export const RECEIVING_DOMAIN = "reply.airfairtravel.com";
// Shared mailboxes live on the Google Workspace domain and are forwarded to
// <local>@RECEIVING_DOMAIN; mail for either domain is ours.
export const MAILBOX_DOMAIN = "airfairtravel.com";
export const SENDER = "Air Fair Travel & Immigration <no-reply@airfairtravel.com>";
// RFC 5321 caps the local part at 64 characters, and Resend rejects longer ones
// with 422. 48 hex characters of the random token still carry 192 bits.
export const threadAddress = (token: string) => `t-${token.slice(0, 48)}@${RECEIVING_DOMAIN}`;
// Legacy "thread-<64 hex>" addresses keep matching, by their first 48 characters.
const threadToken = (a: string) => a.match(/^t-([a-f0-9]{48})@/)?.[1] || a.match(/^thread-([a-f0-9]{64})@/)?.[1].slice(0, 48);
export const address = (value: unknown): string => {
  const raw = String(value || "").trim();
  const email = (raw.match(/<([^<>]+)>$/)?.[1] || raw).toLowerCase();
  if (!/^[^\s<>,;@]+@[^\s<>,;@]+\.[^\s<>,;@]+$/.test(email)) throw new Error("Invalid email address");
  return email;
};
// Lower-cased, de-duplicated addresses; invalid entries and `exclude` are dropped.
export function uniqueAddresses(values: unknown[], exclude: string[] = []) {
  const seen = new Set(exclude.map(a => a.toLowerCase()));
  const out: string[] = [];
  for (const value of values) {
    let a: string;
    try { a = address(value); } catch { continue; }
    if (!seen.has(a)) { seen.add(a); out.push(a); }
  }
  return out;
}
// CC/BCC for a manual email: from the copy recipients stored when it was queued,
// never duplicating To or each other.
export function copyRecipients(to: string, cc: unknown, bcc: unknown) {
  const split = (v: unknown) => String(v || "").split(",").filter(x => x.trim());
  const ccList = uniqueAddresses(split(cc), [to]);
  const bccList = uniqueAddresses(split(bcc), [to, ...ccList]);
  return { ...(ccList.length ? { cc: ccList } : {}), ...(bccList.length ? { bcc: bccList } : {}) };
}
// "Name <address>" for the message's mailbox; quoted when the name needs it.
export function fromHeader(m: { from_email?: string | null; from_name?: string | null }) {
  // Messages saved before shared mailboxes have no from_name: the original sender.
  if (!m.from_email || (m.from_email === "no-reply@airfairtravel.com" && !m.from_name)) return SENDER;
  const name = String(m.from_name || "").replace(/[\r\n"<>\\]/g, "").trim();
  // RFC 5322 specials require a quoted display name.
  return name ? `${/[(),.:;@[\]]/.test(name) ? `"${name}"` : name} <${address(m.from_email)}>` : address(m.from_email);
}
export function headersOf(value: unknown): Record<string, string> {
  const pairs = Array.isArray(value) ? value.map(h => [h.name, h.value]) : Object.entries((value || {}) as object);
  return Object.fromEntries(pairs.map(([k, v]) => [String(k).toLowerCase(), String(v)]));
}
// Browser origins allowed to call inbox-send. The bearer token, not CORS, is the
// access control; extras accept "a, b/" style secret values.
export function allowedOrigins(extra = "") {
  return new Set(["https://airfairtravel.com", "https://www.airfairtravel.com", "http://localhost:5173", "http://localhost:4173",
    ...extra.split(",").map(o => o.trim().replace(/\/+$/, "")).filter(Boolean)]);
}
export function corsHeaders(origin: string, allowed: Set<string>): Record<string, string> {
  return { "Content-Type": "application/json", Vary: "Origin", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS", ...(allowed.has(origin) ? { "Access-Control-Allow-Origin": origin } : {}) };
}
export const messageIds =(value: unknown) => (String(value || "").match(/<[^<>\s]+>/g) || []).slice(-30);

// Svix's documented HMAC format, with raw bytes, constant-time crypto.verify
// and a five-minute replay window. No parsing or reserialization before this.
export async function verifyWebhook(raw: string, headers: Headers, secret: string, now = Date.now()) {
  const id = headers.get("svix-id"), timestamp = headers.get("svix-timestamp");
  if (!id || !timestamp || !/^\d+$/.test(timestamp) || Math.abs(now / 1000 - Number(timestamp)) > 300) throw new Error("Invalid signature");
  const decode = (s: string) => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  const key = await crypto.subtle.importKey("raw", decode(secret.replace(/^whsec_/, "")), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
  const bytes = new TextEncoder().encode(`${id}.${timestamp}.${raw}`);
  for (const entry of (headers.get("svix-signature") || "").split(" ")) {
    const [version, signature] = entry.split(",");
    if (version !== "v1" || !signature) continue;
    try { if (await crypto.subtle.verify("HMAC", key, decode(signature), bytes)) return id; } catch { /* try rotated signature */ }
  }
  throw new Error("Invalid signature");
}

export function normalizeIncoming(email: Record<string, any>, expectedId: string) {
  if (!email || typeof email !== "object") throw new Error("Incomplete receiving API response (not an object)");
  const missing = [email.id !== expectedId && "id", !Array.isArray(email.to) && "to", !("text" in email) && "text", !("headers" in email) && "headers"].filter(Boolean);
  if (missing.length) throw new Error(`Incomplete receiving API response (missing: ${missing.join(", ")})`);
  // Every recipient the provider reports, in order: To, Cc, Bcc, then envelope
  // (received_for). Mailbox routing uses these, never subject or sender.
  const all = uniqueAddresses([...email.to, ...(email.cc || []), ...(email.bcc || []), ...(email.received_for || [])]);
  const receiving = all.filter(a => a.split("@")[1] === RECEIVING_DOMAIN);
  if (!receiving.length && !all.some(a => a.split("@")[1] === MAILBOX_DOMAIN)) return null;
  const headers = headersOf(email.headers);
  const to = uniqueAddresses(email.to);
  const verify = String(headers["x-airfair-mailbox-verify"] || "").trim().toLowerCase();
  return {
    id: expectedId, from: address(email.from), to: (to.length ? to : receiving).join(", "),
    // Other visible CC recipients, e.g. the staff member on a client's Reply All.
    cc: uniqueAddresses(Array.isArray(email.cc) ? email.cc : [], to.length ? to : receiving).join(", "),
    recipients: all,
    ...(/^[a-f0-9]{64}$/.test(verify) ? { verify_token: verify } : {}),
    subject: String(email.subject || "(No subject)").replace(/[\r\n]/g, " ").slice(0, 998),
    text: typeof email.text === "string" ? email.text : "[This email has no plain-text body. HTML is not displayed in this inbox.]",
    headers, message_id: messageIds(email.message_id || headers["message-id"])[0] || null,
    references: [...messageIds(headers["in-reply-to"]), ...messageIds(headers.references)],
    tokens: receiving.map(threadToken).filter(Boolean),
    attachments: (email.attachments || []).map((a: any) => ({ filename: String(a.filename || "Attachment"), content_type: a.content_type || null })),
  };
}

export function resendClient(key: string, fetcher: typeof fetch = fetch) {
  return async (path: string, body?: unknown, idempotencyKey?: string) => {
    if (!key) throw new Error("Email provider is not configured");
    const response = await fetcher(`https://api.resend.com${path}`, {
      method: body ? "POST" : "GET", signal: AbortSignal.timeout(15000),
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (!response.ok) {
      // Resend error bodies are { name, message, statusCode }; they never echo the key.
      const detail = await response.json().catch(() => ({})) as { name?: unknown; message?: unknown };
      throw new ProviderError(response.status, String(detail.name || ""), String(detail.message || ""));
    }
    return await response.json();
  };
}

export class ProviderError extends Error {
  status: number; code: string; detail: string;
  constructor(status: number, code: string, detail: string) {
    super(`Email provider request failed (${status}${code ? ` ${code}` : ""})`);
    this.status = status; this.code = code; this.detail = detail;
  }
}

// Short, address-free error text for logs and last_error.
const clip = (s: unknown) => String(s ?? "").replace(/[^\s<>"'`,;:()]+@[^\s<>"'`,;:()]+/g, "[address]").slice(0, 300);
const errorText = (err: unknown) => err instanceof ProviderError && err.detail ? `${err.message}: ${clip(err.detail)}`
  : err instanceof Error ? clip(err.message) : "Send failed";

// Diagnostic summary of a failure: stage, code and a short message only. Never
// receives request headers, signatures, secrets or the email payload.
export function describeError(err: unknown, stage: string) {
  if (err instanceof ProviderError) return { stage, status: err.status, code: err.code || null, message: clip(err.detail || err.message) };
  const e = err as { name?: string; code?: string; message?: string };
  // JSON.parse messages can quote the raw body, so only the error type is kept.
  if (stage === "parse") return { stage, code: e?.name || "Error" };
  return { stage, code: e?.code || e?.name || "Error", message: clip(e?.message) };
}

type Log = (entry: Record<string, unknown>) => void;
const defaultLog: Log = entry => console.error(JSON.stringify({ fn: "resend-inbound", ...entry }));

export async function receiveWebhook(req: Request, deps: {
  secret: string; getEmail(id: string): Promise<any>; persist(event: string, email: any): Promise<unknown>; log?: Log;
}) {
  const log = deps.log || defaultLog;
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  if (!deps.secret) { log({ stage: "config", code: "missing_webhook_secret" }); return new Response("Webhook not configured", { status: 503 }); }
  const raw = await req.text();
  if (raw.length > 300000) return new Response("Payload too large", { status: 413 });
  let eventId: string;
  try { eventId = await verifyWebhook(raw, req.headers, deps.secret); } catch { log({ stage: "verify", code: "invalid_signature" }); return new Response("Invalid signature", { status: 401 }); }
  let stage = "parse", emailId: string | null = null;
  try {
    const event = JSON.parse(raw);
    if (event.type !== "email.received") return new Response("Ignored");
    stage = "validate";
    const id = event.data?.email_id;
    if (typeof id !== "string" || !/^[a-zA-Z0-9-]{1,100}$/.test(id)) throw new Error("Invalid email id");
    emailId = id;
    stage = "fetch_email";
    const fetched = await deps.getEmail(id);
    stage = "normalize";
    const email = normalizeIncoming(fetched, id);
    if (!email) { log({ stage, code: "no_receiving_recipient", event_id: eventId, email_id: id }); return new Response("OK"); }
    stage = "persist";
    await deps.persist(eventId, email);
    return new Response("OK");
  } catch (err) {
    log({ ...describeError(err, stage), event_id: eventId, email_id: emailId });
    return new Response("Processing failed; retry delivery", { status: 503 });
  }
}

export const must = <T>(result: { data: T; error: { message: string; code?: string } | null }): T => {
  if (result.error) throw Object.assign(new Error(result.error.message), { code: result.error.code });
  return result.data;
};

const PROVIDER_REJECTED = /^Email provider request failed \((400|422)\b/;
// Key-order independent, so a payload read back from jsonb hashes the same as
// when it was first built.
const canonical = (v: unknown): string => Array.isArray(v) ? `[${v.map(canonical).join(",")}]`
  : v && typeof v === "object" ? `{${Object.keys(v).sort().map(k => `${JSON.stringify(k)}:${canonical((v as any)[k])}`).join(",")}}`
  : JSON.stringify(v);
// One idempotency key per saved payload: retries of the same payload reuse it,
// and only a rebuilt payload (after a definite rejection) gets a new one.
export async function sendKey(id: string, payload: unknown) {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonical(payload))));
  return `inbox-${id}-${[...digest.slice(0, 12)].map(b => b.toString(16).padStart(2, "0")).join("")}`;
}

// Durable row + leased processing + immutable payload. Unknown sends are never
// automatically retried after Resend's 24-hour idempotency window expires.
export async function sendStoredMessage(db: any, id: string, api: ReturnType<typeof resendClient>, log: Log = e => console.error(JSON.stringify(e))) {
  const rows: any = must(await db.rpc("claim_inbox_send", { p_id: id }));
  const m = rows?.[0];
  if (!m) return { status: "pending", message: "Already processed or being processed" };
  const patch = async (values: any) => {
    const changed: any = must(await db.from("email_messages").update(values).eq("id", id).eq("lease_token", m.lease_token).select("id"));
    if (!changed?.length) throw new Error("Send lease expired; refresh the saved message before retrying");
  };
  let providerId = m.resend_id;
  try {
    if (!providerId) {
      if (Date.now() - Date.parse(m.first_attempt_at) > 23 * 3600000) {
        await patch({ status: "unknown", last_error: "Retry window expired. Check Resend before composing another email.", locked_until: null });
        return { status: "unknown" };
      }
      const settings: any = must(await db.from("email_settings").select("*").eq("id", 1).single());
      // The From mailbox must still be active (it may have been disabled since queueing).
      if (m.mailbox_id) {
        const box: any = must(await db.from("email_mailboxes").select("status").eq("id", m.mailbox_id).single());
        if (box?.status !== "active") throw new Error("This mailbox is not active. Ask an administrator to re-enable it, then retry.");
      }
      if (!settings.sending_enabled) throw new Error("Sending is disabled in Form Emails");
      const conversation: any = must(await db.from("email_conversations").select("*").eq("id", m.conversation_id).single());
      const to = settings.test_redirect_to ? address(settings.test_redirect_to) : address(conversation.participant_email);
      let payload = m.send_payload;
      // 400/422 means Resend validated and refused the request: nothing was
      // accepted, so the saved payload is rebuilt (and gets a new key below).
      if (payload && PROVIDER_REJECTED.test(m.last_error || "")) payload = null;
      if (payload && payload.to[0] !== to) throw new Error("Sending/test-mode recipient changed. Restore the original setting to retry this saved email.");
      if (!payload) {
        const previous: any = must(await db.from("email_messages").select("*").eq("conversation_id", m.conversation_id)
          .neq("id", id).in("status", ["received", "sent"]).order("created_at", { ascending: false }).limit(30));
        // Best effort: a still-unknown earlier Message-ID only shortens References;
        // it never blocks the reply (the thread Reply-To address routes replies).
        for (const item of previous) {
          if (!item.rfc_message_id && item.resend_id && item.direction === "outgoing")
            item.rfc_message_id = (await reconcileMessage(db, item.id, item.resend_id, api, log)).rfc_message_id || null;
        }
        const refs = previous.map((p: any) => p.rfc_message_id).filter(Boolean).reverse();
        // Test mode keeps its rule: only the test address receives anything.
        payload = { from: fromHeader(m), to: [to], ...(settings.test_redirect_to ? {} : copyRecipients(to, m.cc_email, m.bcc_email)),
          reply_to: [threadAddress(conversation.reply_token)],
          // References only; file contents are read from storage at send time.
          ...(attachmentRefs(m.attachments).length ? { attachments: attachmentRefs(m.attachments) } : {}),
          subject: (settings.test_redirect_to ? "[TEST] " : "") + m.subject, text: m.body_text,
          headers: refs.length ? { "In-Reply-To": refs[refs.length - 1], References: refs.join(" ") } : {} };
        await patch({ send_payload: payload, headers: payload.headers, to_email: to });
      }
      const result = await api("/emails", await withAttachmentContent(payload, path => readAttachment(db, path)), await sendKey(m.id, payload));
      if (typeof result.id !== "string") throw new Error("Missing provider send identifier");
      providerId = result.id;
      await patch({ resend_id: providerId, status: "sent", sent_at: new Date().toISOString(), last_error: null });
    }
    // Accepted. From here on only GETs run: Message-ID and delivery status are
    // reconciled, and a missing Message-ID is a pending state, not an error.
    const status = await reconcileMessage(db, id, providerId, api, log);
    await patch({ status: "sent", locked_until: null, last_error: null });
    return { status: "sent", ...status };
  } catch (err) {
    log({ fn: "inbox-send", ...describeError(err, "send"), message_id: id });
    // Once Resend accepted the email it stays "sent"; the error only applies to unsent mail.
    await patch({ status: providerId ? "sent" : "retry", ...(providerId ? { resend_id: providerId } : {}), locked_until: null,
      last_error: providerId ? null : errorText(err) });
    return { status: providerId ? "sent" : "retry" };
  }
}

// Outgoing attachments saved by queue_inbox_message (immutable storage objects).
export const attachmentRefs = (list: unknown) => (Array.isArray(list) ? list : [])
  .filter((a: any) => typeof a?.path === "string" && a.path.startsWith("outgoing/"))
  .map((a: any) => ({ filename: String(a.filename || "attachment"), storage_path: a.path as string }));

export function toBase64(bytes: Uint8Array) {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

async function readAttachment(db: any, path: string) {
  const { data, error } = await db.storage.from("email-attachments").download(path);
  if (error || !data) throw new Error("Could not read an attachment from storage. Retry shortly.");
  return new Uint8Array(await data.arrayBuffer());
}

// The Resend request: stored references replaced by base64 content. The saved
// payload (and so the idempotency key) keeps only the references.
export async function withAttachmentContent(payload: any, read: (path: string) => Promise<Uint8Array>) {
  if (!Array.isArray(payload.attachments) || !payload.attachments.length) return payload;
  const attachments = [];
  for (const a of payload.attachments) attachments.push({ filename: a.filename, content: toBase64(await read(a.storage_path)) });
  return { ...payload, attachments };
}

// Resend documents message_id as "<…>"; a bare "id@host" value is accepted too.
export const providerMessageId = (value: unknown) => {
  const raw = String(value || "").trim();
  return messageIds(raw)[0] || (/^[^\s<>@]+@[^\s<>@]+$/.test(raw) ? `<${raw}>` : null);
};

// Reads (never sends) the accepted email and stores its RFC Message-ID and last
// provider event. Failures are logged and leave the row unchanged.
export async function reconcileMessage(db: any, id: string, resendId: string, api: ReturnType<typeof resendClient>, log: Log = e => console.error(JSON.stringify(e))) {
  try {
    const full = await api(`/emails/${encodeURIComponent(resendId)}`);
    const values: Record<string, unknown> = { provider_checked_at: new Date().toISOString() };
    const rfc = providerMessageId(full?.message_id);
    if (rfc) values.rfc_message_id = rfc;
    if (typeof full?.last_event === "string") values.provider_event = full.last_event.slice(0, 40);
    must(await db.from("email_messages").update(values).eq("id", id).eq("resend_id", resendId));
    return { rfc_message_id: rfc, provider_event: values.provider_event as string | undefined };
  } catch (err) {
    log({ fn: "inbox", ...describeError(err, "reconcile"), message_id: id });
    return { rfc_message_id: null };
  }
}

// After an inbound reply, fill in Message-IDs of this thread's accepted emails.
export async function reconcileConversation(db: any, conversationId: string, api: ReturnType<typeof resendClient>, log?: Log) {
  const pending = await db.from("email_messages").select("id,resend_id").eq("conversation_id", conversationId)
    .eq("direction", "outgoing").not("resend_id", "is", null).is("rfc_message_id", null).limit(10);
  for (const row of pending.data || []) await reconcileMessage(db, row.id, row.resend_id, api, log);
}

// ---------------------------------------------------------------------------
// Shared mailbox setup checks (mailbox-verify). 'active' is reached only when
// confirm_mailbox_verification sees the probe come back through the webhook.
// ---------------------------------------------------------------------------
export const PROBE_WAIT_MINUTES = 15;
const hex = (bytes: Uint8Array) => [...bytes].map(b => b.toString(16).padStart(2, "0")).join("");
export async function sha256(value: string) {
  return hex(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))));
}

export async function verifyMailbox(db: any, api: ReturnType<typeof resendClient>, id: string,
  token = hex(crypto.getRandomValues(new Uint8Array(32))), now = new Date()) {
  const box: any = must(await db.from("email_mailboxes").select("*").eq("id", id).single());
  if (box.status === "disabled") return { status: box.status, detail: "Enable the mailbox before verifying it." };
  const save = async (values: Record<string, unknown>) =>
    must(await db.from("email_mailboxes").update({ ...values, updated_at: now.toISOString() }).eq("id", id).select("*").single());
  // An active mailbox stays active while re-checking; others record the failure.
  const fail = async (detail: string) => {
    const saved: any = await save(box.status === "active" ? { status_detail: `Re-check failed: ${detail}` } : { status: "setup_failed", status_detail: detail });
    return { status: saved.status, detail: saved.status_detail };
  };
  const domain = box.address.split("@")[1];
  let note = "";
  try {
    const list: any[] = (await api("/domains"))?.data || [];
    const sending = list.find(d => d?.name === domain);
    if (!sending) return fail(`${domain} is not a domain in Resend, so it cannot send.`);
    if (sending.status !== "verified" || sending.capabilities?.sending === "disabled") return fail(`${domain} is not verified for sending in Resend (status: ${sending.status}).`);
    // Receiving is decided by the test email; this only adds a hint.
    if (list.some(d => d?.capabilities) && !list.some(d => d?.capabilities?.receiving === "enabled"))
      note = " Resend reports no domain with receiving enabled, so the test email may not arrive.";
  } catch (err) {
    // A sending-only key cannot list domains; the test email still proves sending.
    if (!(err instanceof ProviderError && [401, 403].includes(err.status))) return fail(`Could not check Resend domains: ${errorText(err)}`);
    note = " (The API key cannot read domain status; relying on the test email.)";
  }
  const tokenHash = await sha256(token);
  must(await db.from("email_mailbox_verifications").upsert({ mailbox_id: id, token_hash: tokenHash, sent_at: now.toISOString(), confirmed_at: null }));
  try {
    await api("/emails", {
      from: fromHeader({ from_email: box.address, from_name: box.name }), to: [box.address],
      subject: "Airfair dashboard: mailbox verification",
      text: `This automatic test checks that ${box.address} can send through Resend and that Google Workspace forwards it to the dashboard (${box.receiving_address}). You can delete it.`,
      headers: { "X-Airfair-Mailbox-Verify": token },
    }, `mailbox-verify-${id}-${tokenHash.slice(0, 24)}`);
  } catch (err) {
    return fail(`Resend did not accept a test email from ${box.address}: ${errorText(err)}`);
  }
  const saved: any = await save({ sending_verified_at: now.toISOString(),
    ...(box.status === "active" ? {} : { status: "pending" }),
    status_detail: `Test email sent ${now.toISOString()}. Waiting for it to arrive at ${box.receiving_address} through Google Workspace forwarding.${note}` });
  return { status: saved.status, detail: saved.status_detail, probe_sent: true };
}

// A probe that has not come back after PROBE_WAIT_MINUTES means forwarding is missing.
export async function checkMailbox(db: any, id: string, now = new Date()) {
  const box: any = must(await db.from("email_mailboxes").select("*").eq("id", id).single());
  const probe: any = must(await db.from("email_mailbox_verifications").select("sent_at,confirmed_at").eq("mailbox_id", id).maybeSingle());
  if (box.status === "pending" && probe && !probe.confirmed_at && now.getTime() - Date.parse(probe.sent_at) > PROBE_WAIT_MINUTES * 60000) {
    const saved: any = must(await db.from("email_mailboxes").update({ status: "setup_failed", updated_at: now.toISOString(),
      status_detail: `The test email sent ${probe.sent_at} did not reach the dashboard. Check that Google Workspace delivers ${box.address} and forwards a copy to ${box.receiving_address}, then Verify Setup again.` })
      .eq("id", id).eq("status", "pending").select("*").single());
    return saved;
  }
  return box;
}
