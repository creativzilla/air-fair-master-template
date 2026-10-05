// Request handlers for the form-submit Edge Function. Storage and email are
// passed in (see Store / Mailer), so the same logic runs in production and in
// the local tests with in-memory fakes.
import { deriveIdentifiers, humanizeSlug, itemRefFromFormId, type ServiceType } from "./identifiers.ts";
import { isBot, isValidEmail, normalizeEmail, validateSubmission, type Guard } from "./validate.ts";
import { envelope, SENDER, staffInboxFor, type EmailSettings } from "./routing.ts";
import {
  DEFAULT_AUTO_REPLIES, renderAutoReply, renderNewsletterConfirmation, renderStaffEmail, TEMPLATE_LIMITS, unknownVariables,
  type Answer, type AutoReplyTemplate,
} from "./templates.ts";
import { isToken } from "./tokens.ts";
import { checkSubmission, fileProblem, formatAnswer, inputFields, normalizeSchema, type FormSchema } from "./schema.ts";
import type { Mailer } from "./resend.ts";

export type OutboxKind = "staff_notification" | "client_confirmation" | "newsletter_confirmation" | "test_email";
export type OutboxStatus = "pending" | "sending" | "retry" | "sent" | "failed" | "skipped";

export interface OutboxDraft {
  dedupe_key: string;
  kind: OutboxKind;
  submission_id: string | null;
  subscriber_id: string | null;
  service_type: ServiceType | "newsletter";
  form_id: string;
  to_email: string;
  reply_to: string | null;
  subject: string;
  html: string;
  body_text: string;
  status: "pending" | "skipped";
  last_error: string | null;
  template_ref?: string | null; // which auto-reply template was used, e.g. "form:travel-inquiry-bali-indonesia"
}

export interface OutboxRow extends Omit<OutboxDraft, "status"> {
  id: string;
  status: OutboxStatus;
  attempts: number;
  next_attempt_at: string;
  locked_until: string | null;
  provider_message_id: string | null;
  sent_at: string | null;
  created_at: string;
}

export interface Subscriber {
  id: string;
  email: string;
  confirmed_at: string | null;
  unsubscribed_at: string | null;
  confirm_expires_at: string | null;
  confirmation_sent_at: string | null;
}

// A row of public.email_templates (client auto-reply).
export interface TemplateRow {
  id?: string;
  service_type: ServiceType;
  form_id: string | null;
  enabled: boolean;
  subject: string;
  body: string;
}

export interface Store {
  getEmailSettings(): Promise<EmailSettings>;
  // The category default (form_id null) and the override for this form, if any.
  getAutoReplyTemplates(serviceType: ServiceType, formId: string): Promise<{ serviceDefault: TemplateRow | null; formOverride: TemplateRow | null }>;
  getBusinessName(): Promise<string>;
  // The live (published) form: content plus the version it came from.
  getPublishedForm(formKey: string): Promise<{ content: Record<string, unknown>; versionId: string | null } | null>;
  // Size and type of an uploaded attachment, as stored (not as claimed by the browser).
  getAttachmentInfo(path: string): Promise<{ size: number; type: string } | null>;
  getItemName(kind: string, slug: string): Promise<string | null>;
  rateLimitHit(bucket: string, keyHash: string, windowSeconds: number, max: number): Promise<boolean>;
  insertSubmission(row: Record<string, unknown>): Promise<{ inserted: boolean; createdAt: string }>;
  findRecentSubmission(email: string, formId: string, sinceIso: string, excludeId: string): Promise<boolean>;
  countRecentEmails(kind: OutboxKind, toEmail: string, sinceIso: string): Promise<number>;
  insertOutbox(drafts: OutboxDraft[]): Promise<OutboxRow[]>; // returns only newly inserted rows
  claimOutbox(ids: string[] | null, limit: number): Promise<OutboxRow[]>;
  updateOutbox(id: string, patch: Partial<OutboxRow>): Promise<void>;
  resetFailedOutbox(): Promise<number>;
  findSubscriberByEmail(email: string): Promise<Subscriber | null>;
  insertSubscriber(row: Record<string, unknown>): Promise<Subscriber>;
  updateSubscriber(id: string, patch: Record<string, unknown>): Promise<void>;
  findSubscriberByTokenHash(column: "confirm_token_hash" | "unsubscribe_token_hash", hash: string): Promise<Subscriber | null>;
}

