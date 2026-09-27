// npm run test:email:e2e
// Runs the REAL form-submit Edge Function (index.ts) under Deno against the
// local fake Supabase + Resend sink, then drives it over HTTP like the website,
// the dashboard and pg_cron would. Nothing leaves this machine.
const { spawn } = require("child_process");
const path = require("path");
const { pathToFileURL } = require("url");
const assert = require("assert/strict");
const { createFake } = require("./fake-supabase.cjs");

const ROOT = path.resolve(__dirname, "../..");
// Deno from PATH, or set DENO_BIN to its full path.
const DENO = process.env.DENO_BIN || "deno";
const FAKE_PORT = 54399, FN_PORT = 8000;
const FN = `http://127.0.0.1:${FN_PORT}`;

const results = [];
async function check(name, fn) {
  try { await fn(); results.push(["PASS", name]); }
  catch (err) { results.push(["FAIL", `${name}: ${err.message.split("\n")[0]}`]); }
}
const uuid = () => require("crypto").randomUUID();
const post = (body, headers = {}) => fetch(FN, { method: "POST", headers: { "Content-Type": "application/json", Origin: "https://airfairtravel.com", ...headers }, body: typeof body === "string" ? body : JSON.stringify(body) });
const human = { company_website: "", elapsed_ms: 6000 };
let ipN = 0;
const ip = () => ({ "x-forwarded-for": `198.51.100.${++ipN}` });
const sub = (kind, over = {}) => ({
  id: uuid(), name: "Ana Cruz", email: `ana+${kind}@example.com`, phone: "+639171234567", attachments: [], document_id: null, form_version_id: null,
  ...{
    contact: { form_type: "website_inquiry", form_key: "website-contact", source_page: "/", raw_data: { name: "Ana Cruz", message: "Hello" } },
    visa: { form_type: "visa_japan", form_key: "visa-inquiry", source_page: "/visa-assistance/japan", raw_data: { fullName: "Ana Cruz", travelDate: "2026-12-01" } },
    travel: { form_type: "travel_package_bali-indonesia", form_key: "travel-inquiry", source_page: "/travel-tours/bali-indonesia", raw_data: { fullName: "Ana Cruz", packageType: "Standard" } },
    immigration: { form_type: "immigration_consultation", form_key: "immigration-consultation", source_page: "/philippine-immigration-services/consultation", raw_data: { fullName: "Ana Cruz", helpNeeded: "Visa extension" } },
  }[kind],
  ...over,
});

