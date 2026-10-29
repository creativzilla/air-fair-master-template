import { isUuid, readJsonObject, publicFailure } from "../_shared/auth/http.ts";
import { budgetedEmailFetch, throttleEmailAction } from "../_shared/auth/emailBudget.ts";
// Admin-only shared mailbox setup checks. The Resend key stays here.
// verify: check the Resend domain, send a test email from the mailbox to itself.
// check:  mark a probe that never came back as Setup Failed.
import { createClient } from "npm:@supabase/supabase-js@2";
import { allowedOrigins, checkMailbox, corsHeaders, resendClient, verifyMailbox } from "../_shared/inbox/core.ts";
const url = Deno.env.get("SUPABASE_URL")!;
const db = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const api = resendClient(Deno.env.get("RESEND_API_KEY") || "", budgetedEmailFetch(db));
const origins = allowedOrigins(Deno.env.get("EXTRA_ALLOWED_ORIGINS") || "");
Deno.serve(async req => {
  const headers = corsHeaders(req.headers.get("origin") || "", origins);
  const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });
  if (req.method === "OPTIONS") return reply({});
  if (req.method !== "POST") return reply({ error: "Method not allowed" }, 405);
  try {
    const caller = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: req.headers.get("authorization") || "" } }, auth: { persistSession: false } });
    const { data: { user } } = await caller.auth.getUser();
    if (!user) return reply({ error: "Sign in required" }, 401);
    // Use the same verified-account rule as RLS.
    const access = await caller.rpc("is_admin");
    if (access.error || access.data !== true) return reply({ error: "Only administrators can verify mailboxes" }, 403);
    const body = await readJsonObject(req, 16000);
    if (!isUuid(body.mailbox_id)) return reply({ error: "Invalid mailbox" }, 400);
    if (body.action === "verify") {
      await throttleEmailAction(db,user.id,'mailbox_verify',3600,10);
      return reply(await verifyMailbox(db, api, body.mailbox_id));
    }
    if (body.action === "check") return reply(await checkMailbox(db, body.mailbox_id));
    return reply({ error: "Unknown action" }, 400);
  } catch (err) {
    console.error(JSON.stringify({ fn: "mailbox-verify", stage: "request_failed" }));
    const failure = publicFailure(err, "Mailbox verification failed. Please retry.");
    return reply(failure.body, failure.status);
  }
});
