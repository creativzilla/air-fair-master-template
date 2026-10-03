import React, { useState, useEffect, useCallback, useMemo } from "react";
import { LayoutDashboard, File as FileEdit, Inbox, CalendarDays, Image as ImageIcon, Settings as SettingsIcon, ChevronRight, ChevronLeft, Bell, Plus, X, Clock, Search, Check, Trash2, GripVertical, Mail, CalendarPlus, Wallet, Users, Globe, UserPlus, FileText, Contact as Contact2, UserCog, ListChecks, Lock, LogOut, Eye, EyeOff, Loader as Loader2, Menu as MenuIcon, Stamp, Newspaper, MessageSquareQuote, ShieldCheck, KeyRound, FolderOpen } from "lucide-react";
import { supabase } from "../lib/supabase.js";
import { fetchSiteSettings, saveSiteSettings } from "../lib/content.js";
import { T, fontDisplay, fontBody, fontMono, Badge, StageBadge, CategoryTag, LabeledInput, LabeledSelect, Modal, Button, Notice, ImagePickerButton } from "../dashboard/ui.jsx";
import { fetchMyProfile } from "../dashboard/api.js";
import PagesEditor from "../dashboard/PagesEditor.jsx";
import CollectionManager from "../dashboard/CollectionManager.jsx";
import { CLIENT_CATEGORIES, clientCategory } from "../dashboard/clientCategories.js";
import PipelineStagesEditor from "../dashboard/PipelineStagesEditor.jsx";
import FormsModule from "../dashboard/FormsModule.jsx";
import MediaLibrary from "../dashboard/MediaLibrary.jsx";
import UsersAdmin from "../dashboard/UsersAdmin.jsx";
import ClientDocuments from "../dashboard/ClientDocuments.jsx";
import LeadDrawer, { mapContactRow } from "../dashboard/LeadEditor.jsx";
import { applySeo } from "../lib/seo.js";
import EmailInbox from "../dashboard/EmailInbox.jsx";
import FormEmails from "../dashboard/FormEmails.jsx";

// Sidebar. `roles` = who may open it; `moduleKey` = can be switched off in
// Settings → Modules; `staffKey` = staff access follows the employee's
// "Dashboard Access" checkboxes.
const ALL_ROLES = ["admin", "editor", "staff"];
const CONTENT_ROLES = ["admin", "editor"];
const NAV = [
  { id: "overview", label: "Dashboard", icon: LayoutDashboard, roles: ALL_ROLES },
  { group: "Clients" },
  { id: "clients", label: "Clients", icon: Contact2, roles: ALL_ROLES, staffKey: "clients" },
  { id: "email-inbox", label: "Email Inbox", icon: Mail, roles: ALL_ROLES, staffKey: "email-inbox" },
  { id: "pipeline", label: "Pipeline", icon: Users, moduleKey: "pipeline", roles: ALL_ROLES, staffKey: "pipeline" },
  { id: "forms", label: "Forms", icon: Inbox, roles: ALL_ROLES, staffKey: "forms" },
  { id: "documents", label: "Documents", icon: FolderOpen, roles: ALL_ROLES, staffKey: "documents" },
  { id: "bookings", label: "Calendar", icon: CalendarDays, moduleKey: "bookings", roles: ALL_ROLES, staffKey: "bookings" },
  { group: "Website" },
  { id: "edit-website", label: "Pages", icon: FileEdit, roles: CONTENT_ROLES, staffKey: "edit-website" },
  { id: "cms-services", label: "Services", icon: Stamp, roles: CONTENT_ROLES },
  { id: "news", label: "News", icon: Newspaper, roles: CONTENT_ROLES },
  { id: "testimonials", label: "Testimonials", icon: MessageSquareQuote, roles: CONTENT_ROLES },
  { group: "Business" },
  { id: "form-emails", label: "Form Emails", icon: Mail, roles: ["admin"] },
  { id: "users", label: "Users", icon: ShieldCheck, roles: ["admin"] },
  { id: "employees", label: "Employees", icon: UserCog, moduleKey: "employees", roles: ["admin"] },
  { id: "media", label: "Media", icon: ImageIcon, roles: CONTENT_ROLES, staffKey: "media" },
  { id: "settings", label: "Settings", icon: SettingsIcon, roles: ["admin"] },
];

const ALL_MODULES = [
  { key: "pipeline", label: "Pipeline" }, { key: "bookings", label: "Calendar" },
  { key: "clients", label: "Clients" }, { key: "documents", label: "Documents" }, { key: "forms", label: "Forms" },
  { key: "email-inbox", label: "Email Inbox" },
  { key: "media", label: "Media" },
  { key: "edit-website", label: "Edit Website" }, { key: "employees", label: "Employees" },
  { key: "settings", label: "Settings" },
];

const DEFAULT_EMPLOYEE_ACCESS = { "email-inbox": false, pipeline: true, bookings: true, clients: true, documents: true, forms: true, media: false, "edit-website": false, employees: false, settings: false };

const BOOKING_STATUSES = ["Pending", "Confirmed", "Completed", "Cancelled"];

function MiniCalendar({ bookings }) {
  const days = ["SUN","MON","TUE","WED","THU","FRI","SAT"];
  const now = new Date();
  const year = now.getFullYear(), month = now.getMonth(), today = now.getDate();
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [...Array(firstWeekday).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  const markers = new Set(bookings.filter(b => b.dateISO && b.dateISO.startsWith(`${year}-${String(month + 1).padStart(2, "0")}`)).map(b => Number(b.dateISO.slice(8, 10))));
  return (
    <div>
      <div className="grid grid-cols-7 mb-2">
        {days.map(d => <div key={d} className="text-center text-[10px]" style={{ color: T.muted, ...fontBody, letterSpacing: "0.03em" }}>{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-y-1.5">
        {cells.map((d, i) => (
          <div key={i} className="flex flex-col items-center justify-center h-7">
            {d && (<>
              <span className="w-6 h-6 flex items-center justify-center rounded-full text-xs" style={{ ...fontBody, backgroundColor: d === today ? T.accent : "transparent", color: d === today ? "#fff" : T.ink }}>{d}</span>
              {markers.has(d) && d !== today && <span className="w-1 h-1 rounded-full mt-0.5" style={{ backgroundColor: T.accent }} />}
            </>)}
          </div>
        ))}
      </div>
    </div>
  );
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function Overview({ goTo, submissions, bookings, contacts, stages, currency, role, calendar = false }) {
  const [livePages, setLivePages] = useState(null);
  useEffect(() => {
    supabase.from("cms_published").select("document_id", { count: "exact", head: true }).in("kind", ["page", "immigration_service", "visa_destination", "travel_package", "news_article"])
      .then(({ count }) => setLivePages(count ?? 0));
  }, []);
  const newInquiries = submissions.filter(s => s.status === "New").length;
  const thisWeek = submissions.filter(s => s.createdAt && Date.now() - new Date(s.createdAt).getTime() < WEEK_MS).length;
  const todayISO = new Date().toISOString().slice(0, 10);
  const upcomingList = bookings.filter(b => b.dateISO && b.dateISO >= todayISO && b.status !== "Cancelled").sort((a, b) => (a.dateISO + a.time).localeCompare(b.dateISO + b.time));
  const finalStage = stages[stages.length - 1];
  const active = contacts.filter(c => c.status !== finalStage);
  const activeTotal = active.reduce((sum, c) => sum + (c.amount || 0), 0);
  const canEditSite = role === "admin" || role === "editor";
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning!" : hour < 18 ? "Good afternoon!" : "Good evening!";
  const stats = [
    { label: "New Inquiries", value: String(newInquiries).padStart(2, "0"), sub: `${thisWeek} received this week`, icon: Mail, link: true, target: "forms" },
    calendar && { label: "Upcoming Bookings", value: String(upcomingList.length).padStart(2, "0"), sub: upcomingList[0] ? `Next: ${upcomingList[0].date} · ${upcomingList[0].time || "time TBD"}` : "Nothing scheduled", icon: CalendarDays, link: true, target: "bookings" },
    { label: "Active Deals", value: String(active.length).padStart(2, "0"), sub: `${currency}${activeTotal.toLocaleString()} in pipeline`, icon: Wallet, link: true, target: "pipeline" },
    { label: "Pages Live", value: livePages === null ? "—" : String(livePages).padStart(2, "0"), sub: canEditSite ? "Edit website" : "Pages & services published", icon: Globe, link: canEditSite, target: "edit-website" },
  ].filter(Boolean);
  const quickActions = [
    ...(calendar ? [{ label: "Add Booking", target: "bookings", icon: CalendarPlus }] : []),
    { label: "View Inquiries", target: "forms", icon: Mail },
    { label: "Open Pipeline", target: "pipeline", icon: UserPlus },
    ...(canEditSite ? [{ label: "Upload Image", target: "media", icon: FileText }] : []),
  ];
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl mb-1 flex items-center gap-2" style={{ ...fontDisplay, color: T.ink }}>{greeting} <span>👋</span></h1>
        <p className="text-sm" style={{ color: T.muted, ...fontBody }}>Here's what's happening today.</p>
      </div>
      <div className="dash-overview-stats" style={stats.length === 3 ? { gridTemplateColumns: "repeat(3, minmax(0, 1fr))" } : undefined}>
        {stats.map((s, i) => {
          const Icon = s.icon;
          const tints = [{ bg: T.accentSoft, fg: T.accent }, { bg: T.infoSoft, fg: T.info }, { bg: T.tealSoft, fg: T.teal }, { bg: T.warnSoft, fg: T.warn }];
          const tint = tints[i % tints.length];
          return (
            <div key={s.label} className="rounded-2xl p-4" style={{ backgroundColor: tint.bg, border: `1px solid ${T.border}` }}>
              <div className="w-10 h-10 rounded-full flex items-center justify-center mb-3" style={{ backgroundColor: "rgba(255,255,255,0.6)" }}><Icon size={18} style={{ color: tint.fg }} /></div>
              <div className="text-[10px] uppercase mb-1" style={{ color: T.muted, ...fontBody, letterSpacing: "0.06em" }}>{s.label}</div>
              <div className="text-3xl mb-2" style={{ ...fontDisplay, color: T.ink }}>{s.value}</div>
              {s.link ? <button onClick={() => goTo(s.target)} className="text-xs font-medium text-left" style={{ color: tint.fg, ...fontBody }}>{s.sub}</button> : <div className="text-xs" style={{ color: tint.fg, ...fontBody }}>{s.sub}</div>}
            </div>
          );
        })}
      </div>
      <div className="rounded-2xl p-5" style={{ backgroundColor: T.accentSoft, border: `1px solid ${T.border}` }}>
        <h2 className="text-sm font-semibold mb-1" style={{ color: T.ink, ...fontBody }}>Quick Actions</h2>
        <p className="text-xs mb-4" style={{ color: T.muted, ...fontBody }}>Access the tools you need most.</p>
        <div className="dash-quick-actions">
          {quickActions.map(a => (
            <button key={a.label} onClick={() => goTo(a.target)} className="px-4 py-2 rounded-lg text-sm flex items-center gap-2 hover:opacity-80 transition-opacity" style={{ backgroundColor: T.surface, color: T.ink, border: `1px solid ${T.border}`, ...fontBody }}>
              <a.icon size={15} style={{ color: T.accent }} /> {a.label}
            </button>
          ))}
        </div>
      </div>
      <div className={`grid grid-cols-1 ${calendar ? "lg:grid-cols-3 dash-grid-3" : ""} gap-5`}>
        <div className="rounded-2xl" style={{ backgroundColor: T.surface, border: `1px solid ${T.border}` }}>
          <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: `1px solid ${T.border}` }}>
            <h2 className="text-sm font-semibold" style={{ color: T.ink, ...fontBody }}>Recent Submissions</h2>
            <button onClick={() => goTo("forms")} className="text-xs flex items-center gap-1 hover:opacity-70" style={{ color: T.accent, ...fontBody }}>View all <ChevronRight size={14} /></button>
          </div>
          <div>
            {submissions.slice(0, 4).map((s, i) => (
              <div key={s.id} className="flex items-center gap-3 px-5 py-3" style={{ borderBottom: i < 3 ? `1px solid ${T.border}` : "none" }}>
                <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: T.accentSoft }}><Mail size={14} style={{ color: T.accent }} /></div>
                <div className="flex-1 min-w-0"><div className="text-sm truncate" style={{ color: T.ink, ...fontBody }}>{s.name}</div><div className="text-xs truncate" style={{ color: T.muted, ...fontBody }}>{s.type} · {s.date}</div></div>
                <Badge status={s.status} />
              </div>
            ))}
            {submissions.length === 0 && <div className="px-5 py-8 text-center text-sm" style={{ color: T.muted, ...fontBody }}>No submissions yet.</div>}
          </div>
        </div>
        {calendar && (<>
        <div className="rounded-2xl" style={{ backgroundColor: T.surface, border: `1px solid ${T.border}` }}>
          <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: `1px solid ${T.border}` }}>
            <h2 className="text-sm font-semibold" style={{ color: T.ink, ...fontBody }}>Upcoming Bookings</h2>
            <button onClick={() => goTo("bookings")} className="text-xs flex items-center gap-1 hover:opacity-70" style={{ color: T.accent, ...fontBody }}>View all <ChevronRight size={14} /></button>
          </div>
          <div>
            {upcomingList.slice(0, 5).map((b, i, list) => {
              const [mon, day] = b.date.split(" ");
              return (
                <div key={b.id} className="flex items-center gap-3 px-5 py-3" style={{ borderBottom: i < list.length - 1 ? `1px solid ${T.border}` : "none" }}>
                  <div className="w-11 h-11 rounded-lg flex flex-col items-center justify-center shrink-0" style={{ backgroundColor: T.accentSoft }}>
                    <span className="text-[9px] uppercase" style={{ color: T.accent, ...fontBody }}>{mon}</span>
                    <span className="text-sm leading-none" style={{ ...fontDisplay, color: T.accent }}>{day || "—"}</span>
                  </div>
                  <div className="flex-1 min-w-0"><div className="text-sm truncate" style={{ color: T.ink, ...fontBody }}>{b.purpose || "Meeting"}</div><div className="text-xs truncate" style={{ color: T.muted, ...fontBody }}>{b.name} · {b.time || "time TBD"}</div></div>
                  <Badge status={b.status} />
                </div>
              );
            })}
            {upcomingList.length === 0 && <div className="px-5 py-8 text-center text-sm" style={{ color: T.muted, ...fontBody }}>No upcoming bookings.</div>}
          </div>
        </div>
        <div className="flex flex-col gap-5">
          <div className="rounded-2xl" style={{ backgroundColor: T.surface, border: `1px solid ${T.border}` }}>
            <div className="px-5 py-4" style={{ borderBottom: `1px solid ${T.border}` }}><h2 className="text-sm font-semibold" style={{ color: T.ink, ...fontBody }}>Next Up</h2></div>
            <div>
              {upcomingList.slice(0, 3).map((b, i, list) => (
                <div key={b.id} className="flex items-start gap-3 px-5 py-3" style={{ borderBottom: i < list.length - 1 ? `1px solid ${T.border}` : "none" }}>
                  <Clock size={14} style={{ color: T.muted }} className="mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0"><div className="text-xs" style={{ color: T.ink, ...fontBody }}>{b.purpose || "Meeting"} — {b.name}</div><div className="text-[11px]" style={{ color: T.muted, ...fontBody }}>{b.date} · {b.time || "time TBD"}</div></div>
                </div>
              ))}
              {upcomingList.length === 0 && <div className="px-5 py-6 text-center text-xs" style={{ color: T.muted, ...fontBody }}>Nothing scheduled.</div>}
            </div>
          </div>
          <div className="rounded-2xl p-5" style={{ backgroundColor: T.surface, border: `1px solid ${T.border}` }}>
            <div className="flex items-center justify-between mb-3"><h2 className="text-sm font-semibold" style={{ color: T.ink, ...fontBody }}>Calendar Overview</h2></div>
            <div className="text-xs mb-3" style={{ color: T.muted, ...fontBody }}>{new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}</div>
            <MiniCalendar bookings={bookings} />
          </div>
        </div>
        </>)}
      </div>
    </div>
  );
}

