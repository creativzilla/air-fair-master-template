import test from "node:test";
import assert from "node:assert/strict";
import { estimateCompletion, inWindow, personalize, renderCampaignEmail, reviewRecipients, sanitizeHtml } from "./render.ts";
import { classify, runWorker } from "./worker.ts";

test("sanitize keeps formatting, drops scripts, handlers, styles and unsafe links", () => {
  const out = sanitizeHtml(`<p style="color:red" onclick="x()">Hi <b>there</b></p><script>alert(1)</script><img src=x onerror=1><a href="javascript:alert(1)">bad</a><a href="https://airfairtravel.com/visa?a=1&amp;b=2">ok</a>`);
  assert.equal(out, `<p>Hi <b>there</b></p><a>bad</a><a href="https://airfairtravel.com/visa?a=1&amp;b=2" target="_blank" rel="noopener">ok</a>`);
});

test("personalization: first name, fallback, HTML-escaped names", () => {
  assert.equal(personalize("Hi {{first_name}}!", "Maria", "there", false), "Hi Maria!");
  assert.equal(personalize("Hi {{ FIRST_NAME }}!", "", "friend", false), "Hi friend!");
  assert.equal(personalize("<p>{{first_name}}</p>", "<b>Jo</b>", "there", true), "<p>&lt;b&gt;Jo&lt;/b&gt;</p>");
});

test("promotional emails carry an unsubscribe link and one-click headers; service emails don't", () => {
  const base = { subject: "Hello {{first_name}}", body_html: "<p>Hi {{first_name}}</p>", first_name_fallback: "there", from_name: "Air Fair" };
  const promo = renderCampaignEmail({ ...base, kind: "promotional" }, "Ana", { unsubscribeUrl: "https://site/u?c=t", oneClickUrl: "https://fn/u?unsubscribe=t" });
  assert.equal(promo.subject, "Hello Ana");
  assert.match(promo.html, /href="https:\/\/site\/u\?c=t"[^>]*>Unsubscribe/);
  assert.match(promo.text, /Unsubscribe: https:\/\/site\/u\?c=t/);
  assert.equal(promo.headers["List-Unsubscribe-Post"], "List-Unsubscribe=One-Click");
  assert.match(promo.headers["List-Unsubscribe"], /^<https:\/\/fn\/u\?unsubscribe=t>/);
  const service = renderCampaignEmail({ ...base, kind: "service" }, null, { unsubscribeUrl: "https://site/u?c=t", oneClickUrl: "x" });
  assert.equal(service.subject, "Hello there");
  assert.doesNotMatch(service.html, /Unsubscribe/);
  assert.deepEqual(service.headers, {});
});

test("review: dedupes addresses (first wins), flags missing and invalid", () => {
  const r = reviewRecipients([{ id: "1", name: "Ana Cruz", email: "Ana@X.com" }, { id: "2", name: "Ana again", email: "ana@x.com " },
    { id: "3", name: "No Mail", email: "" }, { id: "4", name: "Bad", email: "not-an-email" }]);
  assert.deepEqual(r.eligible.map((x: any) => [x.id, x.email, x.firstName]), [["1", "ana@x.com", "Ana"]]);
  assert.deepEqual(r.excluded.map((x: any) => [x.id, x.reason]), [["2", "Duplicate email address"], ["3", "No email address"], ["4", "Invalid email address"]]);
});

