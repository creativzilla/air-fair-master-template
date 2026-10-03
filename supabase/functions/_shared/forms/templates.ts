// Email templates.
// - Staff notification: built in, one layout for every form.
// - Client auto-reply: edited by admins in Dashboard > Form Emails (table
//   email_templates): one default per service_type, optional override per
//   form_id. DEFAULT_AUTO_REPLIES below is the built-in copy (also the seed).
//   Templates are plain text with {{variables}}; the result is escaped as a
//   whole, so neither admins nor visitors can inject HTML.
// - Newsletter confirmation: built in, separate from inquiries.
// The specific service / country / package comes from `itemName` (looked up
// from form_id), so every package shares its category's template.
import type { ServiceType } from "./identifiers.ts";

export interface Rendered {
  subject: string;
  html: string;
  text: string;
}

export interface Answer {
  label: string;
  value: string;
}

export interface FormEmailContext {
  serviceType: ServiceType;
  formId: string;
  itemName: string | null;   // e.g. "Bali, Indonesia", "Japan Tourist Visa"
  reference: string;         // e.g. AF-3F2A9C
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  submittedAt: Date;
  pageUrl: string;
  dashboardUrl: string;
  answers: Answer[];
  attachmentsCount: number;
  businessName: string;
  possibleDuplicate: boolean;
  redirectedFrom: string | null; // set in test mode
  replyEmail?: string | null;    // monitored inbox clients reply to
}

interface ServiceCopy {
  label: string;
  staffSubject: (c: FormEmailContext) => string;
}

const item = (c: FormEmailContext, fallback: string) => c.itemName || fallback;

export const SERVICE_COPY: Record<ServiceType, ServiceCopy> = {
  general: {
    label: "Website contact",
    staffSubject: c => `New website inquiry from ${c.customerName || c.customerEmail}`,
  },
  immigration: {
    label: "Immigration assessment",
    staffSubject: c => `New immigration assessment: ${item(c, "Immigration service")} (${c.customerName || c.customerEmail})`,
  },
  visa: {
    label: "Visa inquiry",
    staffSubject: c => `New visa inquiry: ${item(c, "Visa assistance")} (${c.customerName || c.customerEmail})`,
  },
  travel: {
    label: "Travel package inquiry",
    staffSubject: c => `New travel inquiry: ${item(c, "Travel package")} (${c.customerName || c.customerEmail})`,
  },
};

