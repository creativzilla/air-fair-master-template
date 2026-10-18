// Campaign sending loop (campaign-worker Edge Function, started by pg_cron).
// One short run per invocation: claim due jobs (leased, SKIP LOCKED), send each
// with a stable Idempotency-Key, record the outcome. Nothing waits between
// batches here: drip intervals live in the database (next_batch_at).
import { renderCampaignEmail } from "./render.ts";

export type SendResult = { ok: true; id: string } | { ok: false; status: number; name: string; message: string; network?: boolean };
export type Sender = (payload: Record<string, unknown>, idempotencyKey: string) => Promise<SendResult>;

export function resendSender(apiKey: string, fetcher: typeof fetch = fetch): Sender {
  return async (payload, key) => {
    if (!apiKey) return { ok: false, status: 0, name: "missing_api_key", message: "RESEND_API_KEY is not set", network: false };
    let response: Response;
    try {
      response = await fetcher("https://api.resend.com/emails", {
        method: "POST", signal: AbortSignal.timeout(15000),
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "Idempotency-Key": key },
        body: JSON.stringify(payload),
      });
    } catch (err) {
      // Timeout or connection loss: Resend may or may not have accepted it.
      return { ok: false, status: 0, name: "network_error", message: err instanceof Error ? err.message : String(err), network: true };
    }
    const data: any = await response.json().catch(() => ({}));
    if (response.ok && typeof data.id === "string") return { ok: true, id: data.id };
    return { ok: false, status: response.status, name: String(data.name || ""), message: String(data.message || `HTTP ${response.status}`).slice(0, 300) };
  };
}

export const BACKOFF_MINUTES = [1, 5, 15, 60];
export const MAX_ATTEMPTS = 5;
const IDEMPOTENCY_WINDOW_MS = 23 * 3600 * 1000; // Resend keeps keys for 24 h

// Decide what a send result means for the job.
export function classify(res: SendResult, attempts: number, now: Date) {
  if (res.ok) return { outcome: "accepted" as const, providerId: res.id };
  const retryAt = (mins: number) => new Date(now.getTime() + mins * 60000).toISOString();
  const err = `${res.name || "error"}: ${res.message}`;
  if (["app_email_budget_exceeded", "app_email_budget_unavailable"].includes(res.name))
    return { outcome: "requeue_pause" as const, error: "Paused: application email budget reached or unavailable. Resume after the budget resets or the check is restored.", stop: true };
  if (["daily_quota_exceeded", "monthly_quota_exceeded", "email_above_quota"].includes(res.name))
    return { outcome: "requeue_pause" as const, error: `Paused: provider sending quota reached (${res.name}). Resume when the quota resets.`, stop: true };
  if (res.name === "rate_limit_exceeded" || res.status === 429) return { outcome: "retry" as const, error: err, retryAt: retryAt(1), stop: true };
  if (res.name === "concurrent_idempotent_requests") return { outcome: "retry" as const, error: err, retryAt: retryAt(1) };
  // Same key, different body: never resend under a new key; needs a person.
  if (res.name === "invalid_idempotent_request") return { outcome: "unknown" as const, error: `${err} (not resent; check Resend)` };
  const temporary = res.network || res.status >= 500 || res.status === 0;
  if (!temporary) return { outcome: "failed" as const, error: err };
  if (attempts >= MAX_ATTEMPTS) return { outcome: res.network ? "unknown" as const : "failed" as const, error: `${err} (gave up after ${attempts} attempts)` };
  return { outcome: "retry" as const, error: err, retryAt: retryAt(BACKOFF_MINUTES[Math.min(attempts - 1, BACKOFF_MINUTES.length - 1)]) };
}

export type WorkerOptions = { siteUrl: string; functionsUrl: string; budgetMs?: number; paceMs?: number; claimSize?: number;
  now?: () => Date; sleep?: (ms: number) => Promise<void>; log?: (e: Record<string, unknown>) => void };