export interface Deps {
  store: Store;
  mailer: Mailer;
  now: () => Date;
  siteUrl: string;
  hash: (value: string) => Promise<string>;
  randomToken: () => string;
  // Runs background work (sending) after the response; tests just await it.
  defer: (work: Promise<unknown>) => Promise<void> | void;
}

export interface Reply {
  status: number;
  body: Record<string, unknown>;
}

export const MAX_ATTEMPTS = 5;
export const BACKOFF_MINUTES = [1, 5, 15, 60, 360];
export const RATE_LIMITS = {
  formPerIp10Min: 5,
  formPerIpDay: 30,
  newsletterPerIpHour: 5,
  clientConfirmationsPerAddressDay: 3,
  newsletterEmailsPerAddressDay: 3,
  duplicateWindowMinutes: 10,
  newsletterResendMinutes: 10,
  processDuePerIpHour: 120, // the 5-minute schedule uses 12
  templateTestsPerAdminHour: 10,
};

// Technical keys the website stores in raw_data; not shown as answers.
const META_KEYS = new Set([
  "service_id", "service_slug", "service_name", "service_category", "country_name", "country_slug", "visa_type",
  "package_name", "package_slug", "source_page", "submitted_at", "attachment_upload_failed", "form_id", "service_type", "source",
  "agreed_to_privacy_policy", "fullName", "name", "email", "phone", "mapped_service", "mapped_message",
]);

const ok = (body: Record<string, unknown> = {}): Reply => ({ status: 200, body: { ok: true, ...body } });
const fail = (status: number, error: string): Reply => ({ status, body: { ok: false, error } });
const minutesAgo = (now: Date, minutes: number) => new Date(now.getTime() - minutes * 60_000).toISOString();

export const referenceFor = (id: string) => `AF-${id.replace(/-/g, "").slice(0, 6).toUpperCase()}`;

function formFields(content: Record<string, unknown>) {
  return inputFields(normalizeSchema(content as FormSchema)).filter(f => typeof f.name === "string");
}

function displayValue(value: unknown, options?: unknown): string {
  const optionLabel = (v: unknown) => {
    if (!Array.isArray(options)) return String(v);
    const match = options.find(o => o && typeof o === "object" && (o as { value?: unknown }).value === v) as { label?: string } | undefined;
    return match?.label ?? String(v);
  };
  if (value === true) return "Yes";
  if (value === false) return "No";
  if (Array.isArray(value)) return value.map(optionLabel).join(", ");
  return optionLabel(value ?? "").slice(0, 2000);
}

// Answers for the staff email, labelled from the published form. Fields marked
// sensitive and file uploads (which are private) are left out; the email only
// says how many files were attached.
export function buildAnswers(rawData: Record<string, unknown>, content: Record<string, unknown>): Answer[] {
  const fields = formFields(content);
  const seen = new Set<string>();
  const answers: Answer[] = [];
  for (const field of fields) {
    const name = field.name as string;
    seen.add(name);
    if (META_KEYS.has(name) || field.sensitive || field.type === "file") continue;
    const value = rawData[name];
    if (value === undefined || value === null || value === "") continue;
    const shown = typeof value === "object" && !Array.isArray(value) ? formatAnswer(field, value) : displayValue(value, field.options);
    if (shown) answers.push({ label: field.label || humanizeSlug(name), value: shown.slice(0, 2000) });
  }
  for (const [key, value] of Object.entries(rawData)) {
    if (seen.has(key) || META_KEYS.has(key) || value === undefined || value === null || value === "") continue;
    answers.push({ label: humanizeSlug(key.replace(/_/g, "-").replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase()), value: displayValue(value) });
  }
  if (rawData.agreed_to_privacy_policy === true) answers.push({ label: "Privacy Policy", value: "Agreed" });
  return answers;
}

// Which auto-reply to send: an enabled form override wins; otherwise the
// category default (if it is switched off, no auto-reply); if the default row
// doesn't exist yet, the built-in copy. A new form or package has no override,
// so it automatically uses its category's default.
export function pickAutoReply(serviceType: ServiceType, rows: { serviceDefault: TemplateRow | null; formOverride: TemplateRow | null }, formId: string):
  { template: AutoReplyTemplate; ref: string } | { template: null; ref: string } {
  if (rows.formOverride?.enabled) return { template: rows.formOverride, ref: `form:${formId}` };
  if (rows.serviceDefault) return rows.serviceDefault.enabled ? { template: rows.serviceDefault, ref: `default:${serviceType}` } : { template: null, ref: `default:${serviceType}` };
  return { template: DEFAULT_AUTO_REPLIES[serviceType], ref: `builtin:${serviceType}` };
}

