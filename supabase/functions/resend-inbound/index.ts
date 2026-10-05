import { createClient } from "npm:@supabase/supabase-js@2";
import { must, receiveWebhook, reconcileConversation, resendClient } from "../_shared/inbox/core.ts";
import { sha256Hex } from "../_shared/forms/tokens.ts";
const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const api = resendClient(Deno.env.get("RESEND_API_KEY") || "");
Deno.serve(req => receiveWebhook(req, {
  secret: Deno.env.get("RESEND_WEBHOOK_SECRET") || "",
  getEmail: id => api(`/emails/receiving/${encodeURIComponent(id)}`),
  // Campaign delivery tracking and suppression (hard bounces, complaints).
  onStatusEvent: async (eventId, event) => {
    const d = event.data || {};
    must(await db.rpc("campaign_provider_event", { p_event_id: eventId, p_type: event.type, p_email_id: typeof d.email_id === "string" ? d.email_id : null,
      p_to: Array.isArray(d.to) ? d.to.map((a: unknown) => String(a).replace(/^.*<([^>]+)>.*$/, "$1").trim().toLowerCase()) : [],
      p_bounce_type: d.bounce?.type ?? null, p_detail: d.bounce?.message ? String(d.bounce.message).slice(0, 300) : null }));
  },
  persist: async (event, email) => {
    // Mailbox setup probe (see mailbox-verify): a matching one-time token that
    // arrived for that mailbox proves receiving. Anything else is stored normally.
    if (email.verify_token) {
      const confirmed = must(await db.rpc("confirm_mailbox_verification", { p_token_hash: await sha256Hex(email.verify_token), p_recipients: email.recipients }));
      if (confirmed) return;
    }
    const conversation = must(await db.rpc("accept_inbound_email", { p_event: event, p_email: email })) as string;
    // Best effort, after the committed insert: never changes the webhook result.
    await reconcileConversation(db, conversation, api).catch(() => {});
  },
}));