export async function runWorker(db: any, send: Sender, o: WorkerOptions) {
  const now = o.now || (() => new Date()), sleep = o.sleep || (ms => new Promise(r => setTimeout(r, ms)));
  const started = now().getTime(), budget = o.budgetMs ?? 45000, pace = o.paceMs ?? 520, claimSize = o.claimSize ?? 40;
  const log = o.log || (e => console.log(JSON.stringify({ fn: "campaign-worker", ...e })));
  const settings = (await db.from("email_settings").select("sending_enabled,test_redirect_to").eq("id", 1).single()).data;
  if (!settings?.sending_enabled) { log({ stage: "skip", reason: "sending disabled" }); return { sent: 0, skipped: "Sending is turned off in Form Emails" }; }
  const summary: Record<string, number> = { accepted: 0, retry: 0, failed: 0, unknown: 0, requeue_pause: 0 };
  let stop = false;
  // Claim only while there is time to send the whole claim (leases cover crashes).
  while (!stop && now().getTime() - started + claimSize * pace < budget) {
    const { data: jobs, error } = await db.rpc("campaign_claim_jobs", { p_limit: claimSize });
    if (error) throw new Error(`claim failed: ${error.message}`);
    if (!jobs?.length) break;
    for (const job of jobs) {
      // A job retried after an ambiguous failure must stay within the
      // provider's idempotency window; after that, never resend blindly.
      if (job.attempts > 1 && job.first_attempt_at && now().getTime() - Date.parse(job.first_attempt_at) > IDEMPOTENCY_WINDOW_MS) {
        await db.rpc("campaign_job_result", { p_job: job.id, p_lease: job.lease_token, p_outcome: "unknown",
          p_error: "Outcome unknown and the provider's 24-hour duplicate protection has expired; not resent. Check Resend." });
        summary.unknown++; continue;
      }
      if (stop) {
        // Leave remaining claimed jobs for the next run (lease expires → reclaimed with the same key).
        await db.rpc("campaign_job_result", { p_job: job.id, p_lease: job.lease_token, p_outcome: "retry", p_error: "Deferred to next run", p_retry_at: new Date(now().getTime() + 60000).toISOString() });
        continue;
      }
      const msg = renderCampaignEmail(job, job.first_name, {
        unsubscribeUrl: `${o.siteUrl}/newsletter/unsubscribe?c=${job.unsubscribe_token}`,
        oneClickUrl: `${o.functionsUrl}/campaign-worker?unsubscribe=${job.unsubscribe_token}`,
      });
      const testTo = settings.test_redirect_to;
      // Campaign CC/BCC go on every email; never the recipient's own address,
      // and none in test mode (only the test address receives anything).
      const copies = (list: unknown) => testTo ? [] : (Array.isArray(list) ? list : []).filter((a: string) => a.toLowerCase() !== String(job.email).toLowerCase());
      const cc = copies(job.cc), bcc = copies(job.bcc);
      const payload = {
        from: `${/[(),.:;@[\]]/.test(job.from_name) ? `"${job.from_name.replace(/"/g, "")}"` : job.from_name} <${job.from_email}>`,
        to: [testTo || job.email], ...(cc.length ? { cc } : {}), ...(bcc.length ? { bcc } : {}), reply_to: [job.reply_to],
        subject: (testTo ? "[TEST] " : "") + msg.subject, html: msg.html, text: msg.text,
        ...(Object.keys(msg.headers).length ? { headers: msg.headers } : {}),
        tags: [{ name: "campaign", value: String(job.campaign_id).replace(/[^A-Za-z0-9_-]/g, "_") }],
      };
      const res = await send(payload, `campaign-${job.id}`);
      const c = classify(res, job.attempts, now());
      await db.rpc("campaign_job_result", { p_job: job.id, p_lease: job.lease_token, p_outcome: c.outcome,
        p_provider_id: (c as any).providerId ?? null, p_error: (c as any).error ?? null, p_retry_at: (c as any).retryAt ?? null });
      summary[c.outcome]++;
      if ((c as any).stop) { stop = true; log({ stage: "stop", reason: res.ok ? "" : res.name }); }
      await sleep(pace);
    }
  }
  log({ stage: "done", ...summary });
  return { sent: summary.accepted, ...summary };
}