// ---------------------------------------------------------------------------
// Queue processing (shared by every entry point)
// ---------------------------------------------------------------------------
export async function processOutbox(deps: Deps, opts: { ids?: string[] | null; limit?: number } = {}) {
  const { store, mailer, now } = deps;
  const settings = await store.getEmailSettings();
  const claimed = await store.claimOutbox(opts.ids ?? null, opts.limit ?? 10);
  const summary = { sent: 0, retry: 0, failed: 0, skipped: 0 };
  for (const row of claimed) {
    // Template tests go only to a configured staff inbox, so they are allowed
    // before customer sending is switched on.
    if (!settings.sending_enabled && row.kind !== "test_email") {
      await store.updateOutbox(row.id, { status: "skipped", last_error: "Email sending is turned off in Form Emails.", locked_until: null });
      summary.skipped++;
      continue;
    }
    // A quota delay must not extend ambiguous retries beyond provider duplicate
    // protection. created_at is a conservative lower bound on first send time.
    if (row.attempts > 1 && now().getTime()-Date.parse(row.created_at) > 23*3600000) {
      await store.updateOutbox(row.id,{status:'failed',last_error:'Delivery outcome requires review: duplicate-protection window expired. Check the provider before retrying.',locked_until:null});
      summary.failed++; continue;
    }
    const result = await mailer.send(
      { from: SENDER, to: row.to_email, replyTo: row.reply_to, subject: row.subject, html: row.html, text: row.body_text, tags: { kind: row.kind, service_type: row.service_type ?? "general" } },
      row.id,
    );
    if (result.ok) {
      await store.updateOutbox(row.id, { status: "sent", sent_at: now().toISOString(), provider_message_id: result.id, last_error: null, locked_until: null });
      summary.sent++;
    } else if (result.budgetBlocked) {
      await store.updateOutbox(row.id, { status: 'retry', attempts: Math.max(0,row.attempts-1),
        next_attempt_at: new Date(now().getTime()+3600000).toISOString(), last_error: result.error, locked_until:null });
      summary.retry++;
    } else if (result.retryable && row.attempts < MAX_ATTEMPTS) {
      const wait = BACKOFF_MINUTES[Math.min(row.attempts - 1, BACKOFF_MINUTES.length - 1)];
      await store.updateOutbox(row.id, { status: "retry", next_attempt_at: new Date(now().getTime() + wait * 60_000).toISOString(), last_error: result.error, locked_until: null });
      summary.retry++;
    } else {
      await store.updateOutbox(row.id, { status: "failed", last_error: result.error, locked_until: null });
      summary.failed++;
    }
  }
  return summary;
}

// Send the new emails, then give a few overdue retries a chance too.
async function sendNow(deps: Deps, ids: string[]) {
  if (ids.length) await processOutbox(deps, { ids, limit: ids.length });
  await processOutbox(deps, { ids: null, limit: 3 });
}

async function clientIp(deps: Deps, ip: string | null) {
  return deps.hash(`ip:${ip || "unknown"}`);
}

