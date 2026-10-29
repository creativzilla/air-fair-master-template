// Shared parser-based sanitization for editor previews and server-side sends.
import cleanHtml from 'sanitize-html';
const ALLOWED = ["p", "br", "b", "strong", "i", "em", "u", "a", "ul", "ol", "li", "h2", "h3", "blockquote", "div", "span"];
const esc = (s: unknown) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function sanitizeHtml(html: string): string {
  return cleanHtml(String(html || ""), {
    allowedTags: ALLOWED,
    allowedAttributes: { a: ['href', 'target', 'rel'] },
    allowedSchemes: ['https', 'http', 'mailto'],
    allowProtocolRelative: false,
    parseStyleAttributes: false,
    nonTextTags: ['script', 'style', 'textarea', 'option', 'iframe', 'object', 'embed', 'template', 'svg', 'math'],
    transformTags: {
      a: (_tag: string, attrs: Record<string, string>) => {
        const href = (attrs.href || '').trim();
        return { tagName: 'a', attribs: /^(https?:\/\/|mailto:)/i.test(href) && !/[\u0000-\u0020\u007f]/.test(href)
          ? { href, target: '_blank', rel: 'noopener' } : {} };
      },
    },
  });
}

// Rich paste is sanitized before it ever enters contentEditable. Plain text
// is escaped first so literal '<' characters cannot become markup.
export function editorPaste(html: string, text: string): string {
  return html ? sanitizeHtml(html) : esc(text).replace(/\r\n?|\n/g, '<br>');
}

