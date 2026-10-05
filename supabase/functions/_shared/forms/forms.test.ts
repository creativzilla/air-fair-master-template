// Local tests for the form email flow. Run: npm run test:email
// Uses an in-memory store and a fake mailer: nothing is saved to Supabase and
// no email is sent.
import { test } from "node:test";
import assert from "node:assert/strict";
import { deriveIdentifiers, itemRefFromFormId } from "./identifiers.ts";
import { DEFAULT_SETTINGS, SENDER, staffInboxFor, type EmailSettings } from "./routing.ts";
import {
  handleNewsletterConfirm, handleNewsletterSubscribe, handleNewsletterUnsubscribe, handleProcessDue, handleProcessOutbox, handleSendTemplateTest, handleSubmitForm, processOutbox,
  MAX_ATTEMPTS, type Deps, type OutboxDraft, type OutboxRow, type Store, type Subscriber, type TemplateRow,
} from "./handlers.ts";
import { createResendMailer, type OutgoingEmail, type SendResult } from "./resend.ts";
import { randomToken, sha256Hex } from "./tokens.ts";
import { DEFAULT_AUTO_REPLIES, renderAutoReply, safeFirstName, unknownVariables } from "./templates.ts";

// ---------------------------------------------------------------------------
// Fakes
// ---------------------------------------------------------------------------
const CONFIGURED: EmailSettings = {
  ...DEFAULT_SETTINGS, sending_enabled: true, staff_inbox: "inbox@example.test",
  inbox_travel: "travel-desk@example.test", inbox_visa: null, inbox_immigration: "immigration-desk@example.test", inbox_general: null,
};

const FORMS: Record<string, Record<string, unknown>> = {
  "website-contact": { fields: [{ name: "name", label: "Name" }, { name: "email", label: "Email" }, { name: "message", label: "Message" }] },
  "visa-inquiry": { fields: [{ name: "fullName", label: "Full name" }, { name: "travelDate", label: "Travel date" }, { name: "travelers", label: "Travelers", options: [{ value: "2", label: "2 travelers" }] }] },
  "travel-inquiry": { fields: [{ name: "fullName", label: "Full name" }, { name: "packageType", label: "Package type" }] },
  "immigration-9g-working-visa": { sections: [{ fields: [{ name: "fullName", label: "Full name" }, { name: "companyName", label: "Company name" }, { name: "hasEmployer", label: "Has employer" }] }] },
};
// A form built in the Form Studio: ids, a two-column row, mapped contact fields,
// a conditional file upload, a sensitive field and design elements.
FORMS["studio-form"] = {
  schemaVersion: 2, title: "Studio form",
  sections: [{ id: "s1", title: "", fields: [
    { id: "h", type: "heading", text: "About you" },
    { id: "r", type: "row", columns: 2, children: [
      [{ id: "f_who", type: "text", name: "clientName", label: "Your name", required: true, mapTo: "fullName" }],
      [{ id: "f_mail", type: "email", name: "contactEmail", label: "Email address", required: true, mapTo: "email" }],
    ] },
    { id: "f_svc", type: "select", name: "service", label: "Service", required: true, options: [{ label: "Visa help", value: "visa" }, { label: "Tours", value: "tour" }], mapTo: "service" },
    { id: "f_doc", type: "file", name: "passport", label: "Passport copy", required: true, file: { accept: [".pdf"], maxMB: 2 }, showWhen: { fieldId: "f_svc", equals: "visa" } },
    { id: "f_pass", type: "text", name: "passportNumber", label: "Passport number", sensitive: true },
    { id: "f_msg", type: "textarea", name: "notes", label: "Message", mapTo: "message" },
  ] }],
};

const ITEMS: Record<string, string> = {
  "travel_package:bali-indonesia": "Bali, Indonesia",
  "visa_destination:japan": "Japan Tourist Visa",
  "immigration_service:9g-working-visa": "Pre-Arranged Working Visa (9G)",
};

class Clock {
  t = new Date("2026-09-28T02:00:00Z").getTime();
  now = () => new Date(this.t);
  advance(minutes: number) { this.t += minutes * 60_000; }
}

