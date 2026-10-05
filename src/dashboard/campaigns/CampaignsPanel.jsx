// Campaign history and controls (Clients → Campaigns tab).
import React, { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, Pause, Play, RefreshCw, XCircle } from "lucide-react";
import { supabase } from "../../lib/supabase.js";
import { T, fontBody, Button, Notice, Spinner, formatDateTime } from "../ui.jsx";
import { estimateCompletion } from "../../../supabase/functions/_shared/campaigns/render.ts";

const STATUS = { queued: ["Queued", T.infoSoft, T.info], processing: ["Processing", T.accentSoft, T.accent], paused: ["Paused", T.warnSoft, T.warn],
  completed: ["Completed", T.border, T.ink], cancelled: ["Cancelled", T.border, T.muted] };
const RECIPIENT = { pending: "Pending", retry: "Retrying", sending: "Sending", accepted: "Accepted by provider", delayed: "Delivery delayed", delivered: "Delivered",
  bounced: "Bounced", complained: "Marked as spam", failed: "Failed", unknown: "Unknown — check Resend", skipped: "Skipped", cancelled: "Cancelled" };
const Badge = ({ status }) => { const [l, bg, fg] = STATUS[status] || [status, T.border, T.muted]; return <span className="text-xs rounded-full px-2 py-0.5" style={{ backgroundColor: bg, color: fg }}>{l}</span>; };

function Recipients({ campaignId }) {
  const [rows, setRows] = useState(null);
  useEffect(() => { supabase.from("email_campaign_recipients").select("id,email,status,skip_reason,last_error,attempts,accepted_at,delivered_at").eq("campaign_id", campaignId).order("seq")
    .then(({ data }) => setRows(data || [])); }, [campaignId]);
  if (!rows) return <div className="p-3"><Spinner /></div>;
  return <div className="overflow-x-auto"><table className="w-full text-xs"><thead><tr style={{ color: T.muted }}>{["Recipient", "Result", "Details", "Accepted", "Delivered"].map(h => <th key={h} className="text-left px-3 py-1.5 font-medium">{h}</th>)}</tr></thead>
    <tbody>{rows.map(r => <tr key={r.id} style={{ borderTop: `1px solid ${T.border}` }}>
      <td className="px-3 py-1.5 break-all">{r.email.startsWith("missing-") ? "(no email)" : r.email}</td><td className="px-3 py-1.5 whitespace-nowrap">{RECIPIENT[r.status] || r.status}</td>
      <td className="px-3 py-1.5" style={{ color: T.muted }}>{r.skip_reason || r.last_error || (r.attempts > 1 ? `${r.attempts} attempts` : "")}</td>
      <td className="px-3 py-1.5 whitespace-nowrap">{r.accepted_at ? formatDateTime(r.accepted_at) : "—"}</td><td className="px-3 py-1.5 whitespace-nowrap">{r.delivered_at ? formatDateTime(r.delivered_at) : "—"}</td>
    </tr>)}</tbody></table></div>;
}