// ---------------------------------------------------------------------------
// Website forms
// ---------------------------------------------------------------------------
export async function handleSubmitForm(deps: Deps, body: { submission?: unknown; guard?: Guard }, ctx: { ip: string | null }): Promise<Reply> {
  const { store, now } = deps;
  // Bots get a normal-looking success and nothing is saved or sent.
  if (isBot(body.guard)) return ok();

  const ipKey = await clientIp(deps, ctx.ip);
  const withinShort = await store.rateLimitHit("form_ip_10m", ipKey, 600, RATE_LIMITS.formPerIp10Min);
  const withinDay = withinShort && (await store.rateLimitHit("form_ip_day", ipKey, 86_400, RATE_LIMITS.formPerIpDay));
  if (!withinShort || !withinDay) return fail(429, "Too many submissions from this connection. Please try again later or contact us directly.");

  const checked = validateSubmission(body.submission);
  if (!checked.ok) return fail(400, checked.error);
  const s = checked.value;

  const form = await store.getPublishedForm(s.form_key);
  if (!form) return fail(400, "This form is not available.");

  // Check every answer against the PUBLISHED form (types, required, choices,
  // conditions, files). Browser-supplied field definitions are never used.
  const schema = normalizeSchema(form.content as FormSchema);
  const result = checkSubmission(schema, s.raw_data, s.attachments);
  if (result.unknownKeys.length) return fail(400, "This form was updated. Please reload the page and fill it in again.");
  if (!result.ok) {
    const fields = inputFields(schema);
    const [key, message] = Object.entries(result.errors)[0];
    const label = fields.find(f => f.name === key)?.label || key;
    return { status: 400, body: { ok: false, error: `${label}: ${message}`, fields: result.errors } };
  }
  // Uploaded files: size and type as actually stored, against the field's rules.
  for (const a of s.attachments) {
    const info = await store.getAttachmentInfo(a.path);
    if (!info) return fail(400, "An attached file couldn't be found. Please attach it again.");
    const field = inputFields(schema).find(f => f.name === a.field);
    const problem = field && fileProblem(field, { name: a.name, size: info.size, type: info.type });
    if (problem) return fail(400, `${field?.label || a.field}: ${problem}`);
    a.size = info.size;
    a.type = info.type;
  }

  // Contact details: fields mapped in the Studio win; otherwise the usual keys.
  const v = result.values;
  const email = result.mapped.email || (typeof v.email === "string" ? v.email : "") || s.email;
  if (!isValidEmail(email)) return fail(400, "Please enter a valid email address.");
  const name = (result.mapped.fullName || String(v.fullName ?? v.name ?? "") || s.name).slice(0, 200);
  const phone = (result.mapped.phone || String(v.phone ?? "") || s.phone).slice(0, 60);

  // Identifiers, routing and template all come from the server's own derivation.
  const { formId, serviceType } = deriveIdentifiers(s.form_type, s.form_key);
  const rawData: Record<string, unknown> = {
    ...result.values, ...result.context, form_id: formId, service_type: serviceType, source: s.source_page, source_page: s.source_page,
  };
  if (result.mapped.service) rawData.mapped_service = result.mapped.service.slice(0, 300);
  if (result.mapped.message) rawData.mapped_message = result.mapped.message.slice(0, 5000);
  const { inserted, createdAt } = await store.insertSubmission({
    id: s.id, form_type: s.form_type, form_key: s.form_key, document_id: s.document_id, form_version_id: form.versionId,
    source_page: s.source_page, attachments: s.attachments, name, email: normalizeEmail(email), phone, raw_data: rawData,
    answers: result.answers, form_id: formId, service_type: serviceType, source: s.source_page,
  });

  const drafts = await planFormEmails(deps, {
    id: s.id, createdAt, formId, serviceType, rawData, content: form.content,
    name, email: normalizeEmail(email), phone, sourcePage: s.source_page, attachmentsCount: s.attachments.length,
  });
  // Same submission id again (browser retry): the dedupe keys already exist,
  // so no new emails are queued.
  const created = await store.insertOutbox(drafts);
  const toSend = created.filter(row => row.status === "pending").map(row => row.id);
  await deps.defer(sendNow(deps, toSend));
  return ok({ id: s.id, saved: inserted ? "new" : "existing" });
}