class MemoryStore implements Store {
  settings: EmailSettings = { ...CONFIGURED };
  submissions: Array<Record<string, unknown>> = [];
  outbox: OutboxRow[] = [];
  subscribers: Array<Subscriber & Record<string, unknown>> = [];
  rate: Array<{ bucket: string; key: string; at: number }> = [];
  templates: TemplateRow[] = [];
  clock: Clock;
  constructor(clock: Clock) { this.clock = clock; }
  async getEmailSettings() { return { ...this.settings }; }
  async getAutoReplyTemplates(serviceType: string, formId: string) {
    return {
      serviceDefault: this.templates.find(t => t.service_type === serviceType && t.form_id === null) ?? null,
      formOverride: this.templates.find(t => t.form_id === formId) ?? null,
    };
  }
  async getBusinessName() { return "Air Fair Travel & Immigration"; }
  attachmentInfo: Record<string, { size: number; type: string }> = {};
  async getPublishedForm(key: string) { return FORMS[key] ? { content: FORMS[key], versionId: "00000000-0000-4000-8000-0000000000v1".replace("v1", "01") } : null; }
  async getAttachmentInfo(path: string) { return this.attachmentInfo[path] ?? null; }
  async getItemName(kind: string, slug: string) { return ITEMS[`${kind}:${slug}`] ?? null; }
  async rateLimitHit(bucket: string, key: string, windowSeconds: number, max: number) {
    const since = this.clock.t - windowSeconds * 1000;
    if (this.rate.filter(r => r.bucket === bucket && r.key === key && r.at > since).length >= max) return false;
    this.rate.push({ bucket, key, at: this.clock.t });
    return true;
  }
  async insertSubmission(row: Record<string, unknown>) {
    const existing = this.submissions.find(s => s.id === row.id);
    if (existing) return { inserted: false, createdAt: existing.created_at as string };
    const created = { ...row, status: "New", created_at: this.clock.now().toISOString() };
    this.submissions.push(created);
    return { inserted: true, createdAt: created.created_at };
  }
  async findRecentSubmission(email: string, formId: string, sinceIso: string, excludeId: string) {
    return this.submissions.some(s => String(s.email).toLowerCase() === email && s.form_id === formId && s.id !== excludeId && String(s.created_at) >= sinceIso);
  }
  async countRecentEmails(kind: string, to: string, sinceIso: string) {
    return this.outbox.filter(o => o.kind === kind && o.to_email === to && o.status !== "skipped" && o.created_at >= sinceIso).length;
  }
  async insertOutbox(drafts: OutboxDraft[]) {
    const created: OutboxRow[] = [];
    for (const d of drafts) {
      if (this.outbox.some(o => o.dedupe_key === d.dedupe_key)) continue; // unique dedupe_key
      const row: OutboxRow = { ...d, id: crypto.randomUUID(), attempts: 0, next_attempt_at: this.clock.now().toISOString(), locked_until: null, provider_message_id: null, sent_at: null, created_at: this.clock.now().toISOString() };
      this.outbox.push(row);
      created.push(row);
    }
    return created.map(r => ({ ...r }));
  }
  // Mirrors claim_email_outbox: atomic, skips rows another run holds.
  async claimOutbox(ids: string[] | null, limit: number) {
    const now = this.clock.now().toISOString();
    const due = this.outbox.filter(o => (!ids || ids.includes(o.id)) &&
      ((["pending", "retry"].includes(o.status) && o.next_attempt_at <= now) || (o.status === "sending" && (o.locked_until ?? "") < now))).slice(0, limit);
    for (const o of due) { o.status = "sending"; o.attempts++; o.locked_until = new Date(this.clock.t + 120_000).toISOString(); }
    return due.map(o => ({ ...o }));
  }
  async updateOutbox(id: string, patch: Partial<OutboxRow>) { Object.assign(this.outbox.find(o => o.id === id)!, patch); }
  async resetFailedOutbox() {
    const failed = this.outbox.filter(o => o.status === "failed");
    failed.forEach(o => { o.status = "retry"; o.attempts = 0; o.next_attempt_at = this.clock.now().toISOString(); });
    return failed.length;
  }
  async findSubscriberByEmail(email: string) { return this.subscribers.find(s => s.email.toLowerCase() === email) ?? null; }
  async insertSubscriber(row: Record<string, unknown>) {
    const sub = { id: crypto.randomUUID(), confirmed_at: null, unsubscribed_at: null, confirm_expires_at: null, confirmation_sent_at: null, ...row } as Subscriber & Record<string, unknown>;
    this.subscribers.push(sub);
    return sub;
  }
  async updateSubscriber(id: string, patch: Record<string, unknown>) { Object.assign(this.subscribers.find(s => s.id === id)!, patch); }
  async findSubscriberByTokenHash(column: string, hash: string) { return this.subscribers.find(s => s[column] === hash) ?? null; }
}

class FakeMailer {
  calls: Array<{ message: OutgoingEmail; key: string }> = [];
  delivered = new Map<string, string>(); // idempotency key -> message id (like Resend)
  script: SendResult[] = [];             // queued failures to return next
  async send(message: OutgoingEmail, key: string): Promise<SendResult> {
    this.calls.push({ message, key });
    const scripted = this.script.shift();
    if (scripted) return scripted;
    if (!this.delivered.has(key)) this.delivered.set(key, `msg_${this.delivered.size + 1}`);
    return { ok: true, id: this.delivered.get(key)! };
  }
}

test('application budget holds emails without burning attempts; delayed uncertain sends require review',async()=>{
  const {deps,store,mailer,clock}=setup();
  mailer.script.push(...Array.from({length:2},()=>({ok:false as const,retryable:true,budgetBlocked:true,error:'Budget reached'})));
  await submit(deps,submission('contact'));
  assert.ok(store.outbox.every(o=>o.status==='retry'&&o.attempts===0));
  clock.advance(25*60);
  await processOutbox(deps);
  assert.ok(store.outbox.every(o=>o.status==='sent'),'never-attempted email may send after budget resets');
  const other=setup();
  other.mailer.script.push(...Array.from({length:2},()=>({ok:false as const,retryable:true,error:'Network timeout'})));
  await submit(other.deps,submission('contact'));
  const calls=other.mailer.calls.length;other.clock.advance(25*60);
  await processOutbox(other.deps);
  assert.equal(other.mailer.calls.length,calls);
  assert.ok(other.store.outbox.every(o=>o.status==='failed'&&o.last_error?.includes('review')));
});

function setup() {
  const clock = new Clock();
  const store = new MemoryStore(clock);
  const mailer = new FakeMailer();
  const tokens: string[] = [];
  const deps: Deps = {
    store, mailer, now: clock.now, siteUrl: "https://airfairtravel.com",
    hash: value => sha256Hex(`test-salt:${value}`),
    randomToken: () => { const t = randomToken(32); tokens.push(t); return t; },
    defer: work => work.then(() => undefined),
  };
  return { clock, store, mailer, deps, tokens };
}

const human = { company_website: "", elapsed_ms: 8000 };
let ipCounter = 0;
const freshIp = () => `203.0.113.${++ipCounter}`;

