// One conversation, Gmail-style: older messages collapsed, latest expanded,
// recipient details on demand, Reply / Reply all at the bottom.
import React, { useEffect, useState } from "react";
import { ArrowLeft, ChevronDown, ChevronUp, MailOpen, Paperclip, RefreshCw, Reply, ReplyAll } from "lucide-react";
import { supabase } from "../../lib/supabase.js";
import { Button, LabeledSelect, Notice, Spinner, T, formatDateTime } from "../ui.jsx";
import { formatBytes, replyAllCc } from "../inboxRecipients.js";

const check = ({ data, error }) => { if (error) throw error; return data; };
// Accepted (Resend took it) and delivered (recipient server took it) stay distinct.
const DELIVERY = { delivered: "Delivered", opened: "Delivered", clicked: "Delivered", bounced: "Bounced",
  complained: "Marked as spam", delivery_delayed: "Delivery delayed", failed: "Failed at provider", canceled: "Canceled" };
const FINAL_EVENTS = ["delivered", "opened", "clicked", "bounced", "complained", "failed", "canceled"];
const STATUS = { queued: "Queued", sending: "Sending", retry: "Not sent yet", unknown: "Unknown — check Resend", received: "Received" };
export const statusLabel = m => m.status === "sent" ? DELIVERY[m.provider_event] || "Accepted by Resend" : STATUS[m.status] || m.status;
// Internal attribution: the recorded sender only, never guessed.
export const senderLabel = m => m.direction === "incoming" ? (m.headers?.["x-airfair-source"] === "website-form" ? `${m.from_email} · website inquiry` : m.from_email)
  : m.outbox_id ? "Airfair auto-reply" : m.sender_name || m.sender_email || "Unknown staff";
const split = v => [...new Set(String(v || "").split(",").map(a => a.trim().toLowerCase()).filter(Boolean))];
// Recipients actually sent (frozen payload) when available, else those stored at queue time.
export const recipientsOf = m => {
  const p = m.send_payload || {};
  const pick = (v, stored) => Array.isArray(v) ? split(v.join(",")) : m.send_payload ? [] : split(stored);
  return { to: Array.isArray(p.to) ? split(p.to.join(",")) : split(m.to_email), cc: pick(p.cc, m.cc_email), bcc: m.direction === "outgoing" ? pick(p.bcc, m.bcc_email) : [] };
};
const initial = s => (String(s || "?").trim()[0] || "?").toUpperCase();

function Attachments({ m }) {
  const [err, setErr] = useState("");
  if (!m.attachments?.length) return null;
  const open = async a => {
    setErr("");
    const { data, error } = await supabase.storage.from("email-attachments").createSignedUrl(a.path, 60, { download: a.filename });
    if (error) { setErr("Could not open the attachment."); return; }
    window.open(data.signedUrl, "_blank", "noopener");
  };
  return <div className="mt-3">
    <ul className="flex flex-wrap gap-2">
      {m.attachments.map((a, i) => <li key={i}>
        {a.path ? <button type="button" onClick={() => open(a)} className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs max-w-[16rem]"
          style={{ border: `1px solid ${T.border}` }}><Paperclip size={12} /><span className="truncate">{a.filename}</span>{a.size ? <span style={{ color: T.muted }}>{formatBytes(a.size)}</span> : null}</button>
          : <span className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs max-w-[16rem]" style={{ border: `1px solid ${T.border}`, color: T.muted }}
            title="Received attachments are listed only; open the original email to download"><Paperclip size={12} /><span className="truncate">{a.filename}</span></span>}
      </li>)}
    </ul>
    {err && <p className="text-xs mt-1" style={{ color: T.danger }}>{err}</p>}
  </div>;
}