(async () => {
  const { server, state } = createFake();
  await new Promise(r => server.listen(FAKE_PORT, "127.0.0.1", r));
  const T = state.tables;
  // Same four category defaults the migration seeds.
  const { DEFAULT_AUTO_REPLIES } = await import(pathToFileURL(path.join(ROOT, "supabase/functions/_shared/forms/templates.ts")).href);
  T.email_templates = Object.entries(DEFAULT_AUTO_REPLIES).map(([service_type, t]) => ({ id: uuid(), service_type, form_id: null, enabled: true, ...t }));

  const deno = spawn(DENO, [
    "run", "--node-modules-dir=none", `--allow-net=127.0.0.1,localhost,0.0.0.0:${FN_PORT}`, "--allow-env", "--allow-read",
    `--preload=${path.join(__dirname, "preload.ts")}`, path.join(ROOT, "supabase/functions/form-submit/index.ts"),
  ], {
    cwd: ROOT,
    env: {
      ...process.env,
      SUPABASE_URL: `http://127.0.0.1:${FAKE_PORT}`,
      SUPABASE_SERVICE_ROLE_KEY: "local-test-service-key",
      SUPABASE_ANON_KEY: "local-test-anon-key",
      RESEND_API_KEY: "local-test-resend-key",
      RATE_LIMIT_SALT: "local-test-salt",
      LOCAL_RESEND_SINK: `http://127.0.0.1:${FAKE_PORT}/resend/emails`,
    },
  });
  let log = "";
  deno.stdout.on("data", d => (log += d));
  deno.stderr.on("data", d => (log += d));
  for (let i = 0; i < 120 && !/Listening on/.test(log); i++) await new Promise(r => setTimeout(r, 250));
  if (!/Listening on/.test(log)) { console.log("Function did not start:\n" + log); process.exit(1); }

  // ---------------------------------------------------------------- CORS / basics
  await check("CORS: airfairtravel.com allowed", async () => {
    const r = await fetch(FN, { method: "OPTIONS", headers: { Origin: "https://airfairtravel.com" } });
    assert.equal(r.headers.get("access-control-allow-origin"), "https://airfairtravel.com");
  });
  await check("CORS: other origins get no allow header", async () => {
    const r = await fetch(FN, { method: "OPTIONS", headers: { Origin: "https://evil.example" } });
    assert.equal(r.headers.get("access-control-allow-origin"), null);
  });
  await check("bad JSON -> 400, unknown action -> 400", async () => {
    assert.equal((await post("{not json", ip())).status, 400);
    assert.equal((await post({ action: "send_anything", to: "x@example.com" }, ip())).status, 400);
  });

  // ---------------------------------------------------------------- one per category
  for (const [kind, staffTo, subjectStart] of [
    ["contact", "staff-inbox@example.test", "New website inquiry from Ana Cruz"],
    ["immigration", "staff-inbox@example.test", "New immigration assessment: Immigration-Related Consultation"],
    ["visa", "staff-inbox@example.test", "New visa inquiry: Japan Tourist Visa"],
    ["travel", "travel-desk@example.test", "New travel inquiry: Bali, Indonesia"],
  ]) {
    await check(`${kind}: saved + staff notification + client confirmation`, async () => {
      const before = state.resendCalls.length;
      const s = sub(kind);
      const r = await post({ action: "submit_form", submission: s, guard: human }, ip());
      assert.equal(r.status, 200, await r.text());
      const saved = T.form_submissions.find(x => x.id === s.id);
      assert.ok(saved, "submission saved");
      const calls = state.resendCalls.slice(before);
      assert.equal(calls.length, 2, `emails sent: ${calls.length}`);
      const staff = calls.find(c => c.body.tags.some(t => t.value === "staff_notification")).body;
      const client = calls.find(c => c.body.tags.some(t => t.value === "client_confirmation")).body;
      assert.equal(staff.from, "Air Fair Travel & Immigration <no-reply@airfairtravel.com>");
      assert.deepEqual(staff.to, [staffTo]);
      assert.deepEqual(staff.reply_to, [s.email]);
      assert.ok(staff.subject.startsWith(subjectStart), staff.subject);
      assert.deepEqual(client.to, [s.email]);
      assert.deepEqual(client.reply_to, [staffTo]);
      const rows = T.email_outbox.filter(o => o.submission_id === s.id);
      assert.ok(rows.every(o => o.status === "sent"));
      assert.deepEqual(calls.map(c => c.idempotencyKey).sort(), rows.map(o => o.id).sort(), "Idempotency-Key = outbox id");
      assert.ok(calls.every(c => c.hasAuth), "API key sent as Authorization header");
      assert.ok(calls.every(c => !JSON.stringify(c.body).includes("local-test-resend-key")), "key never in the email payload");
    });
  }

  // ---------------------------------------------------------------- restrictions & duplicates
  await check("request can't pick recipient/sender/template", async () => {
    const before = state.resendCalls.length;
    const s = sub("travel", { email: "ben@example.com", to: "attacker@evil.example", from: "boss@airfairtravel.com" });
    await post({ action: "submit_form", submission: s, guard: human, to: "attacker@evil.example", template: "visa", staff_inbox: "attacker@evil.example" }, ip());
    const calls = state.resendCalls.slice(before);
    assert.equal(calls.length, 2);
    assert.ok(!JSON.stringify(calls.map(c => [c.body.to, c.body.reply_to, c.body.from])).includes("evil"));
  });
  await check("same submission sent twice: saved once, emailed once", async () => {
    const before = state.resendCalls.length;
    const s = sub("visa", { email: "dup@example.com" });
    const headers = ip();
    await post({ action: "submit_form", submission: s, guard: human }, headers);
    const again = await post({ action: "submit_form", submission: s, guard: human }, headers);
    assert.equal(again.status, 200);
    assert.equal(T.form_submissions.filter(x => x.id === s.id).length, 1);
    assert.equal(state.resendCalls.length - before, 2);
  });
  await check("honeypot filled: fake success, nothing saved or sent", async () => {
    const before = [T.form_submissions.length, state.resendCalls.length];
    const r = await post({ action: "submit_form", submission: sub("contact", { email: "bot@example.com" }), guard: { company_website: "http://spam.example", elapsed_ms: 9000 } }, ip());
    assert.equal(r.status, 200);
    assert.deepEqual([T.form_submissions.length, state.resendCalls.length], before);
  });
  await check("rate limit: 6th submission in 10 min from one connection -> 429", async () => {
    const headers = ip();
    const statuses = [];
    for (let i = 0; i < 6; i++) statuses.push((await post({ action: "submit_form", submission: sub("contact", { email: `r${i}@example.com` }), guard: human }, headers)).status);
    assert.deepEqual(statuses, [200, 200, 200, 200, 200, 429]);
  });
  await check("invalid email / unknown form -> 400, nothing saved", async () => {
    const n = T.form_submissions.length;
    assert.equal((await post({ action: "submit_form", submission: sub("contact", { email: "nope" }), guard: human }, ip())).status, 400);
    assert.equal((await post({ action: "submit_form", submission: sub("contact", { form_key: "made-up" }), guard: human }, ip())).status, 400);
    assert.equal(T.form_submissions.length, n);
  });

  // ---------------------------------------------------------------- retries
  await check("Resend outage: queued as retry, then sent by the scheduled run (process_due)", async () => {
    state.resendScript.push(503, 503);
    const s = sub("immigration", { email: "retry@example.com" });
    await post({ action: "submit_form", submission: s, guard: human }, ip());
    const rows = () => T.email_outbox.filter(o => o.submission_id === s.id);
    assert.deepEqual(rows().map(o => o.status), ["retry", "retry"]);
    assert.ok(rows().every(o => /503/.test(o.last_error)));
    const early = await (await post({ action: "process_due" }, ip())).json();
    assert.equal(early.sent, 0, "not due yet");
    state.clockOffsetMs += 2 * 60_000; // 2 minutes later (next cron tick)
    const due = await (await post({ action: "process_due" }, ip())).json();
    assert.equal(due.sent, 2);
    assert.deepEqual(rows().map(o => o.status), ["sent", "sent"]);
    const keys = state.resendCalls.filter(c => rows().some(o => o.id === c.idempotencyKey)).map(c => c.idempotencyKey);
    assert.equal(keys.length, 4, "2 failed + 2 successful attempts");
    assert.equal(new Set(keys).size, 2, "same Idempotency-Key reused on retry");
  });
  await check("process_outbox (reset failed): anonymous and staff refused, admin allowed", async () => {
    assert.equal((await post({ action: "process_outbox", retry_failed: true }, ip())).status, 403);
    assert.equal((await post({ action: "process_outbox", retry_failed: true }, { ...ip(), Authorization: "Bearer staff-token" })).status, 403);
    assert.equal((await post({ action: "process_outbox", retry_failed: true }, { ...ip(), Authorization: "Bearer admin-token" })).status, 200);
  });

  // ---------------------------------------------------------------- settings
  await check("test mode: everything to the test inbox, [TEST] subjects", async () => {
    T.email_settings[0].test_redirect_to = "qa@example.test";
    const before = state.resendCalls.length;
    await post({ action: "submit_form", submission: sub("travel", { email: "real-client@example.com" }), guard: human }, ip());
    const calls = state.resendCalls.slice(before);
    T.email_settings[0].test_redirect_to = null;
    assert.equal(calls.length, 2);
    assert.ok(calls.every(c => c.body.to[0] === "qa@example.test" && c.body.subject.startsWith("[TEST] ")));
  });
  await check("sending off: submission saved, emails logged as skipped, nothing sent", async () => {
    T.email_settings[0].sending_enabled = false;
    const before = state.resendCalls.length;
    const s = sub("contact", { email: "off@example.com" });
    const r = await post({ action: "submit_form", submission: s, guard: human }, ip());
    T.email_settings[0].sending_enabled = true;
    assert.equal(r.status, 200);
    assert.ok(T.form_submissions.find(x => x.id === s.id));
    assert.equal(state.resendCalls.length, before);
    assert.deepEqual(T.email_outbox.filter(o => o.submission_id === s.id).map(o => o.status), ["skipped", "skipped"]);
  });

  // ---------------------------------------------------------------- newsletter
  await check("newsletter: one confirmation email, no inquiry, confirmed after clicking the link", async () => {
    const before = [T.form_submissions.length, state.resendCalls.length];
    const r = await post({ action: "newsletter_subscribe", email: "Reader@Example.com", source_page: "/news", guard: human }, ip());
    assert.equal(r.status, 200);
    assert.equal(T.form_submissions.length, before[0], "no form submission");
    const calls = state.resendCalls.slice(before[1]);
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0].body.to, ["reader@example.com"]);
    const token = calls[0].body.text.match(/newsletter\/confirm\?token=([A-Za-z0-9_-]+)/)[1];
    const subRow = T.newsletter_subscribers.find(x => x.email === "reader@example.com");
    assert.equal(subRow.confirmed_at, null, "not subscribed until confirmed");
    assert.equal((await post({ action: "newsletter_confirm", token }, ip())).status, 200);
    assert.ok(subRow.confirmed_at);
    assert.ok(!subRow.confirm_token_hash.includes(token), "only a hash is stored");
  });

  // ---------------------------------------------------------------- dashboard auto-replies (email_templates)
  const clientCall = calls => calls.find(c => c.body.tags.some(t => t.value === "client_confirmation"))?.body;
  await check("new package with no override uses the edited category default", async () => {
    const travel = T.email_templates.find(t => t.service_type === "travel" && !t.form_id);
    const saved = { ...travel };
    travel.subject = "Your {{item_name}} trip request ({{reference}})";
    T.cms_published.push({ kind: "travel_package", slug: "tokyo-japan", title: "Tokyo, Japan", content: { title: "Tokyo, Japan" } });
    const before = state.resendCalls.length;
    const s = sub("travel", { email: "tokyo@example.com", form_type: "travel_package_tokyo-japan", source_page: "/travel-tours/tokyo-japan" });
    assert.equal((await post({ action: "submit_form", submission: s, guard: human }, ip())).status, 200);
    Object.assign(travel, saved);
    const client = clientCall(state.resendCalls.slice(before));
    assert.match(client.subject, /^Your Tokyo, Japan trip request \(AF-/);
    assert.equal(T.email_outbox.find(o => o.submission_id === s.id && o.kind === "client_confirmation").template_ref, "default:travel");
  });
  await check("form override wins over the category default", async () => {
    T.email_templates.push({ id: uuid(), service_type: "travel", form_id: "travel-inquiry-bali-indonesia", enabled: true, subject: "Bali special for {{client_first_name}}", body: "Selamat datang, {{client_first_name}}! <b>not bold</b>" });
    const before = state.resendCalls.length;
    const s = sub("travel", { email: "bali@example.com" });
    await post({ action: "submit_form", submission: s, guard: human }, ip());
    T.email_templates.pop();
    const client = clientCall(state.resendCalls.slice(before));
    assert.equal(client.subject, "Bali special for Ana");
    assert.ok(client.html.includes("&lt;b&gt;not bold&lt;/b&gt;"), "template text escaped");
  });
  await check("category auto-reply off: client not emailed, staff notified, inquiry saved", async () => {
    const visa = T.email_templates.find(t => t.service_type === "visa" && !t.form_id);
    visa.enabled = false;
    const before = state.resendCalls.length;
    const s = sub("visa", { email: "quiet@example.com" });
    const r = await post({ action: "submit_form", submission: s, guard: human }, ip());
    visa.enabled = true;
    assert.equal(r.status, 200);
    assert.ok(T.form_submissions.find(x => x.id === s.id));
    const calls = state.resendCalls.slice(before);
    assert.equal(calls.length, 1);
    assert.ok(calls[0].body.tags.some(t => t.value === "staff_notification"));
  });
  await check("send_template_test: admin only, configured inboxes only, [TEST] subject, no lead created", async () => {
    const tpl = { action: "send_template_test", service_type: "travel", form_id: "travel-inquiry-bali-indonesia", subject: "Trip {{item_name}}", body: "Hi {{client_first_name}}" };
    assert.equal((await post({ ...tpl, to: "staff-inbox@example.test" }, ip())).status, 403);
    assert.equal((await post({ ...tpl, to: "staff-inbox@example.test" }, { ...ip(), Authorization: "Bearer staff-token" })).status, 403);
    assert.equal((await post({ ...tpl, to: "client@example.com" }, { ...ip(), Authorization: "Bearer admin-token" })).status, 400);
    const before = [state.resendCalls.length, T.form_submissions.length];
    const r = await post({ ...tpl, to: "Travel-Desk@example.test" }, { ...ip(), Authorization: "Bearer admin-token" });
    assert.equal(r.status, 200, await r.clone().text());
    assert.equal((await r.json()).status, "sent");
    const calls = state.resendCalls.slice(before[0]);
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0].body.to, ["travel-desk@example.test"]);
    assert.equal(calls[0].body.subject, "[TEST] Trip Bali, Indonesia");
    assert.equal(T.form_submissions.length, before[1]);
  });

  // ---------------------------------------------------------------- safety net
  await check("no request ever left the machine", async () => {
    assert.ok(!/blocked external request|NotCapable|Requires net access/i.test(log), log.slice(-500));
  });

  deno.kill();
  server.close();
  let pass = 0;
  for (const [status, name] of results) { if (status === "PASS") pass++; console.log(`${status} | ${name}`); }
  console.log(`${pass}/${results.length} passed | emails captured by local sink: ${state.resendCalls.length} | submissions in fake DB: ${T.form_submissions.length}`);
  if (/error/i.test(log)) console.log("--- function log (errors) ---\n" + log.split("\n").filter(l => /error/i.test(l)).slice(0, 10).join("\n"));
})();
