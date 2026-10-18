// Email Inbox, Gmail-style: mail sidebar (Compose + folders with unread
// counts), search, compact rows, thread view, docked compose panel.
// Data: inbox_list / inbox_folder_counts RPCs (RLS + can_use_email_inbox).
import React, { useEffect, useState } from "react";
import { AtSign, ChevronLeft, ChevronRight, Inbox, Layers, Mail, MailOpen, Menu, Paperclip, Pencil, RefreshCw, Search, Send, Settings, UserX, X } from "lucide-react";
import { supabase } from "../lib/supabase.js";
import { Notice, Spinner, T } from "./ui.jsx";
import { rowTime } from "./inboxRecipients.js";
import ComposePanel from "./inbox/ComposePanel.jsx";
import ThreadView from "./inbox/ThreadView.jsx";
import MailboxSettings, { StatusBadge } from "./inbox/MailboxSettings.jsx";

const PAGE_SIZE = 50;
const check = ({ data, error }) => { if (error) throw error; return data; };
// Only folders the data supports.
const FOLDERS = [
  { id: "inbox", label: "Inbox", icon: Inbox, count: "inbox_unread" },
  { id: "sent", label: "Sent", icon: Send },
  { id: "unassigned", label: "Unassigned", icon: UserX, count: "unassigned_unread" },
  { id: "all", label: "All conversations", icon: Layers },
];

function MailSidebar({ folder, counts, leadName, onFolder, onClearLead, onCompose, mailboxes, mailbox, onMailbox, isAdmin, onSettings, settingsOpen }) {
  return <div className="flex flex-col gap-1 p-2 w-full">
    <button type="button" onClick={onCompose} className="flex items-center gap-3 rounded-2xl px-5 py-3.5 mb-2 text-sm font-medium shadow-sm hover:shadow self-start"
      style={{ backgroundColor: T.accentSoft, color: T.ink }}><Pencil size={17} />Compose</button>
    {FOLDERS.map(f => {
      const Icon = f.icon, active = folder === f.id && !leadName, n = f.count ? counts?.[f.count] || 0 : 0;
      return <button key={f.id} type="button" onClick={() => onFolder(f.id)} aria-current={active ? "page" : undefined}
        className="flex items-center gap-3 rounded-r-full pl-4 pr-3 py-1.5 text-sm text-left hover:bg-black/5"
        style={{ backgroundColor: active ? T.accentSoft : undefined, fontWeight: active || n ? 600 : 400, color: T.ink }}>
        <Icon size={16} /><span className="flex-1 truncate">{f.label}</span>{n > 0 && <span className="text-xs" aria-label={`${n} unread`}>{n}</span>}
      </button>;
    })}
    {leadName && <div className="flex items-center gap-2 rounded-r-full pl-4 pr-2 py-1.5 text-sm font-semibold" style={{ backgroundColor: T.accentSoft }}>
      <Mail size={16} /><span className="flex-1 truncate">Lead: {leadName}</span>
      <button type="button" onClick={onClearLead} aria-label="Show all conversations" className="p-0.5"><X size={14} /></button>
    </div>}
    {mailboxes?.length > 1 && <>
      <p className="px-4 pt-4 pb-1 text-xs uppercase tracking-wide" style={{ color: T.muted }}>Mailboxes</p>
      {[{ id: null, name: "All mailboxes" }, ...mailboxes].map(b => {
        const active = mailbox === b.id, n = b.id ? b.unread : 0;
        return <button key={b.id || "all"} type="button" onClick={() => onMailbox(b.id)} aria-current={active ? "true" : undefined} title={b.address}
          className="flex items-center gap-3 rounded-r-full pl-4 pr-3 py-1.5 text-sm text-left hover:bg-black/5"
          style={{ backgroundColor: active ? T.accentSoft : undefined, fontWeight: active || n ? 600 : 400, color: T.ink }}>
          <AtSign size={15} /><span className="flex-1 truncate">{b.name}</span>
          {b.id && b.status !== "active" && <StatusBadge status={b.status} />}
          {n > 0 && <span className="text-xs" aria-label={`${n} unread`}>{n}</span>}
        </button>;
      })}
    </>}
    {isAdmin && <button type="button" onClick={onSettings} className="mt-3 flex items-center gap-3 rounded-r-full pl-4 pr-3 py-1.5 text-sm text-left hover:bg-black/5"
      style={{ backgroundColor: settingsOpen ? T.accentSoft : undefined, color: T.ink }}><Settings size={16} /><span className="flex-1">Settings · Mailboxes</span></button>}
  </div>;
}