// "Edit Website" now edits the CMS pages (dashboard/PagesEditor.jsx).
function EditWebsite({ role }) {
  return <PagesEditor role={role} />;
}

// Forms: submissions inbox + form builder (dashboard/FormsModule.jsx).
function Forms(props) {
  return <FormsModule {...props} />;
}

function Contacts({ contacts, setContacts, bookings, employees, onStageChange, onUpdateContact, onOpenLead, onNewLead, stages, categories, currency, stageRows, onStagesSaved, role }) {
  const [editingStages, setEditingStages] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [editingAmountId, setEditingAmountId] = useState(null);
  const [draftAmount, setDraftAmount] = useState("");
  const [draggingId, setDraggingId] = useState(null);
  const [dragOverStatus, setDragOverStatus] = useState(null);
  const rows = categoryFilter === "All" ? contacts : contacts.filter(c => c.category === categoryFilter);
  const linkedBooking = (contactId) => bookings.find(b => b.contactId === contactId);
  const employeeById = (id) => employees.find(e => e.id === id);
  const setStatus = (contactId, status) => { const contact = contacts.find(c => c.id === contactId); if (!contact || contact.status === status) return; setContacts(prev => prev.map(c => c.id === contactId ? { ...c, status } : c)); onStageChange(contact, status); };
  const setAssignee = (contactId, employeeId) => { setContacts(prev => prev.map(c => c.id === contactId ? { ...c, assignedEmployeeId: employeeId } : c)); onUpdateContact(contactId, { assigned_employee_id: employeeId }); };
  const nudgeStatus = (contact, dir) => { const idx = stages.indexOf(contact.status); const next = stages[Math.min(Math.max(idx + dir, 0), stages.length - 1)]; setStatus(contact.id, next); };
  const startAmount = (c) => { setEditingAmountId(c.id); setDraftAmount(c.amount ? String(c.amount) : ""); };
  const confirmAmount = (id) => { const amt = Number(draftAmount) || 0; setContacts(prev => prev.map(c => c.id === id ? { ...c, amount: amt } : c)); setEditingAmountId(null); onUpdateContact(id, { amount: amt || null }); };
  const handleDragStart = (e, contactId) => { setDraggingId(contactId); e.dataTransfer.setData("text/plain", String(contactId)); e.dataTransfer.effectAllowed = "move"; };
  const handleDragEnd = () => { setDraggingId(null); setDragOverStatus(null); };
  const handleColumnDragOver = (e, status) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; if (dragOverStatus !== status) setDragOverStatus(status); };
  const handleColumnDrop = (e, status) => { e.preventDefault(); const id = e.dataTransfer.getData("text/plain"); if (id) setStatus(id, status); setDraggingId(null); setDragOverStatus(null); };
  const columnTotals = stages.map(status => { const items = rows.filter(c => c.status === status); return { status, count: items.length, amount: items.reduce((sum, c) => sum + (c.amount || 0), 0) }; });
  return (
    <div className="flex flex-col gap-6 h-full min-h-0">
      <div className="flex items-start justify-between flex-wrap gap-3"><div><h1 className="text-2xl mb-1" style={{ ...fontDisplay, color: T.ink }}>Pipeline</h1><p className="text-sm" style={{ color: T.muted, ...fontBody }}>Drag a card to move a client through the pipeline. Moving stages auto-assigns tasks to whoever's handling the case. Click a name to edit.</p></div><button onClick={onNewLead} className="px-4 py-2 rounded-lg text-sm flex items-center gap-1.5" style={{ backgroundColor: T.accent, color: "#fff", ...fontBody }}><Plus size={14} /> New lead</button></div>
      {role === "admin" && <div><Button tone="outline" icon={SettingsIcon} onClick={() => setEditingStages(true)}>Customize stages</Button></div>}
      {editingStages && <Modal wide title="Customize pipeline stages" onClose={() => setEditingStages(false)}><PipelineStagesEditor stageNames={stages} rows={stageRows} onSaved={onStagesSaved} /></Modal>}
      <div className="flex gap-2 flex-wrap">{["All", ...categories].map(c => <button key={c} onClick={() => setCategoryFilter(c)} className="px-3 py-1.5 rounded-full text-xs" style={{ ...fontBody, backgroundColor: categoryFilter === c ? T.ink : T.surface, color: categoryFilter === c ? "#fff" : T.muted, border: `1px solid ${categoryFilter === c ? T.ink : T.border}` }}>{c}</button>)}</div>
      <div className="flex flex-1 min-h-0 gap-4 overflow-x-scroll overflow-y-hidden pb-2" role="region" aria-label="Pipeline stages" tabIndex={0}>
        {stages.map(status => { const items = rows.filter(c => c.status === status); const totals = columnTotals.find(t => t.status === status); const isOver = dragOverStatus === status; return (
          <div key={status} onDragOver={(e) => handleColumnDragOver(e, status)} onDragLeave={() => setDragOverStatus(prev => (prev === status ? null : prev))} onDrop={(e) => handleColumnDrop(e, status)} className="flex flex-col min-h-0 rounded-2xl shrink-0" style={{ width: 270, backgroundColor: isOver ? T.accentSoft : T.bg, border: `1.5px dashed ${isOver ? T.accent : T.border}`, transition: "background-color 120ms, border-color 120ms" }}>
            <div className="px-4 pt-4 pb-3 flex shrink-0 items-center justify-between"><div className="flex items-center gap-2"><StageBadge stage={status} stages={stages} /><span className="text-xs" style={{ color: T.muted, ...fontBody }}>{totals.count}</span></div>{totals.amount > 0 && <span className="text-xs" style={{ ...fontMono, color: T.muted }}>{currency}{totals.amount.toLocaleString()}</span>}</div>
            <div className="flex flex-col gap-2 px-3 pb-3 min-h-0 overflow-y-auto">
              {items.map(c => { const booking = linkedBooking(c.id); const idx = stages.indexOf(c.status); const assignee = employeeById(c.assignedEmployeeId); return (
                <div key={c.id} draggable onDragStart={(e) => handleDragStart(e, c.id)} onDragEnd={handleDragEnd} className="rounded-xl p-3 shrink-0 cursor-grab active:cursor-grabbing" style={{ backgroundColor: T.surface, border: `1px solid ${T.border}`, opacity: draggingId === c.id ? 0.4 : 1 }}>
                  <div className="flex items-start justify-between gap-2 mb-1.5"><button type="button" onClick={() => onOpenLead(c.id)} className="text-sm text-left hover:underline" style={{ color: T.ink, ...fontBody }}>{c.name}</button><GripVertical size={13} style={{ color: T.border }} className="shrink-0 mt-0.5" /></div>
                  <div className="text-xs mb-2" style={{ color: T.muted, ...fontBody }}>{c.email}</div>
                  <div className="mb-2"><CategoryTag category={c.category} categories={categories} /></div>
                  <div className="text-xs mb-2" style={{ color: T.muted, ...fontBody }}>{booking ? <>{booking.date} · {booking.time}</> : "No meeting scheduled"}</div>
                  {editingAmountId === c.id ? (<div className="flex items-center gap-1.5 mb-2"><span className="text-xs" style={{ color: T.muted, ...fontBody }}>{currency}</span><input autoFocus value={draftAmount} onChange={e => setDraftAmount(e.target.value)} className="w-16 rounded-md px-1.5 py-1 text-xs outline-none" style={{ border: `1px solid ${T.border}`, ...fontMono, color: T.ink }} /><button onClick={() => confirmAmount(c.id)} className="px-2 py-1 rounded-md text-xs" style={{ backgroundColor: T.accent, color: "#fff", ...fontBody }}><Check size={11} /></button></div>) : (<button onClick={() => startAmount(c)} className="text-xs block mb-2" style={{ ...fontMono, color: c.amount ? T.ink : T.muted }}>{c.amount ? `${currency}${c.amount.toLocaleString()}` : "Set amount"}</button>)}
                  <div className="flex items-center gap-1.5 mb-2">{assignee ? <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] shrink-0" style={{ backgroundColor: T.accent, color: "#fff", ...fontBody }}>{assignee.name.split(" ").map(p => p[0]).join("").slice(0, 2).toUpperCase()}</div> : <UserCog size={14} style={{ color: T.border }} className="shrink-0" />}<select value={c.assignedEmployeeId ?? ""} onChange={e => setAssignee(c.id, e.target.value || null)} className="text-xs flex-1 min-w-0 rounded-md px-1.5 py-1 outline-none" style={{ border: `1px solid ${T.border}`, color: assignee ? T.ink : T.muted, ...fontBody, backgroundColor: T.bg }}><option value="">Unassigned</option>{employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}</select></div>
                  <div className="flex items-center justify-between pt-1.5" style={{ borderTop: `1px solid ${T.border}` }}><button onClick={() => nudgeStatus(c, -1)} disabled={idx === 0} className="p-1 rounded" style={{ color: idx === 0 ? T.border : T.muted }}><ChevronLeft size={14} /></button><span className="text-[10px]" style={{ color: T.muted, ...fontBody }}>Move stage</span><button onClick={() => nudgeStatus(c, 1)} disabled={idx === stages.length - 1} className="p-1 rounded" style={{ color: idx === stages.length - 1 ? T.border : T.muted }}><ChevronRight size={14} /></button></div>
                </div>
              ); })}
              {items.length === 0 && <div className="text-xs text-center py-6" style={{ color: T.muted, ...fontBody }}>Drop a card here</div>}
            </div>
          </div>
        ); })}
      </div>
    </div>
  );
}