function submission(kind: "contact" | "visa" | "travel" | "immigration", overrides: Record<string, unknown> = {}) {
  const base = {
    contact: { form_type: "website_inquiry", form_key: "website-contact", source_page: "/", raw_data: { name: "Ana Cruz", email: "ana@example.com", message: "Hello" } },
    visa: { form_type: "visa_japan", form_key: "visa-inquiry", source_page: "/visa-assistance/japan", raw_data: { fullName: "Ana Cruz", travelDate: "2026-12-01", travelers: "2", country_name: "Japan" } },
    travel: { form_type: "travel_package_bali-indonesia", form_key: "travel-inquiry", source_page: "/travel-tours/bali-indonesia", raw_data: { fullName: "Ana Cruz", packageType: "Standard" } },
    immigration: { form_type: "immigration_9g-working-visa", form_key: "immigration-9g-working-visa", source_page: "/philippine-immigration-services/9g-working-visa", raw_data: { fullName: "Ana Cruz", companyName: "Acme", hasEmployer: "yes" } },
  }[kind];
  return { id: crypto.randomUUID(), name: "Ana Cruz", email: "ana@example.com", phone: "+639171234567", attachments: [], document_id: null, form_version_id: null, ...base, ...overrides };
}

const submit = (deps: Deps, sub: Record<string, unknown>, ip = freshIp(), guard: Record<string, unknown> = human) =>
  handleSubmitForm(deps, { submission: sub, guard }, { ip });

// ---------------------------------------------------------------------------
// Identifiers and routing
// ---------------------------------------------------------------------------
test("identifiers match the database derivation", () => {
  assert.deepEqual(deriveIdentifiers("website_inquiry", "website-contact"), { formId: "contact-home", serviceType: "general" });
  assert.deepEqual(deriveIdentifiers("visa_south-korea", "visa-inquiry"), { formId: "visa-inquiry-south-korea", serviceType: "visa" });
  assert.deepEqual(deriveIdentifiers("travel_package_bali-indonesia", "travel-inquiry"), { formId: "travel-inquiry-bali-indonesia", serviceType: "travel" });
  assert.deepEqual(deriveIdentifiers("immigration_9g-working-visa", "immigration-9g-working-visa"), { formId: "immigration-9g-working-visa", serviceType: "immigration" });
  assert.deepEqual(itemRefFromFormId("travel-inquiry-bali-indonesia"), { kind: "travel_package", slug: "bali-indonesia" });
  assert.equal(itemRefFromFormId("contact-home"), null);
});

test("staff inbox: per service type, falling back to the main inbox", () => {
  assert.equal(staffInboxFor(CONFIGURED, "travel"), "travel-desk@example.test");
  assert.equal(staffInboxFor(CONFIGURED, "immigration"), "immigration-desk@example.test");
  assert.equal(staffInboxFor(CONFIGURED, "visa"), "inbox@example.test");
  assert.equal(staffInboxFor(CONFIGURED, "general"), "inbox@example.test");
  assert.equal(staffInboxFor(DEFAULT_SETTINGS, "general"), null);
});

for (const [kind, expectedTo, itemName, subjectPart] of [
  ["contact", "inbox@example.test", null, "New website inquiry"],
  ["visa", "inbox@example.test", "Japan Tourist Visa", "New visa inquiry: Japan Tourist Visa"],
  ["travel", "travel-desk@example.test", "Bali, Indonesia", "New travel inquiry: Bali, Indonesia"],
  ["immigration", "immigration-desk@example.test", "Pre-Arranged Working Visa (9G)", "New immigration assessment: Pre-Arranged Working Visa (9G)"],
] as const) {
  test(`${kind}: one staff notification + one client confirmation, routed by service_type`, async () => {
    const { deps, store, mailer } = setup();
    const reply = await submit(deps, submission(kind));
    assert.equal(reply.status, 200);
    assert.equal(store.submissions.length, 1, "submission saved");
    assert.equal(mailer.calls.length, 2);
    const staff = mailer.calls.find(c => c.message.tags.kind === "staff_notification")!.message;
    const client = mailer.calls.find(c => c.message.tags.kind === "client_confirmation")!.message;
    assert.equal(staff.from, SENDER);
    assert.equal(client.from, SENDER);
    assert.equal(staff.to, expectedTo);
    assert.equal(staff.replyTo, "ana@example.com", "staff can reply straight to the client");
    assert.equal(client.to, "ana@example.com");
    assert.equal(client.replyTo, expectedTo, "client replies go to the monitored inbox");
    assert.ok(staff.subject.startsWith(subjectPart), staff.subject);
    if (itemName) assert.ok(client.subject.includes(itemName), `client subject names the item: ${client.subject}`);
    assert.ok(store.outbox.every(o => o.status === "sent"));
  });
}

test("recipient restrictions: request fields can't choose recipient, sender or template", async () => {
  const { deps, mailer, store } = setup();
  const sub = submission("travel", {
    to: "attacker@evil.test", from: "ceo@airfairtravel.com", template: "immigration", reply_to: "attacker@evil.test",
    raw_data: { fullName: "Ana", form_id: "immigration-evil", service_type: "immigration", source: "/evil" },
  });
  await handleSubmitForm(deps, { submission: sub, guard: human, to: "attacker@evil.test", template: "visa" } as never, { ip: freshIp() });
  const addresses = mailer.calls.flatMap(c => [c.message.to, c.message.replyTo, c.message.from]);
  assert.ok(!addresses.some(a => a?.includes("evil")), "no attacker address used");
  assert.ok(mailer.calls.every(c => c.message.tags.service_type === "travel"), "template chosen by server-derived service_type");
  assert.equal(store.submissions[0].form_id, "travel-inquiry-bali-indonesia");
  assert.equal((store.submissions[0].raw_data as Record<string, unknown>).source, "/travel-tours/bali-indonesia");
});

