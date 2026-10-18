import { isUuid, readJsonObject, publicFailure } from "../_shared/auth/http.ts";
import { budgetedEmailFetch, throttleEmailAction } from "../_shared/auth/emailBudget.ts";
// Bulk email campaigns, server side.
//   POST {action:"run"}           pg_cron (header x-campaign-worker-secret): send due jobs
//   POST {action:"test", ...}     signed-in user: send one test email to their own address
//   POST {action:"unsubscribe"}   public: campaign unsubscribe link (website page)
//   POST ?unsubscribe=<token>     public: RFC 8058 one-click unsubscribe (List-Unsubscribe-Post)
// The Resend key never leaves this function.
import { createClient } from "npm:@supabase/supabase-js@2";
import { allowedOrigins, corsHeaders } from "../_shared/inbox/core.ts";
import { renderCampaignEmail } from "../_shared/campaigns/render.ts";
import { resendSender, runWorker } from "../_shared/campaigns/worker.ts";

const url = Deno.env.get("SUPABASE_URL")!;
const db = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const send = resendSender(Deno.env.get("RESEND_API_KEY") || "", budgetedEmailFetch(db));
const SITE_URL = (Deno.env.get("SITE_URL") || "https://airfairtravel.com").replace(/\/+$/, "");
const FUNCTIONS_URL = `${url}/functions/v1`;
const origins = allowedOrigins(Deno.env.get("EXTRA_ALLOWED_ORIGINS") || "");
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async req => {
  const headers = corsHeaders(req.headers.get("origin") || "", origins);
  const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });
  if (req.method === "OPTIONS") return reply({});
  if (req.method !== "POST") return reply({ error: "Method not allowed" }, 405);
  try {
    const oneClick = new URL(req.url).searchParams.get("unsubscribe");
    if (oneClick) {
      if (!UUID.test(oneClick)) return new Response("Invalid link", { status: 400 });
      await db.rpc("campaign_unsubscribe", { p_token: oneClick });
      return new Response("Unsubscribed", { status: 200 });
    }
    const body = await readJsonObject(req, 200000);

    if (body.action === "run") {
      const ok = await db.rpc("campaign_worker_secret_ok", { p_secret: req.headers.get("x-campaign-worker-secret") || "" });
      if (ok.data !== true) return reply({ error: "Forbidden" }, 403);
      return reply(await runWorker(db, send, { siteUrl: SITE_URL, functionsUrl: FUNCTIONS_URL }));
    }

    if (body.action === "unsubscribe") {
      if (typeof body.token !== "string" || !UUID.test(body.token)) return reply({ ok: false, error: "This unsubscribe link is not valid." }, 400);
      const { data } = await db.rpc("campaign_unsubscribe", { p_token: body.token });
      return data ? reply({ ok: true, status: "unsubscribed" }) : reply({ ok: false, error: "This unsubscribe link is not valid." }, 400);
    }

    if (body.action === "test") {
      if (!isUuid(body.mailbox_id)) return reply({ error: "Invalid mailbox ID." }, 400);
      // Signed-in user with send access to the chosen mailbox; goes only to their own registered email.
      const caller = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: req.headers.get("authorization") || "" } }, auth: { persistSession: false } });
      const { data: { user } } = await caller.auth.getUser();
      if (!user?.email) return reply({ error: "Sign in required" }, 401);
      const manage = await caller.rpc("can_manage_campaigns");
      const canSend = await caller.rpc("can_send_mailbox", { p_mailbox: body.mailbox_id });
      if (manage.data !== true || canSend.data !== true) return reply({ error: "You cannot send from this mailbox" }, 403);
      await throttleEmailAction(db,user.id,'campaign_test',3600,10);
      const settings = (await db.from("email_settings").select("sending_enabled").eq("id", 1).single()).data;
      if (!settings?.sending_enabled) return reply({ error: "Sending is turned off in Form Emails." }, 400);
      const box = (await db.from("email_mailboxes").select("name,address,receiving_address").eq("id", body.mailbox_id).single()).data;
      if (!box) return reply({ error: "Mailbox not found" }, 400);
      const kind = body.kind === "promotional" ? "promotional" : "service";
      const msg = renderCampaignEmail({ kind, subject: String(body.subject || "").slice(0, 200), body_html: String(body.body_html || "").slice(0, 100000),
        first_name_fallback: String(body.first_name_fallback || "there").slice(0, 40), from_name: box.name }, String(body.sample_first_name || "").slice(0, 40) || null,
        { unsubscribeUrl: `${SITE_URL}/newsletter/unsubscribe?c=00000000-0000-0000-0000-000000000000`, oneClickUrl: `${FUNCTIONS_URL}/campaign-worker?unsubscribe=00000000-0000-0000-0000-000000000000` });
      const res = await send({ from: `${box.name} <${box.address}>`, to: [user.email], reply_to: [box.receiving_address], subject: `[TEST] ${msg.subject}`,
        html: msg.html, text: msg.text, ...(Object.keys(msg.headers).length ? { headers: msg.headers } : {}) }, `campaign-test-${crypto.randomUUID()}`);
      return res.ok ? reply({ ok: true, to: user.email }) : reply({ error: "The email provider could not accept the test message. Check the mailbox setup and retry." }, 400);
    }
    return reply({ error: "Unknown action" }, 400);
  } catch (err) {
    console.error(JSON.stringify({ fn: "campaign-worker", stage: "request_failed" }));
    const failure = publicFailure(err, "Campaign request failed. Please retry.");
    return reply(failure.body, failure.status);
  }
});
