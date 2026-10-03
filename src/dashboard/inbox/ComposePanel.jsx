// Gmail-style compose: docked bottom-right on desktop, full screen on mobile.
// Used for new emails and replies. Recipients follow the same rules as the
// server (inboxRecipients.js); the server recomputes and must agree.
import React, { useRef, useState } from "react";
import { Maximize2, Minus, Paperclip, Send, X } from "lucide-react";
import { supabase } from "../../lib/supabase.js";
import { Button, Notice, T } from "../ui.jsx";
import { MAX_COPIES, attachmentProblem, pickFromMailbox, finalRecipients, formatBytes, normalizeEmail, recipientProblem } from "../inboxRecipients.js";

const chipStyle = { backgroundColor: T.bg, border: `1px solid ${T.border}` };

// One recipient row. The sender's own automatic copy shows once, as a normal
// chip without a remove button (the server adds it by policy).
function RecipientRow({ label, chips, onRemove, input, setInput, onAdd, trailing }) {
  return <div className="flex items-start gap-2 px-3 py-1.5 border-b" style={{ borderColor: T.border }}>
    <span className="text-sm pt-1 w-10 shrink-0" style={{ color: T.muted }}>{label}</span>
    <div className="flex flex-wrap gap-1 items-center flex-1 min-w-0">
      {chips.map(c => <span key={c.address} className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs max-w-full" style={chipStyle}
        title={c.auto ? "Your copy, added automatically" : undefined}>
        <span className="truncate">{c.label || c.address}</span>
        {onRemove && !c.auto && !c.locked && <button type="button" aria-label={`Remove ${c.address}`} onClick={() => onRemove(c.address)}><X size={12} /></button>}
      </span>)}
      {onAdd && <input value={input} onChange={e => setInput(e.target.value)} aria-label={`Add ${label} recipient`} type="email" autoComplete="off"
        onKeyDown={e => { if (["Enter", ",", "Tab", " "].includes(e.key) && input.trim()) { e.preventDefault(); onAdd(); } }}
        onBlur={() => input.trim() && onAdd()} className="flex-1 min-w-[8rem] text-sm outline-none bg-transparent py-0.5" />}
    </div>
    {trailing}
  </div>;
}

// New email: search leads by name or email; the chosen lead becomes one chip.
function LeadSearch({ contacts, contactId, setContactId }) {
  const [term, setTerm] = useState("");
  const [active, setActive] = useState(0);
  const lead = contacts.find(c => c.id === contactId && c.email);
  const q = term.trim().toLowerCase();
  const matches = q ? contacts.filter(c => c.email && `${c.name || ""} ${c.email}`.toLowerCase().includes(q)).slice(0, 8) : [];
  const pick = c => { setContactId(c.id); setTerm(""); setActive(0); };
  return <div className="relative flex items-start gap-2 px-3 py-1.5 border-b" style={{ borderColor: T.border }}>
    <span className="text-sm pt-1 w-10 shrink-0" style={{ color: T.muted }}>To</span>
    <div className="flex-1 min-w-0">
      {lead ? <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs max-w-full" style={chipStyle}>
        <span className="truncate">{lead.name ? `${lead.name} <${lead.email}>` : lead.email}</span>
        <button type="button" aria-label="Change recipient" onClick={() => setContactId("")}><X size={12} /></button>
      </span> : <input value={term} onChange={e => { setTerm(e.target.value); setActive(0); }} placeholder="Search leads by name or email"
        aria-label="To: search leads" role="combobox" aria-expanded={matches.length > 0} aria-controls="compose-lead-options" autoComplete="off"
        onKeyDown={e => {
          if (e.key === "ArrowDown") { e.preventDefault(); setActive(i => Math.min(i + 1, matches.length - 1)); }
          if (e.key === "ArrowUp") { e.preventDefault(); setActive(i => Math.max(i - 1, 0)); }
          if (e.key === "Enter" && matches[active]) { e.preventDefault(); pick(matches[active]); }
          if (e.key === "Escape") setTerm("");
        }} className="w-full text-sm outline-none bg-transparent py-0.5" />}
    </div>
    {!lead && q && <ul id="compose-lead-options" role="listbox" className="absolute z-20 left-12 right-3 top-full mt-1 rounded-lg shadow-lg max-h-56 overflow-y-auto text-sm"
      style={{ backgroundColor: T.surface, border: `1px solid ${T.border}` }}>
      {matches.length ? matches.map((c, i) => <li key={c.id} role="option" aria-selected={i === active}>
        <button type="button" className="w-full text-left px-3 py-2 truncate" style={{ backgroundColor: i === active ? T.accentSoft : undefined }}
          onMouseEnter={() => setActive(i)} onMouseDown={e => e.preventDefault()} onClick={() => pick(c)}>
          {c.name || c.email}{c.name && <span style={{ color: T.muted }}> &lt;{c.email}&gt;</span>}
        </button></li>)
        : <li className="px-3 py-2" style={{ color: T.muted }}>No lead with an email matches.</li>}
    </ul>}
  </div>;
}