test("client email never echoes the visitor's free text; HTML is escaped", async () => {
  const { deps, mailer } = setup();
  // The name comes from the form's own name field (server-side), not the browser's name column.
  await submit(deps, submission("contact", { name: "ignored", raw_data: { name: "<script>alert(1)</script> Bob", message: "Buy cheap pills at http://spam.test" } }));
  const client = mailer.calls.find(c => c.message.tags.kind === "client_confirmation")!.message;
  const staff = mailer.calls.find(c => c.message.tags.kind === "staff_notification")!.message;
  assert.ok(!client.html.includes("spam.test") && !client.text.includes("spam.test"));
  assert.ok(!staff.html.includes("<script>"));
  assert.ok(staff.html.includes("&lt;script&gt;"));
});

test("test mode redirects every email to the test inbox and marks it [TEST]", async () => {
  const { deps, store, mailer } = setup();
  store.settings.test_redirect_to = "qa@example.test";
  await submit(deps, submission("visa"));
  assert.ok(mailer.calls.every(c => c.message.to === "qa@example.test"));
  assert.ok(mailer.calls.every(c => c.message.subject.startsWith("[TEST] ")));
});

test("sending switched off / no inbox: submission saved, emails logged as skipped", async () => {
  const { deps, store, mailer } = setup();
  store.settings = { ...DEFAULT_SETTINGS };
  const reply = await submit(deps, submission("contact"));
  assert.equal(reply.status, 200);
  assert.equal(store.submissions.length, 1);
  assert.equal(mailer.calls.length, 0);
  assert.deepEqual(store.outbox.map(o => o.status), ["skipped", "skipped"]);
});

// ---------------------------------------------------------------------------
// Spam protection and validation
// ---------------------------------------------------------------------------
test("honeypot or instant submit: fake success, nothing saved or sent", async () => {
  const { deps, store, mailer } = setup();
  const r1 = await submit(deps, submission("contact"), freshIp(), { company_website: "http://spam.test", elapsed_ms: 9000 });
  const r2 = await submit(deps, submission("contact"), freshIp(), { company_website: "", elapsed_ms: 300 });
  assert.equal(r1.status, 200);
  assert.equal(r2.status, 200);
  assert.equal(store.submissions.length, 0);
  assert.equal(mailer.calls.length, 0);
});

test("rate limit: 6th submission from one connection in 10 minutes is refused", async () => {
  const { deps, store } = setup();
  const ip = freshIp();
  for (let i = 0; i < 5; i++) assert.equal((await submit(deps, submission("contact", { email: `p${i}@example.com` }), ip)).status, 200);
  const sixth = await submit(deps, submission("contact", { email: "p6@example.com" }), ip);
  assert.equal(sixth.status, 429);
  assert.equal(store.submissions.length, 5);
});

test("validation: bad email, unknown form, bad attachment path, oversized data", async () => {
  const { deps, store } = setup();
  assert.equal((await submit(deps, submission("contact", { email: "not-an-email" }))).status, 400);
  assert.equal((await submit(deps, submission("contact", { email: "a@b.com\r\nBcc: x@y.com" }))).status, 400);
  assert.equal((await submit(deps, submission("contact", { form_key: "made-up-form" }))).status, 400);
  assert.equal((await submit(deps, submission("contact", { attachments: [{ field: "doc", path: "../secret.pdf", name: "x", size: 1, type: "x" }] }))).status, 400);
  assert.equal((await submit(deps, submission("contact", { raw_data: { message: "x".repeat(20_000) } }))).status, 400);
  assert.equal((await submit(deps, submission("contact", { id: "not-a-uuid" }))).status, 400);
  assert.equal(store.submissions.length, 0);
});

// ---------------------------------------------------------------------------
// Duplicates and retries
// ---------------------------------------------------------------------------
test("retried request with the same submission id: saved once, emailed once", async () => {
  const { deps, store, mailer } = setup();
  const sub = submission("travel");
  await submit(deps, sub);
  const again = await submit(deps, sub);
  assert.equal(again.status, 200);
  assert.equal(store.submissions.length, 1);
  assert.equal(store.outbox.length, 2);
  assert.equal(mailer.calls.length, 2);
});

test("same person sends the same form twice within 10 minutes: staff flagged, client not re-confirmed", async () => {
  const { deps, store, mailer, clock } = setup();
  await submit(deps, submission("visa"));
  clock.advance(3);
  await submit(deps, submission("visa"));
  const staff = mailer.calls.filter(c => c.message.tags.kind === "staff_notification");
  const client = mailer.calls.filter(c => c.message.tags.kind === "client_confirmation");
  assert.equal(staff.length, 2);
  assert.ok(staff[1].message.subject.startsWith("[Possible duplicate]"));
  assert.equal(client.length, 1);
  assert.equal(store.outbox.filter(o => o.status === "skipped").length, 1);
});

test("client confirmations capped at 3 per address per day", async () => {
  const { deps, mailer, clock } = setup();
  const forms = ["contact", "visa", "travel", "immigration"] as const;
  for (const kind of forms) { await submit(deps, submission(kind)); clock.advance(15); }
  assert.equal(mailer.calls.filter(c => c.message.tags.kind === "client_confirmation").length, 3);
  assert.equal(mailer.calls.filter(c => c.message.tags.kind === "staff_notification").length, 4, "staff still notified");
});

