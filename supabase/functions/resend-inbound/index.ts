import { createClient } from "npm:@supabase/supabase-js@2";
import { must, receiveWebhook, reconcileConversation, resendClient } from "../_shared/inbox/core.ts";
import { sha256Hex } from "../_shared/forms/tokens.ts";
const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const api = resendClient(Deno.env.get("RESEND_API_KEY") || "");
Deno.serve(req => receiveWebhook(req, {
  secret: Deno.env.get("RESEND_WEBHOOK_SECRET") || "",
  getEmail: id => api(`/emails/receiving/${encodeURIComponent(id)}`),
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