test("drip estimate: batches × interval, sending window in the campaign timezone", () => {
  const now = new Date("2026-10-05T01:00:00Z"); // 09:00 Manila
  const plain = estimateCompletion({ count: 100, drip: true, batchSize: 25, intervalMinutes: 60 }, now);
  assert.equal(plain.batches, 4);
  assert.equal(plain.finishAt.toISOString(), "2026-10-05T04:01:00.000Z", "3 intervals + last batch");
  // Window 09:00–10:30 Manila: batches at 09:00, 10:00, then next day 09:00, 10:00.
  const windowed = estimateCompletion({ count: 100, drip: true, batchSize: 25, intervalMinutes: 60, windowStart: "09:00", windowEnd: "10:30", timezone: "Asia/Manila" }, now);
  assert.equal(windowed.finishAt.toISOString(), "2026-10-06T02:01:00.000Z");
  assert.equal(inWindow(new Date("2026-10-05T03:00:00Z"), "09:00", "10:30", "Asia/Manila"), false);
  assert.equal(inWindow(new Date("2026-10-05T15:30:00Z"), "22:00", "06:00", "Asia/Manila"), true, "overnight window");
  const fast = estimateCompletion({ count: 120, drip: false, batchSize: 50, intervalMinutes: 0 }, now);
  assert.equal(fast.finishAt.toISOString(), "2026-10-05T01:03:00.000Z");
});

test("classify provider results: quota pauses, rate limit stops, ambiguous retries then gives up as unknown", () => {
  const now = new Date("2026-10-05T00:00:00Z");
  assert.equal(classify({ ok: true, id: "re_1" }, 1, now).outcome, "accepted");
  assert.equal(classify({ ok: false, status: 429, name: "daily_quota_exceeded", message: "" }, 1, now).outcome, "requeue_pause");
  assert.equal(classify({ ok: false, status: 403, name: "email_above_quota", message: "" }, 1, now).outcome, "requeue_pause");
  const rl = classify({ ok: false, status: 429, name: "rate_limit_exceeded", message: "" }, 1, now) as any;
  assert.equal(rl.outcome, "retry"); assert.equal(rl.stop, true);
  const net = classify({ ok: false, status: 0, name: "network_error", message: "timeout", network: true }, 2, now) as any;
  assert.equal(net.outcome, "retry"); assert.equal(net.retryAt, "2026-10-05T00:05:00.000Z", "bounded backoff");
  assert.equal(classify({ ok: false, status: 0, name: "network_error", message: "", network: true }, 5, now).outcome, "unknown");
  assert.equal(classify({ ok: false, status: 422, name: "validation_error", message: "bad" }, 1, now).outcome, "failed");
  assert.equal(classify({ ok: false, status: 409, name: "invalid_idempotent_request", message: "" }, 1, now).outcome, "unknown", "never resend under a new key");
});

function fakeDb(jobs: any[], settings = { sending_enabled: true, test_redirect_to: null as string | null }) {
  const results: any[] = []; let claims = 0;
  return { results, db: {
    from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: settings }) }) }) }),
    rpc: async (name: string, args: any) => {
      if (name === "campaign_claim_jobs") { claims++; return { data: claims === 1 ? jobs : [] }; }
      if (name === "campaign_job_result") { results.push(args); return { data: null }; }
      return { data: null };
    } } };
}
const job = (id: string, extra: any = {}) => ({ id, campaign_id: "camp", email: `${id}@x.com`, first_name: "Ana", unsubscribe_token: "tok-" + id, lease_token: "lease-" + id,
  attempts: 1, first_attempt_at: "2026-10-05T00:00:00Z", kind: "promotional", from_email: "info@airfairtravel.com", from_name: "Air Fair", reply_to: "info@reply.airfairtravel.com",
  subject: "Hi {{first_name}}", body_html: "<p>Hello</p>", first_name_fallback: "there", ...extra });
const opts = { siteUrl: "https://site", functionsUrl: "https://fn", sleep: async () => {}, now: () => new Date("2026-10-05T00:10:00Z"), log: () => {} };