function ClientsDirectory({ contacts, bookings, goTo, categories, stages, currency, onOpenDocuments, onOpenLead, onNewLead }) {
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [stageFilter, setStageFilter] = useState("");
  const categoryOptions = CLIENT_CATEGORIES;
  const stageOptions = [...new Set([...stages, ...contacts.map(c => c.status)].filter(Boolean))];
  const hasFilters = query !== "" || categoryFilter !== "" || stageFilter !== "";
  const clearFilters = () => { setQuery(""); setCategoryFilter(""); setStageFilter(""); };
  const linkedBooking = (contactId) => bookings.find(b => b.contactId === contactId);
  const search = query.trim().toLowerCase();
  const rows = contacts.filter(c =>
    (!categoryFilter || clientCategory(c.category) === categoryFilter) &&
    (!stageFilter || c.status === stageFilter) &&
    (!search || (c.name || "").toLowerCase().includes(search) || (c.email || "").toLowerCase().includes(search))
  );
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between flex-wrap gap-3"><div><h1 className="text-2xl mb-1" style={{ ...fontDisplay, color: T.ink }}>Clients</h1><p className="text-sm" style={{ color: T.muted, ...fontBody }}>Every client on file. Click a name to edit, or open Pipeline to move their case forward.</p></div><div className="flex gap-2 flex-wrap"><button onClick={() => goTo("pipeline")} className="text-sm px-4 py-2 rounded-lg flex items-center gap-1.5" style={{ backgroundColor: T.accentSoft, color: T.accent, ...fontBody }}><Users size={15} /> Open Pipeline</button><button onClick={onNewLead} className="px-4 py-2 rounded-lg text-sm flex items-center gap-1.5" style={{ backgroundColor: T.accent, color: "#fff", ...fontBody }}><Plus size={14} /> New lead</button></div></div>
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[220px]"><label className="block text-xs mb-1.5" style={{ color: T.muted }} htmlFor="client-search">Search clients</label>
          <div className="relative"><Search size={15} style={{ color: T.muted, position: "absolute", left: 12, top: 11 }} /><input id="client-search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search by name or email" className="w-full rounded-lg pl-9 pr-3 py-2 text-sm outline-none" style={{ border: `1px solid ${T.border}`, backgroundColor: T.surface, color: T.ink, ...fontBody }} /></div>
        </div>
        <div className="w-full sm:w-48"><LabeledSelect label="Category" value={categoryFilter} onChange={setCategoryFilter} options={[{ value: "", label: "All categories" }, ...categoryOptions.map(value => ({ value, label: value }))]} /></div>
        <div className="w-full sm:w-48"><LabeledSelect label="Stage" value={stageFilter} onChange={setStageFilter} options={[{ value: "", label: "All stages" }, ...stageOptions.map(value => ({ value, label: value }))]} /></div>
        {hasFilters && <Button tone="outline" onClick={clearFilters}>Clear filters</Button>}
      </div>
      <p className="text-xs" role="status" style={{ color: T.muted }}>Showing {rows.length} of {contacts.length} clients</p>
      <div className="rounded-xl overflow-x-auto" style={{ backgroundColor: T.surface, border: `1px solid ${T.border}` }}><table className="w-full text-sm"><thead><tr style={{ borderBottom: `1px solid ${T.border}` }}>{["Name", "Email", "Category", "Stage", "Amount", "Next Meeting", ""].map(h => <th key={h} className="text-left px-5 py-3 text-xs uppercase tracking-wide" style={{ color: T.muted, ...fontBody, letterSpacing: "0.05em" }}>{h}</th>)}</tr></thead><tbody>{rows.map((c, i) => { const booking = linkedBooking(c.id); return (<tr key={c.id} style={{ borderBottom: i < rows.length - 1 ? `1px solid ${T.border}` : "none" }}><td className="px-5 py-3" style={{ color: T.ink, ...fontBody }}><button type="button" onClick={() => onOpenLead(c.id)} className="text-left hover:underline" style={{ color: T.ink, ...fontBody }}>{c.name}</button></td><td className="px-5 py-3" style={{ color: T.muted, ...fontBody }}>{c.email}</td><td className="px-5 py-3"><CategoryTag category={clientCategory(c.category)} categories={CLIENT_CATEGORIES} /></td><td className="px-5 py-3"><StageBadge stage={c.status} stages={stages} /></td><td className="px-5 py-3" style={{ ...fontMono, color: c.amount ? T.ink : T.muted }}>{c.amount ? `${currency}${c.amount.toLocaleString()}` : "—"}</td><td className="px-5 py-3" style={{ color: T.muted, ...fontBody }}>{booking ? `${booking.date} · ${booking.time}` : "—"}</td><td className="px-5 py-3 text-right"><button type="button" onClick={() => onOpenDocuments(c.id)} className="text-xs px-2.5 py-1 rounded-md inline-flex items-center gap-1" style={{ backgroundColor: T.accentSoft, color: T.accent, ...fontBody }}><FolderOpen size={12} /> Documents</button></td></tr>); })}{rows.length === 0 && <tr><td colSpan={7} className="px-5 py-8 text-center text-sm" style={{ color: T.muted, ...fontBody }}>{hasFilters ? "No clients match these filters. Try another selection or clear filters." : "No clients yet."}</td></tr>}</tbody></table></div>
    </div>
  );
}