test("temporary failure: retried later with the same idempotency key, sent once", async () => {
  const { deps, store, mailer, clock } = setup();
  mailer.script.push({ ok: false, retryable: true, error: "Resend 503: unavailable" }, { ok: false, retryable: true, error: "Resend 503: unavailable" });
  await submit(deps, submission("travel"));
  const failing = store.outbox.filter(o => o.status === "retry");
  assert.equal(failing.length, 2);
  assert.ok(failing.every(o => o.last_error?.includes("503")));
  // Not due yet: nothing happens.
  await processOutbox(deps, {});
  assert.equal(mailer.calls.length, 2);
  clock.advance(2);
  await processOutbox(deps, {});
  assert.ok(store.outbox.every(o => o.status === "sent"));
  const keysByRow = new Map<string, Set<string>>();
  for (const call of mailer.calls) keysByRow.set(call.key, (keysByRow.get(call.key) ?? new Set()).add(call.key));
  assert.equal(new Set(mailer.calls.map(c => c.key)).size, 2, "one idempotency key per email, reused on retry");
  assert.equal(mailer.delivered.size, 2, "each email delivered exactly once");
});

test("permanent failure is not retried; gives up after the maximum attempts", async () => {
  const { deps, store, mailer, clock } = setup();
  mailer.script.push({ ok: false, retryable: false, error: "Resend 422: invalid to address" });
  await submit(deps, submission("contact"));
  const permanent = store.outbox.find(o => o.status === "failed");
  assert.ok(permanent?.last_error?.includes("422"));
  // Now a row that keeps failing temporarily.
  for (let i = 0; i < 2 * MAX_ATTEMPTS; i++) mailer.script.push({ ok: false, retryable: true, error: "Resend 500" }); // staff + client each fail every time
  await submit(deps, submission("visa", { email: "other@example.com" }));
  for (let i = 0; i < 10; i++) { clock.advance(400); await processOutbox(deps, {}); }
  const gaveUp = store.outbox.filter(o => o.form_id === "visa-inquiry-japan" && o.status === "failed");
  assert.equal(gaveUp.length, 2, "both emails give up");
  assert.ok(gaveUp.every(o => o.attempts === MAX_ATTEMPTS));
});

test("overlapping queue runs never send the same email twice", async () => {
  const { deps, store, mailer } = setup();
  store.settings = { ...CONFIGURED, sending_enabled: false };
  await submit(deps, submission("travel"));
  // Make both rows due, then run two processors at once.
  store.settings = { ...CONFIGURED };
  store.outbox.forEach(o => { o.status = "pending"; o.last_error = null; });
  await Promise.all([processOutbox(deps, {}), processOutbox(deps, {})]);
  assert.equal(mailer.calls.length, 2);
});

test("a run that crashed mid-send is picked up after its lock expires", async () => {
  const { deps, store, mailer, clock } = setup();
  store.settings = { ...CONFIGURED, sending_enabled: false };
  await submit(deps, submission("contact"));
  store.settings = { ...CONFIGURED };
  store.outbox.forEach(o => { o.status = "pending"; });
  await store.claimOutbox(null, 10); // simulate a crash right after claiming
  await processOutbox(deps, {});
  assert.equal(mailer.calls.length, 0, "locked rows are left alone");
  clock.advance(3);
  await processOutbox(deps, {});
  assert.equal(mailer.calls.length, 2);
  assert.ok(store.outbox.every(o => o.status === "sent"));
});

test("dashboard retry: only admins/editors; resets failed emails", async () => {
  const { deps, store, mailer } = setup();
  mailer.script.push({ ok: false, retryable: false, error: "Resend 422" });
  await submit(deps, submission("contact"));
  assert.equal((await handleProcessOutbox(deps, { retry_failed: true }, "staff")).status, 403);
  assert.equal((await handleProcessOutbox(deps, { retry_failed: true }, null)).status, 403);
  const reply = await handleProcessOutbox(deps, { retry_failed: true }, "admin");
  assert.equal(reply.status, 200);
  assert.ok(store.outbox.every(o => o.status === "sent"));
});

// ---------------------------------------------------------------------------
// Newsletter: separate flow, double opt-in
// ---------------------------------------------------------------------------
test("newsletter: confirmation email only; not an inquiry; subscribed after confirming", async () => {
  const { deps, store, mailer, tokens } = setup();
  const reply = await handleNewsletterSubscribe(deps, { email: "Reader@Example.com", source_page: "/news", guard: human }, { ip: freshIp() });
  assert.equal(reply.status, 200);
  assert.equal(store.submissions.length, 0, "no form submission / CRM lead");
  assert.equal(mailer.calls.length, 1);
  const mail = mailer.calls[0].message;
  assert.equal(mail.tags.kind, "newsletter_confirmation");
  assert.equal(mail.to, "reader@example.com");
  assert.ok(!mailer.calls.some(c => c.message.to === "inbox@example.test"), "no staff email for signups");
  const sub = store.subscribers[0];
  assert.equal(sub.confirmed_at, null, "not on the marketing list yet");
  const confirmToken = tokens[0];
  assert.ok(mail.html.includes(`/newsletter/confirm?token=${confirmToken}`));
  assert.equal((await handleNewsletterConfirm(deps, { token: confirmToken })).status, 200);
  assert.ok(store.subscribers[0].confirmed_at);
  assert.equal((await handleNewsletterConfirm(deps, { token: "x".repeat(43) })).status, 400);
});

