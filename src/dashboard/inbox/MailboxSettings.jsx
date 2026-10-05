// Email → Settings → Mailboxes (administrators only; every write goes through
// admin_* database functions, verification through the mailbox-verify function).
import React, { useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2, Plus, RefreshCw, Star } from "lucide-react";
import { supabase } from "../../lib/supabase.js";
import { Button, LabeledInput, Notice, Spinner, T, formatDateTime } from "../ui.jsx";

const STATUS = {
  pending: { label: "Pending Setup", bg: T.warnSoft, fg: T.warn },
  active: { label: "Active", bg: T.accentSoft, fg: T.accent },
  disabled: { label: "Disabled", bg: T.border, fg: T.muted },
  setup_failed: { label: "Setup Failed", bg: T.dangerSoft, fg: T.danger },
};
const check = ({ data, error }) => { if (error) throw error; return data; };
const invokeError = async err => (await err.context?.json?.().catch(() => null))?.error || err.message;
export const StatusBadge = ({ status }) => { const s = STATUS[status] || STATUS.pending;
  return <span className="text-xs rounded-full px-2 py-0.5 whitespace-nowrap" style={{ backgroundColor: s.bg, color: s.fg }}>{s.label}</span>; };

function SetupSteps({ box }) {
  const isGeneral = box.address === "no-reply@airfairtravel.com";
  if (box.send_only) return <div className="text-sm rounded-lg p-3 flex flex-col gap-2" style={{ backgroundColor: T.bg }}>
    <p className="font-medium">Setup (send-only)</p>
    <p style={{ color: T.muted }}>Used as the From address in Email Inbox and bulk email. Mail sent directly to {box.address} stays in Google Workspace; replies to emails sent from the dashboard still come back to the dashboard.</p>
    <p>Click <strong>Verify Setup</strong>: a test email is sent from {box.address} to itself. When Resend accepts it, the mailbox becomes Active.</p>
  </div>;
  return <div className="text-sm rounded-lg p-3 flex flex-col gap-2" style={{ backgroundColor: T.bg }}>
    <p className="font-medium">Setup</p>
    {isGeneral ? <p style={{ color: T.muted }}>This is the existing Airfair sender. Replies reach the dashboard through each email's thread address.</p> : <>
      <p style={{ color: T.muted }}>Creating a mailbox here does not create a Google Workspace account. {box.address} must exist in Google Workspace (user, group or alias) and forward a copy to the dashboard.</p>
      <ol className="list-decimal pl-5 flex flex-col gap-1">
        <li>In Google Workspace, make sure <strong>{box.address}</strong> receives mail (a user, group or alias).</li>
        <li>Admin console → Apps → Google Workspace → Gmail → Routing: add a rule for messages to {box.address} that also delivers to <strong className="break-all">{box.receiving_address}</strong> (keeps the copy in Gmail too). For a Google Group you can instead add {box.receiving_address} as a member.</li>
        <li>Click <strong>Verify Setup</strong>. A test email is sent from {box.address} to itself; the mailbox becomes Active only when it arrives here.</li>
      </ol>
      <p className="text-xs" style={{ color: T.muted }}>No DNS changes: airfairtravel.com mail stays with Google Workspace, sending uses the domain already verified in Resend.</p>
    </>}
  </div>;
}