export async function planFormEmails(deps: Deps, sub: {
  id: string; createdAt: string; formId: string; serviceType: ServiceType; rawData: Record<string, unknown>; content: Record<string, unknown>;
  name: string; email: string; phone: string; sourcePage: string; attachmentsCount: number;
}): Promise<OutboxDraft[]> {
  const { store, now, siteUrl } = deps;
  const settings = await store.getEmailSettings();
  const staffInbox = staffInboxFor(settings, sub.serviceType);
  const ref = itemRefFromFormId(sub.formId);
  const itemName = ref
    ? (await store.getItemName(ref.kind, ref.slug)) || String(sub.rawData.service_name || sub.rawData.country_name || sub.rawData.package_name || "") || humanizeSlug(ref.slug)
    : null;
  const businessName = await store.getBusinessName();
  const clientEmail = normalizeEmail(sub.email);
  const possibleDuplicate = await store.findRecentSubmission(clientEmail, sub.formId, minutesAgo(now(), RATE_LIMITS.duplicateWindowMinutes), sub.id);

  const baseContext = {
    serviceType: sub.serviceType, formId: sub.formId, itemName, reference: referenceFor(sub.id),
    customerName: sub.name, customerEmail: clientEmail, customerPhone: sub.phone,
    submittedAt: new Date(sub.createdAt || now().toISOString()), pageUrl: `${siteUrl}${sub.sourcePage}`, dashboardUrl: `${siteUrl}/dashboard`,
    answers: buildAnswers(sub.rawData, sub.content), attachmentsCount: sub.attachmentsCount, businessName, possibleDuplicate,
  };
  const configProblem = !settings.sending_enabled ? "Email sending is turned off in Form Emails." : !staffInbox ? "No staff inbox is set in Form Emails." : null;

  // Staff notification: to the monitored inbox for this service type; Reply-To the client.
  const staffEnv = envelope(settings, staffInbox ?? "not-configured", isValidEmail(clientEmail) ? clientEmail : null);
  const staff = renderStaffEmail({ ...baseContext, redirectedFrom: staffEnv.redirectedFrom });

  // Client confirmation (auto-reply): only to the address typed in the form;
  // Reply-To the monitored inbox. Content from the dashboard template.
  const autoReply = pickAutoReply(sub.serviceType, await store.getAutoReplyTemplates(sub.serviceType, sub.formId), sub.formId);
  let clientProblem = configProblem;
  if (!clientProblem && !autoReply.template) clientProblem = "Auto-reply is turned off for this category in Form Emails.";
  if (!clientProblem && possibleDuplicate) clientProblem = "Same person sent this form in the last 10 minutes; confirmation not repeated.";
  if (!clientProblem) {
    const recent = await store.countRecentEmails("client_confirmation", clientEmail, minutesAgo(now(), 24 * 60));
    if (recent >= RATE_LIMITS.clientConfirmationsPerAddressDay) clientProblem = "Daily limit of confirmations for this address reached.";
  }
  const clientEnv = envelope(settings, clientEmail, staffInbox);
  const client = renderAutoReply(autoReply.template ?? DEFAULT_AUTO_REPLIES[sub.serviceType], {
    serviceType: sub.serviceType, itemName, reference: baseContext.reference, customerName: sub.name, submittedAt: baseContext.submittedAt,
    businessName, replyEmail: staffInbox, redirectedFrom: clientEnv.redirectedFrom,
  });

  const common = { submission_id: sub.id, subscriber_id: null, service_type: sub.serviceType, form_id: sub.formId } as const;
  return [
    { ...common, dedupe_key: `form:${sub.id}:staff`, kind: "staff_notification", to_email: staffEnv.to, reply_to: staffEnv.replyTo,
      subject: staffEnv.subjectPrefix + staff.subject, html: staff.html, body_text: staff.text,
      status: configProblem ? "skipped" : "pending", last_error: configProblem },
    { ...common, dedupe_key: `form:${sub.id}:client`, kind: "client_confirmation", to_email: clientEnv.to, reply_to: clientEnv.replyTo,
      subject: clientEnv.subjectPrefix + client.subject, html: client.html, body_text: client.text,
      status: clientProblem ? "skipped" : "pending", last_error: clientProblem, template_ref: autoReply.ref },
  ];
}