export default function CampaignsPanel() {
  const [items, setItems] = useState(null);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(null);
  const [busy, setBusy] = useState("");
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let active = true;
    const load = async () => {
      const [c, s] = await Promise.all([supabase.from("email_campaigns").select("*").order("created_at", { ascending: false }).limit(50), supabase.from("email_campaign_stats").select("*")]);
      if (!active) return;
      if (c.error) { setError(/email_campaigns/.test(c.error.message) ? "Campaigns need the latest database update." : c.error.message); setItems([]); return; }
      const stats = Object.fromEntries((s.data || []).map(r => [r.campaign_id, r]));
      setItems(c.data.map(x => ({ ...x, stats: stats[x.id] || {} }))); setError("");
    };
    load();
    const t = setInterval(() => { if (!document.hidden) load(); }, 15000);
    return () => { active = false; clearInterval(t); };
  }, [tick]);
  const act = async (id, action) => {
    if (action === "cancel" && !window.confirm("Cancel this campaign? Emails not yet sent won't be sent. Emails already handed to the provider may still be delivered.")) return;
    setBusy(`${action}-${id}`); setError("");
    const { error: err } = await supabase.rpc("campaign_set_status", { p_campaign: id, p_action: action });
    setBusy(""); if (err) setError(err.message); setTick(t => t + 1);
  };
  return <div className="flex flex-col gap-3">
    <div className="flex items-center justify-between gap-2 flex-wrap">
      <p className="text-xs" style={{ color: T.muted, ...fontBody }}>"Accepted by provider" means Resend took the email; "Delivered" means the recipient's mail server confirmed it. Pause or cancel stops emails that haven't started; ones already handed to the provider may still arrive.</p>
      <Button small tone="outline" icon={RefreshCw} onClick={() => setTick(t => t + 1)}>Refresh</Button>
    </div>
    {error && <Notice tone="danger">{error}</Notice>}
    {!items && <Spinner />}
    {items?.length === 0 && !error && <p className="text-sm py-6 text-center" style={{ color: T.muted }}>No campaigns yet. Select clients and choose Send Email.</p>}
    {items?.map(c => { const s = c.stats, remaining = s.pending || 0, done = (s.total || 0) - remaining;
      const eta = ["queued", "processing"].includes(c.status) && remaining ? estimateCompletion({ count: remaining, drip: c.drip, batchSize: c.batch_size, intervalMinutes: c.interval_minutes,
        startAt: c.next_batch_at, windowStart: c.window_start?.slice(0, 5), windowEnd: c.window_end?.slice(0, 5), timezone: c.timezone }).finishAt : null;
      return <div key={c.id} className="rounded-xl" style={{ backgroundColor: T.surface, border: `1px solid ${T.border}` }}>
        <div className="p-4 flex flex-col gap-2">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="min-w-0"><div className="flex items-center gap-2 flex-wrap"><Badge status={c.status} /><span className="text-xs" style={{ color: T.muted }}>{c.kind === "promotional" ? "Promotional" : "Service update"}{c.drip ? ` · drip ${c.batch_size} every ${c.interval_minutes} min` : ""}</span></div>
              <div className="text-sm font-medium mt-1 break-words" style={{ color: T.ink }}>{c.subject}</div>
              <div className="text-xs" style={{ color: T.muted }}>From {c.from_name} &lt;{c.from_email}&gt; · by {c.created_by_name || "—"} · created {formatDateTime(c.created_at)}{c.started_at ? ` · started ${formatDateTime(c.started_at)}` : ""}{c.completed_at ? ` · ${c.status === "cancelled" ? "cancelled" : "finished"} ${formatDateTime(c.completed_at)}` : ""}{eta ? ` · est. finish ${formatDateTime(eta.toISOString())}` : ""}</div>
              {(c.cc?.length > 0 || c.bcc?.length > 0) && <div className="text-xs" style={{ color: T.muted }}>{c.cc?.length ? `CC ${c.cc.join(", ")}` : ""}{c.cc?.length && c.bcc?.length ? " · " : ""}{c.bcc?.length ? `BCC ${c.bcc.join(", ")}` : ""}</div>}
              {c.status_reason && <div className="text-xs mt-1" style={{ color: c.status === "paused" ? T.warn : T.muted }}>{c.status_reason}</div>}
            </div>
            <div className="flex gap-2">
              {["queued", "processing"].includes(c.status) && <Button small tone="outline" icon={Pause} busy={busy === `pause-${c.id}`} onClick={() => act(c.id, "pause")}>Pause</Button>}
              {c.status === "paused" && <Button small icon={Play} busy={busy === `resume-${c.id}`} onClick={() => act(c.id, "resume")}>Resume</Button>}
              {["queued", "processing", "paused"].includes(c.status) && <Button small tone="danger" icon={XCircle} busy={busy === `cancel-${c.id}`} onClick={() => act(c.id, "cancel")}>Cancel</Button>}
            </div>
          </div>
          <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: T.bg }}><div style={{ width: `${s.total ? Math.round(done / s.total * 100) : 0}%`, height: "100%", backgroundColor: T.accent }} /></div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs" style={{ color: T.muted }}>
            {[["Pending", s.pending], ["Accepted by provider", s.accepted], ["Delivered", s.delivered], ["Failed", s.failed], ["Skipped", s.skipped], ["Cancelled", s.cancelled]].map(([l, n]) => <span key={l}>{l}: <strong style={{ color: T.ink }}>{n || 0}</strong></span>)}
            <button type="button" onClick={() => setOpen(open === c.id ? null : c.id)} className="ml-auto inline-flex items-center gap-1 underline">Recipients {open === c.id ? <ChevronUp size={12} /> : <ChevronDown size={12} />}</button>
          </div>
        </div>
        {open === c.id && <div className="border-t" style={{ borderColor: T.border }}><Recipients campaignId={c.id} /></div>}
      </div>; })}
  </div>;
}
