// Client List → Send Email: compose, preview/test, optional drip, review, queue.
// Sending happens server-side (campaign-worker); this only creates the campaign.
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Bold, Eye, Italic, Link2, List, Send, Underline, UserRound } from "lucide-react";
import { supabase } from "../../lib/supabase.js";
import { T, fontBody, Button, LabeledInput, LabeledSelect, Modal, Notice, ToggleRow, formatDateTime, inputStyle } from "../ui.jsx";
import { editorPaste, estimateCompletion, hasFirstNameToken, renderCampaignEmail, sanitizeHtml } from "../../../supabase/functions/_shared/campaigns/render.ts";
import { RecipientRow } from "../inbox/ComposePanel.jsx";
import { EMAIL, normalizeEmail } from "../inboxRecipients.js";

const TIMEZONES = ["Asia/Manila", "Asia/Singapore", "Asia/Tokyo", "Asia/Dubai", "Europe/London", "America/New_York", "America/Los_Angeles", "Australia/Sydney", "UTC"];
const invokeError = async err => (await err.context?.json?.().catch(() => null))?.error || err.message;

function RichEditor({ value, onChange }) {
  const ref = useRef(null);
  useEffect(() => { if (ref.current) ref.current.innerHTML = sanitizeHtml(value); }, []);
  const cmd = (name, arg) => { ref.current?.focus(); document.execCommand(name, false, arg); onChange(sanitizeHtml(ref.current.innerHTML)); };
  const paste = e => {
    e.preventDefault();
    const data = e.clipboardData || e.dataTransfer;
    if (data) cmd("insertHTML", editorPaste(data.getData("text/html"), data.getData("text/plain")));
  };
  const link = () => { const url = window.prompt("Link address (https://…)"); if (url && /^(https?:\/\/|mailto:)/i.test(url.trim())) cmd("createLink", url.trim()); };
  const tool = (Icon, label, fn) => <button type="button" onMouseDown={e => e.preventDefault()} onClick={fn} aria-label={label} title={label} className="p-1.5 rounded hover:bg-black/5"><Icon size={15} /></button>;
  return <div className="rounded-lg" style={{ border: `1px solid ${T.border}`, backgroundColor: "#fff" }}>
    <div className="flex flex-wrap items-center gap-0.5 px-1.5 py-1 border-b" style={{ borderColor: T.border, color: T.muted }}>
      {tool(Bold, "Bold", () => cmd("bold"))}{tool(Italic, "Italic", () => cmd("italic"))}{tool(Underline, "Underline", () => cmd("underline"))}
      {tool(List, "Bulleted list", () => cmd("insertUnorderedList"))}{tool(Link2, "Link", link)}
      <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => cmd("insertText", "{{first_name}}")} className="ml-auto inline-flex items-center gap-1 text-xs px-2 py-1 rounded hover:bg-black/5" style={{ ...fontBody }}><UserRound size={13} />Insert first name</button>
    </div>
    <div ref={ref} contentEditable suppressContentEditableWarning role="textbox" aria-multiline="true" aria-label="Message"
      onPaste={paste} onDrop={paste} onDragOver={e => e.preventDefault()}
      onInput={e => onChange(sanitizeHtml(e.currentTarget.innerHTML))} className="min-h-[10rem] max-h-[40vh] overflow-y-auto px-3 py-2 text-sm outline-none" style={{ color: T.ink, ...fontBody }} />
  </div>;
}