export default function ComposePanel({ mode, contacts, userId, copyDefaults, reloadDefaults, initialContactId = "", conversation, lead,
  replyCc = [], onClose, onSent, mailboxes = [], preferredMailbox = null }) {
  const reply = mode !== "new";
  const { sendable } = pickFromMailbox(mailboxes, preferredMailbox);
  const [fromId, setFromId] = useState(() => pickFromMailbox(mailboxes, preferredMailbox).initial);
  const fromBox = sendable.find(b => b.id === fromId);
  const receivedIn = reply && conversation?.mailbox_id && mailboxes.find(b => b.id === conversation.mailbox_id);
  const [minimized, setMinimized] = useState(false);
  const [contactId, setContactId] = useState(initialContactId || "");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [manualCc, setManualCc] = useState(replyCc);
  const [manualBcc, setManualBcc] = useState([]);
  const [ccInput, setCcInput] = useState("");
  const [bccInput, setBccInput] = useState("");
  const [showBcc, setShowBcc] = useState(false);
  const [files, setFiles] = useState([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const fileInput = useRef(null);
  // A saved request (key + uploaded files) is reused on retry: never a second email.
  const request = useRef(null);
  const [saved, setSaved] = useState(false);

  const toAddress = normalizeEmail(reply ? conversation?.participant_email : contacts.find(c => c.id === contactId)?.email);
  const shown = copyDefaults ? finalRecipients({ to: toAddress, mode: copyDefaults.copy_mode, senderEmail: copyDefaults.sender_email, cc: manualCc, bcc: manualBcc }) : null;
  const bccOpen = !!shown && (showBcc || shown.bcc.length > 0);
  const title = reply ? (mode === "replyAll" ? "Reply all" : "Reply") : "New message";
  const replySubject = conversation ? (/^re:/i.test(conversation.subject) ? conversation.subject : `Re: ${conversation.subject}`) : "";
  const dirty = body.trim() || subject.trim() || files.length || manualBcc.length;

  const add = field => {
    const value = field === "cc" ? ccInput : bccInput;
    const problem = recipientProblem(value, shown) || ((field === "cc" ? shown.cc : shown.bcc).length >= MAX_COPIES ? `Maximum ${MAX_COPIES} ${field.toUpperCase()} recipients.` : "");
    if (problem) { setError(problem); return; }
    setError("");
    (field === "cc" ? setManualCc : setManualBcc)(prev => [...prev, normalizeEmail(value)]);
    (field === "cc" ? setCcInput : setBccInput)("");
  };
  const remove = field => address => (field === "cc" ? setManualCc : setManualBcc)(prev => prev.filter(a => a !== address));
  const pickFiles = list => {
    const adding = [...list];
    const problem = attachmentProblem(files, adding);
    if (problem) { setError(problem); return; }
    setError(""); setFiles(prev => [...prev, ...adding]);
  };
  const close = () => {
    if ((dirty || saved) && !window.confirm(saved ? "This email was saved but may not have sent. Close anyway? You can retry it from the conversation." : "Discard this draft?")) return;
    onClose();
  };

  const send = async () => {
    setBusy(true); setError("");
    try {
      if (!request.current) {
        const key = crypto.randomUUID();
        const uploaded = [];
        for (const [i, f] of files.entries()) {
          const safe = f.name.replace(/[^\w.\-]+/g, "_").slice(-120) || "file";
          const path = `outgoing/${userId}/${key}/${i}-${safe}`;
          const { error: upErr } = await supabase.storage.from("email-attachments").upload(path, f, { contentType: f.type || undefined, upsert: false });
          if (upErr) throw new Error(`Could not upload ${f.name}: ${upErr.message}`);
          uploaded.push({ path, filename: f.name });
        }
        request.current = { request_key: key, contact_id: reply ? null : contactId, conversation_id: reply ? conversation.id : null, subject, body,
          ...(fromBox ? { mailbox_id: fromBox.id } : {}),
          ...(shown ? { cc: shown.cc, bcc: shown.bcc } : {}), ...(uploaded.length ? { attachments: uploaded } : {}) };
        setSaved(true);
      }
      const { data, error: sendError } = await supabase.functions.invoke("inbox-send", { body: request.current });
      if (sendError) {
        const detail = await sendError.context?.json?.().catch(() => null);
        throw new Error(detail?.error || sendError.message);
      }
      if (data.error) throw new Error(data.error);
      request.current = null; setSaved(false);
      onSent(data);
    } catch (err) {
      // Refused before anything was saved: show the current recipients and start a fresh request.
      if (/Recipients changed|Invalid recipient|Too many recipients|Invalid attachment|Attachment|file type|10 MB|maximum 5/.test(err.message || "")) {
        request.current = null; setSaved(false); reloadDefaults();
      }
      setError(err.message || "Could not send. Send again to retry the same saved email.");
    } finally { setBusy(false); }
  };

  const locked = busy || saved;
  // Without mailboxes (database not updated yet) the server uses its default sender.
  const noSender = mailboxes.length > 0 && !fromBox;
  const canSend = body.trim() && toAddress && (reply || subject.trim()) && !noSender;
  return <section role="dialog" aria-label={title}
    className={`fixed z-50 flex flex-col shadow-2xl ${minimized ? "bottom-0 right-0 sm:right-4 w-full sm:w-80 rounded-t-xl" : "inset-0 sm:inset-auto sm:bottom-0 sm:right-4 sm:w-[34rem] sm:max-w-[calc(100vw-2rem)] sm:h-[min(36rem,85vh)] sm:rounded-t-xl"}`}
    style={{ backgroundColor: T.surface, border: `1px solid ${T.border}` }}>
    <header className="flex items-center gap-2 px-3 py-2 sm:rounded-t-xl" style={{ backgroundColor: T.ink, color: "#fff" }}>
      <button type="button" className="flex-1 text-left text-sm font-medium truncate" onClick={() => setMinimized(v => !v)}>{title}</button>
      <button type="button" aria-label={minimized ? "Expand" : "Minimize"} onClick={() => setMinimized(v => !v)} className="p-1">{minimized ? <Maximize2 size={14} /> : <Minus size={14} />}</button>
      <button type="button" aria-label="Close" onClick={close} className="p-1"><X size={15} /></button>
    </header>
    {!minimized && <>
      <fieldset disabled={locked} className="flex flex-col flex-1 min-h-0">
        {sendable.length > 0 && <div className="flex items-center gap-2 px-3 py-1.5 border-b" style={{ borderColor: T.border }}>
          <span className="text-sm w-10 shrink-0" style={{ color: T.muted }}>From</span>
          <select value={fromId} onChange={e => setFromId(e.target.value)} aria-label="From mailbox" className="flex-1 min-w-0 text-sm bg-transparent outline-none py-0.5">
            {sendable.map(b => <option key={b.id} value={b.id}>{b.name} &lt;{b.address}&gt;</option>)}
          </select>
        </div>}
        {noSender && <div className="px-3 py-2 border-b text-sm" style={{ borderColor: T.border, color: T.danger }}>
          {receivedIn ? `You can't send from ${receivedIn.name}.` : "You can't send from any mailbox."} Ask an administrator for send access.</div>}
        {reply && receivedIn && fromBox && fromBox.id !== receivedIn.id && <div className="px-3 py-1 border-b text-xs" style={{ borderColor: T.border, color: T.muted }}>
          This conversation arrived in {receivedIn.name}; replying from {fromBox.name} also files it there.</div>}
        {reply ? <RecipientRow label="To" chips={toAddress ? [{ address: toAddress, locked: true, label: lead?.name ? `${lead.name} <${toAddress}>` : toAddress }] : []} />
          : <LeadSearch contacts={contacts} contactId={contactId} setContactId={setContactId} />}
        {shown && <RecipientRow label="Cc" chips={shown.ccChips} onRemove={remove("cc")} input={ccInput} setInput={setCcInput} onAdd={() => add("cc")}
          trailing={!bccOpen && <button type="button" className="text-sm pt-0.5 shrink-0" style={{ color: T.muted }} onClick={() => setShowBcc(true)}>Bcc</button>} />}
        {bccOpen && <RecipientRow label="Bcc" chips={shown.bccChips} onRemove={remove("bcc")} input={bccInput} setInput={setBccInput} onAdd={() => add("bcc")} />}
        {reply ? <div className="px-3 py-2 border-b text-sm truncate" style={{ borderColor: T.border, color: T.muted }}>{replySubject}</div>
          : <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Subject" aria-label="Subject" maxLength={200}
            className="px-3 py-2 border-b text-sm outline-none bg-transparent" style={{ borderColor: T.border }} />}
        <textarea value={body} onChange={e => setBody(e.target.value)} aria-label="Message" autoFocus={reply}
          className="flex-1 min-h-[8rem] px-3 py-2 text-sm outline-none resize-none bg-transparent" />
        {!!files.length && <ul className="px-3 pb-2 flex flex-wrap gap-1.5">
          {files.map((f, i) => <li key={`${f.name}-${i}`} className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs max-w-full" style={chipStyle}>
            <Paperclip size={12} /><span className="truncate max-w-[12rem]">{f.name}</span><span style={{ color: T.muted }}>{formatBytes(f.size)}</span>
            {!locked && <button type="button" aria-label={`Remove ${f.name}`} onClick={() => setFiles(prev => prev.filter((_, j) => j !== i))}><X size={12} /></button>}
          </li>)}
        </ul>}
      </fieldset>
      <div className="px-3 pb-1 flex flex-col gap-1">
        {error && <Notice tone="danger">{error}</Notice>}
        {copyDefaults?.test_mode && <Notice tone="warn">Test mode: sent only to the test address.</Notice>}
      </div>
      <footer className="flex items-center gap-2 px-3 py-2 border-t" style={{ borderColor: T.border }}>
        <Button icon={Send} busy={busy} disabled={!canSend} onClick={send}>{saved ? "Retry send" : "Send"}</Button>
        <input ref={fileInput} type="file" multiple hidden onChange={e => { pickFiles(e.target.files); e.target.value = ""; }} />
        <button type="button" aria-label="Attach files" title="Attach files (up to 5, 10 MB total)" disabled={locked}
          onClick={() => fileInput.current?.click()} className="p-2 rounded-md" style={{ color: T.muted }}><Paperclip size={17} /></button>
        <span className="text-xs ml-auto truncate" style={{ color: T.muted }}>Plain text</span>
      </footer>
    </>}
  </section>;
}