test("worker: one email per recipient, stable idempotency key, reply-to shared inbox, no CC/BCC", async () => {
  const { db, results } = fakeDb([job("a"), job("b")]);
  const sent: any[] = [];
  const out = await runWorker(db, async (payload, key) => { sent.push({ payload, key }); return { ok: true, id: "re_" + key }; }, opts);
  assert.equal(out.sent, 2);
  assert.deepEqual(sent.map(s => s.payload.to), [["a@x.com"], ["b@x.com"]]);
  assert.ok(sent.every(s => !("cc" in s.payload) && !("bcc" in s.payload)));
  assert.deepEqual(sent.map(s => s.key), ["campaign-a", "campaign-b"]);
  assert.deepEqual(sent[0].payload.reply_to, ["info@reply.airfairtravel.com"]);
  assert.equal(sent[0].payload.subject, "Hi Ana");
  assert.match(sent[0].payload.headers["List-Unsubscribe"], /unsubscribe=tok-a/);
  assert.deepEqual(results.map(r => [r.p_job, r.p_outcome, r.p_provider_id]), [["a", "accepted", "re_campaign-a"], ["b", "accepted", "re_campaign-b"]]);
});

test("worker: quota pauses and stops; remaining claimed jobs deferred, not sent", async () => {
  const { db, results } = fakeDb([job("a"), job("b")]);
  let calls = 0;
  await runWorker(db, async () => { calls++; return { ok: false, status: 429, name: "daily_quota_exceeded", message: "quota" }; }, opts);
  assert.equal(calls, 1);
  assert.deepEqual(results.map(r => [r.p_job, r.p_outcome]), [["a", "requeue_pause"], ["b", "retry"]]);
});

test("worker: ambiguous outcome older than the idempotency window is never resent", async () => {
  const { db, results } = fakeDb([job("a", { attempts: 2, first_attempt_at: "2026-10-03T00:00:00Z" })]);
  let calls = 0;
  await runWorker(db, async () => { calls++; return { ok: true, id: "x" }; }, opts);
  assert.equal(calls, 0); assert.equal(results[0].p_outcome, "unknown");
});

test("worker: nothing is sent while sending is switched off; test mode redirects", async () => {
  const off = fakeDb([job("a")], { sending_enabled: false, test_redirect_to: null });
  let calls = 0;
  const r = await runWorker(off.db, async () => { calls++; return { ok: true, id: "x" }; }, opts);
  assert.equal(calls, 0); assert.match(String(r.skipped), /turned off/);
  const test = fakeDb([job("a")], { sending_enabled: true, test_redirect_to: "qa@airfairtravel.com" });
  const sent: any[] = [];
  await runWorker(test.db, async p => { sent.push(p); return { ok: true, id: "x" }; }, opts);
  assert.deepEqual(sent[0].to, ["qa@airfairtravel.com"]); assert.match(sent[0].subject, /^\[TEST\] /);
});

test("worker: campaign CC/BCC on every email, never the recipient's own address, none in test mode", async () => {
  const { db } = fakeDb([job("a", { cc: ["boss@airfairtravel.com", "a@x.com"], bcc: ["audit@airfairtravel.com"] }), job("b", { cc: ["boss@airfairtravel.com", "a@x.com"], bcc: ["audit@airfairtravel.com"] })]);
  const sent: any[] = [];
  await runWorker(db, async p => { sent.push(p); return { ok: true, id: "x" }; }, opts);
  assert.deepEqual(sent.map(p => [p.to[0], p.cc, p.bcc]), [["a@x.com", ["boss@airfairtravel.com"], ["audit@airfairtravel.com"]], ["b@x.com", ["boss@airfairtravel.com", "a@x.com"], ["audit@airfairtravel.com"]]]);
  const t = fakeDb([job("a", { cc: ["boss@airfairtravel.com"], bcc: ["audit@airfairtravel.com"] })], { sending_enabled: true, test_redirect_to: "qa@airfairtravel.com" });
  const tsent: any[] = [];
  await runWorker(t.db, async p => { tsent.push(p); return { ok: true, id: "x" }; }, opts);
  assert.equal("cc" in tsent[0], false); assert.equal("bcc" in tsent[0], false);
});
