// Minimal local stand-in for Supabase (PostgREST subset + the two RPCs + auth
// /user) and for Resend (/resend/emails), so the real form-submit Edge
// Function can run end to end without touching production or sending email.
const http = require("http");
const crypto = require("crypto");

function createFake() {
  const now = () => new Date(Date.now() + state.clockOffsetMs);
  const state = {
    clockOffsetMs: 0,
    resendScript: [],      // e.g. [503, 503] -> next sends fail with these statuses
    resendCalls: [],       // { idempotencyKey, hasAuth, body }
    tables: {
      email_settings: [{ id: 1, sending_enabled: true, staff_inbox: "staff-inbox@example.test", inbox_general: null, inbox_immigration: null, inbox_visa: null, inbox_travel: "travel-desk@example.test", test_redirect_to: null }],
      site_settings: [{ id: "s1", business_name: "Air Fair Travel & Immigration", updated_at: "2026-09-01T00:00:00Z" }],
      cms_published: [
        { kind: "form", slug: "website-contact", title: "Contact", content: { fields: [{ name: "name", label: "Name" }, { name: "email", label: "Email" }, { name: "message", label: "Message" }] } },
        { kind: "form", slug: "visa-inquiry", title: "Visa inquiry", content: { fields: [{ name: "fullName", label: "Full name" }, { name: "travelDate", label: "Travel date" }] } },
        { kind: "form", slug: "travel-inquiry", title: "Travel inquiry", content: { fields: [{ name: "fullName", label: "Full name" }, { name: "packageType", label: "Package type" }] } },
        { kind: "form", slug: "immigration-consultation", title: "Consultation", content: { sections: [{ fields: [{ name: "helpNeeded", label: "Help needed" }] }] } },
        { kind: "travel_package", slug: "bali-indonesia", title: "Bali, Indonesia", content: { title: "Bali, Indonesia" } },
        { kind: "visa_destination", slug: "japan", title: "Japan Tourist Visa", content: { title: "Japan Tourist Visa" } },
        { kind: "immigration_service", slug: "consultation", title: "Immigration-Related Consultation", content: { title: "Immigration-Related Consultation" } },
      ],
      profiles: [{ id: "u-admin", role: "admin", is_active: true }, { id: "u-staff", role: "staff", is_active: true }],
      form_submissions: [],
      email_outbox: [],
      newsletter_subscribers: [],
      rate_limit_events: [],
    },
  };
  const uniqueKeys = { form_submissions: "id", email_outbox: "dedupe_key", newsletter_subscribers: "email" };
  const tokens = { "admin-token": "u-admin", "staff-token": "u-staff" };

  const likeToRegex = pattern => {
    let re = "";
    for (let i = 0; i < pattern.length; i++) {
      const c = pattern[i];
      if (c === "\\" && i + 1 < pattern.length) { re += pattern[++i].replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); continue; }
      re += c === "%" ? ".*" : c === "_" ? "." : c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }
    return new RegExp(`^${re}$`, "i");
  };
  const RESERVED = new Set(["select", "order", "limit", "on_conflict", "columns", "offset"]);
  function matches(row, params) {
    for (const [col, raw] of params) {
      if (RESERVED.has(col)) continue;
      const dot = raw.indexOf(".");
      const op = raw.slice(0, dot), val = raw.slice(dot + 1);
      const cell = row[col];
      const cmp = typeof cell === "number" ? Number(val) : val;
      if (op === "eq" && String(cell) !== String(cmp)) return false;
      if (op === "neq" && String(cell) === String(cmp)) return false;
      if (op === "gte" && !(String(cell) >= String(cmp))) return false;
      if (op === "ilike" && !likeToRegex(val).test(String(cell ?? ""))) return false;
      if (op === "is" && !(val === "null" ? cell == null : String(cell) === val)) return false;
    }
    return true;
  }
  const project = (row, select) => {
    if (!select || select === "*") return { ...row };
    return Object.fromEntries(select.split(",").map(c => c.trim()).filter(Boolean).map(c => [c, row[c]]));
  };
  const defaultsFor = table => ({
    form_submissions: () => ({ status: "New", created_at: now().toISOString(), notes: null, handled_by: null }),
    email_outbox: () => ({ id: crypto.randomUUID(), status: "pending", attempts: 0, next_attempt_at: now().toISOString(), locked_until: null, last_error: null, provider_message_id: null, sent_at: null, created_at: now().toISOString() }),
    newsletter_subscribers: () => ({ id: crypto.randomUUID(), created_at: now().toISOString(), confirmed_at: null, unsubscribed_at: null }),
  }[table] || (() => ({})))();

  function rpc(name, args) {
    const t = state.tables;
    if (name === "rate_limit_hit") {
      const since = now().getTime() - args.p_window_seconds * 1000;
      const hits = t.rate_limit_events.filter(e => e.bucket === args.p_bucket && e.key_hash === args.p_key_hash && e.at > since).length;
      if (hits >= args.p_max) return false;
      t.rate_limit_events.push({ bucket: args.p_bucket, key_hash: args.p_key_hash, at: now().getTime() });
      return true;
    }
    if (name === "claim_email_outbox") {
      const n = now().toISOString();
      const due = t.email_outbox.filter(o => (!args.p_ids || args.p_ids.includes(o.id)) &&
        ((["pending", "retry"].includes(o.status) && o.next_attempt_at <= n) || (o.status === "sending" && (o.locked_until || "") < n)))
        .slice(0, Math.max(1, Math.min(args.p_limit || 10, 50)));
      for (const o of due) { o.status = "sending"; o.attempts++; o.locked_until = new Date(now().getTime() + 120_000).toISOString(); }
      return due.map(o => ({ ...o }));
    }
    throw new Error(`unknown rpc ${name}`);
  }

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, "http://localhost");
    let body = "";
    for await (const chunk of req) body += chunk;
    const send = (status, data, headers = {}) => { res.writeHead(status, { "Content-Type": "application/json", ...headers }); res.end(data === undefined ? "" : JSON.stringify(data)); };
    try {
      // --- Resend sink ---
      if (url.pathname === "/resend/emails") {
        const parsed = JSON.parse(body);
        state.resendCalls.push({ idempotencyKey: req.headers["idempotency-key"], hasAuth: /^Bearer .+/.test(req.headers.authorization || ""), body: parsed });
        const scripted = state.resendScript.shift();
        if (scripted) return send(scripted, { name: "application_error", message: "simulated failure" });
        return send(200, { id: `local_${state.resendCalls.length}` });
      }
      // --- Auth ---
      if (url.pathname === "/auth/v1/user") {
        const token = (req.headers.authorization || "").replace(/^Bearer /, "");
        return tokens[token] ? send(200, { id: tokens[token], aud: "authenticated" }) : send(401, { message: "invalid token" });
      }
      // --- RPC ---
      const rpcMatch = url.pathname.match(/^\/rest\/v1\/rpc\/(\w+)$/);
      if (rpcMatch) return send(200, rpc(rpcMatch[1], body ? JSON.parse(body) : {}));
      // --- Tables ---
      const tableMatch = url.pathname.match(/^\/rest\/v1\/(\w+)$/);
      if (!tableMatch) return send(404, { message: "not found" });
      const table = tableMatch[1];
      const rows = state.tables[table];
      if (!rows) return send(404, { code: "42P01", message: `relation "${table}" does not exist` });
      const params = [...url.searchParams.entries()];
      const select = url.searchParams.get("select");
      const prefer = req.headers.prefer || "";
      const wantsObject = (req.headers.accept || "").includes("vnd.pgrst.object");
      const reply = list => {
        if (wantsObject) return list.length === 1 ? send(200, list[0]) : send(406, { code: "PGRST116", message: `${list.length} rows` });
        return send(200, list);
      };

      if (req.method === "GET" || req.method === "HEAD") {
        let list = rows.filter(r => matches(r, params));
        const order = url.searchParams.get("order");
        if (order) { const [col, dir] = order.split("."); list.sort((a, b) => (String(a[col]) < String(b[col]) ? -1 : 1) * (dir === "desc" ? -1 : 1)); }
        const limit = url.searchParams.get("limit");
        if (limit) list = list.slice(0, Number(limit));
        if (req.method === "HEAD" || prefer.includes("count=exact")) {
          const headers = { "Content-Range": `${list.length ? `0-${list.length - 1}` : "*"}/${list.length}` };
          if (req.method === "HEAD") { res.writeHead(200, headers); return res.end(); }
          return send(200, list.map(r => project(r, select)), headers);
        }
        return reply(list.map(r => project(r, select)));
      }
      if (req.method === "POST") {
        const incoming = [].concat(JSON.parse(body));
        const key = url.searchParams.get("on_conflict") || uniqueKeys[table];
        const ignoreDup = prefer.includes("resolution=ignore-duplicates");
        const inserted = [];
        for (const item of incoming) {
          const existing = key && rows.find(r => String(r[key]).toLowerCase() === String(item[key]).toLowerCase());
          if (existing) {
            if (ignoreDup) continue;
            return send(409, { code: "23505", message: "duplicate key value violates unique constraint" });
          }
          const row = { ...defaultsFor(table), ...item };
          if (table === "form_submissions") { row.form_id ??= row.raw_data?.form_id; row.service_type ??= row.raw_data?.service_type; row.source ??= row.source_page; }
          rows.push(row);
          inserted.push(row);
        }
        if (!prefer.includes("return=representation")) { res.writeHead(201); return res.end(); }
        return reply(inserted.map(r => project(r, select)));
      }
      if (req.method === "PATCH") {
        const patch = JSON.parse(body);
        const list = rows.filter(r => matches(r, params));
        for (const r of list) Object.assign(r, patch, table === "email_outbox" ? { updated_at: now().toISOString() } : {});
        if (!prefer.includes("return=representation")) { res.writeHead(204); return res.end(); }
        return reply(list.map(r => project(r, select)));
      }
      return send(405, { message: "method" });
    } catch (err) {
      return send(500, { message: String(err && err.message || err) });
    }
  });
  return { server, state };
}

module.exports = { createFake };