test("newsletter: expired link refused; resend throttled; confirmed address not re-emailed", async () => {
  const { deps, store, mailer, tokens, clock } = setup();
  await handleNewsletterSubscribe(deps, { email: "a@example.com", guard: human }, { ip: freshIp() });
  await handleNewsletterSubscribe(deps, { email: "a@example.com", guard: human }, { ip: freshIp() });
  assert.equal(mailer.calls.length, 1, "second request within 10 minutes sends nothing");
  clock.advance(8 * 24 * 60);
  assert.equal((await handleNewsletterConfirm(deps, { token: tokens[0] })).status, 400, "expired after 7 days");
  await handleNewsletterSubscribe(deps, { email: "a@example.com", guard: human }, { ip: freshIp() });
  assert.equal(mailer.calls.length, 2, "new link sent");
  assert.equal((await handleNewsletterConfirm(deps, { token: tokens[2] })).status, 200);
  await handleNewsletterSubscribe(deps, { email: "a@example.com", guard: human }, { ip: freshIp() });
  assert.equal(mailer.calls.length, 2, "already confirmed: no email");
  assert.equal(store.subscribers.length, 1);
});

test("newsletter: unsubscribe link works and is idempotent; bots ignored", async () => {
  const { deps, store, mailer, tokens } = setup();
  await handleNewsletterSubscribe(deps, { email: "b@example.com", guard: { company_website: "spam" } }, { ip: freshIp() });
  assert.equal(store.subscribers.length, 0);
  await handleNewsletterSubscribe(deps, { email: "b@example.com", guard: human }, { ip: freshIp() });
  await handleNewsletterConfirm(deps, { token: tokens[0] });
  assert.equal((await handleNewsletterUnsubscribe(deps, { token: tokens[1] })).status, 200);
  assert.ok(store.subscribers[0].unsubscribed_at);
  assert.equal((await handleNewsletterUnsubscribe(deps, { token: tokens[1] })).status, 200);
  assert.equal(mailer.calls.length, 1);
});

// ---------------------------------------------------------------------------
// Resend adapter (fake HTTP, no network)
// ---------------------------------------------------------------------------
const sample: OutgoingEmail = { from: SENDER, to: "ana@example.com", replyTo: "inbox@example.test", subject: "Hi", html: "<p>Hi</p>", text: "Hi", tags: { kind: "client_confirmation", service_type: "travel" } };

test("resend: sends idempotency key, fixed payload shape, never exposes the key", async () => {
  const requests: Array<{ url: string; headers: Record<string, string>; body: string }> = [];
  const mailer = createResendMailer("re_test_key_not_real", async (url, init) => {
    requests.push({ url, headers: init.headers, body: init.body });
    return { ok: true, status: 200, json: async () => ({ id: "email_123" }) };
  });
  const result = await mailer.send(sample, "row-uuid-1");
  assert.deepEqual(result, { ok: true, id: "email_123" });
  assert.equal(requests[0].url, "https://api.resend.com/emails");
  assert.equal(requests[0].headers["Idempotency-Key"], "row-uuid-1");
  const body = JSON.parse(requests[0].body);
  assert.deepEqual(body.to, ["ana@example.com"]);
  assert.deepEqual(body.reply_to, ["inbox@example.test"]);
  assert.ok(!requests[0].body.includes("re_test_key_not_real"), "key only in the Authorization header");
});

test("resend: 429/5xx/network are retryable; 4xx validation errors are not; missing key is reported", async () => {
  const reply = (status: number, data: Record<string, unknown>) => createResendMailer("k", async () => ({ ok: status < 300, status, json: async () => data }));
  assert.equal((await reply(429, { message: "rate limit" }).send(sample, "a") as { retryable: boolean }).retryable, true);
  assert.equal((await reply(503, {}).send(sample, "a") as { retryable: boolean }).retryable, true);
  assert.equal((await reply(422, { message: "invalid to" }).send(sample, "a") as { retryable: boolean }).retryable, false);
  assert.equal((await reply(409, { name: "invalid_idempotent_request" }).send(sample, "a") as { retryable: boolean }).retryable, false);
  assert.equal((await reply(409, { name: "concurrent_idempotent_requests" }).send(sample, "a") as { retryable: boolean }).retryable, true);
  const network = createResendMailer("k", async () => { throw new Error("ECONNRESET"); });
  assert.equal((await network.send(sample, "a") as { retryable: boolean }).retryable, true);
  const noKey = await createResendMailer(undefined, async () => { throw new Error("should not be called"); }).send(sample, "a");
  assert.equal(noKey.ok, false);
  assert.match((noKey as { error: string }).error, /RESEND_API_KEY is not set/);
});

// ---------------------------------------------------------------------------
// Scheduled retries (pg_cron -> process_due)
// ---------------------------------------------------------------------------
test("scheduled run: sends due retries without any visitor activity, only when due", async () => {
  const { deps, store, mailer, clock } = setup();
  mailer.script.push({ ok: false, retryable: true, error: "Resend 503" }, { ok: false, retryable: true, error: "Resend 503" });
  await submit(deps, submission("visa"));
  assert.equal(store.outbox.filter(o => o.status === "retry").length, 2);
  const early = await handleProcessDue(deps, { ip: "10.0.0.1" });
  assert.equal(early.status, 200);
  assert.equal(early.body.sent, 0, "not due yet: nothing sent");
  clock.advance(5); // next cron tick
  const due = await handleProcessDue(deps, { ip: "10.0.0.1" });
  assert.equal(due.body.sent, 2);
  assert.ok(store.outbox.every(o => o.status === "sent"));
  assert.equal(mailer.delivered.size, 2, "each email delivered once");
});

test("scheduled run can't resurrect permanently failed emails (admin-only reset)", async () => {
  const { deps, store, mailer, clock } = setup();
  mailer.script.push({ ok: false, retryable: false, error: "Resend 422" });
  await submit(deps, submission("contact"));
  clock.advance(60);
  await handleProcessDue(deps, { ip: "10.0.0.2" });
  assert.equal(store.outbox.filter(o => o.status === "failed").length, 1);
  assert.equal(mailer.calls.length, 2, "no extra send attempts");
});