export default function EmailInbox({ contacts, initialContactId, initialCompose = false, userId, onOpenLead, onContextUsed, isAdmin = false }) {
  const [folder, setFolder] = useState(initialContactId ? "all" : "inbox");
  const [leadFilter, setLeadFilter] = useState(initialContactId || null);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [items, setItems] = useState(null);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState(null);
  const [error, setError] = useState("");
  const [picked, setPicked] = useState(() => new Set());
  const [openId, setOpenId] = useState(null);
  const [drawer, setDrawer] = useState(false);
  const [compose, setCompose] = useState(initialCompose ? { mode: "new", contactId: initialContactId || "", key: 1 } : null);
  const [copyDefaults, setCopyDefaults] = useState(null);
  const [revision, setRevision] = useState(0);
  const [notice, setNotice] = useState("");
  const [mailboxes, setMailboxes] = useState(null);
  const [mailbox, setMailbox] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const refresh = () => setRevision(v => v + 1);

  // Lead context from "Send Email"/"Email history" applies to this visit only.
  useEffect(() => { onContextUsed?.(); }, []);
  const loadCopyDefaults = async () => {
    const { data, error: err } = await supabase.rpc("inbox_compose_defaults");
    setCopyDefaults(err ? false : data);
  };
  useEffect(() => { loadCopyDefaults(); }, []);
  // Mailboxes the user can read (server-filtered), with send permission and unread counts.
  useEffect(() => {
    let active = true;
    supabase.rpc("inbox_my_mailboxes").then(({ data, error: err }) => { if (active) setMailboxes(err ? [] : data); });
    return () => { active = false; };
  }, [revision]);
  useEffect(() => { const t = setTimeout(() => { setQuery(search.trim()); setPage(0); }, 300); return () => clearTimeout(t); }, [search]);

  useEffect(() => {
    let active = true, running = false;
    const load = async () => {
      if (running) return; running = true;
      try {
        const [rows, c] = await Promise.all([
          supabase.rpc("inbox_list", { p_folder: folder, p_query: query || null, p_contact: leadFilter, p_offset: page * PAGE_SIZE, p_limit: PAGE_SIZE, p_mailbox: mailbox }),
          supabase.rpc("inbox_folder_counts", { p_mailbox: mailbox }),
        ]);
        const data = check(rows);
        if (!active) return;
        setItems(data); setTotal(Number(data[0]?.total_count || 0)); setCounts(c.data || null); setError("");
      } catch (err) {
        if (active) setError(/inbox_list|function/.test(err.message || "") ? "The mailbox needs the latest database update (supabase db push)." : err.message || "Could not load the inbox");
      } finally { running = false; }
    };
    load();
    const timer = setInterval(() => { if (!document.hidden) load(); }, 15000);
    return () => { active = false; clearInterval(timer); };
  }, [folder, query, page, leadFilter, mailbox, revision]);
  useEffect(() => { setPicked(new Set()); }, [folder, query, page, leadFilter, mailbox]);

  const leadName = leadFilter ? contacts.find(c => c.id === leadFilter)?.name || "Selected lead" : null;
  const chooseFolder = id => { setFolder(id); setLeadFilter(null); setPage(0); setOpenId(null); setDrawer(false); setSettingsOpen(false); };
  const chooseMailbox = id => { setMailbox(id); setPage(0); setOpenId(null); setDrawer(false); setSettingsOpen(false); };
  const startCompose = (config = { mode: "new" }) => {
    if (compose && !window.confirm("Replace the email you are writing?")) return;
    setCompose({ ...config, key: Date.now() }); setDrawer(false);
  };
  const setRead = async (ids, read) => {
    setError("");
    try {
      check(await supabase.from("email_read_state").upsert([...ids].map(id => ({ conversation_id: id, user_id: userId, read_at: read ? new Date().toISOString() : "1970-01-01T00:00:00Z" }))));
      setPicked(new Set()); refresh();
    } catch (err) { setError(err.message); }
  };
  const allPicked = !!items?.length && items.every(i => picked.has(i.id));
  const togglePick = id => setPicked(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  const rowName = item => {
    const who = item.contact_name || item.participant_email;
    return folder === "sent" ? `To: ${who}` : who;
  };
  const sidebar = <MailSidebar folder={folder} counts={counts} leadName={leadName} onFolder={chooseFolder}
    onClearLead={() => chooseFolder("inbox")} onCompose={() => startCompose()}
    mailboxes={mailboxes} mailbox={mailbox} onMailbox={chooseMailbox}
    isAdmin={isAdmin} settingsOpen={settingsOpen} onSettings={() => { setSettingsOpen(true); setOpenId(null); setDrawer(false); }} />;

  return <div className="flex min-w-0 rounded-xl overflow-hidden" style={{ backgroundColor: T.surface, border: `1px solid ${T.border}`, minHeight: "min(75vh, 48rem)" }}>
    {/* Desktop: inline mail sidebar. Tablet/mobile: drawer via the menu button. */}
    <aside className="hidden lg:flex w-56 shrink-0 border-r" style={{ borderColor: T.border, backgroundColor: T.bg }}>{sidebar}</aside>
    {drawer && <div className="lg:hidden fixed inset-0 z-40 flex" role="dialog" aria-label="Mail folders">
      <div className="w-64 max-w-[80vw] h-full overflow-y-auto shadow-xl" style={{ backgroundColor: T.surface }}>{sidebar}</div>
      <button type="button" className="flex-1 bg-black/30" aria-label="Close folders" onClick={() => setDrawer(false)} />
    </div>}

    <main className="flex-1 min-w-0 flex flex-col">
      {settingsOpen ? <MailboxSettings onBack={() => setSettingsOpen(false)} onChanged={refresh} />
      : openId ? <ThreadView conversationId={openId} contacts={contacts} userId={userId} selfEmail={copyDefaults?.sender_email} revision={revision} mailboxes={mailboxes}
        onBack={() => { setOpenId(null); refresh(); }} onOpenLead={onOpenLead} onChanged={refresh}
        onReply={(mode, conversation, lead, replyCc) => startCompose({ mode, conversation, lead, replyCc })} />
      : <>
        <div className="flex items-center gap-2 px-2 sm:px-3 py-2 border-b" style={{ borderColor: T.border }}>
          <button type="button" className="lg:hidden p-2 rounded-full hover:bg-black/5" aria-label="Folders" onClick={() => setDrawer(true)}><Menu size={18} /></button>
          <label className="flex-1 min-w-0 flex items-center gap-2 rounded-full px-4 py-2" style={{ backgroundColor: T.bg }}>
            <Search size={16} style={{ color: T.muted }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search mail" aria-label="Search mail"
              className="flex-1 min-w-0 bg-transparent outline-none text-sm" />
            {search && <button type="button" aria-label="Clear search" onClick={() => setSearch("")}><X size={15} /></button>}
          </label>
          <button type="button" onClick={() => startCompose()} className="lg:hidden p-2 rounded-full" aria-label="Compose" style={{ backgroundColor: T.accentSoft }}><Pencil size={17} /></button>
        </div>
        <div className="flex items-center gap-1 px-2 sm:px-3 py-1 border-b text-sm" style={{ borderColor: T.border, color: T.muted }}>
          <input type="checkbox" className="m-2" aria-label="Select all on this page" checked={allPicked} disabled={!items?.length}
            onChange={() => setPicked(allPicked ? new Set() : new Set(items.map(i => i.id)))} />
          <button type="button" onClick={refresh} className="p-2 rounded-full hover:bg-black/5" aria-label="Refresh" title="Refresh"><RefreshCw size={15} /></button>
          {picked.size > 0 && <>
            <button type="button" onClick={() => setRead(picked, true)} className="p-2 rounded-full hover:bg-black/5" aria-label="Mark as read" title="Mark as read"><MailOpen size={15} /></button>
            <button type="button" onClick={() => setRead(picked, false)} className="p-2 rounded-full hover:bg-black/5" aria-label="Mark as unread" title="Mark as unread"><Mail size={15} /></button>
            <span className="text-xs">{picked.size} selected</span>
          </>}
          <span className="ml-auto text-xs whitespace-nowrap">{total ? `${page * PAGE_SIZE + 1}–${Math.min(total, (page + 1) * PAGE_SIZE)} of ${total}` : ""}</span>
          <button type="button" disabled={page === 0} onClick={() => setPage(p => p - 1)} className="p-1.5 rounded-full hover:bg-black/5 disabled:opacity-30" aria-label="Newer"><ChevronLeft size={16} /></button>
          <button type="button" disabled={(page + 1) * PAGE_SIZE >= total} onClick={() => setPage(p => p + 1)} className="p-1.5 rounded-full hover:bg-black/5 disabled:opacity-30" aria-label="Older"><ChevronRight size={16} /></button>
        </div>
        {error && <div className="p-3"><Notice tone="danger">{error}</Notice></div>}
        {notice && <div className="p-3"><Notice tone="success">{notice}</Notice></div>}
        {items === null && !error && <div className="p-6"><Spinner /></div>}
        {items?.length === 0 && <p className="p-8 text-sm text-center" style={{ color: T.muted }}>{query ? "No conversations match your search." : "No conversations here."}</p>}
        <ul className="flex-1 overflow-y-auto">
          {items?.map(item => <li key={item.id} className="border-b" style={{ borderColor: T.border }}>
            <div role="button" tabIndex={0} onClick={() => setOpenId(item.id)} onKeyDown={e => { if (e.key === "Enter") setOpenId(item.id); }}
              className="flex items-start sm:items-center gap-2 sm:gap-3 px-2 sm:px-3 py-2 cursor-pointer transition-shadow hover:shadow-[inset_1px_0_0_#dadce0,inset_-1px_0_0_#dadce0,0_1px_2px_rgba(60,64,67,.2)] hover:z-10 relative"
              style={{ backgroundColor: picked.has(item.id) ? T.accentSoft : item.unread ? T.surface : T.bg }}>
              <input type="checkbox" className="m-1.5 mt-2 sm:mt-1.5 shrink-0" aria-label={`Select ${item.subject}`} checked={picked.has(item.id)}
                onClick={e => e.stopPropagation()} onChange={() => togglePick(item.id)} />
              <div className="flex-1 min-w-0 sm:flex sm:items-center sm:gap-3">
                <div className="flex items-center gap-2 sm:w-48 sm:shrink-0 min-w-0">
                  <span className={`truncate text-sm ${item.unread ? "font-bold" : ""}`} style={{ color: T.ink }}>{rowName(item)}</span>
                  {item.message_count > 1 && <span className="text-xs shrink-0" style={{ color: T.muted }}>{item.message_count}</span>}
                  <span className={`sm:hidden ml-auto text-xs shrink-0 ${item.unread ? "font-bold" : ""}`} style={{ color: item.unread ? T.ink : T.muted }}>{rowTime(item.updated_at)}</span>
                </div>
                <div className="flex-1 min-w-0 truncate text-sm">
                  {!mailbox && mailboxes?.length > 1 && item.mailbox_name && <span className="text-xs rounded px-1.5 py-0.5 mr-1.5 align-middle" style={{ backgroundColor: T.bg, border: `1px solid ${T.border}`, color: T.muted }}>{item.mailbox_name}</span>}
                  <span className={item.unread ? "font-bold" : ""} style={{ color: T.ink }}>{item.subject}</span>
                  {item.last_preview && <span className="hidden sm:inline" style={{ color: T.muted }}> — {item.last_direction === "outgoing" ? `${item.last_sender}: ` : ""}{item.last_preview}</span>}
                </div>
              </div>
              {item.has_attachments && <Paperclip size={14} className="hidden sm:block shrink-0" style={{ color: T.muted }} aria-label="Has attachments" />}
              <span className={`hidden sm:block text-xs w-16 text-right shrink-0 ${item.unread ? "font-bold" : ""}`} style={{ color: item.unread ? T.ink : T.muted }}>{rowTime(item.updated_at)}</span>
            </div>
          </li>)}
        </ul>
      </>}
    </main>

    {compose && <ComposePanel key={compose.key} mode={compose.mode} contacts={contacts} userId={userId} copyDefaults={copyDefaults} reloadDefaults={loadCopyDefaults}
      mailboxes={mailboxes || []} preferredMailbox={compose.conversation?.mailbox_id || mailbox}
      initialContactId={compose.contactId} conversation={compose.conversation} lead={compose.lead} replyCc={compose.replyCc}
      onClose={() => setCompose(null)}
      onSent={data => {
        setCompose(null); setOpenId(data.conversation_id); refresh();
        setNotice(data.status === "sent" ? "Email accepted by Resend." : "Email saved. Check its status in the conversation.");
        setTimeout(() => setNotice(""), 6000);
      }} />}
  </div>;
}