function MailboxEditor({ box, staff, onSaved, onCancel }) {
  const [name, setName] = useState(box?.name || "");
  const [address, setAddress] = useState(box?.address || "");
  const [everyone, setEveryone] = useState(!!box?.all_inbox_users);
  const [sendOnly, setSendOnly] = useState(!!box?.send_only);
  const [members, setMembers] = useState(() => Object.fromEntries((box?.members || []).map(m => [m.user_id, m.can_send ? "send" : "read"])));
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true); setError("");
    try {
      const saved = check(await supabase.rpc("admin_save_mailbox", { p_id: box?.id || null, p_name: name, p_address: address, p_all_inbox_users: everyone, p_send_only: sendOnly }));
      const row = Array.isArray(saved) ? saved[0] : saved;
      check(await supabase.rpc("admin_set_mailbox_members", { p_id: row.id,
        p_members: Object.entries(members).filter(([, v]) => v !== "none").map(([user_id, v]) => ({ user_id, can_send: v === "send" })) }));
      onSaved(row.id);
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };
  return <div className="flex flex-col gap-4 p-4">
    <h3 className="font-semibold">{box ? `Edit ${box.name}` : "Add Shared Mailbox"}</h3>
    <LabeledInput label="Mailbox name" value={name} onChange={setName} placeholder="Visa Team" hint="Shown to clients as the sender name." />
    <LabeledInput label="Email address" value={address} onChange={setAddress} placeholder="visa@airfairtravel.com" hint="Must be an @airfairtravel.com address. Changing it requires verifying again." />
    <label className="flex items-start gap-2 text-sm">
      <input type="checkbox" className="mt-1" checked={sendOnly} onChange={e => setSendOnly(e.target.checked)} />
      <span>Send-only<span className="block text-xs" style={{ color: T.muted }}>For an address that already has its own Google Workspace inbox (like admin@): use it as From without forwarding its mail into the dashboard. Replies to dashboard emails still come back here.</span></span>
    </label>
    <div>
      <p className="text-sm font-medium mb-1">Authorized staff</p>
      <label className="flex items-center gap-2 text-sm mb-2"><input type="checkbox" checked={everyone} onChange={e => setEveryone(e.target.checked)} />Everyone with Email Inbox access (read and send)</label>
      {!everyone && <div className="flex flex-col divide-y rounded-lg" style={{ border: `1px solid ${T.border}` }}>
        {staff.map(p => <div key={p.id} className="flex items-center gap-3 px-3 py-2 text-sm min-w-0">
          <span className="flex-1 min-w-0 truncate">{p.full_name || p.email} <span style={{ color: T.muted }}>{p.email} · {p.role}</span>
            {p.role === "admin" && <span style={{ color: T.muted }}> · all mailboxes</span>}
            {!p.inbox_access && <span style={{ color: T.warn }}> · no Email Inbox access</span>}</span>
          {p.role !== "admin" && <select value={members[p.id] || "none"} onChange={e => setMembers(m => ({ ...m, [p.id]: e.target.value }))} className="text-sm rounded px-2 py-1" style={{ border: `1px solid ${T.border}` }} aria-label={`Access for ${p.full_name || p.email}`}>
            <option value="none">No access</option><option value="read">Read</option><option value="send">Read and send</option>
          </select>}
        </div>)}
      </div>}
      <p className="text-xs mt-1" style={{ color: T.muted }}>Administrators can use every mailbox. Staff also need Clients and Email Inbox access in Employees.</p>
    </div>
    {error && <Notice tone="danger">{error}</Notice>}
    <div className="flex gap-2"><Button busy={busy} disabled={!name.trim() || !address.trim()} onClick={save}>Save mailbox</Button><Button tone="outline" onClick={onCancel}>Cancel</Button></div>
  </div>;
}

