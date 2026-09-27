// form-submit: website form submissions, their emails, and newsletter
// double opt-in, for the Air Fair website.
//
// Actions (POST JSON { action, ... }):
//   submit_form            public   { submission, guard }   save + staff/client emails
//   newsletter_subscribe   public   { email, source_page, guard }   confirmation email
//   newsletter_confirm     public   { token }
//   newsletter_unsubscribe public   { token }
//   process_due            public (5-min schedule)  send queued emails that are due; nothing else
//   process_outbox         admin / editor JWT   { retry_failed? }   send due retries now
//
// Recipients come only from public.email_settings (edited by admins in the
// dashboard) and the submitter's own address; the sender is fixed. Secrets
// (RESEND_API_KEY, service role) stay in the function environment.
import { createClient } from "npm:@supabase/supabase-js@2";
import { DEFAULT_SETTINGS, type EmailSettings } from "../_shared/forms/routing.ts";
import { createResendMailer } from "../_shared/forms/resend.ts";
import { randomToken, sha256Hex } from "../_shared/forms/tokens.ts";
import {
  handleNewsletterConfirm, handleNewsletterSubscribe, handleNewsletterUnsubscribe, handleProcessDue, handleProcessOutbox, handleSubmitForm,
  type Deps, type OutboxDraft, type OutboxRow, type Store, type Subscriber,
} from "../_shared/forms/handlers.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SITE_URL = (Deno.env.get("SITE_URL") || "https://airfairtravel.com").replace(/\/+$/, "");
// Keys the rate-limit hashes so raw IP addresses are never stored.
const HASH_SALT = Deno.env.get("RATE_LIMIT_SALT") || SERVICE_KEY;
const ALLOWED_ORIGINS = new Set([
  "https://airfairtravel.com", "https://www.airfairtravel.com", "http://localhost:5173", "http://localhost:4173",
  ...(Deno.env.get("EXTRA_ALLOWED_ORIGINS") || "").split(",").map(o => o.trim()).filter(Boolean),
]);

const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const escapeLike = (value: string) => value.replace(/[\\%_]/g, m => `\\${m}`);
const must = <T>(result: { data: T; error: { message: string } | null }) => {
  if (result.error) throw new Error(result.error.message);
  return result.data;
};

const store: Store = {
  async getEmailSettings() {
    const { data } = await db.from("email_settings").select("*").eq("id", 1).maybeSingle();
    return { ...DEFAULT_SETTINGS, ...(data ?? {}) } as EmailSettings;
  },
  async getBusinessName() {
    const { data } = await db.from("site_settings").select("business_name").order("updated_at", { ascending: false }).limit(1).maybeSingle();
    return (data?.business_name as string) || "Air Fair Travel & Immigration";
  },
  async getPublishedForm(formKey) {
    const { data } = await db.from("cms_published").select("content").eq("kind", "form").eq("slug", formKey).maybeSingle();
    return data ? { content: (data.content ?? {}) as Record<string, unknown> } : null;
  },
  async getItemName(kind, slug) {
    const { data } = await db.from("cms_published").select("title, content").eq("kind", kind).eq("slug", slug).maybeSingle();
    const content = (data?.content ?? {}) as { title?: string };
    return content.title || (data?.title as string) || null;
  },
  async rateLimitHit(bucket, keyHash, windowSeconds, max) {
    return Boolean(must(await db.rpc("rate_limit_hit", { p_bucket: bucket, p_key_hash: keyHash, p_window_seconds: windowSeconds, p_max: max })));
  },
  async insertSubmission(row) {
    const inserted = must(await db.from("form_submissions").upsert(row, { onConflict: "id", ignoreDuplicates: true }).select("created_at")) as Array<{ created_at: string }>;
    if (inserted.length) return { inserted: true, createdAt: inserted[0].created_at };
    const existing = must(await db.from("form_submissions").select("created_at").eq("id", row.id as string).single()) as { created_at: string };
    return { inserted: false, createdAt: existing.created_at };
  },
  async findRecentSubmission(email, formId, sinceIso, excludeId) {
    const rows = must(await db.from("form_submissions").select("id").ilike("email", escapeLike(email)).eq("form_id", formId)
      .gte("created_at", sinceIso).neq("id", excludeId).limit(1)) as unknown[];
    return rows.length > 0;
  },
  async countRecentEmails(kind, toEmail, sinceIso) {
    const { count, error } = await db.from("email_outbox").select("id", { count: "exact", head: true })
      .eq("kind", kind).ilike("to_email", escapeLike(toEmail)).gte("created_at", sinceIso).neq("status", "skipped");
    if (error) throw new Error(error.message);
    return count ?? 0;
  },
  async insertOutbox(drafts: OutboxDraft[]) {
    if (!drafts.length) return [];
    return must(await db.from("email_outbox").upsert(drafts, { onConflict: "dedupe_key", ignoreDuplicates: true }).select("*")) as OutboxRow[];
  },
  async claimOutbox(ids, limit) {
    return must(await db.rpc("claim_email_outbox", { p_ids: ids, p_limit: limit })) as OutboxRow[];
  },
  async updateOutbox(id, patch) {
    must(await db.from("email_outbox").update(patch).eq("id", id));
  },
  async resetFailedOutbox() {
    const rows = must(await db.from("email_outbox").update({ status: "retry", attempts: 0, next_attempt_at: new Date().toISOString() })
      .eq("status", "failed").select("id")) as unknown[];
    return rows.length;
  },
  async findSubscriberByEmail(email) {
    const { data } = await db.from("newsletter_subscribers").select("*").ilike("email", escapeLike(email)).maybeSingle();
    return (data as Subscriber) ?? null;
  },
  async insertSubscriber(row) {
    return must(await db.from("newsletter_subscribers").insert(row).select("*").single()) as Subscriber;
  },
  async updateSubscriber(id, patch) {
    must(await db.from("newsletter_subscribers").update(patch).eq("id", id));
  },
  async findSubscriberByTokenHash(column, hash) {
    const { data } = await db.from("newsletter_subscribers").select("*").eq(column, hash).maybeSingle();
    return (data as Subscriber) ?? null;
  },
};