export function escapeHtml(value: unknown): string {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

// Subjects can't carry line breaks (header injection) and stay short.
const oneLine = (value: string, max = 200) => value.replace(/[\r\n\t]+/g, " ").replace(/\s{2,}/g, " ").trim().slice(0, max);

const manila = (d: Date) => new Intl.DateTimeFormat("en-PH", { timeZone: "Asia/Manila", dateStyle: "medium", timeStyle: "short" }).format(d);

function layout(title: string, bodyHtml: string, footer: string): string {
  return `<!doctype html><html><body style="margin:0;background:#f4f6f9;font-family:Arial,Helvetica,sans-serif;color:#1f2d3d">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f6f9;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e3e8ed">
<tr><td style="background:#051931;padding:18px 24px;color:#ffffff;font-size:16px;font-weight:bold">${escapeHtml(title)}</td></tr>
<tr><td style="padding:24px;font-size:15px;line-height:1.6">${bodyHtml}</td></tr>
<tr><td style="padding:16px 24px;border-top:1px solid #e3e8ed;font-size:12px;color:#6b7a8c">${footer}</td></tr>
</table></td></tr></table></body></html>`;
}

const row = (label: string, value: string) =>
  `<tr><td style="padding:6px 12px 6px 0;color:#6b7a8c;vertical-align:top;white-space:nowrap">${escapeHtml(label)}</td><td style="padding:6px 0;vertical-align:top">${value}</td></tr>`;

export function renderStaffEmail(c: FormEmailContext): Rendered {
  const copy = SERVICE_COPY[c.serviceType];
  const subject = oneLine(`${c.possibleDuplicate ? "[Possible duplicate] " : ""}${copy.staffSubject(c)}`);
  const answersHtml = c.answers.length
    ? `<table role="presentation" cellspacing="0" cellpadding="0" style="width:100%;font-size:14px">${c.answers.map(a => row(a.label, escapeHtml(a.value).replace(/\n/g, "<br>"))).join("")}</table>`
    : "<p>(No other answers)</p>";
  const body = [
    c.redirectedFrom ? `<p style="background:#fff4d6;padding:10px 12px;border-radius:8px;font-size:13px">TEST MODE: this email would have gone to ${escapeHtml(c.redirectedFrom)}.</p>` : "",
    c.possibleDuplicate ? `<p style="background:#fdecea;padding:10px 12px;border-radius:8px;font-size:13px">This person sent the same form a few minutes ago. It may be a duplicate.</p>` : "",
    `<table role="presentation" cellspacing="0" cellpadding="0" style="font-size:14px;margin-bottom:16px">`,
    row("Type", escapeHtml(copy.label)),
    c.itemName ? row("For", `<strong>${escapeHtml(c.itemName)}</strong>`) : "",
    row("Reference", escapeHtml(c.reference)),
    row("Form ID", escapeHtml(c.formId)),
    row("Submitted", escapeHtml(manila(c.submittedAt))),
    row("Page", `<a href="${escapeHtml(c.pageUrl)}">${escapeHtml(c.pageUrl)}</a>`),
    `</table>`,
    `<h3 style="font-size:15px;margin:16px 0 6px">Contact</h3>`,
    `<table role="presentation" cellspacing="0" cellpadding="0" style="font-size:14px">`,
    row("Name", escapeHtml(c.customerName || "(not given)")),
    row("Email", `<a href="mailto:${escapeHtml(c.customerEmail)}">${escapeHtml(c.customerEmail)}</a>`),
    row("Phone", escapeHtml(c.customerPhone || "(not given)")),
    `</table>`,
    `<h3 style="font-size:15px;margin:16px 0 6px">Answers</h3>`,
    answersHtml,
    c.attachmentsCount ? `<p style="font-size:14px">${c.attachmentsCount} file(s) attached. Open them from the dashboard.</p>` : "",
    `<p style="margin-top:20px"><a href="${escapeHtml(c.dashboardUrl)}" style="background:#4B9B13;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:20px;font-weight:bold;display:inline-block">Open in dashboard</a></p>`,
    `<p style="font-size:13px;color:#6b7a8c">Reply to this email to answer the client directly.</p>`,
  ].join("");
  const text = [
    c.redirectedFrom ? `TEST MODE: would have gone to ${c.redirectedFrom}` : "",
    c.possibleDuplicate ? "Possible duplicate: the same person sent this form a few minutes ago." : "",
    `${copy.label}${c.itemName ? `: ${c.itemName}` : ""}`,
    `Reference: ${c.reference}`, `Form ID: ${c.formId}`, `Submitted: ${manila(c.submittedAt)}`, `Page: ${c.pageUrl}`, "",
    `Name: ${c.customerName || "(not given)"}`, `Email: ${c.customerEmail}`, `Phone: ${c.customerPhone || "(not given)"}`, "",
    "Answers:", ...c.answers.map(a => `- ${a.label}: ${a.value}`),
    c.attachmentsCount ? `\n${c.attachmentsCount} file(s) attached (open in the dashboard).` : "",
    "", `Dashboard: ${c.dashboardUrl}`,
  ].filter((line, i, all) => line !== "" || all[i - 1] !== "").join("\n");
  return { subject, html: layout(`${c.businessName}: ${copy.label}`, body, `Sent by the ${escapeHtml(c.businessName)} website.`), text };
}

// ---------------------------------------------------------------------------
// Client auto-replies
// ---------------------------------------------------------------------------
export interface AutoReplyTemplate {
  subject: string;
  body: string;
}

// The only placeholders a template can use. Anything else renders as nothing.
export const TEMPLATE_VARIABLES = [
  { name: "client_first_name", description: 'Client\'s first name (letters only; "there" if missing)' },
  { name: "item_name", description: "Service, visa or travel package name" },
  { name: "service_label", description: 'Category, e.g. "Travel package inquiry"' },
  { name: "reference", description: "Reference number, e.g. AF-3F2A9C" },
  { name: "submitted_date", description: "Date and time received (Manila time)" },
  { name: "business_name", description: "Business name from Settings" },
  { name: "reply_email", description: "Your monitored inbox (replies go there)" },
] as const;
const KNOWN = new Set<string>(TEMPLATE_VARIABLES.map(v => v.name));
const VARIABLE = /\{\{\s*([A-Za-z_]+)\s*\}\}/g;

export const TEMPLATE_LIMITS = { subject: 200, body: 5000 };

export const DEFAULT_AUTO_REPLIES: Record<ServiceType, AutoReplyTemplate> = {
  general: {
    subject: "We received your message ({{reference}})",
    body: "Hi {{client_first_name}},\n\nThank you for contacting {{business_name}}. We have received your message.\n\nReference: {{reference}}\nReceived: {{submitted_date}}\n\nA member of our team will read your message and reply by email, usually within one business day.\n\nIf you need to add anything, just reply to this email.\n\nThank you,\n{{business_name}}",
  },
  immigration: {
    subject: "We received your {{item_name}} assessment request ({{reference}})",
    body: "Hi {{client_first_name}},\n\nThank you for requesting an assessment for {{item_name}}. We have received your details.\n\nReference: {{reference}}\nReceived: {{submitted_date}}\n\nWhat happens next:\n- Our immigration team will review your answers.\n- We will contact you to confirm the requirements and next steps for your case.\n\nIf you need to add anything, just reply to this email.\n\nThank you,\n{{business_name}}",
  },
  visa: {
    subject: "We received your {{item_name}} inquiry ({{reference}})",
    body: "Hi {{client_first_name}},\n\nThank you for your inquiry about {{item_name}}. We have received your details.\n\nReference: {{reference}}\nReceived: {{submitted_date}}\n\nWhat happens next:\n- Our visa team will review your travel dates and details.\n- We will contact you with the requirements checklist and the next steps.\n\nIf you need to add anything, just reply to this email.\n\nThank you,\n{{business_name}}",
  },
  travel: {
    subject: "We received your inquiry for {{item_name}} ({{reference}})",
    body: "Hi {{client_first_name}},\n\nThank you for your interest in {{item_name}}. We have received your inquiry.\n\nReference: {{reference}}\nReceived: {{submitted_date}}\n\nWhat happens next:\n- Our travel team will check availability for your preferred dates.\n- We will contact you with the package details and pricing.\n\nIf you need to add anything, just reply to this email.\n\nThank you,\n{{business_name}}",
  },
};

const ITEM_FALLBACK: Record<ServiceType, string> = {
  general: "your inquiry", immigration: "our immigration services", visa: "visa assistance", travel: "our travel packages",
};

// Variables used in a template that aren't supported (for validation / UI).
export function unknownVariables(text: string): string[] {
  return [...new Set([...String(text ?? "").matchAll(VARIABLE)].map(m => m[1]).filter(name => !KNOWN.has(name)))];
}

// Letters only (any alphabet), plus apostrophes, hyphens and dots; so the
// name field can't be used to put links or other text into an email.
export function safeFirstName(name: string): string {
  const first = String(name ?? "").trim().split(/\s+/)[0] || "";
  return /^[\p{L}][\p{L}'.-]{0,29}$/u.test(first) ? first : "";
}

export function fillTemplate(text: string, values: Record<string, string>): string {
  return String(text ?? "").replace(VARIABLE, (_, name: string) => (KNOWN.has(name) ? values[name] ?? "" : ""));
}

export interface AutoReplyContext {
  serviceType: ServiceType;
  itemName: string | null;
  reference: string;
  customerName: string;
  submittedAt: Date;
  businessName: string;
  replyEmail: string | null;
  redirectedFrom: string | null;
}

export function autoReplyValues(c: AutoReplyContext): Record<string, string> {
  return {
    client_first_name: safeFirstName(c.customerName) || "there",
    item_name: c.itemName || ITEM_FALLBACK[c.serviceType],
    service_label: SERVICE_COPY[c.serviceType].label,
    reference: c.reference,
    submitted_date: manila(c.submittedAt),
    business_name: c.businessName,
    reply_email: c.replyEmail || "",
  };
}

// Plain-text template -> email. The filled-in text is escaped as a whole, then
// blank lines become paragraphs and single line breaks become <br>.
export function renderAutoReply(template: AutoReplyTemplate, c: AutoReplyContext): Rendered {
  const values = autoReplyValues(c);
  const fallback = DEFAULT_AUTO_REPLIES[c.serviceType];
  const subject = oneLine(fillTemplate(template.subject || fallback.subject, values)) || oneLine(fillTemplate(fallback.subject, values));
  const bodyText = fillTemplate((template.body || fallback.body).slice(0, TEMPLATE_LIMITS.body), values).replace(/\r\n?/g, "\n").trim();
  const paragraphs = bodyText.split(/\n{2,}/).map(p => `<p style="margin:0 0 14px">${escapeHtml(p).replace(/\n/g, "<br>")}</p>`).join("");
  const banner = c.redirectedFrom
    ? `<p style="background:#fff4d6;padding:10px 12px;border-radius:8px;font-size:13px">TEST MODE: this email would have gone to ${escapeHtml(c.redirectedFrom)}.</p>`
    : "";
  const footer = `You are receiving this because this email address was entered in a form on the ${escapeHtml(c.businessName)} website. If this wasn't you, you can ignore this email.`;
  const text = [c.redirectedFrom ? `TEST MODE: would have gone to ${c.redirectedFrom}\n` : "", bodyText].join("");
  return { subject, html: layout(c.businessName, banner + paragraphs, footer), text };
}

// Built-in auto-reply for a form email context (no dashboard template).
export function renderClientEmail(c: FormEmailContext): Rendered {
  return renderAutoReply(DEFAULT_AUTO_REPLIES[c.serviceType], {
    serviceType: c.serviceType, itemName: c.itemName, reference: c.reference, customerName: c.customerName,
    submittedAt: c.submittedAt, businessName: c.businessName, replyEmail: c.replyEmail ?? null, redirectedFrom: c.redirectedFrom,
  });
}

export interface NewsletterContext {
  businessName: string;
  confirmUrl: string;
  unsubscribeUrl: string;
  redirectedFrom: string | null;
}

export function renderNewsletterConfirmation(c: NewsletterContext): Rendered {
  const subject = `Please confirm your subscription to ${c.businessName}`;
  const body = [
    c.redirectedFrom ? `<p style="background:#fff4d6;padding:10px 12px;border-radius:8px;font-size:13px">TEST MODE: this email would have gone to ${escapeHtml(c.redirectedFrom)}.</p>` : "",
    `<p>Hello,</p>`,
    `<p>Please confirm that you want to receive travel updates and deals from ${escapeHtml(c.businessName)}.</p>`,
    `<p style="margin:22px 0"><a href="${escapeHtml(c.confirmUrl)}" style="background:#4B9B13;color:#ffffff;text-decoration:none;padding:11px 20px;border-radius:20px;font-weight:bold;display:inline-block">Confirm subscription</a></p>`,
    `<p style="font-size:13px;color:#6b7a8c">This link expires in 7 days. If you didn't sign up, ignore this email and you won't be subscribed.</p>`,
  ].join("");
  const text = [
    c.redirectedFrom ? `TEST MODE: would have gone to ${c.redirectedFrom}\n` : "",
    "Hello,", "", `Please confirm that you want to receive travel updates and deals from ${c.businessName}:`, c.confirmUrl, "",
    "This link expires in 7 days. If you didn't sign up, ignore this email and you won't be subscribed.", "",
    `Unsubscribe at any time: ${c.unsubscribeUrl}`,
  ].join("\n");
  const footer = `Don't want these emails? <a href="${escapeHtml(c.unsubscribeUrl)}" style="color:#6b7a8c">Unsubscribe</a>.`;
  return { subject, html: layout(c.businessName, body, footer), text };
}