export default function BulkEmailComposer({ contacts, onClose, onQueued }) {
  const [step, setStep] = useState("compose");
  const [mailboxes, setMailboxes] = useState([]);
  const [form, setForm] = useState({ kind: "service", mailboxId: "", subject: "", body: "<p>Hi {{first_name}},</p><p></p>", fallback: "there",
    drip: false, batchSize: 25, intervalMinutes: 60, startAt: "", useWindow: false, windowStart: "09:00", windowEnd: "17:00", timezone: "Asia/Manila" });
  const [review, setReview] = useState(null);
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const requestKey = useRef(crypto.randomUUID());
  // Optional CC/BCC added to every email (one copy per client). Empty by default.
  const [cc, setCc] = useState([]);
  const [bcc, setBcc] = useState([]);
  const [ccInput, setCcInput] = useState("");
  const [bccInput, setBccInput] = useState("");
  const [showBcc, setShowBcc] = useState(false);
  const addCopy = field => {
    const value = normalizeEmail(field === "cc" ? ccInput : bccInput), list = field === "cc" ? cc : bcc;
    if (!EMAIL.test(value)) { setError("Enter a valid email address for CC/BCC."); return; }
    if (cc.includes(value) || bcc.includes(value)) { setError("That address is already in CC or BCC."); return; }
    if (list.length >= 5) { setError(`Bulk email allows up to 5 ${field.toUpperCase()} addresses.`); return; }
    (field === "cc" ? setCc : setBcc)([...list, value]); (field === "cc" ? setCcInput : setBccInput)(""); setError("");
  };
  const set = patch => { setForm(f => ({ ...f, ...patch })); setError(""); setNotice(""); };

  useEffect(() => {
    supabase.rpc("inbox_my_mailboxes").then(({ data }) => {
      const sendable = (data || []).filter(b => b.can_send && b.status === "active");
      setMailboxes(sendable);
      if (sendable.length) set({ mailboxId: (sendable.find(b => b.is_default) || sendable[0]).id });
    });
  }, []);
  const box = mailboxes.find(b => b.id === form.mailboxId);
  const [replyTo, setReplyTo] = useState("");
  useEffect(() => { if (box) supabase.from("email_mailboxes").select("receiving_address").eq("id", box.id).single().then(({ data }) => setReplyTo(data?.receiving_address || "")); }, [box?.id]);

  // Server-side eligibility (dedupe, missing/invalid, consent, suppressions).
  const loadReview = async () => {
    setBusy("review"); setError("");
    const { data, error: err } = await supabase.rpc("campaign_preview_recipients", { p_contact_ids: contacts.map(c => c.id), p_kind: form.kind });
    setBusy("");
    if (err) { setError(/campaign_preview_recipients/.test(err.message) ? "Bulk email needs the latest database update." : err.message); return null; }
    setReview(data); return data;
  };
  useEffect(() => { setReview(null); }, [form.kind]);
  const eligible = review?.filter(r => r.eligible) || [];
  const excluded = review?.filter(r => !r.eligible) || [];
  const sampleName = (review ? eligible[0]?.first_name : contacts[0]?.name?.split(/\s+/)[0]) || null;
  const rendered = useMemo(() => renderCampaignEmail({ kind: form.kind, subject: form.subject || "(no subject)", body_html: form.body, first_name_fallback: form.fallback, from_name: box?.name || "Air Fair" },
    sampleName, { unsubscribeUrl: "https://airfairtravel.com/newsletter/unsubscribe?c=preview" }), [form, box, sampleName]);
  const estimate = estimateCompletion({ count: review ? eligible.length : contacts.length, drip: form.drip, batchSize: Number(form.batchSize) || 1, intervalMinutes: Number(form.intervalMinutes) || 0,
    startAt: form.startAt ? new Date(form.startAt).toISOString() : null, windowStart: form.drip && form.useWindow ? form.windowStart : null, windowEnd: form.drip && form.useWindow ? form.windowEnd : null, timezone: form.timezone });

  const problems = [!box && "Choose who it's from.", !form.subject.trim() && "Add a subject.", !sanitizeHtml(form.body).replace(/<[^>]+>/g, "").replace(/\{\{\s*first_?name\s*\}\}/gi, "").trim() && "Write a message.",
    form.drip && !(Number(form.batchSize) >= 1 && Number(form.batchSize) <= 500) && "Recipients per batch: 1–500.",
    form.drip && !(Number(form.intervalMinutes) >= 1 && Number(form.intervalMinutes) <= 10080) && "Interval: 1 minute to 7 days."].filter(Boolean);

  const sendTest = async () => {
    setBusy("test"); setError(""); setNotice("");
    const { data, error: err } = await supabase.functions.invoke("campaign-worker", { body: { action: "test", mailbox_id: form.mailboxId, kind: form.kind,
      subject: form.subject, body_html: sanitizeHtml(form.body), first_name_fallback: form.fallback, sample_first_name: sampleName } });
    setBusy("");
    if (err) { setError(/Failed to send|404/.test(err.message) ? "The campaign-worker function isn't deployed yet." : await invokeError(err)); return; }
    if (data?.error) { setError(data.error); return; }
    setNotice(`Test sent to ${data.to}.`);
  };
  const goReview = async () => { if (problems.length) { setError(problems[0]); return; } if (await loadReview()) setStep("review"); };
  const queue = async () => {
    setBusy("queue"); setError("");
    const { data, error: err } = await supabase.rpc("campaign_create", {
      p_request_key: requestKey.current, p_mailbox: form.mailboxId, p_kind: form.kind, p_subject: form.subject.trim(), p_body_html: sanitizeHtml(form.body),
      p_first_name_fallback: form.fallback, p_contact_ids: contacts.map(c => c.id),
      p_drip: { enabled: form.drip, batch_size: Number(form.batchSize), interval_minutes: Number(form.intervalMinutes),
        start_at: form.startAt ? new Date(form.startAt).toISOString() : "", window_start: form.drip && form.useWindow ? form.windowStart : "",
        window_end: form.drip && form.useWindow ? form.windowEnd : "", timezone: form.timezone }, p_cc: cc, p_bcc: bcc });
    setBusy("");
    if (err) { setError(err.message); return; }
    onQueued(data);
  };

  const field = { ...inputStyle, backgroundColor: "#fff" };
  return <Modal title={`Send email to ${contacts.length} selected client${contacts.length === 1 ? "" : "s"}`} onClose={onClose} footer={step === "compose" ? <>
      <Button tone="outline" onClick={onClose}>Cancel</Button>
      <Button tone="outline" icon={Send} busy={busy === "test"} disabled={!box || !form.subject.trim()} onClick={sendTest}>Send test to me</Button>
      <Button busy={busy === "review"} onClick={goReview}>Review recipients</Button>
    </> : <>
      <Button tone="outline" onClick={() => setStep("compose")}>Back</Button>
      <Button icon={Send} busy={busy === "queue"} disabled={!eligible.length} onClick={queue}>{form.drip ? "Schedule" : "Send"} {eligible.length} email{eligible.length === 1 ? "" : "s"}</Button>
    </>}>
    <div className="flex flex-col gap-4">
      {step === "compose" && <>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <LabeledSelect label="Type" value={form.kind} onChange={kind => set({ kind })} options={[{ value: "service", label: "Service update (clients)" }, { value: "promotional", label: "Promotional (subscribers only)" }]} />
          <LabeledSelect label="From" value={form.mailboxId} onChange={mailboxId => set({ mailboxId })} options={mailboxes.length ? mailboxes.map(b => ({ value: b.id, label: `${b.name} <${b.address}>` })) : [{ value: "", label: "No mailbox you can send from" }]} />
        </div>
        <p className="text-xs -mt-2" style={{ color: T.muted, ...fontBody }}>
          {form.kind === "promotional" ? "Only clients who subscribed to marketing emails (and haven't unsubscribed) receive it, with an unsubscribe link." : "For essential updates about a client's inquiry or application. Marketing unsubscribes don't apply."}
          {replyTo && <> Replies go to <strong>{replyTo}</strong> and appear in Email Inbox → {box?.name}.</>}
        </p>
        <div className="rounded-lg overflow-visible" style={{ border: `1px solid ${T.border}`, backgroundColor: "#fff" }}>
          <RecipientRow label="Cc" chips={cc.map(address => ({ address }))} onRemove={a => setCc(cc.filter(x => x !== a))} input={ccInput} setInput={setCcInput} onAdd={() => addCopy("cc")}
            trailing={!showBcc && !bcc.length && <button type="button" className="text-sm pt-0.5 shrink-0" style={{ color: T.muted }} onClick={() => setShowBcc(true)}>Bcc</button>} />
          {(showBcc || bcc.length > 0) && <RecipientRow label="Bcc" chips={bcc.map(address => ({ address }))} onRemove={a => setBcc(bcc.filter(x => x !== a))} input={bccInput} setInput={setBccInput} onAdd={() => addCopy("bcc")} />}
        </div>
        {(cc.length > 0 || bcc.length > 0) && <p className="text-xs -mt-2" style={{ color: T.warn, ...fontBody }}>
          Each client gets a separate email, so every CC/BCC address receives one copy per client ({contacts.length} selected).{cc.length > 0 && " CC addresses are visible to every client."} Clients never see each other.</p>}
        <LabeledInput label="Subject" value={form.subject} onChange={subject => set({ subject })} placeholder="e.g. {{first_name}}, your visa checklist" />
        <RichEditor value={form.body} onChange={body => set({ body })} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
          <LabeledInput label="If a first name is missing, use" value={form.fallback} onChange={fallback => set({ fallback })} />
          <Button tone="outline" icon={Eye} onClick={() => setPreview(v => !v)}>{preview ? "Hide preview" : "Preview"}</Button>
        </div>
        {!hasFirstNameToken(form.body + form.subject) && <p className="text-xs" style={{ color: T.muted }}>Tip: use {"{{first_name}}"} to greet each client by name.</p>}
        {preview && <div className="rounded-lg overflow-hidden" style={{ border: `1px solid ${T.border}` }}>
          <div className="px-3 py-2 text-xs" style={{ backgroundColor: T.bg, color: T.muted }}>Subject: <strong style={{ color: T.ink }}>{rendered.subject}</strong>{sampleName ? ` · as ${sampleName}` : " · fallback name"}</div>
          <iframe title="Email preview" sandbox="" srcDoc={rendered.html} className="w-full" style={{ height: 320, border: 0, backgroundColor: "#fff" }} />
        </div>}
        <div className="rounded-lg p-3 flex flex-col gap-3" style={{ border: `1px solid ${T.border}`, backgroundColor: T.bg }}>
          <ToggleRow label="Drip Sending" checked={form.drip} onChange={drip => set({ drip })} />
          {form.drip && <>
            <div className="grid grid-cols-2 gap-3">
              <LabeledInput label="Recipients per batch" type="number" value={form.batchSize} onChange={batchSize => set({ batchSize })} />
              <LabeledInput label="Minutes between batches" type="number" value={form.intervalMinutes} onChange={intervalMinutes => set({ intervalMinutes })} />
            </div>
            <div><label className="text-xs block mb-1.5" style={{ color: T.muted, ...fontBody }}>Start (optional)</label>
              <input type="datetime-local" value={form.startAt} onChange={e => set({ startAt: e.target.value })} className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={field} /></div>
            <label className="flex items-center gap-2 text-sm" style={{ color: T.ink, ...fontBody }}><input type="checkbox" checked={form.useWindow} onChange={e => set({ useWindow: e.target.checked })} />Only send during these hours</label>
            {form.useWindow && <div className="grid grid-cols-3 gap-3">
              <div><label className="text-xs block mb-1.5" style={{ color: T.muted }}>From</label><input type="time" value={form.windowStart} onChange={e => set({ windowStart: e.target.value })} className="w-full rounded-lg px-2 py-2 text-sm outline-none" style={field} /></div>
              <div><label className="text-xs block mb-1.5" style={{ color: T.muted }}>Until</label><input type="time" value={form.windowEnd} onChange={e => set({ windowEnd: e.target.value })} className="w-full rounded-lg px-2 py-2 text-sm outline-none" style={field} /></div>
              <LabeledSelect label="Timezone" value={form.timezone} onChange={timezone => set({ timezone })} options={TIMEZONES.map(z => ({ value: z, label: z }))} />
            </div>}
          </>}
          <p className="text-xs" style={{ color: T.muted, ...fontBody }}>
            Estimated finish: <strong style={{ color: T.ink }}>{formatDateTime(estimate.finishAt.toISOString())}</strong>{form.drip ? ` (${estimate.batches} batch${estimate.batches === 1 ? "" : "es"})` : ""}.
            {" "}{form.drip ? "Drip controls the sending pace only; it doesn't guarantee inbox placement." : "Sent at the provider's safe rate; large lists take a few minutes."} Provider limits and quotas are always respected; a reached quota pauses the campaign.
          </p>
        </div>
      </>}
      {step === "review" && review && <>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
          {[["Selected", contacts.length], ["Will receive", eligible.length], ["Excluded", excluded.length], ["Finish ~", formatDateTime(estimate.finishAt.toISOString())]].map(([l, v]) =>
            <div key={l} className="rounded-lg p-2" style={{ backgroundColor: T.bg, border: `1px solid ${T.border}` }}><div className="text-[11px]" style={{ color: T.muted }}>{l}</div><div className="text-sm font-medium" style={{ color: T.ink }}>{v}</div></div>)}
        </div>
        {(cc.length > 0 || bcc.length > 0) && <Notice tone="warn">{cc.length > 0 && <>CC (visible to clients): {cc.join(", ")}. </>}{bcc.length > 0 && <>BCC (hidden): {bcc.join(", ")}. </>}
          Each address receives {eligible.length} cop{eligible.length === 1 ? "y" : "ies"}, one per client email.</Notice>}
        <p className="text-xs" style={{ color: T.muted, ...fontBody }}>Each person gets their own email; clients never see each other's addresses. From {box?.name} &lt;{box?.address}&gt;; replies to {replyTo}. You're recorded as the sender of this campaign.</p>
        <details open={excluded.length > 0}><summary className="text-sm cursor-pointer" style={{ color: T.ink }}>Excluded ({excluded.length})</summary>
          <ul className="mt-2 max-h-40 overflow-y-auto text-xs flex flex-col gap-1">{excluded.map(r => <li key={r.contact_id} className="flex justify-between gap-3"><span className="truncate">{r.name} {r.email ? `<${r.email}>` : ""}</span><span style={{ color: T.danger }}>{r.reason}</span></li>)}
            {!excluded.length && <li style={{ color: T.muted }}>Nobody excluded.</li>}</ul></details>
        <details><summary className="text-sm cursor-pointer" style={{ color: T.ink }}>Will receive ({eligible.length})</summary>
          <ul className="mt-2 max-h-40 overflow-y-auto text-xs flex flex-col gap-1">{eligible.map(r => <li key={r.contact_id} className="truncate">{r.name} &lt;{r.email}&gt;</li>)}</ul></details>
        {!eligible.length && <Notice tone="warn">Nobody selected can receive this {form.kind === "promotional" ? "promotional email (no marketing consent or unsubscribed)" : "email"}.</Notice>}
      </>}
      {error && <Notice tone="danger">{error}</Notice>}
      {notice && <Notice tone="success">{notice}</Notice>}
    </div>
  </Modal>;
}