// ---------------------------------------------------------------------------
// Newsletter (separate from inquiries): double opt-in
// ---------------------------------------------------------------------------
export async function handleNewsletterSubscribe(deps: Deps, body: { email?: unknown; source_page?: unknown; guard?: Guard }, ctx: { ip: string | null }): Promise<Reply> {
  const { store, now, siteUrl } = deps;
  if (isBot(body.guard)) return ok({ status: "check_email" });
  const ipKey = await clientIp(deps, ctx.ip);
  if (!(await store.rateLimitHit("newsletter_ip_hour", ipKey, 3600, RATE_LIMITS.newsletterPerIpHour))) {
    return fail(429, "Too many requests from this connection. Please try again later.");
  }
  if (!isValidEmail(body.email)) return fail(400, "Please enter a valid email address.");
  const email = normalizeEmail(body.email as string);
  const sourcePage = typeof body.source_page === "string" && /^\/[\w\-./~%]*$/.test(body.source_page) ? body.source_page.slice(0, 300) : "/";

  // Same answer whatever the state, so the form can't reveal who is subscribed.
  const generic = ok({ status: "check_email" });
  let subscriber = await store.findSubscriberByEmail(email);
  if (subscriber?.confirmed_at && !subscriber.unsubscribed_at) return generic;
  if (subscriber?.confirmation_sent_at && new Date(subscriber.confirmation_sent_at) > new Date(minutesAgo(now(), RATE_LIMITS.newsletterResendMinutes))) return generic;
  if ((await store.countRecentEmails("newsletter_confirmation", email, minutesAgo(now(), 24 * 60))) >= RATE_LIMITS.newsletterEmailsPerAddressDay) return generic;

  const confirmToken = deps.randomToken();
  const unsubscribeToken = deps.randomToken();
  const tokenFields = {
    confirm_token_hash: await deps.hash(confirmToken),
    confirm_expires_at: new Date(now().getTime() + 7 * 24 * 3600_000).toISOString(),
    confirmation_sent_at: now().toISOString(),
    unsubscribe_token_hash: await deps.hash(unsubscribeToken),
  };
  if (subscriber) await store.updateSubscriber(subscriber.id, tokenFields);
  else subscriber = await store.insertSubscriber({ email, source_page: sourcePage, source: sourcePage, ...tokenFields });

  const settings = await store.getEmailSettings();
  const env = envelope(settings, email, staffInboxFor(settings, "newsletter"));
  const rendered = renderNewsletterConfirmation({
    businessName: await store.getBusinessName(),
    confirmUrl: `${siteUrl}/newsletter/confirm?token=${confirmToken}`,
    unsubscribeUrl: `${siteUrl}/newsletter/unsubscribe?token=${unsubscribeToken}`,
    redirectedFrom: env.redirectedFrom,
  });
  const problem = settings.sending_enabled ? null : "Email sending is turned off in Form Emails.";
  const created = await store.insertOutbox([{
    dedupe_key: `newsletter:${subscriber.id}:${tokenFields.confirm_token_hash.slice(0, 16)}`, kind: "newsletter_confirmation",
    submission_id: null, subscriber_id: subscriber.id, service_type: "newsletter", form_id: "newsletter-footer",
    to_email: env.to, reply_to: env.replyTo, subject: env.subjectPrefix + rendered.subject, html: rendered.html, body_text: rendered.text,
    status: problem ? "skipped" : "pending", last_error: problem,
  }]);
  await deps.defer(sendNow(deps, created.filter(r => r.status === "pending").map(r => r.id)));
  return generic;
}

export async function handleNewsletterConfirm(deps: Deps, body: { token?: unknown }): Promise<Reply> {
  if (!isToken(body.token)) return fail(400, "This confirmation link is not valid.");
  const subscriber = await deps.store.findSubscriberByTokenHash("confirm_token_hash", await deps.hash(body.token));
  if (!subscriber) return fail(400, "This confirmation link is not valid.");
  if (subscriber.confirmed_at && !subscriber.unsubscribed_at) return ok({ status: "already_confirmed" });
  if (!subscriber.confirm_expires_at || new Date(subscriber.confirm_expires_at) < deps.now()) return fail(400, "This confirmation link has expired. Please sign up again.");
  await deps.store.updateSubscriber(subscriber.id, { confirmed_at: deps.now().toISOString(), unsubscribed_at: null });
  return ok({ status: "confirmed" });
}

export async function handleNewsletterUnsubscribe(deps: Deps, body: { token?: unknown }): Promise<Reply> {
  if (!isToken(body.token)) return fail(400, "This unsubscribe link is not valid.");
  const subscriber = await deps.store.findSubscriberByTokenHash("unsubscribe_token_hash", await deps.hash(body.token));
  if (!subscriber) return fail(400, "This unsubscribe link is not valid.");
  if (!subscriber.unsubscribed_at) await deps.store.updateSubscriber(subscriber.id, { unsubscribed_at: deps.now().toISOString() });
  return ok({ status: "unsubscribed" });
}

// ---------------------------------------------------------------------------
// Scheduled retries (called every 5 minutes by pg_cron via pg_net). Public on
// purpose: it only sends emails that are already queued and due, never resets
// failures, and can't choose content or recipients. Rate limited per caller.
// ---------------------------------------------------------------------------
export async function handleProcessDue(deps: Deps, ctx: { ip: string | null }): Promise<Reply> {
  const ipKey = await clientIp(deps, ctx.ip);
  if (!(await deps.store.rateLimitHit("process_due_ip", ipKey, 3600, RATE_LIMITS.processDuePerIpHour))) return fail(429, "Too many requests.");
  const summary = await processOutbox(deps, { ids: null, limit: 20 });
  return ok(summary);
}