function Message({ m, expanded, onToggle, busy, onAction }) {
  const [details, setDetails] = useState(false);
  const r = recipientsOf(m);
  const time = m.direction === "outgoing" && m.sent_at ? m.sent_at : m.created_at;
  const staff = m.direction === "outgoing" && !m.outbox_id;
  if (!expanded) return <button type="button" onClick={onToggle} className="w-full text-left flex items-center gap-3 px-4 py-2.5 border-b text-sm min-w-0" style={{ borderColor: T.border }}>
    <span className="font-medium truncate w-40 shrink-0">{senderLabel(m)}</span>
    <span className="truncate flex-1 min-w-0" style={{ color: T.muted }}>{String(m.body_text || "").replace(/\s+/g, " ").slice(0, 160)}</span>
    <span className="text-xs shrink-0" style={{ color: T.muted }}>{formatDateTime(time)}</span>
  </button>;
  return <article className="px-4 py-3 border-b" style={{ borderColor: T.border }}>
    <div className="flex items-start gap-3">
      <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm shrink-0" style={{ backgroundColor: m.direction === "incoming" ? T.infoSoft : T.accentSoft, color: m.direction === "incoming" ? T.info : T.accent }}>{initial(senderLabel(m))}</div>
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3">
          <button type="button" onClick={onToggle} className="text-sm font-semibold text-left break-words">{senderLabel(m)}
            {staff && m.sender_name && m.sender_email && <span className="font-normal" style={{ color: T.muted }}> &lt;{m.sender_email}&gt;</span>}
            {m.direction === "outgoing" && <span className="font-normal" style={{ color: T.muted }}> · via Airfair</span>}</button>
          <span className="text-xs" style={{ color: T.muted }}>{formatDateTime(time)}</span>
        </div>
        <button type="button" onClick={() => setDetails(v => !v)} className="text-xs inline-flex items-center gap-0.5 max-w-full" style={{ color: T.muted }} aria-expanded={details}>
          <span className="truncate">to {r.to.join(", ")}{r.cc.length ? `, cc ${r.cc.join(", ")}` : ""}</span>{details ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>
        {details && <dl className="mt-2 text-xs grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 rounded-md p-2" style={{ backgroundColor: T.bg }}>
          <dt style={{ color: T.muted }}>From</dt><dd className="break-all">{m.direction === "incoming" ? m.from_email
            : `${m.from_name || "Air Fair Travel & Immigration"} <${m.from_email || "no-reply@airfairtravel.com"}>`}</dd>
          {staff && <><dt style={{ color: T.muted }}>Sent by</dt><dd className="break-all">{senderLabel(m)}{m.sender_email && m.sender_name ? ` <${m.sender_email}>` : ""}</dd></>}
          <dt style={{ color: T.muted }}>To</dt><dd className="break-all">{r.to.join(", ")}</dd>
          {!!r.cc.length && <><dt style={{ color: T.muted }}>Cc</dt><dd className="break-all">{r.cc.join(", ")}</dd></>}
          {/* BCC: internal only; messages are readable only by inbox-authorized staff (RLS). */}
          {!!r.bcc.length && <><dt style={{ color: T.muted }}>Bcc</dt><dd className="break-all">{r.bcc.join(", ")} <span style={{ color: T.muted }}>(internal)</span></dd></>}
          <dt style={{ color: T.muted }}>Date</dt><dd>{formatDateTime(time)}</dd>
          {m.direction === "outgoing" && <><dt style={{ color: T.muted }}>Status</dt><dd>{statusLabel(m)}</dd></>}
        </dl>}
        <p className="text-sm whitespace-pre-wrap break-words mt-3">{m.body_text}</p>
        <Attachments m={m} />
        {m.direction === "outgoing" && <p className="text-xs mt-2" style={{ color: m.last_error ? T.danger : T.muted }}>{statusLabel(m)}{m.last_error ? ` — ${m.last_error}` : ""}</p>}
        {staff && ["queued", "retry", "sending"].includes(m.status) && !m.resend_id && <div className="mt-2"><Button small tone="outline" disabled={busy} onClick={() => onAction(m.id)}>Retry send</Button></div>}
        {staff && m.resend_id && (!m.rfc_message_id || !FINAL_EVENTS.includes(m.provider_event)) && <div className="mt-2"><Button small tone="outline" icon={RefreshCw} disabled={busy} onClick={() => onAction(m.id)}>Refresh status</Button></div>}
      </div>
    </div>
  </article>;
}

export default function ThreadView({ conversationId, contacts, userId, selfEmail, revision, onBack, onReply, onOpenLead, onChanged, mailboxes = [] }) {
  const [state, setState] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [limit, setLimit] = useState(50);
  const [expanded, setExpanded] = useState(() => new Set());
  const [association, setAssociation] = useState("");
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let active = true, running = false;
    const load = async () => {
      if (running) return; running = true;
      try {
        const conversation = check(await supabase.from("email_conversations").select("*").eq("id", conversationId).single());
        const result = await supabase.from("email_messages").select("*", { count: "exact" }).eq("conversation_id", conversationId)
          .order("created_at", { ascending: false }).order("id").limit(limit);
        const data = check(result).reverse();
        // Mailboxes this thread is filed under (only those the user can read).
        const links = await supabase.from("email_conversation_mailboxes").select("mailbox_id").eq("conversation_id", conversationId);
        if (!active) return;
        setState({ conversation, data, more: result.count > limit, boxes: (links.data || []).map(l => l.mailbox_id) }); setError("");
        if (conversation.last_incoming_at) {
          const mine = check(await supabase.from("email_read_state").select("read_at").eq("conversation_id", conversationId).eq("user_id", userId).maybeSingle());
          if (!mine || new Date(mine.read_at) < new Date(conversation.last_incoming_at)) {
            check(await supabase.from("email_read_state").upsert({ conversation_id: conversationId, user_id: userId, read_at: conversation.last_incoming_at }));
            if (active) onChanged?.();
          }
        }
      } catch (err) { if (active) setError(err.message || "Could not load conversation"); }
      finally { running = false; }
    };
    load();
    const timer = setInterval(() => { if (!document.hidden) load(); }, 10000);
    return () => { active = false; clearInterval(timer); };
  }, [conversationId, userId, limit, revision, tick]);

  const conversation = state?.conversation;
  const lead = contacts.find(c => c.id === conversation?.contact_id);
  const messages = state?.data || [];
  const last = messages[messages.length - 1];
  const isOpen = m => expanded.has(m.id) || m.id === last?.id;
  const toggle = id => setExpanded(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  const allCc = replyAllCc(last, { to: conversation?.participant_email, self: selfEmail });

  const action = async id => {
    setBusy(true); setError(""); setNotice("");
    try {
      const { data, error: err } = await supabase.functions.invoke("inbox-send", { body: { message_id: id } });
      if (err) { const detail = await err.context?.json?.().catch(() => null); throw new Error(detail?.error || err.message); }
      if (data.error) throw new Error(data.error);
      setNotice(data.status === "sent" ? (DELIVERY[data.provider_event] ? `Status: ${DELIVERY[data.provider_event]}.` : "Accepted by Resend. Delivery not yet confirmed.") : "Saved. Check the status below.");
      setTick(t => t + 1); onChanged?.();
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };
  const markUnread = async () => {
    setBusy(true);
    try { check(await supabase.from("email_read_state").upsert({ conversation_id: conversationId, user_id: userId, read_at: "1970-01-01T00:00:00Z" })); onChanged?.(); onBack(); }
    catch (err) { setError(err.message); setBusy(false); }
  };
  const associate = async () => {
    setBusy(true); setError("");
    try { check(await supabase.rpc("associate_email_conversation", { p_conversation: conversationId, p_contact: association })); setTick(t => t + 1); onChanged?.(); }
    catch (err) { setError(err.message); } finally { setBusy(false); }
  };

  return <div className="flex flex-col min-w-0">
    <div className="flex items-center gap-1 px-2 py-1.5 border-b" style={{ borderColor: T.border }}>
      <button type="button" onClick={onBack} className="p-2 rounded-full hover:bg-black/5" aria-label="Back to list" title="Back"><ArrowLeft size={18} /></button>
      {conversation?.last_incoming_at && <button type="button" onClick={markUnread} disabled={busy} className="p-2 rounded-full hover:bg-black/5" aria-label="Mark as unread" title="Mark as unread"><MailOpen size={17} /></button>}
    </div>
    {error && <div className="p-3"><Notice tone="danger">{error}</Notice></div>}
    {!state && !error && <div className="p-6"><Spinner /></div>}
    {conversation && <>
      <div className="px-4 pt-4 pb-2 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold break-words" style={{ color: T.ink }}>{conversation.subject}</h2>
          {mailboxes.length > 1 && <div className="flex flex-wrap gap-1 mt-1">{state.boxes.map(id => mailboxes.find(b => b.id === id)).filter(Boolean).map(b =>
            <span key={b.id} className="text-xs rounded px-1.5 py-0.5" title={b.address} style={{ border: `1px solid ${T.border}`, color: T.muted,
              fontWeight: b.id === conversation.mailbox_id ? 600 : 400 }}>{b.name}{b.id === conversation.mailbox_id ? " · replies from here" : ""}</span>)}</div>}
        </div>
        {lead ? <Button small tone="outline" onClick={() => onOpenLead(lead.id)}>Lead: {lead.name}</Button>
          : <div className="flex flex-wrap gap-2 items-end"><LabeledSelect label="Associate with lead" value={association} onChange={setAssociation}
            options={[{ value: "", label: "Select lead" }, ...contacts.map(c => ({ value: c.id, label: `${c.name} (${c.email || "no email"})` }))]} />
            <Button small disabled={!association || busy} onClick={associate}>Associate</Button></div>}
      </div>
      {notice && <div className="px-4 pb-2"><Notice>{notice}</Notice></div>}
      {state.more && <div className="px-4 pb-2"><Button small tone="outline" onClick={() => setLimit(n => n + 50)}>Load older messages</Button></div>}
      <div className="border-t" style={{ borderColor: T.border }}>
        {messages.map(m => <Message key={m.id} m={m} expanded={isOpen(m)} onToggle={() => toggle(m.id)} busy={busy} onAction={action} />)}
      </div>
      <div className="flex flex-wrap gap-2 p-4">
        <Button tone="outline" icon={Reply} onClick={() => onReply("reply", conversation, lead, [])}>Reply</Button>
        {allCc.length > 0 && <Button tone="outline" icon={ReplyAll} onClick={() => onReply("replyAll", conversation, lead, allCc)}>Reply all</Button>}
      </div>
    </>}
  </div>;
}