test("scheduled run endpoint is rate limited per caller", async () => {
  const { deps } = setup();
  let last;
  for (let i = 0; i < 121; i++) last = await handleProcessDue(deps, { ip: "10.0.0.3" });
  assert.equal(last!.status, 429);
});

// ---------------------------------------------------------------------------
// Dashboard-editable auto-replies (email_templates)
// ---------------------------------------------------------------------------
const seedDefaults = (store: MemoryStore) => {
  store.templates = (Object.keys(DEFAULT_AUTO_REPLIES) as Array<keyof typeof DEFAULT_AUTO_REPLIES>)
    .map(type => ({ service_type: type, form_id: null, enabled: true, ...DEFAULT_AUTO_REPLIES[type] }));
};
const clientMail = (mailer: FakeMailer) => mailer.calls.find(c => c.message.tags.kind === "client_confirmation")?.message;

test("new package with no override uses its category's default (edited in the dashboard)", async () => {
  const { deps, store, mailer } = setup();
  seedDefaults(store);
  store.templates.find(t => t.service_type === "travel")!.subject = "Your {{item_name}} trip request is in! ({{reference}})";
  await submit(deps, submission("travel")); // bali-indonesia has no override
  assert.match(clientMail(mailer)!.subject, /^Your Bali, Indonesia trip request is in! \(AF-/);
  assert.equal(store.outbox.find(o => o.kind === "client_confirmation")!.template_ref, "default:travel");
});

test("form override wins while enabled; a disabled override falls back to the default", async () => {
  const { deps, store, mailer } = setup();
  seedDefaults(store);
  store.templates.push({ service_type: "visa", form_id: "visa-inquiry-japan", enabled: true, subject: "Japan special for {{client_first_name}}", body: "Konnichiwa {{client_first_name}}!" });
  await submit(deps, submission("visa"));
  assert.equal(clientMail(mailer)!.subject, "Japan special for Ana");
  assert.equal(store.outbox.find(o => o.kind === "client_confirmation")!.template_ref, "form:visa-inquiry-japan");
  store.templates.find(t => t.form_id === "visa-inquiry-japan")!.enabled = false;
  mailer.calls.length = 0;
  await submit(deps, submission("visa", { email: "other@example.com" }));
  assert.match(clientMail(mailer)!.subject, /^We received your Japan Tourist Visa inquiry/);
});

test("category auto-reply switched off: client not emailed, staff still notified, CRM save unchanged", async () => {
  const { deps, store, mailer } = setup();
  seedDefaults(store);
  store.templates.find(t => t.service_type === "immigration")!.enabled = false;
  const reply = await submit(deps, submission("immigration"));
  assert.equal(reply.status, 200);
  assert.equal(store.submissions.length, 1);
  assert.equal(clientMail(mailer), undefined);
  assert.equal(mailer.calls.filter(c => c.message.tags.kind === "staff_notification").length, 1);
  assert.match(store.outbox.find(o => o.kind === "client_confirmation")!.last_error!, /turned off/);
});

test("no template rows yet: built-in default copy is used", async () => {
  const { deps, store, mailer } = setup();
  store.templates = [];
  await submit(deps, submission("contact"));
  assert.match(clientMail(mailer)!.subject, /^We received your message \(AF-/);
  assert.equal(store.outbox.find(o => o.kind === "client_confirmation")!.template_ref, "builtin:general");
});

test("template variables are safe: escaped values, letters-only first name, unknown variables removed", () => {
  const ctx = { serviceType: "travel" as const, itemName: "Bali <script>alert(1)</script> & Co", reference: "AF-ABC123", customerName: "http://spam.example now",
    submittedAt: new Date("2026-09-28T02:00:00Z"), businessName: "Air Fair", replyEmail: "inbox@example.test", redirectedFrom: null };
  const out = renderAutoReply({ subject: "Hi {{client_first_name}}\nBcc: x@y.z {{secret_token}}", body: "<b>Bold</b> {{item_name}}\n\nThanks {{client_first_name}} {{nope}}" }, ctx);
  assert.equal(out.subject, "Hi there Bcc: x@y.z", "newline collapsed, unknown variable dropped, name not echoed");
  assert.ok(!out.html.includes("<script>") && !out.html.includes("<b>"), "admin text and values are escaped");
  assert.ok(out.html.includes("&lt;script&gt;") && out.html.includes("&lt;b&gt;Bold&lt;/b&gt;"));
  assert.ok(!out.text.includes("spam.example"));
  assert.equal(safeFirstName("María José"), "María");
  assert.equal(safeFirstName("<img src=x>"), "");
  assert.deepEqual(unknownVariables("{{item_name}} {{password}} {{ reference }}"), ["password"]);
});

test("send test: admin only, only to configured inboxes, works before sending is switched on", async () => {
  const { deps, store, mailer } = setup();
  store.settings = { ...CONFIGURED, sending_enabled: false, test_redirect_to: "qa@example.test" };
  const tpl = { service_type: "travel", form_id: "travel-inquiry-bali-indonesia", subject: "Trip {{item_name}}", body: "Hi {{client_first_name}}" };
  const admin = { id: "u-admin", role: "admin" };
  assert.equal((await handleSendTemplateTest(deps, { ...tpl, to: "inbox@example.test" }, { id: "u-staff", role: "staff" })).status, 403);
  assert.equal((await handleSendTemplateTest(deps, { ...tpl, to: "inbox@example.test" }, null)).status, 403);
  assert.equal((await handleSendTemplateTest(deps, { ...tpl, to: "client@example.com" }, admin)).status, 400, "arbitrary address refused");
  assert.equal((await handleSendTemplateTest(deps, { ...tpl, subject: "{{password}}", to: "inbox@example.test" }, admin)).status, 400, "unknown variable refused");
  const sent1 = await handleSendTemplateTest(deps, { ...tpl, to: "Travel-Desk@example.test" }, admin);
  assert.equal(sent1.status, 200);
  assert.equal(sent1.body.status, "sent");
  const sent = mailer.calls.at(-1)!.message;
  assert.equal(sent.to, "travel-desk@example.test");
  assert.equal(sent.subject, "[TEST] Trip Bali, Indonesia");
  assert.equal(sent.tags.kind, "test_email");
  assert.equal(store.submissions.length, 0, "a test never creates a submission or lead");
});

test("send test is rate limited per admin", async () => {
  const { deps } = setup();
  const admin = { id: "u-admin", role: "admin" };
  let last;
  for (let i = 0; i < 11; i++) last = await handleSendTemplateTest(deps, { service_type: "general", subject: "S", body: "B", to: "inbox@example.test" }, admin);
  assert.equal(last!.status, 429);
});

// ---------------------------------------------------------------------------
// Form Studio schemas: server-side validation against the published form
// ---------------------------------------------------------------------------
const studioSub = (raw: Record<string, unknown>, overrides: Record<string, unknown> = {}) => ({
  id: crypto.randomUUID(), form_type: "studio-form", form_key: "studio-form", source_page: "/apply",
  name: "browser name", email: "ana@example.com", phone: "", attachments: [], document_id: null, form_version_id: null, raw_data: raw, ...overrides,
});

test("studio form: answers stored by field id, contact fields mapped, server version id used", async () => {
  const { deps, store, mailer } = setup();
  const reply = await submit(deps, studioSub({ clientName: "Ana Cruz", contactEmail: "Ana@Example.com", service: "tour", passportNumber: "P1234567", notes: "Two adults" },
    { form_version_id: "11111111-1111-4111-8111-111111111111" }));
  assert.equal(reply.status, 200, JSON.stringify(reply.body));
  const row = store.submissions[0];
  assert.deepEqual(row.answers, { f_who: "Ana Cruz", f_mail: "Ana@Example.com", f_svc: "tour", f_pass: "P1234567", f_msg: "Two adults" });
  assert.equal(row.name, "Ana Cruz", "name from the field mapped to Full name");
  assert.equal(row.email, "ana@example.com", "email from the mapped field, normalised");
  assert.equal(row.form_version_id, "00000000-0000-4000-8000-000000000001", "the published version, not what the browser claimed");
  const raw = row.raw_data as Record<string, unknown>;
  assert.equal(raw.mapped_service, "tour");
  assert.equal(raw.mapped_message, "Two adults");
  const staff = mailer.calls.find(c => c.message.tags.kind === "staff_notification")!.message;
  assert.ok(staff.html.includes("Your name") && staff.html.includes("Tours"), "labels and choice labels from the schema");
  assert.ok(!staff.html.includes("P1234567"), "sensitive fields are not emailed");
  assert.deepEqual(mailer.calls.find(c => c.message.tags.kind === "client_confirmation")!.message.to, "ana@example.com");
});

test("studio form: unknown fields, missing required answers and bad choices are refused; nothing saved", async () => {
  const { deps, store } = setup();
  const base = { clientName: "Ana", contactEmail: "ana@example.com" };
  const unknown = await submit(deps, studioSub({ ...base, service: "tour", isAdmin: "true" }));
  assert.equal(unknown.status, 400);
  assert.match(String(unknown.body.error), /reload the page/);
  const badChoice = await submit(deps, studioSub({ ...base, service: "cruise" }));
  assert.equal(badChoice.status, 400);
  assert.match(String(badChoice.body.error), /^Service: Choose from the listed options/);
  const missingFile = await submit(deps, studioSub({ ...base, service: "visa" }));
  assert.equal(missingFile.status, 400);
  assert.deepEqual(missingFile.body.fields, { passport: "Please attach a file." }, "required because the condition shows it");
  assert.equal(store.submissions.length, 0);
});

test("studio form: uploads are checked against the stored file, not the browser's claim", async () => {
  const { deps, store } = setup();
  const path = "submissions/2026-10/abcdef12-passport.pdf";
  const attachment = { field: "passport", path, name: "passport.pdf", size: 1000, type: "application/pdf" };
  const raw = { clientName: "Ana", contactEmail: "ana@example.com", service: "visa", passport: "passport.pdf" };
  const missing = await submit(deps, studioSub(raw, { attachments: [attachment] }));
  assert.match(String(missing.body.error), /couldn't be found/);
  store.attachmentInfo[path] = { size: 5 * 1024 * 1024, type: "application/pdf" };
  const tooBig = await submit(deps, studioSub(raw, { attachments: [attachment] }));
  assert.match(String(tooBig.body.error), /Passport copy: File is larger than 2 MB/);
  store.attachmentInfo[path] = { size: 1500, type: "application/pdf" };
  const ok = await submit(deps, studioSub(raw, { attachments: [attachment] }));
  assert.equal(ok.status, 200, JSON.stringify(ok.body));
  const row = store.submissions[0];
  assert.deepEqual((row.answers as Record<string, unknown>).f_doc, { file: path, name: "passport.pdf", size: 1000, type: "application/pdf" });
  assert.equal((row.attachments as Array<{ size: number }>)[0].size, 1500, "stored size recorded");
});

test("studio form: answers to fields hidden by a condition are dropped", async () => {
  const { deps, store } = setup();
  await submit(deps, studioSub({ clientName: "Ana", contactEmail: "ana@example.com", service: "tour", passport: "sneaky.pdf" }));
  assert.equal(store.submissions.length, 1);
  assert.ok(!("passport" in (store.submissions[0].raw_data as Record<string, unknown>)));
});
