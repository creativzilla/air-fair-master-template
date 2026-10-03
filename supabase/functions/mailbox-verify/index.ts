// Admin-only shared mailbox setup checks. The Resend key stays here.
// verify: check the Resend domain, send a test email from the mailbox to itself.
// check:  mark a probe that never came back as Setup Failed.
import { createClient } from "npm:@supabase/supabase-js@2";
import { allowedOrigins, checkMailbox, corsHeaders, resendClient, verifyMailbox } from "../_shared/inbox/core.ts";
const url = Deno.env.get("SUPABASE_URL")!;
const db = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const api = resendClient(Deno.env.get("RESEND_API_KEY") || "");
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
    // Same rule as public.is_admin(): an active profile with role admin.
    const profile = await db.from("profiles").select("role,is_active").eq("id", user.id).maybeSingle();
    if (profile.error || profile.data?.role !== "admin" || !profile.data?.is_active) return reply({ error: "Only administrators can verify mailboxes" }, 403);
    const body = await req.json().catch(() => ({}));
    if (typeof body.mailbox_id !== "string" || !/^[0-9a-f-]{36}$/i.test(body.mailbox_id)) return reply({ error: "Invalid mailbox" }, 400);
    if (body.action === "verify") return reply(await verifyMailbox(db, api, body.mailbox_id));
    if (body.action === "check") return reply(await checkMailbox(db, body.mailbox_id));
    return reply({ error: "Unknown action" }, 400);
  } catch (err) {
    console.error(JSON.stringify({ fn: "mailbox-verify", code: (err as any)?.code || (err as any)?.name || "Error" }));
    return reply({ error: err instanceof Error ? err.message : "Verification failed" }, 400);
  }
});