export function htmlToText(html: string): string {
  return String(html || "")
    .replace(/<a\b[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, (_m, href, label) => `${label} (${href})`)
    .replace(/<(br)\s*\/?>/gi, "\n").replace(/<\/(p|div|h2|h3|blockquote)>/gi, "\n\n").replace(/<li>/gi, "• ").replace(/<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&")
    .replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

export const firstNameOf = (name: unknown) => (String(name || "").trim().split(/\s+/)[0] || "").slice(0, 40);
const TOKEN = /\{\{\s*first_?name\s*\}\}/gi;
export const hasFirstNameToken = (s: string) => new RegExp(TOKEN.source, "i").test(s || "");
// {{first_name}} → the recipient's first name, or the campaign's fallback.
export function personalize(text: string, firstName: string | null | undefined, fallback: string, html: boolean) {
  const value = (firstName && firstName.trim()) || fallback || "there";
  return String(text || "").replace(TOKEN, html ? esc(value) : value);
}

export type CampaignMessage = { kind: "service" | "promotional"; subject: string; body_html: string; first_name_fallback: string; from_name: string };
export type RenderedEmail = { subject: string; html: string; text: string; headers: Record<string, string> };

export function renderCampaignEmail(c: CampaignMessage, firstName: string | null | undefined,
  links: { unsubscribeUrl?: string; oneClickUrl?: string } = {}): RenderedEmail {
  const body = personalize(sanitizeHtml(c.body_html), firstName, c.first_name_fallback, true);
  const subject = personalize(c.subject, firstName, c.first_name_fallback, false).replace(/[\r\n]+/g, " ").trim();
  const promo = c.kind === "promotional";
  const footerText = promo
    ? `You're receiving this because you subscribed to updates from ${c.from_name}.`
    : `This is a service message from ${c.from_name} about your inquiry or application.`;
  const footerHtml = `<p style="margin:24px 0 0;padding-top:12px;border-top:1px solid #e5e7eb;color:#7c8894;font-size:12px;line-height:1.5">${esc(footerText)}${
    promo && links.unsubscribeUrl ? ` <a href="${esc(links.unsubscribeUrl)}" style="color:#7c8894">Unsubscribe</a>` : ""}</p>`;
  const html = `<!doctype html><html><body style="margin:0;padding:24px;background:#f7f9f5"><div style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;padding:24px;font:15px/1.6 Arial,Helvetica,sans-serif;color:#151a22">${body}${footerHtml}</div></body></html>`;
  const text = `${htmlToText(body)}\n\n--\n${footerText}${promo && links.unsubscribeUrl ? `\nUnsubscribe: ${links.unsubscribeUrl}` : ""}`;
  const headers: Record<string, string> = promo && links.oneClickUrl
    ? { "List-Unsubscribe": `<${links.oneClickUrl}>${links.unsubscribeUrl ? `, <${links.unsubscribeUrl}>` : ""}`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" }
    : {};
  return { subject, html, text, headers };
}

// Review screen: dedupe by address (first selected wins), flag missing/invalid.
const EMAIL = /^[^\s<>,;@]+@[^\s<>,;@]+\.[^\s<>,;@]+$/;
export function reviewRecipients(contacts: { id: string; name?: string; email?: string | null }[]) {
  const seen = new Set<string>(), eligible: any[] = [], excluded: any[] = [];
  for (const c of contacts) {
    const email = String(c.email || "").trim().toLowerCase();
    if (!email) excluded.push({ ...c, reason: "No email address" });
    else if (!EMAIL.test(email)) excluded.push({ ...c, reason: "Invalid email address" });
    else if (seen.has(email)) excluded.push({ ...c, reason: "Duplicate email address" });
    else { seen.add(email); eligible.push({ ...c, email, firstName: firstNameOf(c.name) }); }
  }
  return { eligible, excluded };
}

// Local wall-clock minutes (0-1439) of a moment in an IANA timezone.
function localMinutes(d: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(d);
  const get = (t: string) => Number(parts.find(p => p.type === t)?.value || 0);
  return get("hour") * 60 + get("minute");
}
const toMinutes = (hhmm?: string | null) => { if (!hhmm) return null; const [h, m] = hhmm.split(":").map(Number); return h * 60 + (m || 0); };
export function inWindow(d: Date, windowStart?: string | null, windowEnd?: string | null, timeZone = "Asia/Manila") {
  const s = toMinutes(windowStart), e = toMinutes(windowEnd);
  if (s === null || e === null) return true;
  const m = localMinutes(d, timeZone);
  return s <= e ? m >= s && m <= e : m >= s || m <= e;
}

export type DripPlan = { count: number; drip: boolean; batchSize: number; intervalMinutes: number; startAt?: string | null;
  windowStart?: string | null; windowEnd?: string | null; timezone?: string };
// When the last batch is due to start, mirroring the worker: one batch per
// interval, only inside the window, at most ~50 sends per minute otherwise.
export function estimateCompletion(p: DripPlan, now = new Date(), sendsPerMinute = 50) {
  const tz = p.timezone || "Asia/Manila";
  let t = new Date(Math.max(now.getTime(), p.startAt ? Date.parse(p.startAt) : now.getTime()));
  if (!p.count) return { batches: 0, finishAt: t };
  if (!p.drip) return { batches: Math.ceil(p.count / sendsPerMinute), finishAt: new Date(t.getTime() + Math.ceil(p.count / sendsPerMinute) * 60000) };
  const size = Math.max(1, p.batchSize), batches = Math.ceil(p.count / size);
  const nextOpen = (d: Date) => { let x = new Date(d); for (let i = 0; i < 8 * 24 * 12 && !inWindow(x, p.windowStart, p.windowEnd, tz); i++) x = new Date(x.getTime() + 5 * 60000); return x; };
  for (let b = 0; b < batches; b++) {
    t = nextOpen(t);
    if (b < batches - 1) t = new Date(t.getTime() + Math.max(0, p.intervalMinutes) * 60000);
  }
  // The last batch itself takes about a minute per sendsPerMinute recipients.
  return { batches, finishAt: new Date(t.getTime() + Math.ceil(Math.min(size, p.count) / sendsPerMinute) * 60000) };
}