// ---------------------------------------------------------------------------
// Dashboard > Form Emails: send a test of an auto-reply (admin only). The
// recipient must be one of the inboxes already configured in email_settings,
// so this can never email a client or an arbitrary address.
// ---------------------------------------------------------------------------
const SAMPLE_ITEMS: Record<ServiceType, string> = {
  general: "", immigration: "Pre-Arranged Working Visa (9G)", visa: "Japan Tourist Visa", travel: "Bali, Indonesia",
};

export function authorizedTestInboxes(settings: EmailSettings): string[] {
  return [...new Set([settings.staff_inbox, settings.inbox_general, settings.inbox_immigration, settings.inbox_visa, settings.inbox_travel, settings.test_redirect_to]
    .filter(isValidEmail).map(e => normalizeEmail(e as string)))];
}

export async function handleSendTemplateTest(deps: Deps, body: { service_type?: unknown; form_id?: unknown; subject?: unknown; body?: unknown; to?: unknown }, caller: { id: string; role: string } | null): Promise<Reply> {
  const { store, now } = deps;
  if (caller?.role !== "admin") return fail(403, "Only admins can send test emails.");
  const serviceType = body.service_type as ServiceType;
  if (!["general", "immigration", "visa", "travel"].includes(serviceType)) return fail(400, "Choose a category.");
  const formId = typeof body.form_id === "string" && body.form_id ? body.form_id : null;
  if (formId && !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(formId)) return fail(400, "Invalid form.");
  const template = { subject: String(body.subject ?? ""), body: String(body.body ?? "") };
  if (!template.subject.trim() || !template.body.trim()) return fail(400, "Enter a subject and a message.");
  if (template.subject.length > TEMPLATE_LIMITS.subject || template.body.length > TEMPLATE_LIMITS.body) return fail(400, "The subject or message is too long.");
  const unknown = unknownVariables(template.subject + " " + template.body);
  if (unknown.length) return fail(400, `Unknown variable(s): ${unknown.map(v => `{{${v}}}`).join(", ")}`);

  const settings = await store.getEmailSettings();
  const to = typeof body.to === "string" ? normalizeEmail(body.to) : "";
  if (!authorizedTestInboxes(settings).includes(to)) return fail(400, "Tests can only be sent to an inbox configured in Form Emails.");
  if (!(await store.rateLimitHit("template_test_admin", await deps.hash(`user:${caller.id}`), 3600, RATE_LIMITS.templateTestsPerAdminHour))) {
    return fail(429, "Too many test emails. Try again later.");
  }

  const ref = formId ? itemRefFromFormId(formId) : null;
  const itemName = ref ? (await store.getItemName(ref.kind, ref.slug)) || humanizeSlug(ref.slug) : SAMPLE_ITEMS[serviceType] || null;
  const rendered = renderAutoReply(template, {
    serviceType, itemName, reference: "AF-TEST01", customerName: "Maria Santos", submittedAt: now(),
    businessName: await store.getBusinessName(), replyEmail: staffInboxFor(settings, serviceType), redirectedFrom: null,
  });
  const created = await store.insertOutbox([{
    dedupe_key: `test:${deps.randomToken().slice(0, 24)}`, kind: "test_email", submission_id: null, subscriber_id: null,
    service_type: serviceType, form_id: formId ?? `default-${serviceType}`, to_email: to, reply_to: null,
    subject: `[TEST] ${rendered.subject}`.slice(0, 300), html: rendered.html, body_text: rendered.text,
    status: "pending", last_error: null, template_ref: formId ? `test:form:${formId}` : `test:default:${serviceType}`,
  }]);
  const summary = await processOutbox(deps, { ids: created.map(r => r.id), limit: 1 });
  return summary.sent ? ok({ status: "sent" }) : ok({ status: summary.retry ? "queued_for_retry" : "not_sent" });
}

// ---------------------------------------------------------------------------
// Dashboard: send due retries now (admin / editor only; checked by caller)
// ---------------------------------------------------------------------------
export async function handleProcessOutbox(deps: Deps, body: { retry_failed?: unknown }, callerRole: string | null): Promise<Reply> {
  if (callerRole !== "admin" && callerRole !== "editor") return fail(403, "Only admins and editors can resend emails.");
  const reset = body.retry_failed === true ? await deps.store.resetFailedOutbox() : 0;
  const summary = await processOutbox(deps, { ids: null, limit: 25 });
  return ok({ reset, ...summary });
}
