// Email templates: one per service_type (general, immigration, visa, travel),
// each with a staff and a client version, plus the newsletter confirmation.
// The specific service / country / package comes from `itemName` (looked up
// from form_id), so every package shares the same template.
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
}

interface ServiceCopy {
  label: string;
  staffSubject: (c: FormEmailContext) => string;
  clientSubject: (c: FormEmailContext) => string;
  clientIntro: (c: FormEmailContext) => string;
  nextSteps: string[];
}

const item = (c: FormEmailContext, fallback: string) => c.itemName || fallback;

export const SERVICE_COPY: Record<ServiceType, ServiceCopy> = {
  general: {
    label: "Website contact",
    staffSubject: c => `New website inquiry from ${c.customerName || c.customerEmail}`,
    clientSubject: () => "We received your message",
    clientIntro: () => "Thank you for contacting us. We have received your message.",
    nextSteps: ["A member of our team will read your message and reply by email, usually within one business day."],
  },
  immigration: {
    label: "Immigration assessment",
    staffSubject: c => `New immigration assessment: ${item(c, "Immigration service")} (${c.customerName || c.customerEmail})`,
    clientSubject: c => `We received your ${item(c, "immigration")} assessment request`,
    clientIntro: c => `Thank you for requesting an assessment for ${item(c, "our immigration services")}. We have received your details.`,
    nextSteps: [
      "Our immigration team will review your answers.",
      "We will contact you to confirm the requirements and next steps for your case.",
    ],
  },
  visa: {
    label: "Visa inquiry",
    staffSubject: c => `New visa inquiry: ${item(c, "Visa assistance")} (${c.customerName || c.customerEmail})`,
    clientSubject: c => `We received your ${item(c, "visa")} inquiry`,
    clientIntro: c => `Thank you for your inquiry about ${item(c, "visa assistance")}. We have received your details.`,
    nextSteps: [
      "Our visa team will review your travel dates and details.",
      "We will contact you with the requirements checklist and the next steps.",
    ],
  },
  travel: {
    label: "Travel package inquiry",
    staffSubject: c => `New travel inquiry: ${item(c, "Travel package")} (${c.customerName || c.customerEmail})`,
    clientSubject: c => `We received your inquiry for ${item(c, "your trip")}`,
    clientIntro: c => `Thank you for your interest in ${item(c, "our travel packages")}. We have received your inquiry.`,
    nextSteps: [
      "Our travel team will check availability for your preferred dates.",
      "We will contact you with the package details and pricing.",
    ],
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

export function renderClientEmail(c: FormEmailContext): Rendered {
  const copy = SERVICE_COPY[c.serviceType];
  const firstName = oneLine(c.customerName.split(/\s+/)[0] || "", 40);
  const greeting = firstName ? `Hi ${firstName},` : "Hello,";
  const subject = oneLine(`${copy.clientSubject(c)} (${c.reference})`);
  // The client email never repeats free text the visitor typed (other than
  // their first name), so the form can't be used to send messages to others.
  const body = [
    c.redirectedFrom ? `<p style="background:#fff4d6;padding:10px 12px;border-radius:8px;font-size:13px">TEST MODE: this email would have gone to ${escapeHtml(c.redirectedFrom)}.</p>` : "",
    `<p>${escapeHtml(greeting)}</p>`,
    `<p>${escapeHtml(copy.clientIntro(c))}</p>`,
    `<p style="font-size:14px;color:#6b7a8c">Reference: <strong style="color:#1f2d3d">${escapeHtml(c.reference)}</strong><br>Received: ${escapeHtml(manila(c.submittedAt))}</p>`,
    `<h3 style="font-size:15px;margin:18px 0 6px">What happens next</h3>`,
    `<ul style="padding-left:20px;margin:0">${copy.nextSteps.map(step => `<li style="margin-bottom:6px">${escapeHtml(step)}</li>`).join("")}</ul>`,
    `<p style="margin-top:18px">If you need to add anything, just reply to this email.</p>`,
    `<p>Thank you,<br>${escapeHtml(c.businessName)}</p>`,
  ].join("");
  const text = [
    c.redirectedFrom ? `TEST MODE: would have gone to ${c.redirectedFrom}\n` : "",
    greeting, "", copy.clientIntro(c), "", `Reference: ${c.reference}`, `Received: ${manila(c.submittedAt)}`, "",
    "What happens next:", ...copy.nextSteps.map(step => `- ${step}`), "",
    "If you need to add anything, just reply to this email.", "", "Thank you,", c.businessName,
  ].join("\n");
  const footer = `You are receiving this because this email address was entered in a form on the ${escapeHtml(c.businessName)} website. If this wasn't you, you can ignore this email.`;
  return { subject, html: layout(c.businessName, body, footer), text };
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