const deps: Deps = {
  store,
  mailer: createResendMailer(Deno.env.get("RESEND_API_KEY"), fetch),
  now: () => new Date(),
  siteUrl: SITE_URL,
  hash: value => sha256Hex(`${HASH_SALT}:${value}`),
  randomToken: () => randomToken(32),
  // Send after the response so visitors don't wait for Resend.
  defer: work => {
    const runtime = (globalThis as { EdgeRuntime?: { waitUntil(p: Promise<unknown>): void } }).EdgeRuntime;
    const guarded = work.catch(err => console.error("form-submit background error:", err instanceof Error ? err.message : String(err)));
    if (runtime?.waitUntil) runtime.waitUntil(guarded);
    else return guarded.then(() => undefined);
  },
};

async function callerRole(authHeader: string): Promise<string | null> {
  if (!authHeader) return null;
  const asCaller = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } });
  const { data: { user } } = await asCaller.auth.getUser();
  if (!user) return null;
  const { data } = await db.from("profiles").select("role,is_active").eq("id", user.id).maybeSingle();
  return data?.is_active ? (data.role as string) : null;
}

Deno.serve(async req => {
  const origin = req.headers.get("Origin") ?? "";
  const cors: Record<string, string> = {
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
    ...(ALLOWED_ORIGINS.has(origin) ? { "Access-Control-Allow-Origin": origin } : {}),
  };
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);
  if (Number(req.headers.get("content-length") ?? 0) > 300_000) return json({ ok: false, error: "Request too large." }, 413);

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ ok: false, error: "Invalid request body." }, 400); }
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || req.headers.get("x-real-ip");

  try {
    let reply;
    switch (body.action) {
      case "submit_form": reply = await handleSubmitForm(deps, body, { ip }); break;
      case "newsletter_subscribe": reply = await handleNewsletterSubscribe(deps, body, { ip }); break;
      case "newsletter_confirm": reply = await handleNewsletterConfirm(deps, body); break;
      case "newsletter_unsubscribe": reply = await handleNewsletterUnsubscribe(deps, body); break;
      case "process_due": reply = await handleProcessDue(deps, { ip }); break;
      case "process_outbox": reply = await handleProcessOutbox(deps, body, await callerRole(req.headers.get("Authorization") ?? "")); break;
      default: reply = { status: 400, body: { ok: false, error: "Unknown action." } };
    }
    return json(reply.body, reply.status);
  } catch (err) {
    console.error("form-submit error:", err instanceof Error ? err.message : String(err));
    return json({ ok: false, error: "Something went wrong. Please try again." }, 500);
  }
});