function Employees({ employees, setEmployees, tasks, setTasks, stageTasks, setStageTasks, stages, profiles = [], role, onDeleteEmployee }) {
  const [activeId, setActiveId] = useState(employees[0]?.id ?? null);
  const [addingEmployee, setAddingEmployee] = useState(false);
  const [draft, setDraft] = useState({ name: "", email: "", role: "" });
  const [addError, setAddError] = useState("");
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDue, setNewTaskDue] = useState("");
  const [pickerStage, setPickerStage] = useState(stages[0]);
  const [checkedTemplateIds, setCheckedTemplateIds] = useState([]);
  const [newTemplateTitle, setNewTemplateTitle] = useState("");
  const active = employees.find(e => e.id === activeId);
  const activeTasks = tasks.filter(t => t.employeeId === activeId);
  const stageTemplates = stageTasks.filter(t => t.stage === pickerStage);
  const openAdd = () => { setAddingEmployee(true); setActiveId(null); setAddError(""); setDraft({ name: "", email: "", role: "" }); };
  const selectEmployee = (id) => { setActiveId(id); setAddingEmployee(false); setCheckedTemplateIds([]); };
  const saveEmployee = async () => {
    if (!draft.name.trim() || !draft.email.trim()) { setAddError("Name and email are required."); return; }
    setAddError("");
    const allowedModules = { ...DEFAULT_EMPLOYEE_ACCESS };
    const { data, error } = await supabase.from("employees").insert({ name: draft.name.trim(), email: draft.email.trim(), role: draft.role.trim(), allowed_modules: allowedModules }).select().single();
    if (error) { setAddError("Could not save employee: " + error.message); return; }
    setEmployees(prev => [...prev, { id: data.id, name: data.name, email: data.email, role: data.role, allowedModules: data.allowed_modules || allowedModules }]);
    setAddingEmployee(false);
    setActiveId(data.id);
  };
  const linkLogin = (employeeId, userId) => {
    setEmployees(prev => prev.map(e => e.id === employeeId ? { ...e, userId } : e));
    supabase.from("employees").update({ user_id: userId }).eq("id", employeeId).then(({ error }) => { if (error) console.error("Failed to link sign-in account:", error); });
  };
  const toggleAccess = (employeeId, moduleKey) => {
    const target = employees.find(e => e.id === employeeId);
    if (!target) return;
    const current = target.allowedModules || DEFAULT_EMPLOYEE_ACCESS;
    const updatedModules = { ...current, [moduleKey]: !current[moduleKey] };
    setEmployees(prev => prev.map(e => e.id === employeeId ? { ...e, allowedModules: updatedModules } : e));
    supabase.from("employees").update({ allowed_modules: updatedModules }).eq("id", employeeId).then(({ error }) => { if (error) console.error("Failed to update employee access:", error); });
  };
  const addTask = async () => {
    if (!newTaskTitle.trim() || !activeId) return;
    const title = newTaskTitle.trim();
    const due = newTaskDue || null;
    setNewTaskTitle(""); setNewTaskDue("");
    const { data, error } = await supabase.from("employee_tasks").insert({ employee_id: activeId, title, due_date: due, is_done: false }).select().single();
    if (error) { console.error("Failed to add task:", error); return; }
    setTasks(prev => [...prev, { id: data.id, employeeId: data.employee_id, contactId: data.contact_id, title: data.title, due: data.due_date || "No due date", done: data.is_done }]);
  };
  const toggleTask = (taskId) => {
    const target = tasks.find(t => t.id === taskId);
    if (!target) return;
    const nextDone = !target.done;
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, done: nextDone } : t));
    supabase.from("employee_tasks").update({ is_done: nextDone }).eq("id", taskId).then(({ error }) => { if (error) console.error("Failed to update task:", error); });
  };
  const toggleTemplateChecked = (id) => { setCheckedTemplateIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]); };
  const addNewTemplate = async () => {
    if (!newTemplateTitle.trim()) return;
    const title = newTemplateTitle.trim();
    setNewTemplateTitle("");
    const { data, error } = await supabase.from("stage_task_templates").insert({ stage: pickerStage, title }).select().single();
    if (error) { console.error("Failed to add task template:", error); return; }
    setStageTasks(prev => [...prev, { id: data.id, stage: data.stage, title: data.title }]);
  };
  const addSelectedTemplateTasks = async () => {
    if (!activeId || checkedTemplateIds.length === 0) return;
    const toAdd = stageTasks.filter(t => checkedTemplateIds.includes(t.id));
    const rows = toAdd.map(t => ({ employee_id: activeId, title: t.title, is_done: false }));
    setCheckedTemplateIds([]);
    const { data, error } = await supabase.from("employee_tasks").insert(rows).select();
    if (error) { console.error("Failed to add template tasks:", error); return; }
    const newTasks = data.map(r => ({ id: r.id, employeeId: r.employee_id, contactId: r.contact_id, title: r.title, due: r.due_date || "TBD", done: r.is_done }));
    setTasks(prev => [...prev, ...newTasks]);
  };
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between flex-wrap gap-3"><div><h1 className="text-2xl mb-1" style={{ ...fontDisplay, color: T.ink }}>Employees</h1><p className="text-sm" style={{ color: T.muted, ...fontBody }}>Your internal team and the tasks assigned to each of them.</p></div><button onClick={openAdd} className="px-4 py-2 rounded-lg text-sm flex items-center gap-1.5" style={{ backgroundColor: T.accent, color: "#fff", ...fontBody }}><Plus size={14} /> Add Employee</button></div>
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 dash-grid-5">
        <div className="lg:col-span-2 rounded-xl overflow-hidden" style={{ backgroundColor: T.surface, border: `1px solid ${T.border}` }}>
          {employees.map((e, i) => { const count = tasks.filter(t => t.employeeId === e.id && !t.done).length; return (<button key={e.id} onClick={() => selectEmployee(e.id)} className="w-full flex items-center gap-3 px-5 py-4 text-left" style={{ borderBottom: i < employees.length - 1 ? `1px solid ${T.border}` : "none", backgroundColor: activeId === e.id ? T.accentSoft : "transparent" }}><div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-xs" style={{ backgroundColor: T.accent, color: "#fff", ...fontBody }}>{e.name.split(" ").map(p => p[0]).join("").slice(0, 2).toUpperCase()}</div><div className="flex-1 min-w-0"><div className="text-sm truncate" style={{ color: T.ink, ...fontBody }}>{e.name}</div><div className="text-xs truncate" style={{ color: T.muted, ...fontBody }}>{e.role}</div></div>{count > 0 && <span className="text-xs px-2 py-0.5 rounded-full shrink-0" style={{ backgroundColor: T.warnSoft, color: T.warn, ...fontBody }}>{count}</span>}</button>); })}
          {employees.length === 0 && <div className="px-5 py-10 text-center text-sm" style={{ color: T.muted, ...fontBody }}>No employees yet.</div>}
        </div>
        <div className="lg:col-span-3 rounded-xl" style={{ backgroundColor: T.surface, border: `1px solid ${T.border}` }}>
          {addingEmployee ? (
            <div className="p-5 flex flex-col gap-4"><div className="flex items-center justify-between"><span className="text-sm font-medium" style={{ color: T.ink, ...fontBody }}>New Employee</span><button onClick={() => setAddingEmployee(false)} style={{ color: T.muted }}><X size={16} /></button></div>{[{ key: "name", label: "Full Name" }, { key: "email", label: "Email" }, { key: "role", label: "Role (e.g. Visa Officer)" }].map(f => (<div key={f.key}><label className="text-xs block mb-1.5" style={{ color: T.muted, ...fontBody }}>{f.label}</label><input value={draft[f.key]} onChange={e => setDraft(prev => ({ ...prev, [f.key]: e.target.value }))} className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={{ border: `1px solid ${T.border}`, color: T.ink, ...fontBody, backgroundColor: T.bg }} /></div>))}<p className="text-xs" style={{ color: T.muted, ...fontBody }}>This adds an internal team record for task assignment — it doesn't create a dashboard login for them yet.</p>{addError && <div className="text-xs" style={{ color: T.danger, ...fontBody }}>{addError}</div>}<button onClick={saveEmployee} className="mt-2 px-4 py-2 rounded-lg text-sm" style={{ backgroundColor: T.accent, color: "#fff", ...fontBody }}>Save Employee</button></div>
          ) : !active ? (
            <div className="h-full flex items-center justify-center text-center px-8 py-16"><p className="text-sm" style={{ color: T.muted, ...fontBody }}>Select an employee to view their tasks.</p></div>
          ) : (
            <div className="p-5 flex flex-col gap-5">
              <div className="flex items-start justify-between gap-3"><div><span className="text-sm font-medium" style={{ color: T.ink, ...fontBody }}>{active.name}'s Tasks</span><div className="text-xs mt-0.5" style={{ color: T.muted, ...fontBody }}>{active.email} · {active.role}</div></div>{role === "admin" && <button type="button" onClick={async () => { if (await onDeleteEmployee(active)) setActiveId(null); }} className="text-xs px-2.5 py-1.5 rounded-md flex items-center gap-1 shrink-0" style={{ backgroundColor: T.dangerSoft, color: T.danger, ...fontBody }}><Trash2 size={12} /> Delete employee</button>}</div>
              <div className="rounded-lg p-3" style={{ border: `1px solid ${T.border}`, backgroundColor: T.bg }}><div className="flex items-center gap-1.5 mb-0.5"><UserCog size={13} style={{ color: T.muted }} /><span className="text-xs font-medium" style={{ color: T.ink, ...fontBody }}>Dashboard Access</span></div><p className="text-[11px] mb-2.5" style={{ color: T.muted, ...fontBody }}>What {active.name.split(" ")[0]} can see once they log in (applies to the staff role). Only you can change this.</p><div className="flex items-center gap-2 mb-3"><span className="text-xs shrink-0" style={{ color: T.muted, ...fontBody }}>Sign-in account</span><select value={active.userId || ""} onChange={e => linkLogin(active.id, e.target.value || null)} className="text-xs flex-1 min-w-0 rounded-md px-1.5 py-1 outline-none" style={{ border: `1px solid ${T.border}`, color: T.ink, ...fontBody, backgroundColor: "#fff" }}><option value="">Not linked</option>{profiles.map(p => <option key={p.id} value={p.id}>{p.email}{p.role ? ` (${p.role})` : ""}</option>)}</select></div><div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">{ALL_MODULES.map(m => { const checked = !!(active.allowedModules || DEFAULT_EMPLOYEE_ACCESS)[m.key]; return (<label key={m.key} className="flex items-center gap-1.5 text-xs cursor-pointer" style={{ color: T.ink, ...fontBody }}><input type="checkbox" checked={checked} onChange={() => toggleAccess(active.id, m.key)} style={{ accentColor: T.accent }} />{m.label}</label>); })}</div></div>
              <div className="flex flex-col gap-2">{activeTasks.map(t => (<div key={t.id} className="flex items-start gap-3 px-3 py-2.5 rounded-lg" style={{ border: `1px solid ${T.border}` }}><button onClick={() => toggleTask(t.id)} className="mt-0.5 shrink-0"><div className="w-4 h-4 rounded flex items-center justify-center" style={{ border: `1.5px solid ${t.done ? T.accent : T.border}`, backgroundColor: t.done ? T.accent : "transparent" }}>{t.done && <Check size={11} color="#fff" />}</div></button><div className="flex-1 min-w-0"><div className="text-sm" style={{ color: t.done ? T.muted : T.ink, textDecoration: t.done ? "line-through" : "none", ...fontBody }}>{t.title}</div><div className="text-xs mt-0.5" style={{ color: T.muted, ...fontBody }}>Due {t.due}</div></div></div>))}{activeTasks.length === 0 && <div className="text-xs text-center py-6" style={{ color: T.muted, ...fontBody }}>No tasks assigned yet.</div>}</div>
              <div className="pt-4 flex flex-col gap-3" style={{ borderTop: `1px solid ${T.border}` }}><label className="text-xs font-medium" style={{ color: T.ink, ...fontBody }}>Add Pipeline Task</label><div className="flex gap-1.5 flex-wrap">{stages.map(stage => <button key={stage} onClick={() => { setPickerStage(stage); setCheckedTemplateIds([]); }} className="px-2.5 py-1 rounded-full text-xs" style={{ ...fontBody, backgroundColor: pickerStage === stage ? T.ink : T.bg, color: pickerStage === stage ? "#fff" : T.muted, border: `1px solid ${pickerStage === stage ? T.ink : T.border}` }}>{stage}</button>)}</div><div className="flex flex-col gap-1.5">{stageTemplates.map(t => <label key={t.id} className="flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer" style={{ border: `1px solid ${T.border}`, backgroundColor: T.bg }}><input type="checkbox" checked={checkedTemplateIds.includes(t.id)} onChange={() => toggleTemplateChecked(t.id)} className="w-4 h-4 shrink-0" style={{ accentColor: T.accent }} /><span className="text-sm flex-1" style={{ color: T.ink, ...fontBody }}>{t.title}</span></label>)}{stageTemplates.length === 0 && <div className="text-xs px-3 py-2" style={{ color: T.muted, ...fontBody }}>No tasks defined for this stage yet — add one below.</div>}</div><div className="flex gap-2"><input value={newTemplateTitle} onChange={e => setNewTemplateTitle(e.target.value)} placeholder={`New task for "${pickerStage}"`} className="flex-1 rounded-lg px-3 py-2 text-sm outline-none" style={{ border: `1px solid ${T.border}`, color: T.ink, ...fontBody, backgroundColor: T.bg }} /><button onClick={addNewTemplate} className="px-3 py-2 rounded-lg text-sm" style={{ backgroundColor: T.surface, color: T.ink, border: `1px solid ${T.border}`, ...fontBody }}><Plus size={14} /></button></div><button onClick={addSelectedTemplateTasks} disabled={checkedTemplateIds.length === 0} className="px-4 py-2 rounded-lg text-sm flex items-center justify-center gap-1.5" style={{ backgroundColor: checkedTemplateIds.length === 0 ? T.border : T.accent, color: checkedTemplateIds.length === 0 ? T.muted : "#fff", ...fontBody }}><ListChecks size={14} /> Add {checkedTemplateIds.length > 0 ? `${checkedTemplateIds.length} Task${checkedTemplateIds.length > 1 ? "s" : ""}` : "Selected Tasks"}</button></div>
              <div className="pt-4 flex flex-col gap-2" style={{ borderTop: `1px solid ${T.border}` }}><label className="text-xs" style={{ color: T.muted, ...fontBody }}>Or assign a one-off task</label><div className="flex gap-2 flex-wrap"><input value={newTaskTitle} onChange={e => setNewTaskTitle(e.target.value)} placeholder="Task description" className="flex-1 min-w-[160px] rounded-lg px-3 py-2 text-sm outline-none" style={{ border: `1px solid ${T.border}`, color: T.ink, ...fontBody, backgroundColor: T.bg }} /><input type="date" value={newTaskDue} onChange={e => setNewTaskDue(e.target.value)} aria-label="Due date" className="w-40 rounded-lg px-3 py-2 text-sm outline-none" style={{ border: `1px solid ${T.border}`, color: T.ink, ...fontBody, backgroundColor: T.bg }} /><button onClick={addTask} className="px-4 py-2 rounded-lg text-sm" style={{ backgroundColor: T.surface, color: T.ink, border: `1px solid ${T.border}`, ...fontBody }}>Assign</button></div></div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function BookingModal({ booking, contacts, canDelete, onClose, onSave, onDelete }) {
  const [form, setForm] = useState({
    contactId: booking?.contactId || "",
    name: booking?.name || "",
    purpose: booking?.purpose || "",
    date: booking?.dateISO || "",
    time: booking?.timeISO ? booking.timeISO.slice(0, 5) : "",
    status: booking?.status || "Pending",
  });
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const set = patch => setForm(prev => ({ ...prev, ...patch }));
  const save = async () => {
    if (!form.name.trim()) { setError("Enter the client's name."); return; }
    setBusy("save"); setError("");
    try { await onSave(form, booking?.id); onClose(); } catch (err) { setError(err.message || "Could not save the booking."); setBusy(""); }
  };
  const remove = async () => {
    if (!window.confirm("Delete this booking?")) return;
    setBusy("delete"); setError("");
    try { await onDelete(booking.id); onClose(); } catch (err) { setError(err.message || "Could not delete the booking."); setBusy(""); }
  };
  return (
    <Modal title={booking ? "Edit booking" : "Add booking"} onClose={onClose} footer={<>
      {booking && canDelete && <Button tone="danger" icon={Trash2} busy={busy === "delete"} onClick={remove}>Delete</Button>}
      <Button tone="outline" onClick={onClose}>Cancel</Button>
      <Button busy={busy === "save"} onClick={save}>{booking ? "Save changes" : "Add booking"}</Button>
    </>}>
      <div className="flex flex-col gap-4">
        <LabeledSelect label="Client (from Pipeline)" value={form.contactId} onChange={contactId => { const c = contacts.find(x => String(x.id) === contactId); set({ contactId, name: c ? c.name : form.name }); }}
          options={[{ value: "", label: "Not linked to a client" }, ...contacts.map(c => ({ value: String(c.id), label: `${c.name}${c.email ? ` (${c.email})` : ""}` }))]} />
        <LabeledInput label="Name" value={form.name} onChange={name => set({ name })} />
        <LabeledInput label="Purpose" placeholder="e.g. SRRV document review" value={form.purpose} onChange={purpose => set({ purpose })} />
        <div className="grid grid-cols-2 gap-3">
          <LabeledInput label="Date" type="date" value={form.date} onChange={date => set({ date })} />
          <LabeledInput label="Time" type="time" value={form.time} onChange={time => set({ time })} />
        </div>
        <LabeledSelect label="Status" value={form.status} onChange={status => set({ status })} options={BOOKING_STATUSES.map(s => ({ value: s, label: s }))} />
        {error && <Notice tone="danger">{error}</Notice>}
      </div>
    </Modal>
  );
}

function Bookings({ bookings, contacts, role, onSaveBooking, onDeleteBooking }) {
  const [editing, setEditing] = useState(null); // null | "new" | booking
  const sorted = [...bookings].sort((a, b) => ((a.dateISO || "9999") + (a.timeISO || "")).localeCompare((b.dateISO || "9999") + (b.timeISO || "")));
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between"><div><h1 className="text-2xl mb-1" style={{ ...fontDisplay, color: T.ink }}>Calendar</h1><p className="text-sm" style={{ color: T.muted, ...fontBody }}>Scheduled meetings with clients.</p></div><button onClick={() => setEditing("new")} className="px-4 py-2 rounded-lg text-sm flex items-center gap-1.5" style={{ backgroundColor: T.accent, color: "#fff", ...fontBody }}><Plus size={14} /> Add Booking</button></div>
      <div className="rounded-xl overflow-hidden" style={{ backgroundColor: T.surface, border: `1px solid ${T.border}` }}>{sorted.map((b, i) => (<button type="button" key={b.id} onClick={() => setEditing(b)} className="w-full text-left flex items-center justify-between gap-3 flex-wrap px-5 py-4 hover:opacity-80" style={{ borderBottom: i < sorted.length - 1 ? `1px solid ${T.border}` : "none" }}><div className="flex items-center gap-4 min-w-0"><div className="w-11 h-11 rounded-lg flex flex-col items-center justify-center shrink-0" style={{ backgroundColor: T.accentSoft }}><Clock size={16} style={{ color: T.accent }} /></div><div className="min-w-0"><div className="text-sm truncate" style={{ color: T.ink, ...fontBody }}>{b.name}</div><div className="text-xs truncate" style={{ color: T.muted, ...fontBody }}>{b.purpose}</div></div></div><div className="flex items-center gap-6"><span className="text-sm" style={{ ...fontMono, color: T.ink }}>{b.date}{b.time ? ` · ${b.time}` : ""}</span><Badge status={b.status} /></div></button>))}{bookings.length === 0 && <div className="px-5 py-10 text-center text-sm" style={{ color: T.muted, ...fontBody }}>No bookings yet.</div>}</div>
      <div className="rounded-xl p-5 text-sm" style={{ backgroundColor: T.infoSoft, color: T.info, ...fontBody, border: `1px solid ${T.border}` }}>No calendar connected yet. Meetings are scheduled here manually until you connect Google Calendar or Cal.com in Settings → Integrations.</div>
      {editing && <BookingModal booking={editing === "new" ? null : editing} contacts={contacts} canDelete={role === "admin"} onClose={() => setEditing(null)} onSave={onSaveBooking} onDelete={onDeleteBooking} />}
    </div>
  );
}

// Media library (see dashboard/MediaLibrary.jsx).
function Media({ role }) {
  return <MediaLibrary role={role} />;
}

function Settings({ pipelineStages, pipelineStageRows, onStagesSaved, currency, setCurrency, modules, setModules, chatWidgetCode, setChatWidgetCode, settings, onSaveSettings, goTo }) {
  const [tab, setTab] = useState("Business");
  const tabs = ["Business", "Branding", "Social", "SEO", "Pipeline", "Modules", "Integrations"];
  const [form, setForm] = useState(null);
  const [savedFlash, setSavedFlash] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    setLoading(true); setLoadError("");
    const load = async () => {
      try {
        const { data, error } = await supabase.from("site_settings").select("*").order("updated_at", { ascending: false }).limit(1).maybeSingle().abortSignal(controller.signal);
        if (error) throw error;
        if (!active) return;
        const settings = data || {};
        setForm({
        business_name: settings.business_name || "",
        logo_url: settings.logo_url || "",
        contact_email: settings.contact_email || "",
        contact_phone: settings.contact_phone || "",
        address: settings.address || "",
        facebook_url: settings.facebook_url || "",
        instagram_url: settings.instagram_url || "",
        linkedin_url: settings.linkedin_url || "",
        seo_title: settings.seo_title || "",
        seo_description: settings.seo_description || "",
        currency_symbol: settings.currency_symbol || "\u20B1",
        chat_widget_code: settings.chat_widget_code || "",
        enabled_modules: { ...modules, ...(settings.enabled_modules || {}) },
      });
      } catch (err) {
        if (active) setLoadError(controller.signal.aborted ? "Loading settings timed out. Please retry." : err.message || "Could not load settings.");
      } finally { clearTimeout(timeout); if (active) setLoading(false); }
    };
    load();
    return () => { active = false; clearTimeout(timeout); controller.abort(); };
  }, [retry]);

  const update = (key, val) => setForm(prev => ({ ...prev, [key]: val }));

  const handleSave = async () => {
    if (!form) return;
    setSaving(true); setSavedFlash(false); setSaveError("");
    try {
      await onSaveSettings(form);
      setSavedFlash(true); setTimeout(() => setSavedFlash(false), 1800);
    } catch (err) {
      setSaveError(err.message || "Could not save settings. Please try again.");
    } finally { setSaving(false); }
  };

  const renderField = ({ label, fieldKey, placeholder }) => form ? (
    <div>
      <label className="text-xs block mb-1.5" style={{ color: T.muted, ...fontBody }}>{label}</label>
      <input value={form[fieldKey] || ""} onChange={e => update(fieldKey, e.target.value)} placeholder={placeholder} className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={{ border: `1px solid ${T.border}`, color: T.ink, ...fontBody, backgroundColor: T.bg }} />
    </div>
  ) : null;

  const MODULE_INFO = [{ key: "pipeline", label: "Pipeline", desc: "Kanban board for tracking leads through your sales stages." }, { key: "bookings", label: "Calendar", desc: "Scheduled meetings/appointments with clients." }, { key: "employees", label: "Employees", desc: "Internal staff, task assignment, and pipeline automation." }];
  return (
    <div className="flex flex-col gap-6">
      <div><h1 className="text-2xl mb-1" style={{ ...fontDisplay, color: T.ink }}>Settings</h1><p className="text-sm" style={{ color: T.muted, ...fontBody }}>Business info, branding, and site-wide details.</p></div>
      <div className="flex gap-1 border-b flex-wrap" style={{ borderColor: T.border }}>{tabs.map(t => <button key={t} onClick={() => setTab(t)} className="px-4 py-2 text-sm -mb-px" style={{ ...fontBody, color: tab === t ? T.ink : T.muted, borderBottom: tab === t ? `2px solid ${T.accent}` : "2px solid transparent", fontWeight: tab === t ? 500 : 400 }}>{t}</button>)}</div>
      <div className="rounded-xl p-6 max-w-xl" style={{ backgroundColor: T.surface, border: `1px solid ${T.border}` }}>
        {tab === "Pipeline" && <PipelineStagesEditor stageNames={pipelineStages} rows={pipelineStageRows} onSaved={onStagesSaved} />}
        {tab !== "Pipeline" && loading && <p role="status" className="text-sm" style={{ color: T.muted }}>Loading settings...</p>}
        {tab !== "Pipeline" && loadError && <Notice tone="danger">{loadError}<div className="mt-3"><Button tone="outline" onClick={() => setRetry(value => value + 1)}>Retry loading</Button></div></Notice>}
        {form && (<>
        {tab === "Business" && (<div className="flex flex-col gap-4">{renderField({"label":"Business Name","fieldKey":"business_name"})}{renderField({"label":"Email","fieldKey":"contact_email"})}{renderField({"label":"Phone","fieldKey":"contact_phone"})}{renderField({"label":"Address","fieldKey":"address"})}<div><label className="text-xs block mb-1.5" style={{ color: T.muted, ...fontBody }}>Currency Symbol</label><input value={form.currency_symbol || ""} onChange={e => update("currency_symbol", e.target.value)} className="w-20 rounded-lg px-3 py-2 text-sm outline-none text-center" style={{ border: `1px solid ${T.border}`, color: T.ink, ...fontBody, backgroundColor: T.bg }} /><p className="text-xs mt-1.5" style={{ color: T.muted, ...fontBody }}>Used across Pipeline, Clients, and form Monetary fields.</p></div></div>)}
        {tab === "Branding" && <div className="flex flex-col gap-4">
          <div className="flex gap-4"><div className="flex-1"><p className="text-xs mb-1.5" style={{ color: T.muted }}>Primary Color</p><div className="flex items-center gap-2"><div className="w-9 h-9 rounded-lg" style={{ backgroundColor: T.accent }} /><span className="text-sm">#6EBE3D</span></div></div><div className="flex-1"><p className="text-xs mb-1.5" style={{ color: T.muted }}>Accent Color</p><div className="flex items-center gap-2"><div className="w-9 h-9 rounded-lg" style={{ backgroundColor: T.warn }} /><span className="text-sm">#E08A2C</span></div></div></div>
          <div><h3 className="text-sm font-medium mb-2" style={{ color: T.ink }}>Dashboard logo</h3>
            <p className="text-xs mb-3" style={{ color: T.muted }}>Upload or choose a logo for the dashboard sidebar, then click Save Changes.</p>
            <div className="rounded-lg p-4 mb-3 flex items-center justify-center" style={{ backgroundColor: T.sidebarBg, minHeight: 88 }}>
              {form.logo_url ? <img src={form.logo_url} alt="Dashboard logo preview" className="max-w-full h-14 object-contain" /> : <span className="text-sm text-white">Air Fair</span>}
            </div>
            <fieldset disabled={saving} className="flex gap-2 flex-wrap"><ImagePickerButton label={form.logo_url ? "Change logo" : "Upload logo"} onPicked={url => update("logo_url", url)} />{form.logo_url && <Button small tone="outline" onClick={() => update("logo_url", "")}>Reset to default</Button>}</fieldset>
          </div>
        </div>}
        {tab === "Social" && (<div className="flex flex-col gap-4">{renderField({"label":"Facebook","fieldKey":"facebook_url","placeholder":"facebook.com/yourpage"})}{renderField({"label":"Instagram","fieldKey":"instagram_url","placeholder":"instagram.com/yourpage"})}{renderField({"label":"LinkedIn","fieldKey":"linkedin_url","placeholder":"linkedin.com/company/yourpage"})}</div>)}
        {tab === "SEO" && (<div className="flex flex-col gap-4">{renderField({"label":"Site Title","fieldKey":"seo_title"})}{renderField({"label":"Meta Description","fieldKey":"seo_description"})}</div>)}

        {tab === "Modules" && (<div className="flex flex-col gap-4"><p className="text-xs" style={{ color: T.muted, ...fontBody }}>Turn off anything this business doesn't need — hidden modules disappear from the sidebar entirely. Click Save Changes to apply.</p>{MODULE_INFO.map(m => (<label key={m.key} className="flex items-start gap-3 px-3 py-3 rounded-lg cursor-pointer" style={{ border: `1px solid ${T.border}`, backgroundColor: T.bg }}><input type="checkbox" checked={!!form.enabled_modules[m.key]} onChange={e => { const next = { ...form.enabled_modules, [m.key]: e.target.checked }; update("enabled_modules", next); }} className="mt-0.5" style={{ accentColor: T.accent }} /><div><div className="text-sm" style={{ color: T.ink, ...fontBody, fontWeight: 500 }}>{m.label}</div><div className="text-xs mt-0.5" style={{ color: T.muted, ...fontBody }}>{m.desc}</div></div></label>))}</div>)}
        {tab === "Integrations" && (<div className="flex flex-col gap-4"><div><h3 className="text-sm font-medium mb-1" style={{ color: T.ink, ...fontBody }}>Chat Widget</h3><p className="text-xs" style={{ color: T.muted, ...fontBody }}>Paste the embed code from any chat provider — Facebook Messenger Chat Plugin, Tawk.to, Crisp, Tidio, or a WhatsApp click-to-chat link. It shows up on your live website automatically, no developer needed.</p></div><textarea rows={6} value={form.chat_widget_code || ""} onChange={e => update("chat_widget_code", e.target.value)} placeholder={'<!-- Paste your widget script here, e.g. Facebook Messenger Chat Plugin or Tawk.to code -->'} className="w-full rounded-lg px-3 py-2 text-xs font-mono outline-none" style={{ border: `1px solid ${T.border}`, color: T.ink, backgroundColor: T.bg }} /><div className="rounded-lg p-3 text-xs" style={{ backgroundColor: T.infoSoft, color: T.info, ...fontBody }}>Recommended for this business: Facebook Messenger Chat Plugin (ties into the Facebook page you already use) or Tawk.to (free, no Facebook page needed).</div></div>)}
        {saveError && <Notice tone="danger">{saveError}</Notice>}
        {tab !== "Pipeline" && <button onClick={handleSave} disabled={saving} className="mt-6 px-4 py-2 rounded-lg text-sm flex items-center gap-1.5" style={{ backgroundColor: T.accent, color: "#fff", ...fontBody, opacity: saving ? 0.7 : 1 }}>{savedFlash ? <><Check size={14} /> Saved</> : saving ? "Saving..." : "Save Changes"}</button>}
        </>)}
      </div>
    </div>
  );
}

function inferCategory(submissionType, categories = []) {
  const t = submissionType.toLowerCase();
  const guesses = [];
  if (t.includes("immigra") || t.includes("residency") || t.includes("work permit")) guesses.push("Immigration Processing");
  if (t.includes("visa")) guesses.push("Visa");
  if (t.includes("flight") || t.includes("hotel")) guesses.push("Flight & Hotel");
  if (t.includes("insurance")) guesses.push("Insurance");
  const match = guesses.find(g => categories.includes(g));
  return match || categories[0] || "General";
}

function AuthShell({ children, subtitle }) {
  return (
    <div className="w-full min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: T.bg, ...fontBody }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');`}</style>
      <div className="w-full max-w-md dash-modal-full">
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4" style={{ backgroundColor: T.sidebarBg }}>
            <svg viewBox="0 0 24 24" width="28" height="28" fill="none"><path d="M13 3 L13 21 L9 21 L9 11 L2 19 Z" fill={T.accent} /></svg>
          </div>
          <h1 className="text-2xl mb-1 text-center" style={{ ...fontDisplay, color: T.ink }}>Air Fair Travel & Immigration</h1>
          <p className="text-sm" style={{ color: T.muted, ...fontBody }}>{subtitle}</p>
        </div>
        <div className="rounded-2xl p-8" style={{ backgroundColor: T.surface, border: `1px solid ${T.border}` }}>{children}</div>
      </div>
    </div>
  );
}

function PasswordInput({ value, onChange, placeholder, autoFocus, autoComplete = "current-password" }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Lock size={15} style={{ position: "absolute", left: 12, top: 12, color: T.muted }} />
      <input type={show ? "text" : "password"} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} autoFocus={autoFocus} autoComplete={autoComplete} className="w-full rounded-lg pl-9 pr-9 py-2.5 text-sm outline-none" style={{ border: `1px solid ${T.border}`, color: T.ink, ...fontBody, backgroundColor: T.bg }} />
      <button type="button" onClick={() => setShow(s => !s)} className="absolute right-2 top-2 p-1" style={{ color: T.muted }} aria-label={show ? "Hide password" : "Show password"}>{show ? <EyeOff size={15} /> : <Eye size={15} />}</button>
    </div>
  );
}

// Sign-in only: accounts are created by an admin (Users → Invite user).
function LoginScreen() {
  const [mode, setMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(""); setInfo("");
    if (!email.trim() || (mode === "signin" && !password)) {
      setError(mode === "signin" ? "Please enter your email and password." : "Please enter your email.");
      return;
    }
    setLoading(true);
    try {
      if (mode === "reset") {
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/dashboard` });
        if (resetError) throw resetError;
        setInfo("If that email has an account, a password reset link is on its way.");
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (signInError) throw signInError;
      }
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell subtitle={mode === "reset" ? "Reset your password" : "Dashboard login"}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className="text-xs block mb-1.5" style={{ color: T.muted, ...fontBody }}>Email</label>
          <div className="relative">
            <Mail size={15} style={{ position: "absolute", left: 12, top: 12, color: T.muted }} />
            <input type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="your@email.com" className="w-full rounded-lg pl-9 pr-3 py-2.5 text-sm outline-none" style={{ border: `1px solid ${T.border}`, color: T.ink, ...fontBody, backgroundColor: T.bg }} autoFocus />
          </div>
        </div>
        {mode === "signin" && (
          <div>
            <label className="text-xs block mb-1.5" style={{ color: T.muted, ...fontBody }}>Password</label>
            <PasswordInput value={password} onChange={setPassword} placeholder="Enter your password" />
          </div>
        )}
        {error && <div className="text-xs rounded-lg px-3 py-2" style={{ color: T.danger, backgroundColor: T.dangerSoft, ...fontBody }}>{error}</div>}
        {info && <div className="text-xs rounded-lg px-3 py-2" style={{ color: T.accent, backgroundColor: T.accentSoft, ...fontBody }}>{info}</div>}
        <button type="submit" disabled={loading} className="w-full py-2.5 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-opacity" style={{ backgroundColor: T.accent, color: "#fff", ...fontBody, opacity: loading ? 0.7 : 1 }}>
          {loading ? <><Loader2 size={15} className="animate-spin" /> {mode === "reset" ? "Sending..." : "Signing in..."}</> : mode === "reset" ? "Send reset link" : "Sign In"}
        </button>
        <button type="button" onClick={() => { setMode(mode === "reset" ? "signin" : "reset"); setError(""); setInfo(""); }} className="text-xs self-center underline" style={{ color: T.muted, ...fontBody }}>{mode === "reset" ? "Back to sign in" : "Forgot your password?"}</button>
      </form>
      <p className="text-center text-xs mt-6" style={{ color: T.muted, ...fontBody }}>Accounts are created by an administrator. Ask your admin for an invite.</p>
    </AuthShell>
  );
}

// After an invite or password-reset link: choose a password.
function SetPasswordScreen({ email, onDone }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const submit = async e => {
    e.preventDefault();
    setError("");
    if (password.length < 8) { setError("Use at least 8 characters."); return; }
    if (password !== confirm) { setError("The passwords don't match."); return; }
    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (updateError) { setError(updateError.message); return; }
    onDone();
  };
  return (
    <AuthShell subtitle={`Choose a password for ${email}`}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <div><label className="text-xs block mb-1.5" style={{ color: T.muted, ...fontBody }}>New password</label><PasswordInput value={password} onChange={setPassword} placeholder="At least 8 characters" autoFocus autoComplete="new-password" /></div>
        <div><label className="text-xs block mb-1.5" style={{ color: T.muted, ...fontBody }}>Confirm password</label><PasswordInput value={confirm} onChange={setConfirm} placeholder="Type it again" autoComplete="new-password" /></div>
        {error && <div className="text-xs rounded-lg px-3 py-2" style={{ color: T.danger, backgroundColor: T.dangerSoft, ...fontBody }}>{error}</div>}
        <button type="submit" disabled={loading} className="w-full py-2.5 rounded-lg text-sm font-medium flex items-center justify-center gap-2" style={{ backgroundColor: T.accent, color: "#fff", ...fontBody, opacity: loading ? 0.7 : 1 }}>{loading ? <Loader2 size={15} className="animate-spin" /> : <KeyRound size={15} />} Save password</button>
      </form>
    </AuthShell>
  );
}

function NoAccessScreen({ email, deactivated, onSignOut }) {
  return (
    <AuthShell subtitle={email}>
      <div className="flex flex-col gap-4 text-center">
        <Lock size={28} style={{ color: T.muted, margin: "0 auto" }} />
        <p className="text-sm" style={{ color: T.ink, ...fontBody }}>{deactivated ? "Your account has been deactivated." : "Your account doesn't have access to the dashboard yet."}</p>
        <p className="text-xs" style={{ color: T.muted, ...fontBody }}>Ask an administrator to {deactivated ? "reactivate your account" : "give you a role"} in Users.</p>
        <button type="button" onClick={onSignOut} className="py-2.5 rounded-lg text-sm font-medium" style={{ border: `1px solid ${T.border}`, color: T.ink, ...fontBody }}>Sign out</button>
      </div>
    </AuthShell>
  );
}

const mapBooking = r => ({
  id: r.id, contactId: r.contact_id, name: r.name, purpose: r.purpose, status: r.status,
  dateISO: r.date || null, timeISO: r.time || null,
  date: r.date ? new Date(`${r.date}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "TBD",
  time: r.time ? new Date(`1970-01-01T${r.time}`).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : "",
});
const mapTask = r => ({ id: r.id, employeeId: r.employee_id, contactId: r.contact_id, title: r.title, due: r.due_date || "No due date", done: r.is_done });

export default function Dashboard() {
  // Private back office: keep it out of search results.
  useEffect(() => { applySeo({ title: "Dashboard | Air Fair", noindex: true }); }, []);
  const [session, setSession] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [profile, setProfile] = useState(undefined); // undefined = loading
  const [needsPassword, setNeedsPassword] = useState(() => typeof window !== "undefined" && /type=(invite|recovery)/.test(window.location.hash));
  const [signingOut, setSigningOut] = useState(false);
  const [page, setPage] = useState("overview");
  const [collapsed, setCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [submissions, setSubmissions] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [employeeTasks, setEmployeeTasks] = useState([]);
  const [stageTasks, setStageTasks] = useState([]);
  const [pipelineStages, setPipelineStages] = useState(["New Lead", "Contacted", "Qualified", "Proposal Sent", "Booked Appointment", "Close"]);
  const [pipelineStageRows, setPipelineStageRows] = useState([]);
  const [currency, setCurrency] = useState("₱");
  // Calendar stays hidden unless the saved settings turn it on (no flash while loading).
  const [modules, setModules] = useState({ pipeline: true, bookings: false, employees: true });
  const [chatWidgetCode, setChatWidgetCode] = useState("");
  const [siteSettings, setSiteSettings] = useState(null);
  const [profiles, setProfiles] = useState([]);
  const [documentsContactId, setDocumentsContactId] = useState(null);
  const [emailContext, setEmailContext] = useState({ contactId: null, compose: false, key: 0 });
  const openEmail = (contactId, compose = false) => { setEmailContext({ contactId, compose, key: Date.now() }); setLeadPanel(null); setPage("email-inbox"); };
  const [leadPanel, setLeadPanel] = useState(null); // null | "new" | contact id
  const [loaded, setLoaded] = useState(false);

  const role = profile && profile.is_active ? profile.role : "none";

  const loadAll = useCallback(async () => {
    try {
      const [subsRes, contactsRes, bookingsRes, employeesRes, tasksRes, stageTasksRes, servicesRes, stagesRes, settingsRes, profilesRes] = await Promise.all([
        supabase.from("form_submissions").select("id,name,email,form_type,status,created_at").order("created_at", { ascending: false }),
        supabase.from("contacts").select("*").order("created_at", { ascending: false }),
        supabase.from("bookings").select("*").order("created_at", { ascending: false }),
        supabase.from("employees").select("*").order("created_at", { ascending: false }),
        supabase.from("employee_tasks").select("*").order("created_at", { ascending: false }),
        supabase.from("stage_task_templates").select("*").order("created_at", { ascending: false }),
        supabase.from("pipeline_stages").select("*").order("sort_order", { ascending: true }),
        fetchSiteSettings(),
        supabase.from("profiles").select("id,email,full_name,role"),
      ]);
      [["form_submissions", subsRes], ["contacts", contactsRes], ["bookings", bookingsRes], ["employees", employeesRes], ["employee_tasks", tasksRes], ["stage_task_templates", stageTasksRes], ["services", servicesRes], ["pipeline_stages", stagesRes]]
        .forEach(([name, res]) => { if (res.error) console.error(`Failed to load ${name}:`, res.error); });

      if (subsRes.data) setSubmissions(subsRes.data.map(r => ({ id: r.id, name: r.name, email: r.email, type: r.form_type, createdAt: r.created_at, date: r.created_at ? new Date(r.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "", status: r.status })));
      if (contactsRes.data) setContacts(contactsRes.data.map(mapContactRow));
      if (bookingsRes.data) setBookings(bookingsRes.data.map(mapBooking));
      if (employeesRes.data) setEmployees(employeesRes.data.map(r => ({ id: r.id, userId: r.user_id, name: r.name, email: r.email, role: r.role, allowedModules: r.allowed_modules || { ...DEFAULT_EMPLOYEE_ACCESS } })));
      if (tasksRes.data) setEmployeeTasks(tasksRes.data.map(mapTask));
      if (stageTasksRes.data) setStageTasks(stageTasksRes.data.map(r => ({ id: r.id, stage: r.stage, title: r.title })));
      if (stagesRes.data && stagesRes.data.length > 0) { setPipelineStages(stagesRes.data.map(r => r.name)); setPipelineStageRows(stagesRes.data); }
      if (profilesRes.data) setProfiles(profilesRes.data);
      if (settingsRes) {
        setSiteSettings(settingsRes);
        if (settingsRes.currency_symbol) setCurrency(settingsRes.currency_symbol);
        if (settingsRes.enabled_modules) setModules(prev => ({ ...prev, ...settingsRes.enabled_modules }));
        if (settingsRes.chat_widget_code !== undefined) setChatWidgetCode(settingsRes.chat_widget_code);
      }
    } catch (err) { console.error("Dashboard failed to load data:", err); } finally { setLoaded(true); }
  }, []);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      if (!mounted) return;
      setSession(s);
      setAuthReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (event === "PASSWORD_RECOVERY") setNeedsPassword(true);
    });
    return () => { mounted = false; sub.subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!session) { setProfile(undefined); return; }
    fetchMyProfile(session.user.id).then(p => setProfile(p || null)).catch(() => setProfile(null));
  }, [session]);

  useEffect(() => { if (session && role !== "none") loadAll(); }, [session, role, loadAll]);

  const handleSignOut = async () => {
    setSigningOut(true);
    await supabase.auth.signOut();
    setSigningOut(false);
    setSession(null);
    setLoaded(false);
    setPage("overview");
  };

  // Pipeline filter options: every category a lead actually uses.
  const categories = Array.from(new Set(contacts.map(c => c.category).filter(Boolean)));


  const handleConvertToCase = async (submission) => {
    const category = inferCategory(submission.type || "", categories);
    const { data, error } = await supabase.from("contacts").insert({ submission_id: submission.id, name: submission.name || "(no name)", email: submission.email, category, status: pipelineStages[0] }).select().single();
    if (error) { console.error("Failed to add to pipeline:", error); return; }
    setContacts(prev => [...prev, { id: data.id, submissionId: data.submission_id, name: data.name, email: data.email, phone: data.phone, category: data.category, status: data.status, amount: null, assignedEmployeeId: null }]);
    const { error: statusError } = await supabase.from("form_submissions").update({ status: "Contacted" }).eq("id", submission.id);
    if (statusError) console.error("Failed to update submission status:", statusError);
    setSubmissions(prev => prev.map(s => s.id === submission.id ? { ...s, status: "Contacted" } : s));
  };

  // Stage changes are always saved. Tasks for the new stage are created by the
  // database trigger (trg_auto_assign_stage_tasks), then reloaded here.
  const handleStageChange = async (contact, newStatus) => {
    const { error } = await supabase.from("contacts").update({ status: newStatus }).eq("id", contact.id);
    if (error) {
      console.error("Failed to move contact:", error);
      setContacts(prev => prev.map(c => c.id === contact.id ? { ...c, status: contact.status } : c));
      return;
    }
    if (contact.assignedEmployeeId) {
      const { data } = await supabase.from("employee_tasks").select("*").eq("contact_id", contact.id);
      if (data) setEmployeeTasks(prev => [...prev.filter(t => t.contactId !== contact.id), ...data.map(mapTask)]);
    }
  };

  const handleLeadSaved = (saved, isNew) => {
    setContacts(prev => (isNew ? [saved, ...prev] : prev.map(c => (c.id === saved.id ? saved : c))));
    setLeadPanel(null);
  };

  const handleLeadDeleted = id => {
    setContacts(prev => prev.filter(c => c.id !== id));
    setBookings(prev => prev.map(b => (b.contactId === id ? { ...b, contactId: null } : b)));
    setEmployeeTasks(prev => prev.map(t => (t.contactId === id ? { ...t, contactId: null } : t)));
    setLeadPanel(null);
  };

  const handleDeleteEmployee = async employee => {
    if (!window.confirm(`Delete ${employee.name}? Their tasks are deleted too and their leads become unassigned.`)) return false;
    const { error } = await supabase.from("employees").delete().eq("id", employee.id);
    if (error) { window.alert(error.code === "23503" ? "This employee still has leads assigned. Push the latest database update (npx supabase@2.118.0 db push) or reassign their leads first." : error.message); return false; }
    setEmployees(prev => prev.filter(e => e.id !== employee.id));
    setEmployeeTasks(prev => prev.filter(t => t.employeeId !== employee.id));
    setContacts(prev => prev.map(c => (c.assignedEmployeeId === employee.id ? { ...c, assignedEmployeeId: null } : c)));
    return true;
  };

  const handleUpdateContact = async (id, patch) => {
    const { error } = await supabase.from("contacts").update(patch).eq("id", id);
    if (error) console.error("Failed to update contact:", error);
  };

  const handleSaveBooking = async (form, id) => {
    const row = { contact_id: form.contactId || null, name: form.name.trim(), purpose: form.purpose || null, date: form.date || null, time: form.time || null, status: form.status };
    const query = id ? supabase.from("bookings").update(row).eq("id", id) : supabase.from("bookings").insert(row);
    const { data, error } = await query.select().single();
    if (error) throw error;
    const mapped = mapBooking(data);
    setBookings(prev => (id ? prev.map(b => (b.id === id ? mapped : b)) : [mapped, ...prev]));
  };

  const handleDeleteBooking = async (id) => {
    const { error } = await supabase.from("bookings").delete().eq("id", id);
    if (error) throw error;
    setBookings(prev => prev.filter(b => b.id !== id));
  };

  const handleStagesSaved = (rows, previousRows) => {
    const names = new Map(previousRows.map(old => [old.name, rows.find(row => row.id === old.id)?.name || old.name]));
    setPipelineStageRows(rows);
    setPipelineStages(rows.map(row => row.name));
    setContacts(prev => prev.map(contact => ({ ...contact, status: names.get(contact.status) || contact.status })));
    setStageTasks(prev => prev.map(task => ({ ...task, stage: names.get(task.stage) || task.stage })));
  };

  const handleSaveSettings = async (formData) => {
    const saved = await saveSiteSettings(formData);
    setSiteSettings(saved);
    if (saved.currency_symbol) setCurrency(saved.currency_symbol);
    if (saved.chat_widget_code !== undefined) setChatWidgetCode(saved.chat_widget_code);
    if (saved.enabled_modules) setModules(prev => ({ ...prev, ...saved.enabled_modules }));
  };

  // Staff see the modules ticked on their employee record (Employees → Dashboard Access).
  const myEmployee = session ? employees.find(e => e.userId === session.user.id) : null;
  const staffAccess = myEmployee?.allowedModules || DEFAULT_EMPLOYEE_ACCESS;
  const canEmail = ["admin", "editor"].includes(role) || (role === "staff" && !!myEmployee?.allowedModules?.clients && !!myEmployee?.allowedModules?.["email-inbox"]);
  const visibleNav = useMemo(() => {
    const allowed = NAV.filter(n => n.group || (n.roles.includes(role) && (n.id !== "email-inbox" || canEmail) && (!n.moduleKey || modules[n.moduleKey]) && (role !== "staff" || !n.staffKey || staffAccess[n.staffKey])));
    return allowed.filter((n, i) => !n.group || (allowed[i + 1] && !allowed[i + 1].group));
  }, [role, modules, staffAccess, canEmail]);
  const navItems = visibleNav.filter(n => !n.group);
  const currentPage = navItems.some(n => n.id === page) ? page : "overview";
  const activeLabel = navItems.find(n => n.id === currentPage)?.label ?? "";
  const newCount = submissions.filter(s => s.status === "New").length;
  // Unread Email Inbox conversations for the signed-in user (only mailboxes they can read).
  const [inboxUnread, setInboxUnread] = useState(0);
  useEffect(() => {
    if (!canEmail || !session) { setInboxUnread(0); return; }
    let active = true;
    const load = async () => {
      if (document.hidden) return;
      const { data } = await supabase.rpc("inbox_folder_counts");
      if (active && data) setInboxUnread(data.inbox_unread || 0);
    };
    load();
    const timer = setInterval(load, 30000);
    return () => { active = false; clearInterval(timer); };
  }, [canEmail, session, page]);

  const pageComponents = {
    overview: <Overview goTo={setPage} submissions={submissions} bookings={bookings} contacts={contacts} stages={pipelineStages} currency={currency} role={role} calendar={!!modules.bookings} />,
    "edit-website": <EditWebsite role={role} />,
    "cms-services": <CollectionManager kinds={["immigration_service", "visa_destination", "travel_package"]} title="Services" subtitle="Everything on each service page — text, images, SEO and its form — on one screen." role={role} />,
    news: <CollectionManager kinds={["news_article"]} title="News" subtitle="Stories (badge “Homepage”) appear in the homepage “News & Current Events” section in list order; guides appear on the News page. The section's heading is edited in Pages → Home." role={role} />,
    testimonials: <CollectionManager kinds={["testimonial"]} title="Testimonials" subtitle="Client quotes shown on the homepage (the first three are displayed)." role={role} />,
    forms: <Forms onOpenEmail={canEmail ? openEmail : null} role={role} stages={pipelineStages} goTo={setPage} onConvertToCase={handleConvertToCase} />,
    pipeline: <Contacts contacts={contacts} setContacts={setContacts} bookings={bookings} employees={employees} onStageChange={handleStageChange} onUpdateContact={handleUpdateContact} onOpenLead={setLeadPanel} onNewLead={() => setLeadPanel("new")} stages={pipelineStages} categories={categories} currency={currency} stageRows={pipelineStageRows} onStagesSaved={handleStagesSaved} role={role} />,
    clients: <ClientsDirectory contacts={contacts} bookings={bookings} goTo={setPage} categories={categories} stages={pipelineStages} currency={currency} onOpenDocuments={id => { setDocumentsContactId(id); setPage("documents"); }} onOpenLead={setLeadPanel} onNewLead={() => setLeadPanel("new")} />,
    documents: <ClientDocuments contacts={contacts} role={role} selectedContactId={documentsContactId} onSelectContact={setDocumentsContactId} />,
    employees: <Employees employees={employees} setEmployees={setEmployees} tasks={employeeTasks} setTasks={setEmployeeTasks} stageTasks={stageTasks} setStageTasks={setStageTasks} stages={pipelineStages} profiles={profiles} role={role} onDeleteEmployee={handleDeleteEmployee} />,
    bookings: <Bookings bookings={bookings} contacts={contacts} role={role} onSaveBooking={handleSaveBooking} onDeleteBooking={handleDeleteBooking} />,
    media: <Media role={role} />,
    users: profile ? <UsersAdmin me={profile} /> : null,
    "form-emails": <FormEmails />,
    "email-inbox": canEmail ? <EmailInbox key={emailContext.key} contacts={contacts} userId={session?.user.id} initialContactId={emailContext.contactId} initialCompose={emailContext.compose} onOpenLead={setLeadPanel}
      onContextUsed={() => setEmailContext(c => (c.contactId || c.compose ? { ...c, contactId: null, compose: false } : c))}
      isAdmin={role === "admin"} /> : null,
    settings: <Settings pipelineStages={pipelineStages} pipelineStageRows={pipelineStageRows} onStagesSaved={handleStagesSaved} currency={currency} setCurrency={setCurrency} modules={modules} setModules={setModules} chatWidgetCode={chatWidgetCode} setChatWidgetCode={setChatWidgetCode} settings={siteSettings} onSaveSettings={handleSaveSettings} goTo={setPage} />,
  };

  if (!authReady || (session && profile === undefined)) {
    return <div className="w-full min-h-screen flex items-center justify-center" style={{ backgroundColor: T.bg, ...fontBody }}><Loader2 size={24} className="animate-spin" style={{ color: T.muted }} /></div>;
  }

  if (!session) {
    return <LoginScreen />;
  }

  if (needsPassword) {
    return <SetPasswordScreen email={session.user.email} onDone={() => { setNeedsPassword(false); window.history.replaceState(null, "", window.location.pathname); }} />;
  }

  if (role === "none") {
    return <NoAccessScreen email={session.user.email} deactivated={profile && !profile.is_active} onSignOut={handleSignOut} />;
  }

  const renderNav = (onPick, isMobile) => visibleNav.map(n => {
    if (n.group) return (!collapsed || isMobile) ? <div key={`g-${n.group}`} className="px-3 pt-4 pb-1 text-[10px] uppercase" style={{ color: T.sidebarText, letterSpacing: "0.08em", opacity: 0.7, ...fontBody }}>{n.group}</div> : <div key={`g-${n.group}`} className="mx-3 my-2" style={{ borderTop: "1px solid #1F3A52" }} />;
    const Icon = n.icon;
    const active = currentPage === n.id;
    return (<button key={n.id} onClick={() => onPick(n.id)} className={`flex items-center gap-3 px-3 ${isMobile ? "py-2.5" : "py-2"} rounded-lg text-sm text-left`} style={{ backgroundColor: active ? T.sidebarActiveBg : "transparent", color: active ? T.sidebarTextActive : T.sidebarText, fontWeight: active ? 500 : 400 }} title={collapsed && !isMobile ? n.label : undefined}><Icon size={isMobile ? 18 : 17} />{(!collapsed || isMobile) && <span>{n.label}</span>}{n.id === "forms" && newCount > 0 && (!collapsed || isMobile) && <span className="ml-auto text-[10px] px-1.5 rounded-full" style={{ backgroundColor: T.danger, color: "#fff" }}>{newCount}</span>}{n.id === "email-inbox" && inboxUnread > 0 && (!collapsed || isMobile) && <span className="ml-auto text-[10px] px-1.5 rounded-full" style={{ backgroundColor: T.danger, color: "#fff" }} aria-label={`${inboxUnread} unread conversations`}>{inboxUnread}</span>}</button>);
  });

  return (
    <div className="w-full min-h-screen flex" style={{ backgroundColor: T.bg, ...fontBody, ...(currentPage === "pipeline" ? { height: "100dvh", overflow: "hidden" } : {}) }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');`}</style>
      <style>{`
        .dash-mobile-nav{display:none}
        .dash-mobile-bar{display:none}
        .dash-mobile-overlay{display:none}
        .dash-catalog-mobile-editor{display:none}
        .dash-catalog-desktop-editor{display:block}
        .dash-overview-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:1rem}
        .dash-quick-actions{display:flex;flex-wrap:wrap;gap:.75rem}
        @media(max-width:768px){
          .dash-desktop-sidebar{display:none!important}
          .dash-mobile-bar{display:flex!important}
          .dash-mobile-nav{display:flex!important}
          .dash-content-pad{padding:16px!important}
          .dash-pipeline-content{padding-bottom:72px!important}
          .dash-header-pad{padding:0 16px!important}
          .dash-grid-5{grid-template-columns:1fr!important}
          .dash-grid-3{grid-template-columns:1fr!important}
          .dash-grid-2{grid-template-columns:1fr!important;flex-direction:column!important}
          .dash-mobile-full{max-width:100%!important;max-height:none!important}
          .dash-mobile-hide{display:none!important}
          .dash-catalog-desktop-editor{display:none!important}
          .dash-catalog-mobile-editor{display:block!important}
          .dash-overview-stats{grid-template-columns:repeat(2,1fr)!important;gap:10px!important}
          .dash-quick-actions{display:grid!important;grid-template-columns:repeat(2,1fr)!important;gap:10px!important}
          .dash-quick-actions button{justify-content:center!important;width:100%}
          .dash-modal-full{width:100%!important;max-width:none!important;border-radius:0!important;min-height:100vh!important}
        }
      `}</style>
      {/* Mobile slide-out nav */}
      {mobileNavOpen && (
        <>
          <div className="dash-mobile-overlay" onClick={() => setMobileNavOpen(false)} style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", zIndex: 100 }} />
          <aside className="dash-mobile-nav" style={{ position: "fixed", top: 0, left: 0, bottom: 0, width: 240, backgroundColor: T.sidebarBg, flexDirection: "column", zIndex: 101, transition: "transform 0.2s" }}>
            <div className="flex items-center gap-2.5 px-4 h-16" style={{ borderBottom: "1px solid #1F3A52" }}>
              {siteSettings?.logo_url ? <img src={siteSettings.logo_url} alt="Air Fair logo" className="h-12 flex-1 min-w-0 object-contain object-left" /> : (<div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: T.accent }}><svg viewBox="0 0 24 24" width="16" height="16" fill="none"><path d="M13 3 L13 21 L9 21 L9 11 L2 19 Z" fill="#13293F" /></svg></div>)}
              {!siteSettings?.logo_url && <div className="leading-tight"><div className="text-sm" style={{ color: "#fff", ...fontDisplay }}>Air Fair</div><div className="text-[9px] uppercase" style={{ color: T.sidebarText, letterSpacing: "0.08em", ...fontBody }}>Travel & Immigration</div></div>}
              <button onClick={() => setMobileNavOpen(false)} className="ml-auto" style={{ color: T.sidebarText }} aria-label="Close menu"><X size={18} /></button>
            </div>
            <nav className="flex-1 py-3 px-2 flex flex-col gap-0.5 overflow-y-auto">{renderNav(id => { setPage(id); setMobileNavOpen(false); }, true)}</nav>
          </aside>
        </>
      )}
      {/* Desktop sidebar */}
      <aside className="dash-desktop-sidebar flex flex-col shrink-0 transition-all duration-200" style={{ backgroundColor: T.sidebarBg, width: collapsed ? 76 : 240 }}>
        <div className="flex items-center gap-2.5 px-4 h-16" style={{ borderBottom: "1px solid #1F3A52" }}>
          {siteSettings?.logo_url ? <img src={siteSettings.logo_url} alt="Air Fair logo" className={collapsed ? "w-8 h-8 object-contain shrink-0" : "h-12 flex-1 min-w-0 object-contain object-left"} /> : (<div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: T.accent }}><svg viewBox="0 0 24 24" width="16" height="16" fill="none"><path d="M13 3 L13 21 L9 21 L9 11 L2 19 Z" fill="#13293F" /></svg></div>)}
          {!collapsed && !siteSettings?.logo_url && <div className="leading-tight"><div className="text-sm" style={{ color: "#fff", ...fontDisplay }}>Air Fair</div><div className="text-[9px] uppercase" style={{ color: T.sidebarText, letterSpacing: "0.08em", ...fontBody }}>Travel & Immigration</div></div>}
          <button onClick={() => setCollapsed(c => !c)} className="ml-auto" style={{ color: T.sidebarText }} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}>{collapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}</button>
        </div>
        <nav className="flex-1 py-3 px-2 flex flex-col gap-0.5 overflow-y-auto">{renderNav(setPage, false)}</nav>
        {!collapsed && <div className="mx-3 mb-3 rounded-xl overflow-hidden relative" style={{ height: 130 }}><img src="/header-rizal-park.webp" alt="" className="w-full h-full object-cover" /><div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(16,22,37,0) 20%, rgba(16,22,37,0.92) 100%)" }} /><div className="absolute bottom-0 left-0 right-0 p-3"><div className="text-xs font-medium mb-0.5" style={{ color: "#fff", ...fontBody }}>Delivering Journeys.</div><div className="text-xs mb-1.5" style={{ color: "#fff", ...fontBody }}>Simplifying Visas.</div><div className="w-6 h-0.5 rounded" style={{ backgroundColor: T.accent }} /></div></div>}
      </aside>
      <div className="flex-1 flex flex-col min-w-0 min-h-0" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        {/* Header */}
        <div className="h-16 flex items-center justify-between dash-header-pad px-8 shrink-0" style={{ borderBottom: `1px solid ${T.border}` }}>
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => setMobileNavOpen(true)} className="dash-mobile-bar p-1.5 rounded-md" style={{ color: T.ink }} aria-label="Open menu"><MenuIcon size={20} /></button>
            <div className="text-sm truncate" style={{ color: T.ink, fontWeight: 600, ...fontBody }}>{activeLabel}</div>
          </div>
          <div className="flex items-center gap-5"><button type="button" onClick={() => setPage("forms")} className="relative dash-mobile-hide" aria-label={`${newCount} new submissions`}><Bell size={17} style={{ color: T.muted }} />{newCount > 0 && <span className="absolute -top-1.5 -right-1.5 min-w-[14px] h-3.5 px-0.5 rounded-full flex items-center justify-center text-[9px]" style={{ backgroundColor: T.danger, color: "#fff", ...fontBody }}>{newCount}</span>}</button><div className="flex items-center gap-2"><div className="w-8 h-8 rounded-full flex items-center justify-center text-xs uppercase" style={{ backgroundColor: T.accent, color: "#fff", ...fontBody }}>{(profile?.full_name || session.user.email || "A").slice(0, 2)}</div><span className="text-sm hidden sm:inline" style={{ color: T.ink, ...fontBody }}>{session.user.email}</span><span className="hidden sm:inline"><Badge status={role} /></span><button onClick={() => setNeedsPassword(true)} title="Change password" className="p-1.5 rounded-md dash-mobile-hide" style={{ color: T.muted }} aria-label="Change password"><KeyRound size={15} /></button><button onClick={handleSignOut} disabled={signingOut} title="Sign out" className="p-1.5 rounded-md transition-colors" style={{ color: T.muted }} aria-label="Sign out">{signingOut ? <Loader2 size={15} className="animate-spin" /> : <LogOut size={16} />}</button></div></div>
        </div>
        <div className={`flex-1 min-h-0 dash-content-pad px-8 py-8 ${currentPage === "pipeline" ? "dash-pipeline-content overflow-hidden" : "overflow-auto"}`} style={{ paddingBottom: currentPage === "pipeline" ? 24 : 80 }}>{!loaded ? <div className="flex items-center justify-center py-20"><Loader2 size={22} className="animate-spin" style={{ color: T.muted }} /></div> : pageComponents[currentPage]}</div>
      </div>
      {leadPanel && <LeadDrawer onOpenEmail={canEmail ? openEmail : null} key={leadPanel} lead={leadPanel === "new" ? null : contacts.find(c => c.id === leadPanel)} contacts={contacts} stages={pipelineStages} employees={employees} bookings={bookings} role={role}
        onClose={() => setLeadPanel(null)} onSaved={handleLeadSaved} onDeleted={handleLeadDeleted}
        goTo={id => { setLeadPanel(null); setPage(id); }} onOpenDocuments={id => { setLeadPanel(null); setDocumentsContactId(id); setPage("documents"); }} />}
      {/* Mobile bottom tab bar */}
      <nav className="dash-mobile-bar" style={{ position: "fixed", bottom: 0, left: 0, right: 0, height: 56, backgroundColor: T.surface, borderTop: `1px solid ${T.border}`, alignItems: "center", justifyContent: "space-around", zIndex: 90, paddingBottom: "env(safe-area-inset-bottom)" }}>
        {navItems.slice(0, 4).map(n => { const Icon = n.icon; const active = currentPage === n.id; return (<button key={n.id} onClick={() => setPage(n.id)} className="flex flex-col items-center gap-0.5" style={{ color: active ? T.accent : T.muted, flex: 1 }}><Icon size={20} /><span className="text-[9px]" style={{ ...fontBody, fontWeight: active ? 600 : 400 }}>{n.label.split(" ")[0]}</span></button>); })}
        <button onClick={() => setMobileNavOpen(true)} className="flex flex-col items-center gap-0.5" style={{ color: T.muted, flex: 1 }}><MenuIcon size={20} /><span className="text-[9px]" style={{ ...fontBody }}>More</span></button>
      </nav>
    </div>
  );
}