export default function MailboxSettings({ onBack, onChanged }) {
  const [boxes, setBoxes] = useState(null);
  const [staff, setStaff] = useState([]);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [open, setOpen] = useState(null);
  const load = async () => {
    try {
      const [b, m, s] = await Promise.all([
        supabase.from("email_mailboxes").select("*").order("is_default", { ascending: false }).order("name"),
        supabase.from("email_mailbox_members").select("mailbox_id,user_id,can_send"),
        supabase.rpc("admin_mailbox_staff"),
      ]);
      const members = check(m);
      const list = check(b).map(x => ({ ...x, members: members.filter(r => r.mailbox_id === x.id) }));
      setBoxes(list); setStaff(check(s)); setError("");
      // A probe that never came back turns into Setup Failed (server decides the timing).
      for (const x of list.filter(x => x.status === "pending" && x.sending_verified_at))
        supabase.functions.invoke("mailbox-verify", { body: { action: "check", mailbox_id: x.id } }).then(r => { if (r.data?.status && r.data.status !== "pending") load(); });
    } catch (err) { setError(/email_mailboxes/.test(err.message || "") ? "Mailboxes need the latest database update (supabase db push)." : err.message); }
  };
  useEffect(() => { load(); }, []);
  const act = async (key, fn) => {
    setBusy(key); setError("");
    try { await fn(); await load(); onChanged?.(); } catch (err) { setError(err.message); } finally { setBusy(""); }
  };
  const verify = box => act(`verify-${box.id}`, async () => {
    const { data, error: err } = await supabase.functions.invoke("mailbox-verify", { body: { action: "verify", mailbox_id: box.id } });
    if (err) throw new Error(/Failed to send|not found|404/.test(err.message) ? "The mailbox-verify function isn't deployed yet." : await invokeError(err));
    if (data?.error) throw new Error(data.error);
  });

  if (editing) return <MailboxEditor box={editing === "new" ? null : editing} staff={staff} onCancel={() => setEditing(null)}
    onSaved={id => { setEditing(null); setOpen(id); load(); onChanged?.(); }} />;
  return <div className="flex flex-col min-w-0">
    <div className="flex items-center gap-2 px-2 py-1.5 border-b" style={{ borderColor: T.border }}>
      <button type="button" onClick={onBack} className="p-2 rounded-full hover:bg-black/5" aria-label="Back to mail"><ArrowLeft size={18} /></button>
      <h2 className="font-semibold flex-1">Settings · Mailboxes</h2>
      <button type="button" onClick={load} className="p-2 rounded-full hover:bg-black/5" aria-label="Refresh"><RefreshCw size={15} /></button>
      <Button small icon={Plus} onClick={() => setEditing("new")}>Add Shared Mailbox</Button>
    </div>
    {error && <div className="p-3"><Notice tone="danger">{error}</Notice></div>}
    {!boxes && !error && <div className="p-6"><Spinner /></div>}
    <ul>
      {boxes?.map(box => <li key={box.id} className="border-b" style={{ borderColor: T.border }}>
        <button type="button" onClick={() => setOpen(open === box.id ? null : box.id)} className="w-full text-left flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 hover:bg-black/5">
          <span className="font-medium truncate">{box.name}</span>
          <span className="text-sm truncate" style={{ color: T.muted }}>{box.address}</span>
          {box.is_default && <span className="text-xs inline-flex items-center gap-1" style={{ color: T.accent }}><Star size={12} />Default</span>}
          {box.send_only && <span className="text-xs rounded px-1.5" style={{ border: `1px solid ${T.border}`, color: T.muted }}>Send-only</span>}
          <span className="ml-auto"><StatusBadge status={box.status} /></span>
        </button>
        {open === box.id && <div className="px-4 pb-4 flex flex-col gap-3">
          {box.status_detail && <p className="text-sm" style={{ color: box.status === "setup_failed" ? T.danger : T.muted }}>{box.status_detail}</p>}
          <div className="text-xs flex flex-wrap gap-x-4 gap-y-1" style={{ color: T.muted }}>
            <span>Sending: {box.sending_verified_at ? <><CheckCircle2 size={11} className="inline" /> verified {formatDateTime(box.sending_verified_at)}</> : "not verified"}</span>
            <span>Receiving: {box.send_only ? "not used (send-only)" : box.receiving_verified_at ? <><CheckCircle2 size={11} className="inline" /> verified {formatDateTime(box.receiving_verified_at)}</> : "not verified"}</span>
            <span>Access: {box.all_inbox_users ? "everyone with Email Inbox access" : `${box.members.length} staff (administrators always)`}</span>
          </div>
          <SetupSteps box={box} />
          <div className="flex flex-wrap gap-2">
            {box.status !== "disabled" && <Button small busy={busy === `verify-${box.id}`} onClick={() => verify(box)}>Verify Setup</Button>}
            <Button small tone="outline" onClick={() => setEditing(box)}>Edit name, address, staff</Button>
            {!box.is_default && box.status === "active" && <Button small tone="outline" busy={busy === `default-${box.id}`}
              onClick={() => act(`default-${box.id}`, async () => check(await supabase.rpc("admin_set_default_mailbox", { p_id: box.id })))}>Make default</Button>}
            {!box.is_default && <Button small tone="outline" busy={busy === `toggle-${box.id}`}
              onClick={() => act(`toggle-${box.id}`, async () => check(await supabase.rpc("admin_set_mailbox_enabled", { p_id: box.id, p_enabled: box.status === "disabled" })))}>
              {box.status === "disabled" ? "Enable" : "Disable"}</Button>}
          </div>
          {box.is_default && <p className="text-xs" style={{ color: T.muted }}>The default mailbox receives mail that matches no other mailbox and is preselected for new emails.</p>}
        </div>}
      </li>)}
    </ul>
  </div>;
}
