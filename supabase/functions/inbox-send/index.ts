import { createClient } from "npm:@supabase/supabase-js@2";
import { allowedOrigins, corsHeaders, must, resendClient, sendStoredMessage } from "../_shared/inbox/core.ts";
const url = Deno.env.get("SUPABASE_URL")!;
const db = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const api = resendClient(Deno.env.get("RESEND_API_KEY") || "");
const origins = allowedOrigins(Deno.env.get("EXTRA_ALLOWED_ORIGINS") || "");
Deno.serve(async req => {
  const headers = corsHeaders(req.headers.get("origin") || "", origins);
  const reply = (body: unknown, status=200) => new Response(JSON.stringify(body), { status, headers });
  if (req.method === "OPTIONS") return reply({});
  if (req.method !== "POST") return reply({ error: "Method not allowed" },405);
  // Every path, including unexpected failures, returns CORS headers so the
  // dashboard shows the real error instead of a browser network failure.
  try {
    const caller = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: req.headers.get("authorization") || "" } }, auth: { persistSession: false } });
    const { data: { user } } = await caller.auth.getUser();
    if (!user) return reply({ error: "Sign in required" },401);
    const access = await caller.rpc("can_use_email_inbox");
    if (access.error || access.data !== true) return reply({ error: "Inbox access denied" },403);
    try {
      const raw = await req.text();
      if (raw.length > 60000) return reply({ error: "Message too large" },413);
      const body = JSON.parse(raw);
      let message: any;
      if (body.message_id) {
        // RLS: only messages in mailboxes the caller can read.
        message = must(await caller.from("email_messages").select("id,conversation_id,outbox_id,mailbox_id,resend_id").eq("id", body.message_id).single());
        if (message.outbox_id) return reply({ error: "Retry form confirmations from Form Emails" },400);
        // Retrying an unsent email sends from its mailbox: needs send permission. A
        // status refresh (already accepted) only reads, so read access suffices.
        if (!message.resend_id && message.mailbox_id) {
          const allowed = await caller.rpc("can_send_mailbox", { p_mailbox: message.mailbox_id });
          if (allowed.error || allowed.data !== true) return reply({ error: "You cannot send from this mailbox (no permission, or it is not active)" },403);
        }
      } else {
        // Manual CC/BCC are validated, deduplicated and combined with the
        // sender copy in queue_inbox_message, as the signed-in user.
        const list = (v: unknown) => v === undefined || v === null ? null
          : Array.isArray(v) && v.length <= 20 && v.every(x => typeof x === "string" && x.length <= 254) ? v : undefined;
        const cc = list(body.cc), bcc = list(body.bcc);
        if (cc === undefined || bcc === undefined) return reply({ error: "Invalid recipient list" },400);
        // Uploaded file references; the queue function checks ownership, size and type in storage.
        const files = body.attachments;
        if (files !== undefined && !(Array.isArray(files) && files.length <= 5 && files.every((f: any) =>
          typeof f?.path === "string" && f.path.length <= 500 && typeof f?.filename === "string" && f.filename.length <= 255)))
          return reply({ error: "Invalid attachments" },400);
        message = must(await caller.rpc("queue_inbox_message", { p_key: body.request_key, p_contact: body.contact_id || null,
          p_conversation: body.conversation_id || null, p_subject: body.subject || "", p_body: body.body || "",
          ...(cc || bcc ? { p_cc: cc || [], p_bcc: bcc || [] } : {}),
          ...(files?.length ? { p_attachments: files.map((f: any) => ({ path: f.path, filename: f.filename })) } : {}),
          // From mailbox; permission and status are enforced in queue_inbox_message.
          ...(typeof body.mailbox_id === "string" ? { p_mailbox: body.mailbox_id } : {}) }));
      }
      const result = await sendStoredMessage(db, message.id, api);
      return reply({ ...result, message_id: message.id, conversation_id: message.conversation_id });
    } catch (err) { return reply({ error: err instanceof Error ? err.message : "Could not send email" },400); }
  } catch (err) {
    console.error(JSON.stringify({ fn: "inbox-send", stage: "auth", code: (err as any)?.code || (err as any)?.name || "Error" }));
    return reply({ error: "Could not verify sign-in. Retry shortly." },503);
  }
});
