import React, { useState, useEffect, useCallback } from "react";
import { LayoutDashboard, File as FileEdit, Inbox, CalendarDays, Image as ImageIcon, Settings as SettingsIcon, ExternalLink, ChevronRight, ChevronLeft, Bell, Plus, X, Upload, Clock, Search, Check, MoveHorizontal as MoreHorizontal, Briefcase, Trash2, GripVertical, Mail, CalendarPlus, Wallet, Users, Plane, Globe, ArrowUp, UserPlus, FileText, Contact as Contact2, UserCog, ListChecks, LayoutTemplate, User, Calendar, Phone, MapPin, Building2, Landmark, TextCursorInput, AlignLeft, List, ChevronDown, SquareCheck as CheckSquare, Circle, Star, Hash, PenLine, Send, CreditCard, Monitor, Smartphone, ArrowLeft, Pencil, Package, Lock, LogOut, Eye, EyeOff, Loader2 } from "lucide-react";
import { supabase } from "../lib/supabase.js";
import { dbRowToService, serviceToDbRow, getPriceLabel } from "../lib/catalog.js";
import { fetchAllPagesForEditor, saveContentBlock, fetchSiteSettings, saveSiteSettings } from "../lib/content.js";

const T = {
  bg: "#F7F9F5", surface: "#FFFFFF", ink: "#151A22", muted: "#7C8894",
  border: "#E8ECE4", sidebarBg: "#13293F", sidebarText: "#8FA0AF",
  sidebarTextActive: "#FFFFFF", sidebarActiveBg: "#6EBE3D",
  accent: "#6EBE3D", accentSoft: "#EAF6E1", warn: "#E08A2C", warnSoft: "#FCEEDC",
  danger: "#D64545", dangerSoft: "#FBE7E7", info: "#3B7DDB", infoSoft: "#E8F0FC",
  violet: "#7C5CBF", violetSoft: "#EFE9F7", teal: "#1D8A8A", tealSoft: "#E1F2F2",
};

const fontDisplay = { fontFamily: "'Inter', sans-serif", fontWeight: 700 };
const fontBody = { fontFamily: "'Inter', sans-serif" };
const fontMono = { fontFamily: "'Inter', sans-serif", fontWeight: 600 };

const NAV = [
  { id: "overview", label: "Dashboard", icon: LayoutDashboard },
  { id: "pipeline", label: "Pipeline", icon: Users, moduleKey: "pipeline" },
  { id: "bookings", label: "Calendar", icon: CalendarDays, moduleKey: "bookings" },
  { id: "clients", label: "Clients", icon: Contact2 },
  { id: "employees", label: "Employees", icon: UserCog, moduleKey: "employees" },
  { id: "forms", label: "Forms", icon: Inbox },
  { id: "services", label: "Catalog", icon: Briefcase, moduleKey: "services" },
  { id: "media", label: "Media", icon: ImageIcon },
  { id: "edit-website", label: "Edit Website", icon: FileEdit },
  { id: "settings", label: "Settings", icon: SettingsIcon },
];



const FORM_TEMPLATES = [
  { id: 1, name: "Visa Inquiry Form", updatedOn: "Aug 20, 2026", updatedBy: "Bea Fernandez", fields: [
    { id: "f1", type: "full_name", label: "Full Name", placeholder: "Enter your full name", required: true },
    { id: "f2", type: "email", label: "Email", placeholder: "your@email.com", required: true },
    { id: "f3", type: "phone", label: "Phone", placeholder: "+63 9XX XXX XXXX", required: true },
    { id: "f4", type: "single_dropdown", label: "Service Interested In", options: ["Tourist Visa", "Immigration Processing", "Not sure yet"], required: false },
    { id: "f5", type: "multi_line", label: "Message", placeholder: "Tell us about your situation...", required: false },
    { id: "f6", type: "submit", label: "Send Inquiry" },
  ]},
  { id: 2, name: "Flight Quote Request", updatedOn: "Aug 18, 2026", updatedBy: "—", fields: [
    { id: "f1", type: "full_name", label: "Full Name", placeholder: "Enter your full name", required: true },
    { id: "f2", type: "email", label: "Email", placeholder: "your@email.com", required: true },
    { id: "f3", type: "date_picker", label: "Preferred Travel Date", required: false },
    { id: "f4", type: "submit", label: "Get a Quote" },
  ]},
  { id: 3, name: "Consultation Booking Form", updatedOn: "Aug 15, 2026", updatedBy: "—", fields: [
    { id: "f1", type: "full_name", label: "Full Name", placeholder: "Enter your full name", required: true },
    { id: "f2", type: "phone", label: "Phone", placeholder: "+63 9XX XXX XXXX", required: true },
    { id: "f3", type: "submit", label: "Book Now" },
  ]},
  { id: 4, name: "General Contact Form", updatedOn: "Aug 10, 2026", updatedBy: "—", fields: [
    { id: "f1", type: "full_name", label: "Full Name", placeholder: "Enter your full name", required: true },
    { id: "f2", type: "email", label: "Email", placeholder: "your@email.com", required: true },
    { id: "f3", type: "multi_line", label: "Message", placeholder: "How can we help?", required: false },
    { id: "f4", type: "submit", label: "Submit" },
  ]},
];

const FIELD_PALETTE = [
  { category: "Personal Info", fields: [
    { type: "full_name", label: "Full Name", icon: User },
    { type: "first_name", label: "First Name", icon: User },
    { type: "last_name", label: "Last Name", icon: User },
    { type: "dob", label: "Date of birth", icon: Calendar },
    { type: "phone", label: "Phone", icon: Phone },
    { type: "email", label: "Email", icon: Mail },
  ]},
  { category: "Address", fields: [
    { type: "address", label: "Address", icon: MapPin },
    { type: "city", label: "City", icon: Building2 },
    { type: "state", label: "State", icon: Landmark },
    { type: "country", label: "Country", icon: Globe },
    { type: "postal_code", label: "Postal Code", icon: CreditCard },
    { type: "organization", label: "Organization", icon: Building2 },
    { type: "website", label: "Website", icon: Globe },
  ]},
  { category: "Text", fields: [
    { type: "single_line", label: "Single Line", icon: TextCursorInput },
    { type: "multi_line", label: "Multi Line", icon: AlignLeft },
    { type: "textbox_list", label: "Text Box List", icon: List },
  ]},
  { category: "Choice Elements", fields: [
    { type: "single_dropdown", label: "Single Dropdown", icon: ChevronDown },
    { type: "multi_dropdown", label: "Multi Dropdown", icon: List },
    { type: "checkbox", label: "Checkbox", icon: CheckSquare },
    { type: "radio", label: "Radio", icon: Circle },
  ]},
  { category: "Rating", fields: [
    { type: "rating", label: "Rating", icon: Star },
  ]},
  { category: "Other Elements", fields: [
    { type: "image", label: "Image", icon: ImageIcon },
    { type: "file_upload", label: "File Upload", icon: Upload },
    { type: "monetary", label: "Monetary", icon: Wallet },
    { type: "number", label: "Number", icon: Hash },
    { type: "date_picker", label: "Date Picker", icon: CalendarDays },
    { type: "signature", label: "Signature", icon: PenLine },
  ]},
  { category: "Submit", fields: [
    { type: "submit", label: "Submit Button", icon: Send },
  ]},
];

const MEDIA = [1,2,3,4,5,6,7,8].map(i => ({ id: i, url: `https://picsum.photos/seed/media${i}/300/300` }));

const STATUS_STYLE = {
  New: { bg: T.infoSoft, fg: T.info },
  Contacted: { bg: T.warnSoft, fg: T.warn },
  Qualified: { bg: T.accentSoft, fg: T.accent },
  Confirmed: { bg: T.accentSoft, fg: T.accent },
  Pending: { bg: T.infoSoft, fg: T.info },
  Closed: { bg: T.border, fg: T.muted },
  Archived: { bg: T.border, fg: T.muted },
  Published: { bg: T.accentSoft, fg: T.accent },
  Draft: { bg: T.border, fg: T.muted },
};

const COLOR_PALETTE = [
  { bg: T.infoSoft, fg: T.info }, { bg: T.warnSoft, fg: T.warn },
  { bg: T.accentSoft, fg: T.accent }, { bg: T.violetSoft, fg: T.violet },
  { bg: T.tealSoft, fg: T.teal }, { bg: T.dangerSoft, fg: T.danger },
];
function paletteColor(i) { return COLOR_PALETTE[((i % COLOR_PALETTE.length) + COLOR_PALETTE.length) % COLOR_PALETTE.length]; }

function Badge({ status }) {
  const s = STATUS_STYLE[status] || { bg: T.border, fg: T.muted };
  return <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: s.bg, color: s.fg, ...fontBody }}>{status}</span>;
}

function StageBadge({ stage, stages }) {
  const idx = stages.indexOf(stage);
  const s = paletteColor(idx >= 0 ? idx : 0);
  return <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: s.bg, color: s.fg, ...fontBody }}>{stage}</span>;
}

function CategoryTag({ category, categories }) {
  const idx = categories ? categories.indexOf(category) : -1;
  const c = paletteColor(idx >= 0 ? idx : 0).fg;
  return <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ border: `1px solid ${c}`, color: c, ...fontBody }}>{category}</span>;
}

function MiniCalendar() {
  const days = ["SUN","MON","TUE","WED","THU","FRI","SAT"];
  const cells = [null,null,null,null,null,1,2, 3,4,5,6,7,8,9, 10,11,12,13,14,15,16, 17,18,19,20,21,22,23, 24,25,26,27,28,29,30, 31];
  const markers = [27, 29]; const today = 26;
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
              {markers.includes(d) && d !== today && <span className="w-1 h-1 rounded-full mt-0.5" style={{ backgroundColor: T.accent }} />}
            </>)}
          </div>
        ))}
      </div>
    </div>
  );
}

const ALL_MODULES = [
  { key: "pipeline", label: "Pipeline" }, { key: "bookings", label: "Calendar" },
  { key: "clients", label: "Clients" }, { key: "forms", label: "Forms" },
  { key: "services", label: "Catalog" }, { key: "media", label: "Media" },
  { key: "edit-website", label: "Edit Website" }, { key: "employees", label: "Employees" },
  { key: "settings", label: "Settings" },
];

const DEFAULT_EMPLOYEE_ACCESS = { pipeline: true, bookings: true, clients: true, forms: true, services: false, media: false, "edit-website": false, employees: false, settings: false };

const PRICING_TYPE_OPTIONS = [
  { value: "fixed", label: "Fixed Price" }, { value: "starting", label: "Starting Price" },
  { value: "range", label: "Price Range" }, { value: "quote", label: "Custom Quote" }, { value: "free", label: "Free" },
];

const PRICING_UNIT_OPTIONS = [
  { value: "per person", label: "Per Person" }, { value: "per package", label: "Per Package" },
  { value: "per night", label: "Per Night" }, { value: "one-time", label: "One-time" },
];

function Overview({ goTo, submissions, bookings, contacts, stages, currency }) {
  const newInquiries = submissions.filter(s => s.status === "New").length;
  const upcoming = bookings.length;
  const finalStage = stages[stages.length - 1];
  const active = contacts.filter(c => c.status !== finalStage);
  const activeTotal = active.reduce((sum, c) => sum + (c.amount || 0), 0);
  const stats = [
    { label: "New Inquiries", value: String(newInquiries).padStart(2, "0"), sub: "20% vs last week", icon: Mail, trend: true },
    { label: "Upcoming Bookings", value: String(upcoming).padStart(2, "0"), sub: "33% vs last week", icon: CalendarDays, trend: true },
    { label: "Active Deals", value: String(active.length).padStart(2, "0"), sub: `${currency}${activeTotal.toLocaleString()} in pipeline`, icon: Wallet, link: true, target: "pipeline" },
    { label: "Pages Live", value: "04", sub: "View website", icon: Globe, link: true, target: "edit-website" },
  ];
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl mb-1 flex items-center gap-2" style={{ ...fontDisplay, color: T.ink }}>Good morning, Air Fair Travel & Immigration <span>👋</span></h1>
        <p className="text-sm" style={{ color: T.muted, ...fontBody }}>Here's what's happening with your website.</p>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "1rem" }}>
        {stats.map((s, i) => {
          const Icon = s.icon;
          const tints = [{ bg: T.accentSoft, fg: T.accent }, { bg: T.infoSoft, fg: T.info }, { bg: T.tealSoft, fg: T.teal }, { bg: T.warnSoft, fg: T.warn }];
          const tint = tints[i % tints.length];
          return (
            <div key={s.label} className="rounded-2xl p-4" style={{ backgroundColor: tint.bg, border: `1px solid ${T.border}` }}>
              <div className="w-10 h-10 rounded-full flex items-center justify-center mb-3" style={{ backgroundColor: "rgba(255,255,255,0.6)" }}><Icon size={18} style={{ color: tint.fg }} /></div>
              <div className="text-[10px] uppercase mb-1" style={{ color: T.muted, ...fontBody, letterSpacing: "0.06em" }}>{s.label}</div>
              <div className="text-3xl mb-2" style={{ ...fontDisplay, color: T.ink }}>{s.value}</div>
              {s.link ? <button onClick={() => goTo(s.target)} className="text-xs font-medium" style={{ color: tint.fg, ...fontBody }}>{s.sub}</button> : <div className="text-xs flex items-center gap-1" style={{ color: tint.fg, ...fontBody }}><ArrowUp size={11} /> {s.sub}</div>}
            </div>
          );
        })}
      </div>
      <div className="rounded-2xl p-5" style={{ backgroundColor: T.accentSoft, border: `1px solid ${T.border}` }}>
        <h2 className="text-sm font-semibold mb-1" style={{ color: T.ink, ...fontBody }}>Quick Actions</h2>
        <p className="text-xs mb-4" style={{ color: T.muted, ...fontBody }}>Access the tools you need most.</p>
        <div className="flex flex-wrap gap-3">
          {[{ label: "Add Booking", target: "bookings", icon: CalendarPlus }, { label: "New Inquiry", target: "forms", icon: Mail }, { label: "Add to Pipeline", target: "pipeline", icon: UserPlus }, { label: "Upload Document", target: "media", icon: FileText }].map(a => (
            <button key={a.label} onClick={() => goTo(a.target)} className="px-4 py-2 rounded-lg text-sm flex items-center gap-2 hover:opacity-80 transition-opacity" style={{ backgroundColor: T.surface, color: T.ink, border: `1px solid ${T.border}`, ...fontBody }}>
              <a.icon size={15} style={{ color: T.accent }} /> {a.label}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
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
          </div>
        </div>
        <div className="rounded-2xl" style={{ backgroundColor: T.surface, border: `1px solid ${T.border}` }}>
          <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: `1px solid ${T.border}` }}>
            <h2 className="text-sm font-semibold" style={{ color: T.ink, ...fontBody }}>Upcoming Bookings</h2>
            <button onClick={() => goTo("bookings")} className="text-xs flex items-center gap-1 hover:opacity-70" style={{ color: T.accent, ...fontBody }}>View all <ChevronRight size={14} /></button>
          </div>
          <div>
            {bookings.map((b, i) => {
              const [mon, day] = b.date === "TBD" ? ["TBD", ""] : b.date.split(" ");
              return (
                <div key={b.id} className="flex items-center gap-3 px-5 py-3" style={{ borderBottom: i < bookings.length - 1 ? `1px solid ${T.border}` : "none" }}>
                  <div className="w-11 h-11 rounded-lg flex flex-col items-center justify-center shrink-0" style={{ backgroundColor: T.accentSoft }}>
                    <span className="text-[9px] uppercase" style={{ color: T.accent, ...fontBody }}>{mon}</span>
                    <span className="text-sm leading-none" style={{ ...fontDisplay, color: T.accent }}>{day || "—"}</span>
                  </div>
                  <div className="flex-1 min-w-0"><div className="text-sm truncate" style={{ color: T.ink, ...fontBody }}>{b.purpose}</div><div className="text-xs truncate" style={{ color: T.muted, ...fontBody }}>{b.name} · {b.time}</div></div>
                  <Badge status={b.status} />
                </div>
              );
            })}
          </div>
        </div>
        <div className="flex flex-col gap-5">
          <div className="rounded-2xl" style={{ backgroundColor: T.surface, border: `1px solid ${T.border}` }}>
            <div className="px-5 py-4" style={{ borderBottom: `1px solid ${T.border}` }}><h2 className="text-sm font-semibold" style={{ color: T.ink, ...fontBody }}>Tasks & Reminders</h2></div>
            <div>
              {bookings.slice(0, 3).map((b, i) => (
                <div key={b.id} className="flex items-start gap-3 px-5 py-3" style={{ borderBottom: i < 2 ? `1px solid ${T.border}` : "none" }}>
                  <div className="w-4 h-4 rounded mt-0.5 shrink-0" style={{ border: `1.5px solid ${T.border}` }} />
                  <div className="flex-1 min-w-0"><div className="text-xs" style={{ color: T.ink, ...fontBody }}>{b.purpose} — {b.name}</div><div className="text-[11px]" style={{ color: T.muted, ...fontBody }}>{b.date} · {b.time}</div></div>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-2xl p-5" style={{ backgroundColor: T.surface, border: `1px solid ${T.border}` }}>
            <div className="flex items-center justify-between mb-3"><h2 className="text-sm font-semibold" style={{ color: T.ink, ...fontBody }}>Calendar Overview</h2></div>
            <div className="text-xs mb-3" style={{ color: T.muted, ...fontBody }}>August 2026</div>
            <MiniCalendar />
          </div>
        </div>
      </div>
    </div>
  );
}

const catalogInputStyle = { border: `1px solid ${T.border}`, color: T.ink, ...fontBody, backgroundColor: T.bg };

function LabeledInput({ label, value, onChange, placeholder, type = "text" }) {
  return (<div><label className="text-xs block mb-1.5" style={{ color: T.muted, ...fontBody }}>{label}</label><input type={type} value={value ?? ""} placeholder={placeholder} onChange={e => onChange(e.target.value)} className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={catalogInputStyle} /></div>);
}
function LabeledTextarea({ label, value, onChange, placeholder, rows = 3 }) {
  return (<div><label className="text-xs block mb-1.5" style={{ color: T.muted, ...fontBody }}>{label}</label><textarea rows={rows} value={value ?? ""} placeholder={placeholder} onChange={e => onChange(e.target.value)} className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={catalogInputStyle} /></div>);
}
function LabeledSelect({ label, value, onChange, options }) {
  return (<div><label className="text-xs block mb-1.5" style={{ color: T.muted, ...fontBody }}>{label}</label><select value={value ?? ""} onChange={e => onChange(e.target.value)} className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={{ ...catalogInputStyle, backgroundColor: "#fff" }}>{options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select></div>);
}
function ToggleRow({ label, checked, onChange }) {
  return (<label className="flex items-center gap-2.5 text-sm cursor-pointer" style={{ color: T.ink, ...fontBody }}><input type="checkbox" checked={!!checked} onChange={e => onChange(e.target.checked)} style={{ accentColor: T.accent }} />{label}</label>);
}
function GalleryEditor({ label, images, onChange }) {
  const addImage = () => onChange([...(images || []), `https://picsum.photos/seed/gallery${Date.now()}/300/200`]);
  const removeImage = (idx) => onChange(images.filter((_, i) => i !== idx));
  return (<div><label className="text-xs block mb-1.5" style={{ color: T.muted, ...fontBody }}>{label}</label><div className="flex flex-wrap gap-2">{(images || []).map((img, i) => (<div key={i} className="relative"><img src={img} alt="" className="w-16 h-12 object-cover rounded-md" style={{ border: `1px solid ${T.border}` }} /><button onClick={() => removeImage(i)} className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full flex items-center justify-center" style={{ backgroundColor: T.danger }}><X size={10} color="#fff" /></button></div>))}<button onClick={addImage} className="w-16 h-12 rounded-md flex items-center justify-center" style={{ border: `1.5px dashed ${T.border}`, backgroundColor: T.bg }}><Plus size={14} style={{ color: T.muted }} /></button></div></div>);
}

function FieldInput({ field, onChange }) {
  const base = "w-full rounded-lg px-3 py-2 text-sm outline-none";
  const style = { border: `1px solid ${T.border}`, color: T.ink, ...fontBody, backgroundColor: T.bg };
  if (field.type === "textarea") return <textarea rows={3} className={base} style={style} value={field.value} onChange={e => onChange(e.target.value)} />;
  if (field.type === "image") return (<div className="flex items-center gap-3"><img src={field.value} alt="" className="w-20 h-14 object-cover rounded-lg" style={{ border: `1px solid ${T.border}` }} /><button className="px-3 py-2 rounded-lg text-xs flex items-center gap-1.5" style={{ backgroundColor: T.accentSoft, color: T.accent, ...fontBody }}><Upload size={13} /> Replace Image</button></div>);
  return <input className={base} style={style} value={field.value} onChange={e => onChange(e.target.value)} />;
}

const SECTION_FIELD_DEFS = {
  hero: [
    { key: "heading", label: "Main Heading", type: "text" },
    { key: "subheading", label: "Subheading", type: "textarea" },
    { key: "cta_text", label: "Button Text", type: "text" },
    { key: "cta_url", label: "Button Link", type: "text" },
  ],
  services_preview: [
    { key: "heading", label: "Section Heading", type: "text" },
    { key: "subheading", label: "Subheading", type: "textarea" },
  ],
  testimonials: [
    { key: "heading", label: "Section Heading", type: "text" },
  ],
  cta: [
    { key: "heading", label: "Heading", type: "text" },
    { key: "subheading", label: "Subheading", type: "textarea" },
    { key: "cta_text", label: "Button Text", type: "text" },
    { key: "cta_url", label: "Button Link", type: "text" },
  ],
};

const TEMPLATE_LABELS = {
  hero: "Hero", services_preview: "Services Preview",
  testimonials: "Testimonials", cta: "CTA Section",
};

function EditWebsite() {
  const [dbPages, setDbPages] = useState([]);
  const [pageIdx, setPageIdx] = useState(0);
  const [sectionId, setSectionId] = useState(null);
  const [savedFlash, setSavedFlash] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [localBlocks, setLocalBlocks] = useState({});

  useEffect(() => {
    (async () => {
      const pages = await fetchAllPagesForEditor();
      setDbPages(pages);
      setLoaded(true);
    })();
  }, []);

  const page = dbPages[pageIdx];
  const section = page?.sections.find(s => s.id === sectionId);
  const fieldDefs = section ? (SECTION_FIELD_DEFS[section.template_type] || []) : [];

  const updateField = (key, value) => {
    setLocalBlocks(prev => ({ ...prev, [`${sectionId}:${key}`]: value }));
  };

  const getFieldValue = (key) => {
    const localKey = `${sectionId}:${key}`;
    if (localKey in localBlocks) return localBlocks[localKey];
    return section?.blocks?.[key] ?? "";
  };

  const handleSave = async () => {
    if (!section) return;
    setSaving(true); setSavedFlash(false);
    try {
      for (const f of fieldDefs) {
        const localKey = `${sectionId}:${f.key}`;
        if (localKey in localBlocks) {
          await saveContentBlock(section.id, f.key, localBlocks[localKey]);
        }
      }
      setSavedFlash(true); setTimeout(() => setSavedFlash(false), 1800);
      setLocalBlocks({});
      const pages = await fetchAllPagesForEditor();
      setDbPages(pages);
    } catch (err) {
    } finally { setSaving(false); }
  };

  if (!loaded) return <div className="text-sm" style={{ color: T.muted, ...fontBody }}>Loading website content...</div>;
  if (!page) return <div className="text-sm" style={{ color: T.muted, ...fontBody }}>No pages found. Content will appear here once sections are set up.</div>;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl mb-1" style={{ ...fontDisplay, color: T.ink }}>Edit Website</h1><p className="text-sm" style={{ color: T.muted, ...fontBody }}>Click a section to edit its content. Layout and design stay locked.</p></div>
        <a href="/" target="_blank" rel="noopener noreferrer" className="text-sm flex items-center gap-1.5 px-3 py-2 rounded-lg shrink-0" style={{ color: T.accent, border: `1px solid ${T.border}`, ...fontBody }}><ExternalLink size={15} /> View Live Website</a>
      </div>
      <div className="flex gap-1 border-b" style={{ borderColor: T.border }}>
        {dbPages.map((p, i) => (<button key={p.id} onClick={() => { setPageIdx(i); setSectionId(null); setLocalBlocks({}); }} className="px-4 py-2 text-sm -mb-px" style={{ ...fontBody, color: pageIdx === i ? T.ink : T.muted, borderBottom: pageIdx === i ? `2px solid ${T.accent}` : "2px solid transparent", fontWeight: pageIdx === i ? 500 : 400 }}>{p.title}</button>))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3 rounded-xl overflow-hidden" style={{ backgroundColor: T.surface, border: `1px solid ${T.border}` }}>
          <div className="px-5 py-4" style={{ borderBottom: `1px solid ${T.border}` }}><span className="text-sm font-medium" style={{ color: T.ink, ...fontBody }}>{page.title} — Sections</span></div>
          {page.sections.map((s, i) => {
            const label = TEMPLATE_LABELS[s.template_type] || s.template_type;
            const fieldCount = (SECTION_FIELD_DEFS[s.template_type] || []).length;
            return (
              <button key={s.id} onClick={() => { setSectionId(s.id); setLocalBlocks({}); }} className="w-full flex items-center justify-between px-5 py-4 text-left hover:opacity-80" style={{ borderBottom: i < page.sections.length - 1 ? `1px solid ${T.border}` : "none", backgroundColor: sectionId === s.id ? T.accentSoft : "transparent" }}>
                <div><div className="text-sm" style={{ color: T.ink, ...fontBody }}>{label}</div><div className="text-xs mt-0.5" style={{ color: T.muted, ...fontBody }}>{fieldCount} editable field{fieldCount !== 1 ? "s" : ""}</div></div>
                <ChevronRight size={16} style={{ color: T.muted }} />
              </button>
            );
          })}
          {page.sections.length === 0 && <div className="px-5 py-10 text-center text-sm" style={{ color: T.muted, ...fontBody }}>No sections on this page yet.</div>}
        </div>
        <div className="lg:col-span-2 rounded-xl" style={{ backgroundColor: T.surface, border: `1px solid ${T.border}` }}>
          {!section ? (<div className="h-full flex items-center justify-center text-center px-8 py-16"><p className="text-sm" style={{ color: T.muted, ...fontBody }}>Select a section on the left to edit its content.</p></div>) : (
            <div className="p-5 flex flex-col gap-4">
              <div className="flex items-center justify-between"><span className="text-sm font-medium" style={{ color: T.ink, ...fontBody }}>Edit {TEMPLATE_LABELS[section.template_type] || section.template_type}</span><button onClick={() => setSectionId(null)} style={{ color: T.muted }}><X size={16} /></button></div>
              {fieldDefs.map(f => {
                const fieldObj = { type: f.type, value: getFieldValue(f.key) };
                return (<div key={f.key}><label className="text-xs block mb-1.5" style={{ color: T.muted, ...fontBody }}>{f.label}</label><FieldInput field={fieldObj} onChange={v => updateField(f.key, v)} /></div>);
              })}
              {fieldDefs.length === 0 && <div className="text-xs" style={{ color: T.muted, ...fontBody }}>No editable fields defined for this section type.</div>}
              <button onClick={handleSave} disabled={saving} className="mt-2 px-4 py-2 rounded-lg text-sm flex items-center justify-center gap-1.5" style={{ backgroundColor: T.accent, color: "#fff", ...fontBody, opacity: saving ? 0.7 : 1 }}>{savedFlash ? <><Check size={14} /> Saved</> : saving ? "Saving..." : "Save Changes"}</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ServiceForm({ draft, update, currency }) {
  return (
    <div className="flex flex-col gap-3.5">
      <LabeledInput label="Service Name" value={draft.name} onChange={v => update({ name: v })} />
      <LabeledInput label="Category" value={draft.category} onChange={v => update({ category: v })} />
      <LabeledTextarea label="Short Description" rows={2} value={draft.shortDescription} onChange={v => update({ shortDescription: v })} />
      <LabeledTextarea label="Full Description" rows={4} value={draft.fullDescription} onChange={v => update({ fullDescription: v })} />
      <LabeledSelect label="Pricing Type" value={draft.pricingType} onChange={v => update({ pricingType: v })} options={PRICING_TYPE_OPTIONS} />
      {draft.pricingType === "range" ? (<div className="grid grid-cols-2 gap-3"><LabeledInput label={`Min Price (${currency})`} value={draft.priceMin} onChange={v => update({ priceMin: v })} /><LabeledInput label={`Max Price (${currency})`} value={draft.priceMax} onChange={v => update({ priceMax: v })} /></div>) : (draft.pricingType !== "quote" && draft.pricingType !== "free") ? (<LabeledInput label={`Price (${currency})`} value={draft.price} onChange={v => update({ price: v })} />) : null}
      <LabeledInput label="Duration" placeholder="e.g. 45 minutes, 3-5 business days" value={draft.duration} onChange={v => update({ duration: v })} />
      <div><label className="text-xs block mb-1.5" style={{ color: T.muted, ...fontBody }}>Featured Image</label><div className="flex items-center gap-3"><img src={draft.image} alt="" className="w-20 h-14 object-cover rounded-lg" style={{ border: `1px solid ${T.border}` }} /><button className="px-3 py-2 rounded-lg text-xs flex items-center gap-1.5" style={{ backgroundColor: T.accentSoft, color: T.accent, ...fontBody }}><Upload size={13} /> Replace Image</button></div></div>
      <GalleryEditor label="Gallery Images" images={draft.gallery} onChange={v => update({ gallery: v })} />
      <LabeledInput label="CTA Button Label" value={draft.ctaLabel} onChange={v => update({ ctaLabel: v })} />
      <LabeledInput label="CTA Action / Link" placeholder="/booking or https://..." value={draft.ctaLink} onChange={v => update({ ctaLink: v })} />
      <ToggleRow label="Featured" checked={draft.featured} onChange={v => update({ featured: v })} />
      <LabeledSelect label="Status" value={draft.status} onChange={v => update({ status: v })} options={[{ value: "Published", label: "Published" }, { value: "Draft", label: "Draft" }]} />
    </div>
  );
}

function ProductForm({ draft, update, currency }) {
  return (
    <div className="flex flex-col gap-3.5">
      <LabeledInput label="Product / Package Name" value={draft.name} onChange={v => update({ name: v })} />
      <LabeledInput label="Category" value={draft.category} onChange={v => update({ category: v })} />
      <LabeledTextarea label="Short Description" rows={2} value={draft.shortDescription} onChange={v => update({ shortDescription: v })} />
      <LabeledTextarea label="Full Description" rows={4} value={draft.fullDescription} onChange={v => update({ fullDescription: v })} />
      <div className="grid grid-cols-2 gap-3"><LabeledInput label={`Regular Price (${currency})`} value={draft.regularPrice} onChange={v => update({ regularPrice: v })} /><LabeledInput label={`Sale Price (${currency})`} placeholder="Optional" value={draft.salePrice} onChange={v => update({ salePrice: v })} /></div>
      <LabeledSelect label="Pricing Unit" value={draft.pricingUnit} onChange={v => update({ pricingUnit: v })} options={PRICING_UNIT_OPTIONS} />
      <div><label className="text-xs block mb-1.5" style={{ color: T.muted, ...fontBody }}>Featured Image</label><div className="flex items-center gap-3"><img src={draft.image} alt="" className="w-20 h-14 object-cover rounded-lg" style={{ border: `1px solid ${T.border}` }} /><button className="px-3 py-2 rounded-lg text-xs flex items-center gap-1.5" style={{ backgroundColor: T.accentSoft, color: T.accent, ...fontBody }}><Upload size={13} /> Replace Image</button></div></div>
      <GalleryEditor label="Gallery Images" images={draft.gallery} onChange={v => update({ gallery: v })} />
      <LabeledTextarea label="Inclusions" rows={2} value={draft.inclusions} onChange={v => update({ inclusions: v })} />
      <LabeledTextarea label="Exclusions" rows={2} value={draft.exclusions} onChange={v => update({ exclusions: v })} />
      <LabeledInput label="Availability" placeholder="e.g. Departures every Saturday" value={draft.availability} onChange={v => update({ availability: v })} />
      <div className="grid grid-cols-2 gap-3"><LabeledInput label="Start Date" type="date" value={draft.startDate} onChange={v => update({ startDate: v })} /><LabeledInput label="End Date" type="date" value={draft.endDate} onChange={v => update({ endDate: v })} /></div>
      <LabeledInput label="CTA Button Label" value={draft.ctaLabel} onChange={v => update({ ctaLabel: v })} />
      <LabeledInput label="CTA Action / Link" placeholder="/booking or https://..." value={draft.ctaLink} onChange={v => update({ ctaLink: v })} />
      <ToggleRow label="Featured" checked={draft.featured} onChange={v => update({ featured: v })} />
      <LabeledSelect label="Status" value={draft.status} onChange={v => update({ status: v })} options={[{ value: "Published", label: "Published" }, { value: "Draft", label: "Draft" }]} />
    </div>
  );
}

function AddOfferingModal({ onClose, onChoose }) {
  return (<div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(21,26,34,0.45)" }}><div className="w-full max-w-lg rounded-2xl p-6" style={{ backgroundColor: T.surface }}><div className="flex items-center justify-between mb-5"><h2 className="text-base font-semibold" style={{ color: T.ink, ...fontBody }}>What would you like to add?</h2><button onClick={onClose} style={{ color: T.muted }}><X size={18} /></button></div><div className="grid grid-cols-2 gap-3"><button onClick={() => onChoose("service")} className="text-left rounded-xl p-4" style={{ border: `1px solid ${T.border}` }}><div className="w-9 h-9 rounded-lg flex items-center justify-center mb-3" style={{ backgroundColor: T.infoSoft }}><Briefcase size={16} style={{ color: T.info }} /></div><div className="text-sm font-medium mb-1" style={{ color: T.ink, ...fontBody }}>Service</div><p className="text-xs" style={{ color: T.muted, ...fontBody }}>For work performed for a customer — visa processing, consultation, booking assistance, immigration processing.</p></button><button onClick={() => onChoose("product")} className="text-left rounded-xl p-4" style={{ border: `1px solid ${T.border}` }}><div className="w-9 h-9 rounded-lg flex items-center justify-center mb-3" style={{ backgroundColor: T.tealSoft }}><Package size={16} style={{ color: T.teal }} /></div><div className="text-sm font-medium mb-1" style={{ color: T.ink, ...fontBody }}>Product / Package</div><p className="text-xs" style={{ color: T.muted, ...fontBody }}>For packaged or predefined offers — tour packages, insurance packages, physical or digital products.</p></button></div></div></div>);
}

const emptyServiceDraft = { type: "service", name: "", category: "", shortDescription: "", fullDescription: "", pricingType: "starting", price: "", priceMin: "", priceMax: "", duration: "", image: "https://picsum.photos/seed/newservice/300/200", gallery: [], ctaLabel: "Learn More", ctaLink: "", featured: false, status: "Draft" };
const emptyProductDraft = { type: "product", name: "", category: "", shortDescription: "", fullDescription: "", regularPrice: "", salePrice: "", pricingUnit: "per person", image: "https://picsum.photos/seed/newproduct/300/200", gallery: [], inclusions: "", exclusions: "", availability: "", startDate: "", endDate: "", ctaLabel: "Book Now", ctaLink: "", featured: false, status: "Draft" };

function Catalog({ services, onSaveService, onDeleteService, categories, currency }) {
  const [tab, setTab] = useState("all");
  const [query, setQuery] = useState("");
  const [activeId, setActiveId] = useState(null);
  const [draft, setDraft] = useState(null);
  const [showChooser, setShowChooser] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [saving, setSaving] = useState(false);

  const filtered = services.filter(it => {
    const matchesTab = tab === "all" || it.type === tab;
    const q = query.toLowerCase();
    const matchesSearch = !q || it.name.toLowerCase().includes(q) || (it.category || "").toLowerCase().includes(q);
    return matchesTab && matchesSearch;
  });

  const openItem = (item) => { setActiveId(item.id); setDraft({ ...item }); setShowChooser(false); };
  const openNew = (type) => { setActiveId("new"); setDraft(type === "service" ? { ...emptyServiceDraft } : { ...emptyProductDraft }); setShowChooser(false); };
  const updateDraft = (patch) => setDraft(prev => ({ ...prev, ...patch }));

  const handleSave = async () => {
    setSaving(true); setSavedFlash(false);
    try {
      await onSaveService(draft, activeId === "new" ? null : activeId);
      setSavedFlash(true); setTimeout(() => setSavedFlash(false), 1200);
      setActiveId(null); setDraft(null);
    } catch (err) { /* error handled by parent */ } finally { setSaving(false); }
  };
  const handleDelete = async (id) => {
    try { await onDeleteService(id); if (activeId === id) { setActiveId(null); setDraft(null); } } catch (err) {}
  };

  const tabs = [{ id: "all", label: "All" }, { id: "service", label: "Services" }, { id: "product", label: "Products" }];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div><h1 className="text-2xl mb-1" style={{ ...fontDisplay, color: T.ink }}>Catalog</h1><p className="text-sm" style={{ color: T.muted, ...fontBody }}>Manage the products, services, packages, and offers available to your customers.</p></div>
        <button onClick={() => setShowChooser(true)} className="px-4 py-2 rounded-lg text-sm flex items-center gap-1.5" style={{ backgroundColor: T.accent, color: "#fff", ...fontBody }}><Plus size={14} /> Add Offering</button>
      </div>
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-2">{tabs.map(t => (<button key={t.id} onClick={() => setTab(t.id)} className="px-3 py-1.5 rounded-full text-xs" style={{ ...fontBody, backgroundColor: tab === t.id ? T.ink : T.surface, color: tab === t.id ? "#fff" : T.muted, border: `1px solid ${tab === t.id ? T.ink : T.border}` }}>{t.label}</button>))}</div>
        <div className="relative w-full sm:w-56"><Search size={14} style={{ color: T.muted, position: "absolute", left: 10, top: 9 }} /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search catalog" className="w-full rounded-lg pl-8 pr-3 py-1.5 text-sm outline-none" style={{ border: `1px solid ${T.border}`, backgroundColor: T.surface, color: T.ink, ...fontBody }} /></div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3 rounded-xl overflow-hidden" style={{ backgroundColor: T.surface, border: `1px solid ${T.border}` }}>
          {filtered.map((it, i) => (
            <div key={it.id} className="flex items-center gap-4 px-5 py-4" style={{ borderBottom: i < filtered.length - 1 ? `1px solid ${T.border}` : "none" }}>
              <GripVertical size={15} style={{ color: T.border }} />
              <img src={it.image} alt="" className="w-14 h-10 object-cover rounded-md" style={{ border: `1px solid ${T.border}` }} />
              <button onClick={() => openItem(it)} className="flex-1 text-left min-w-0">
                <div className="text-sm truncate" style={{ color: T.ink, ...fontBody }}>{it.name}</div>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-medium flex items-center gap-1" style={{ backgroundColor: it.type === "service" ? T.infoSoft : T.tealSoft, color: it.type === "service" ? T.info : T.teal, ...fontBody }}>{it.type === "service" ? <Briefcase size={10} /> : <Package size={10} />}{it.type === "service" ? "Service" : "Product"}</span>
                  {it.category && <CategoryTag category={it.category} categories={categories} />}
                  <span className="text-xs" style={{ color: T.muted, ...fontBody }}>{getPriceLabel(it, currency)}</span>
                  <Badge status={it.status} />
                </div>
              </button>
              <button onClick={() => openItem(it)} className="text-xs px-2.5 py-1 rounded-md shrink-0" style={{ backgroundColor: T.accentSoft, color: T.accent, ...fontBody }}>Edit</button>
              <button onClick={() => handleDelete(it.id)} style={{ color: T.muted }} className="shrink-0"><Trash2 size={15} /></button>
            </div>
          ))}
          {filtered.length === 0 && <div className="px-5 py-10 text-center text-sm" style={{ color: T.muted, ...fontBody }}>No items match this view yet.</div>}
        </div>
        <div className="lg:col-span-2 rounded-xl overflow-y-auto" style={{ backgroundColor: T.surface, border: `1px solid ${T.border}`, maxHeight: 720 }}>
          {!draft ? (<div className="h-full flex items-center justify-center text-center px-8 py-16"><p className="text-sm" style={{ color: T.muted, ...fontBody }}>Select an item to edit, or add a new offering.</p></div>) : (
            <div className="p-5 flex flex-col gap-4">
              <div className="flex items-center justify-between"><span className="text-sm font-medium" style={{ color: T.ink, ...fontBody }}>{activeId === "new" ? "New " : "Edit "}{draft.type === "service" ? "Service" : "Product / Package"}</span><button onClick={() => { setActiveId(null); setDraft(null); }} style={{ color: T.muted }}><X size={16} /></button></div>
              {draft.type === "service" ? <ServiceForm draft={draft} update={updateDraft} currency={currency} /> : <ProductForm draft={draft} update={updateDraft} currency={currency} />}
              <button onClick={handleSave} disabled={saving} className="mt-2 px-4 py-2 rounded-lg text-sm flex items-center justify-center gap-1.5" style={{ backgroundColor: T.accent, color: "#fff", ...fontBody, opacity: saving ? 0.7 : 1 }}>{savedFlash ? <><Check size={14} /> Saved</> : saving ? "Saving..." : "Save"}</button>
            </div>
          )}
        </div>
      </div>
      {showChooser && <AddOfferingModal onClose={() => setShowChooser(false)} onChoose={openNew} />}
    </div>
  );
}

function FieldPreview({ field, currency = "\u20B1" }) {
  const inputStyle = { border: `1px solid ${T.border}`, color: T.ink, ...fontBody, backgroundColor: "#fff" };
  const label = <label className="text-sm block mb-1.5" style={{ color: T.ink, ...fontBody, fontWeight: 500 }}>{field.label}{field.required && <span style={{ color: T.danger }}> *</span>}</label>;
  switch (field.type) {
    case "email": return <div>{label}<div className="relative"><Mail size={14} style={{ position: "absolute", left: 12, top: 12, color: T.muted }} /><input disabled placeholder={field.placeholder || "your@email.com"} className="w-full rounded-lg pl-9 pr-3 py-2.5 text-sm" style={inputStyle} /></div></div>;
    case "phone": return <div>{label}<input disabled placeholder={field.placeholder || "+1 (555) 000-0000"} className="w-full rounded-lg px-3 py-2.5 text-sm" style={inputStyle} /></div>;
    case "dob": case "date_picker": return <div>{label}<div className="relative"><input disabled placeholder="mm/dd/yyyy" className="w-full rounded-lg pl-3 pr-9 py-2.5 text-sm" style={inputStyle} /><Calendar size={14} style={{ position: "absolute", right: 12, top: 12, color: T.muted }} /></div></div>;
    case "multi_line": case "textbox_list": return <div>{label}<textarea disabled rows={3} placeholder={field.placeholder || ""} className="w-full rounded-lg px-3 py-2.5 text-sm" style={inputStyle} /></div>;
    case "single_dropdown": case "multi_dropdown": return <div>{label}<select disabled className="w-full rounded-lg px-3 py-2.5 text-sm" style={inputStyle}>{(field.options && field.options.length > 0 ? field.options : ["Option 1", "Option 2"]).map(o => <option key={o}>{o}</option>)}</select></div>;
    case "checkbox": return <label className="flex items-start gap-2.5 text-sm" style={{ color: T.ink, ...fontBody }}><input type="checkbox" disabled className="mt-0.5" style={{ accentColor: T.accent }} />{field.label}{field.required && <span style={{ color: T.danger }}> *</span>}</label>;
    case "radio": return <div>{label}<div className="flex flex-col gap-1.5">{(field.options && field.options.length > 0 ? field.options : ["Option 1", "Option 2"]).map(o => <label key={o} className="flex items-center gap-2 text-sm" style={{ color: T.ink, ...fontBody }}><input type="radio" disabled name={field.id} style={{ accentColor: T.accent }} /> {o}</label>)}</div></div>;
    case "rating": return <div>{label}<div className="flex gap-1">{[1, 2, 3, 4, 5].map(i => <Star key={i} size={20} style={{ color: T.warn }} />)}</div></div>;
    case "image": return <div>{label}<div className="rounded-lg flex flex-col items-center justify-center gap-1 py-6" style={{ border: `1.5px dashed ${T.border}`, backgroundColor: T.bg }}><ImageIcon size={20} style={{ color: T.muted }} /><span className="text-xs" style={{ color: T.muted, ...fontBody }}>Upload image</span></div></div>;
    case "file_upload": return <div>{label}<div className="rounded-lg flex flex-col items-center justify-center gap-1 py-6" style={{ border: `1.5px dashed ${T.border}`, backgroundColor: T.bg }}><Upload size={20} style={{ color: T.muted }} /><span className="text-xs" style={{ color: T.muted, ...fontBody }}>Choose file</span></div></div>;
    case "monetary": return <div>{label}<div className="relative"><span className="absolute left-3 top-2.5 text-sm" style={{ color: T.muted }}>{currency}</span><input disabled className="w-full rounded-lg pl-7 pr-3 py-2.5 text-sm" style={inputStyle} /></div></div>;
    case "number": return <div>{label}<input disabled type="number" className="w-full rounded-lg px-3 py-2.5 text-sm" style={inputStyle} /></div>;
    case "signature": return <div>{label}<div className="rounded-lg flex flex-col items-center justify-center gap-1 py-6" style={{ border: `1.5px dashed ${T.border}`, backgroundColor: T.bg }}><PenLine size={20} style={{ color: T.muted }} /><span className="text-xs" style={{ color: T.muted, ...fontBody }}>Sign here</span></div></div>;
    case "submit": return <button disabled className="w-full py-3 rounded-lg text-sm font-semibold" style={{ backgroundColor: T.accent, color: "#fff", ...fontBody }}>{field.label || "Submit"}</button>;
    default: return <div>{label}<input disabled placeholder={field.placeholder || ""} className="w-full rounded-lg px-3 py-2.5 text-sm" style={inputStyle} /></div>;
  }
}

function FormBuilderView({ form, onBack, currency }) {
  const [formName, setFormName] = useState(form.name);
  const [fields, setFields] = useState(form.fields || []);
  const [topTab, setTopTab] = useState("edit");
  const [device, setDevice] = useState("desktop");
  const [editingId, setEditingId] = useState(null);
  const [draggingId, setDraggingId] = useState(null);
  const [dragOverId, setDragOverId] = useState(null);
  const [canvasDragOver, setCanvasDragOver] = useState(false);
  const addField = (type, defaultLabel) => { const needsOptions = ["single_dropdown", "multi_dropdown", "radio"].includes(type); setFields(prev => [...prev, { id: `f_${Date.now()}`, type, label: defaultLabel, placeholder: "", required: false, options: needsOptions ? ["Option 1", "Option 2"] : undefined }]); };
  const removeField = (id) => { setFields(prev => prev.filter(f => f.id !== id)); if (editingId === id) setEditingId(null); };
  const updateField = (id, patch) => { setFields(prev => prev.map(f => f.id === id ? { ...f, ...patch } : f)); };
  const handleDragStart = (id) => setDraggingId(id);
  const handleDragOverField = (e, id) => { e.preventDefault(); if (id !== draggingId) setDragOverId(id); };
  const handleDropField = (e, id) => { e.preventDefault(); if (!draggingId || draggingId === id) { setDraggingId(null); setDragOverId(null); return; } setFields(prev => { const from = prev.findIndex(f => f.id === draggingId); const to = prev.findIndex(f => f.id === id); const next = [...prev]; const [moved] = next.splice(from, 1); next.splice(to, 0, moved); return next; }); setDraggingId(null); setDragOverId(null); };
  const tabs = ["Edit", "Settings", "Submissions", "Notifications", "Analytics"];
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-1 pb-4 flex-wrap gap-3">
        <div className="flex items-center gap-3 min-w-0"><button onClick={() => onBack(fields, formName)} className="flex items-center gap-1 text-sm shrink-0" style={{ color: T.muted, ...fontBody }}><ArrowLeft size={15} /> All Forms</button><input value={formName} onChange={e => setFormName(e.target.value)} className="text-sm font-medium px-2 py-1 rounded-md outline-none min-w-0" style={{ color: T.ink, ...fontBody, border: "1px solid transparent" }} onFocus={e => e.target.style.border = `1px solid ${T.border}`} onBlur={e => e.target.style.border = "1px solid transparent"} /></div>
        <div className="flex gap-5">{tabs.map(t => <button key={t} onClick={() => setTopTab(t.toLowerCase())} className="text-sm pb-1" style={{ ...fontBody, color: topTab === t.toLowerCase() ? T.accent : T.muted, borderBottom: topTab === t.toLowerCase() ? `2px solid ${T.accent}` : "2px solid transparent", fontWeight: topTab === t.toLowerCase() ? 600 : 400 }}>{t}</button>)}</div>
        {topTab === "edit" ? (<div className="flex gap-1 shrink-0"><button onClick={() => setDevice("desktop")} className="p-1.5 rounded-md" style={{ backgroundColor: device === "desktop" ? T.accentSoft : "transparent" }}><Monitor size={16} style={{ color: device === "desktop" ? T.accent : T.muted }} /></button><button onClick={() => setDevice("mobile")} className="p-1.5 rounded-md" style={{ backgroundColor: device === "mobile" ? T.accentSoft : "transparent" }}><Smartphone size={16} style={{ color: device === "mobile" ? T.accent : T.muted }} /></button></div>) : <div className="w-16 shrink-0" />}
      </div>
      {topTab !== "edit" ? (<div className="flex-1 rounded-xl flex items-center justify-center p-10" style={{ backgroundColor: T.surface, border: `1px solid ${T.border}` }}><p className="text-sm text-center" style={{ color: T.muted, ...fontBody }}>{topTab === "settings" && "Form settings (redirect URL, notifications email) — coming soon."}{topTab === "submissions" && "This form's submissions will show here once it's live."}{topTab === "notifications" && "Configure who gets emailed on a new submission — coming soon."}{topTab === "analytics" && "Views, completion rate, and conversion — coming soon."}</p></div>) : (
        <div className="gap-5 min-h-0" style={{ display: "flex", flexDirection: "row", flexWrap: "nowrap", flex: 1 }}>
          <div className="rounded-xl overflow-y-auto" style={{ backgroundColor: T.surface, border: `1px solid ${T.border}`, maxHeight: 640, width: 260, minWidth: 260, flexShrink: 0 }}>
            {FIELD_PALETTE.map(cat => (<div key={cat.category} className="px-3.5 py-3.5" style={{ borderBottom: `1px solid ${T.border}` }}><div className="text-[11px] font-semibold uppercase mb-2.5" style={{ color: T.muted, letterSpacing: "0.05em", ...fontBody }}>{cat.category}</div><div className="grid grid-cols-2 gap-2">{cat.fields.map(f => { const Icon = f.icon; return (<button key={f.type + f.label} draggable onDragStart={(e) => { e.dataTransfer.setData("field-type", f.type); e.dataTransfer.setData("field-label", f.label); e.dataTransfer.effectAllowed = "copy"; }} onClick={() => addField(f.type, f.label)} className="flex flex-col items-center gap-1.5 rounded-lg py-3 px-1 text-center cursor-grab active:cursor-grabbing" style={{ border: `1px solid ${T.border}`, backgroundColor: T.bg }}><Icon size={16} style={{ color: T.ink }} /><span className="text-[10.5px] leading-tight" style={{ color: T.ink, ...fontBody }}>{f.label}</span></button>); })}</div></div>))}
          </div>
          <div onDragOver={(e) => { if (e.dataTransfer.types.includes("field-type")) { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; setCanvasDragOver(true); } }} onDragLeave={() => setCanvasDragOver(false)} onDrop={(e) => { const type = e.dataTransfer.getData("field-type"); if (type) { e.preventDefault(); addField(type, e.dataTransfer.getData("field-label")); } setCanvasDragOver(false); }} className="rounded-xl overflow-y-auto p-6 transition-colors" style={{ backgroundColor: canvasDragOver ? T.accentSoft : T.bg, border: `1.5px dashed ${canvasDragOver ? T.accent : T.border}`, maxHeight: 640, flex: 1, minWidth: 0 }}>
            <div className="mx-auto rounded-2xl p-8 flex flex-col gap-5 transition-all" style={{ backgroundColor: "#fff", border: `1px solid ${T.border}`, maxWidth: device === "mobile" ? 380 : 760 }}>
              {fields.map(f => (
                <div key={f.id} draggable onDragStart={() => handleDragStart(f.id)} onDragOver={(e) => handleDragOverField(e, f.id)} onDrop={(e) => handleDropField(e, f.id)} onDragEnd={() => { setDraggingId(null); setDragOverId(null); }} className="group relative rounded-lg p-2 -m-2" style={{ opacity: draggingId === f.id ? 0.4 : 1, backgroundColor: dragOverId === f.id ? T.accentSoft : "transparent" }}>
                  <div className="absolute -top-1 right-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10"><span className="cursor-grab p-1" style={{ color: T.border }}><GripVertical size={14} /></span><button onClick={() => setEditingId(editingId === f.id ? null : f.id)} className="p-1 rounded" style={{ backgroundColor: T.surface, border: `1px solid ${T.border}` }}><Pencil size={12} style={{ color: T.muted }} /></button><button onClick={() => removeField(f.id)} className="p-1 rounded" style={{ backgroundColor: T.surface, border: `1px solid ${T.border}` }}><Trash2 size={12} style={{ color: T.danger }} /></button></div>
                  <FieldPreview field={f} currency={currency} />
                  {editingId === f.id && (<div className="mt-3 rounded-lg p-3 flex flex-col gap-2.5" style={{ backgroundColor: T.bg, border: `1px solid ${T.border}` }}><div><label className="text-[11px] block mb-1" style={{ color: T.muted, ...fontBody }}>Label</label><input value={f.label} onChange={e => updateField(f.id, { label: e.target.value })} className="w-full rounded-md px-2.5 py-1.5 text-xs outline-none" style={{ border: `1px solid ${T.border}`, ...fontBody, backgroundColor: "#fff" }} /></div>{"placeholder" in f && f.type !== "submit" && (<div><label className="text-[11px] block mb-1" style={{ color: T.muted, ...fontBody }}>Placeholder</label><input value={f.placeholder || ""} onChange={e => updateField(f.id, { placeholder: e.target.value })} className="w-full rounded-md px-2.5 py-1.5 text-xs outline-none" style={{ border: `1px solid ${T.border}`, ...fontBody, backgroundColor: "#fff" }} /></div>)}{f.options && (<div><label className="text-[11px] block mb-1" style={{ color: T.muted, ...fontBody }}>Options (one per line)</label><textarea rows={3} value={f.options.join("\n")} onChange={e => updateField(f.id, { options: e.target.value.split("\n") })} className="w-full rounded-md px-2.5 py-1.5 text-xs outline-none" style={{ border: `1px solid ${T.border}`, ...fontBody, backgroundColor: "#fff" }} /></div>)}{f.type !== "submit" && (<label className="flex items-center gap-2 text-xs" style={{ color: T.ink, ...fontBody }}><input type="checkbox" checked={!!f.required} onChange={e => updateField(f.id, { required: e.target.checked })} style={{ accentColor: T.accent }} />Required field</label>)}</div>)}
                </div>
              ))}
              {fields.length === 0 && <div className="text-center py-16 text-sm" style={{ color: T.muted, ...fontBody }}>Click a field on the left to start building your form.</div>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CreateFormModal({ onClose, onCreate }) {
  const [choice, setChoice] = useState("scratch");
  return (<div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(21,26,34,0.45)" }}><div className="w-full max-w-lg rounded-2xl p-6" style={{ backgroundColor: T.surface }}><div className="flex items-center justify-between mb-5"><h2 className="text-base font-semibold" style={{ color: T.ink, ...fontBody }}>Create new form</h2><button onClick={onClose} style={{ color: T.muted }}><X size={18} /></button></div><div className="grid grid-cols-2 gap-3 mb-6"><button onClick={() => setChoice("scratch")} className="text-left rounded-xl p-4" style={{ border: `2px solid ${choice === "scratch" ? T.accent : T.border}` }}><div className="flex items-center justify-between mb-1"><span className="text-sm font-medium" style={{ color: T.ink, ...fontBody }}>Start from Scratch</span><div className="w-3.5 h-3.5 rounded-full shrink-0" style={{ border: `1.5px solid ${choice === "scratch" ? T.accent : T.border}`, backgroundColor: choice === "scratch" ? T.accent : "transparent" }} /></div><p className="text-xs mb-3" style={{ color: T.muted, ...fontBody }}>Design from scratch using the form builder</p><div className="h-20 rounded-lg flex items-center justify-center" style={{ backgroundColor: T.bg }}><div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: T.surface, border: `1px solid ${T.border}` }}><Plus size={16} style={{ color: T.ink }} /></div></div></button><button onClick={() => setChoice("template")} className="text-left rounded-xl p-4" style={{ border: `2px solid ${choice === "template" ? T.accent : T.border}` }}><div className="flex items-center justify-between mb-1"><span className="text-sm font-medium" style={{ color: T.ink, ...fontBody }}>From Templates</span><div className="w-3.5 h-3.5 rounded-full shrink-0" style={{ border: `1.5px solid ${choice === "template" ? T.accent : T.border}`, backgroundColor: choice === "template" ? T.accent : "transparent" }} /></div><p className="text-xs mb-3" style={{ color: T.muted, ...fontBody }}>Jump start with a prebuilt form</p><div className="h-20 rounded-lg flex flex-col items-center justify-center gap-1" style={{ backgroundColor: T.accentSoft }}><LayoutTemplate size={18} style={{ color: T.accent }} /><span className="text-[10px] font-medium" style={{ color: T.accent, ...fontBody }}>Coming soon</span></div></button></div><div className="flex justify-end gap-2"><button onClick={onClose} className="px-4 py-2 rounded-lg text-sm" style={{ border: `1px solid ${T.border}`, color: T.ink, ...fontBody }}>Cancel</button><button onClick={() => onCreate(choice)} className="px-4 py-2 rounded-lg text-sm" style={{ backgroundColor: T.accent, color: "#fff", ...fontBody }}>Create</button></div></div></div>);
}

function Forms({ submissions, contacts, onConvertToCase, currency }) {
  const [tab, setTab] = useState("all");
  const [formTemplates, setFormTemplates] = useState(FORM_TEMPLATES);
  const [showCreate, setShowCreate] = useState(false);
  const [filter, setFilter] = useState("All");
  const [builderForm, setBuilderForm] = useState(null);
  const filters = ["All", "New", "Contacted", "Qualified", "Closed", "Archived"];
  const rows = filter === "All" ? submissions : submissions.filter(s => s.status === filter);
  const hasCase = (submissionId) => contacts.some(c => c.submissionId === submissionId);
  const handleCreateForm = (choice) => { setShowCreate(false); if (choice !== "scratch") return; const newForm = { id: Date.now(), name: "Untitled Form", updatedOn: "Just now", updatedBy: "—", fields: [{ id: "f1", type: "full_name", label: "Full Name", placeholder: "Enter your full name", required: true }, { id: "f2", type: "email", label: "Email", placeholder: "your@email.com", required: true }, { id: "f3", type: "submit", label: "Submit" }] }; setFormTemplates(prev => [newForm, ...prev]); setBuilderForm(newForm); };
  const handleBuilderBack = (fields, name) => { setFormTemplates(prev => prev.map(f => f.id === builderForm.id ? { ...f, fields, name, updatedOn: "Just now" } : f)); setBuilderForm(null); };
  if (builderForm) return <FormBuilderView form={builderForm} onBack={handleBuilderBack} currency={currency} />;
  const tabs = [{ id: "all", label: "All forms" }, { id: "analytics", label: "Analytics" }, { id: "submissions", label: "Submissions" }];
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between flex-wrap gap-3"><div><h1 className="text-2xl mb-1" style={{ ...fontDisplay, color: T.ink }}>Forms</h1><p className="text-sm" style={{ color: T.muted, ...fontBody }}>Build forms, then review what comes in through them.</p></div>{tab === "all" && <button onClick={() => setShowCreate(true)} className="px-4 py-2 rounded-lg text-sm flex items-center gap-1.5" style={{ backgroundColor: T.accent, color: "#fff", ...fontBody }}><Plus size={14} /> Create Form</button>}</div>
      <div className="flex gap-5 border-b" style={{ borderColor: T.border }}>{tabs.map(t => <button key={t.id} onClick={() => setTab(t.id)} className="pb-3 text-sm -mb-px" style={{ ...fontBody, color: tab === t.id ? T.ink : T.muted, borderBottom: tab === t.id ? `2px solid ${T.accent}` : "2px solid transparent", fontWeight: tab === t.id ? 600 : 400 }}>{t.label}</button>)}</div>
      {tab === "all" && (<div className="rounded-xl overflow-hidden" style={{ backgroundColor: T.surface, border: `1px solid ${T.border}` }}><table className="w-full text-sm"><thead><tr style={{ borderBottom: `1px solid ${T.border}` }}>{["Name", "Updated on", "Updated by", ""].map(h => <th key={h} className="text-left px-5 py-3 text-xs uppercase tracking-wide" style={{ color: T.muted, ...fontBody, letterSpacing: "0.05em" }}>{h}</th>)}</tr></thead><tbody>{formTemplates.map((f, i) => (<tr key={f.id} style={{ borderBottom: i < formTemplates.length - 1 ? `1px solid ${T.border}` : "none" }}><td className="px-5 py-3.5"><button onClick={() => setBuilderForm(f)} style={{ color: T.accent, ...fontBody }}>{f.name}</button></td><td className="px-5 py-3.5" style={{ color: T.muted, ...fontBody }}>{f.updatedOn}</td><td className="px-5 py-3.5" style={{ color: T.muted, ...fontBody }}>{f.updatedBy}</td><td className="px-5 py-3.5 text-right"><MoreHorizontal size={16} style={{ color: T.muted }} /></td></tr>))}{formTemplates.length === 0 && <tr><td colSpan={4} className="px-5 py-8 text-center text-sm" style={{ color: T.muted, ...fontBody }}>No forms yet — create your first one.</td></tr>}</tbody></table></div>)}
      {tab === "analytics" && <div className="rounded-xl p-10 text-center" style={{ backgroundColor: T.surface, border: `1px solid ${T.border}` }}><p className="text-sm" style={{ color: T.muted, ...fontBody }}>Form analytics (views, completion rate, conversion) — coming soon.</p></div>}
      {tab === "submissions" && (<><div className="flex gap-2 flex-wrap">{filters.map(f => <button key={f} onClick={() => setFilter(f)} className="px-3 py-1.5 rounded-full text-xs" style={{ ...fontBody, backgroundColor: filter === f ? T.ink : T.surface, color: filter === f ? "#fff" : T.muted, border: `1px solid ${filter === f ? T.ink : T.border}` }}>{f}</button>)}</div><div className="rounded-xl overflow-hidden" style={{ backgroundColor: T.surface, border: `1px solid ${T.border}` }}><table className="w-full text-sm"><thead><tr style={{ borderBottom: `1px solid ${T.border}` }}>{["Name", "Email", "Type", "Date", "Status", "Actions"].map(h => <th key={h} className="text-left px-5 py-3 text-xs uppercase tracking-wide" style={{ color: T.muted, ...fontBody, letterSpacing: "0.05em" }}>{h}</th>)}</tr></thead><tbody>{rows.map((r, i) => (<tr key={r.id} style={{ borderBottom: i < rows.length - 1 ? `1px solid ${T.border}` : "none" }}><td className="px-5 py-3" style={{ color: T.ink, ...fontBody }}>{r.name}</td><td className="px-5 py-3" style={{ color: T.muted, ...fontBody }}>{r.email}</td><td className="px-5 py-3" style={{ color: T.ink, ...fontBody }}>{r.type}</td><td className="px-5 py-3" style={{ ...fontMono, color: T.muted }}>{r.date}</td><td className="px-5 py-3"><Badge status={r.status} /></td><td className="px-5 py-3"><div className="flex items-center gap-3"><a href={`mailto:${r.email}?subject=Re: your inquiry with Air Fair Travel & Immigration`} title="Send email" style={{ color: T.muted }}><Mail size={16} /></a>{hasCase(r.id) ? <span className="text-xs px-2 py-1 rounded-md" style={{ backgroundColor: T.accentSoft, color: T.accent, ...fontBody }}>In Pipeline</span> : <button onClick={() => onConvertToCase(r)} title="Add to pipeline as New Lead" className="text-xs px-2 py-1 rounded-md flex items-center gap-1" style={{ backgroundColor: T.bg, color: T.ink, border: `1px solid ${T.border}`, ...fontBody }}><UserPlus size={13} /> Add to Pipeline</button>}</div></td></tr>))}{rows.length === 0 && <tr><td colSpan={6} className="px-5 py-8 text-center text-sm" style={{ color: T.muted, ...fontBody }}>No submissions with this status.</td></tr>}</tbody></table></div></>)}
      {showCreate && <CreateFormModal onClose={() => setShowCreate(false)} onCreate={handleCreateForm} />}
    </div>
  );
}

function Contacts({ contacts, setContacts, bookings, employees, onStageChange, stages, categories, currency }) {
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [editingAmountId, setEditingAmountId] = useState(null);
  const [draftAmount, setDraftAmount] = useState("");
  const [draggingId, setDraggingId] = useState(null);
  const [dragOverStatus, setDragOverStatus] = useState(null);
  const rows = categoryFilter === "All" ? contacts : contacts.filter(c => c.category === categoryFilter);
  const linkedBooking = (contactId) => bookings.find(b => b.contactId === contactId);
  const employeeById = (id) => employees.find(e => e.id === id);
  const setStatus = (contactId, status) => { const contact = contacts.find(c => c.id === contactId); if (!contact || contact.status === status) return; setContacts(prev => prev.map(c => c.id === contactId ? { ...c, status } : c)); onStageChange(contact, status); };
  const setAssignee = (contactId, employeeId) => { setContacts(prev => prev.map(c => c.id === contactId ? { ...c, assignedEmployeeId: employeeId } : c)); };
  const nudgeStatus = (contact, dir) => { const idx = stages.indexOf(contact.status); const next = stages[Math.min(Math.max(idx + dir, 0), stages.length - 1)]; setStatus(contact.id, next); };
  const startAmount = (c) => { setEditingAmountId(c.id); setDraftAmount(c.amount ? String(c.amount) : ""); };
  const confirmAmount = (id) => { const amt = Number(draftAmount) || 0; setContacts(prev => prev.map(c => c.id === id ? { ...c, amount: amt } : c)); setEditingAmountId(null); };
  const handleDragStart = (e, contactId) => { setDraggingId(contactId); e.dataTransfer.setData("text/plain", String(contactId)); e.dataTransfer.effectAllowed = "move"; };
  const handleDragEnd = () => { setDraggingId(null); setDragOverStatus(null); };
  const handleColumnDragOver = (e, status) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; if (dragOverStatus !== status) setDragOverStatus(status); };
  const handleColumnDrop = (e, status) => { e.preventDefault(); const id = e.dataTransfer.getData("text/plain"); if (id) setStatus(id, status); setDraggingId(null); setDragOverStatus(null); };
  const columnTotals = stages.map(status => { const items = rows.filter(c => c.status === status); return { status, count: items.length, amount: items.reduce((sum, c) => sum + (c.amount || 0), 0) }; });
  return (
    <div className="flex flex-col gap-6">
      <div><h1 className="text-2xl mb-1" style={{ ...fontDisplay, color: T.ink }}>Pipeline</h1><p className="text-sm" style={{ color: T.muted, ...fontBody }}>Drag a card to move a client through the pipeline. Moving stages auto-assigns tasks to whoever's handling the case.</p></div>
      <div className="flex gap-2 flex-wrap">{["All", ...categories].map(c => <button key={c} onClick={() => setCategoryFilter(c)} className="px-3 py-1.5 rounded-full text-xs" style={{ ...fontBody, backgroundColor: categoryFilter === c ? T.ink : T.surface, color: categoryFilter === c ? "#fff" : T.muted, border: `1px solid ${categoryFilter === c ? T.ink : T.border}` }}>{c}</button>)}</div>
      <div className="flex gap-4 overflow-x-auto pb-2">
        {stages.map(status => { const items = rows.filter(c => c.status === status); const totals = columnTotals.find(t => t.status === status); const isOver = dragOverStatus === status; return (
          <div key={status} onDragOver={(e) => handleColumnDragOver(e, status)} onDragLeave={() => setDragOverStatus(prev => (prev === status ? null : prev))} onDrop={(e) => handleColumnDrop(e, status)} className="flex flex-col rounded-2xl shrink-0" style={{ width: 270, backgroundColor: isOver ? T.accentSoft : T.bg, border: `1.5px dashed ${isOver ? T.accent : T.border}`, transition: "background-color 120ms, border-color 120ms" }}>
            <div className="px-4 pt-4 pb-3 flex items-center justify-between"><div className="flex items-center gap-2"><StageBadge stage={status} stages={stages} /><span className="text-xs" style={{ color: T.muted, ...fontBody }}>{totals.count}</span></div>{totals.amount > 0 && <span className="text-xs" style={{ ...fontMono, color: T.muted }}>{currency}{totals.amount.toLocaleString()}</span>}</div>
            <div className="flex flex-col gap-2 px-3 pb-3 min-h-[80px]">
              {items.map(c => { const booking = linkedBooking(c.id); const idx = stages.indexOf(c.status); const assignee = employeeById(c.assignedEmployeeId); return (
                <div key={c.id} draggable onDragStart={(e) => handleDragStart(e, c.id)} onDragEnd={handleDragEnd} className="rounded-xl p-3 cursor-grab active:cursor-grabbing" style={{ backgroundColor: T.surface, border: `1px solid ${T.border}`, opacity: draggingId === c.id ? 0.4 : 1 }}>
                  <div className="flex items-start justify-between gap-2 mb-1.5"><div className="text-sm" style={{ color: T.ink, ...fontBody }}>{c.name}</div><GripVertical size={13} style={{ color: T.border }} className="shrink-0 mt-0.5" /></div>
                  <div className="text-xs mb-2" style={{ color: T.muted, ...fontBody }}>{c.email}</div>
                  <div className="mb-2"><CategoryTag category={c.category} categories={categories} /></div>
                  <div className="text-xs mb-2" style={{ color: T.muted, ...fontBody }}>{booking ? <>{booking.date} · {booking.time}</> : "No meeting scheduled"}</div>
                  {editingAmountId === c.id ? (<div className="flex items-center gap-1.5 mb-2"><span className="text-xs" style={{ color: T.muted, ...fontBody }}>{currency}</span><input autoFocus value={draftAmount} onChange={e => setDraftAmount(e.target.value)} className="w-16 rounded-md px-1.5 py-1 text-xs outline-none" style={{ border: `1px solid ${T.border}`, ...fontMono, color: T.ink }} /><button onClick={() => confirmAmount(c.id)} className="px-2 py-1 rounded-md text-xs" style={{ backgroundColor: T.accent, color: "#fff", ...fontBody }}><Check size={11} /></button></div>) : (<button onClick={() => startAmount(c)} className="text-xs block mb-2" style={{ ...fontMono, color: c.amount ? T.ink : T.muted }}>{c.amount ? `${currency}${c.amount.toLocaleString()}` : "Set amount"}</button>)}
                  <div className="flex items-center gap-1.5 mb-2">{assignee ? <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] shrink-0" style={{ backgroundColor: T.accent, color: "#fff", ...fontBody }}>{assignee.name.split(" ").map(p => p[0]).join("").slice(0, 2).toUpperCase()}</div> : <UserCog size={14} style={{ color: T.border }} className="shrink-0" />}<select value={c.assignedEmployeeId ?? ""} onChange={e => setAssignee(c.id, e.target.value ? Number(e.target.value) : null)} className="text-xs flex-1 min-w-0 rounded-md px-1.5 py-1 outline-none" style={{ border: `1px solid ${T.border}`, color: assignee ? T.ink : T.muted, ...fontBody, backgroundColor: T.bg }}><option value="">Unassigned</option>{employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}</select></div>
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

function ClientsDirectory({ contacts, bookings, goTo, categories, stages, currency }) {
  const [query, setQuery] = useState("");
  const linkedBooking = (contactId) => bookings.find(b => b.contactId === contactId);
  const rows = contacts.filter(c => c.name.toLowerCase().includes(query.toLowerCase()) || c.email.toLowerCase().includes(query.toLowerCase()));
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between flex-wrap gap-3"><div><h1 className="text-2xl mb-1" style={{ ...fontDisplay, color: T.ink }}>Clients</h1><p className="text-sm" style={{ color: T.muted, ...fontBody }}>Every client on file. Open Pipeline to move their case forward.</p></div><button onClick={() => goTo("pipeline")} className="text-sm px-4 py-2 rounded-lg flex items-center gap-1.5" style={{ backgroundColor: T.accentSoft, color: T.accent, ...fontBody }}><Users size={15} /> Open Pipeline</button></div>
      <div className="relative max-w-sm"><Search size={15} style={{ color: T.muted, position: "absolute", left: 12, top: 11 }} /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search by name or email" className="w-full rounded-lg pl-9 pr-3 py-2 text-sm outline-none" style={{ border: `1px solid ${T.border}`, backgroundColor: T.surface, color: T.ink, ...fontBody }} /></div>
      <div className="rounded-xl overflow-hidden" style={{ backgroundColor: T.surface, border: `1px solid ${T.border}` }}><table className="w-full text-sm"><thead><tr style={{ borderBottom: `1px solid ${T.border}` }}>{["Name", "Email", "Category", "Stage", "Amount", "Next Meeting"].map(h => <th key={h} className="text-left px-5 py-3 text-xs uppercase tracking-wide" style={{ color: T.muted, ...fontBody, letterSpacing: "0.05em" }}>{h}</th>)}</tr></thead><tbody>{rows.map((c, i) => { const booking = linkedBooking(c.id); return (<tr key={c.id} style={{ borderBottom: i < rows.length - 1 ? `1px solid ${T.border}` : "none" }}><td className="px-5 py-3" style={{ color: T.ink, ...fontBody }}>{c.name}</td><td className="px-5 py-3" style={{ color: T.muted, ...fontBody }}>{c.email}</td><td className="px-5 py-3"><CategoryTag category={c.category} categories={categories} /></td><td className="px-5 py-3"><StageBadge stage={c.status} stages={stages} /></td><td className="px-5 py-3" style={{ ...fontMono, color: c.amount ? T.ink : T.muted }}>{c.amount ? `${currency}${c.amount.toLocaleString()}` : "—"}</td><td className="px-5 py-3" style={{ color: T.muted, ...fontBody }}>{booking ? `${booking.date} · ${booking.time}` : "—"}</td></tr>); })}{rows.length === 0 && <tr><td colSpan={6} className="px-5 py-8 text-center text-sm" style={{ color: T.muted, ...fontBody }}>No contacts match "{query}".</td></tr>}</tbody></table></div>
    </div>
  );
}

function Employees({ employees, setEmployees, tasks, setTasks, stageTasks, setStageTasks, stages }) {
  const [activeId, setActiveId] = useState(employees[0]?.id ?? null);
  const [addingEmployee, setAddingEmployee] = useState(false);
  const [draft, setDraft] = useState({ name: "", email: "", role: "", password: "", confirmPassword: "" });
  const [addError, setAddError] = useState("");
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDue, setNewTaskDue] = useState("");
  const [pickerStage, setPickerStage] = useState(stages[0]);
  const [checkedTemplateIds, setCheckedTemplateIds] = useState([]);
  const [newTemplateTitle, setNewTemplateTitle] = useState("");
  const active = employees.find(e => e.id === activeId);
  const activeTasks = tasks.filter(t => t.employeeId === activeId);
  const stageTemplates = stageTasks.filter(t => t.stage === pickerStage);
  const openAdd = () => { setAddingEmployee(true); setActiveId(null); setAddError(""); setDraft({ name: "", email: "", role: "", password: "", confirmPassword: "" }); };
  const selectEmployee = (id) => { setActiveId(id); setAddingEmployee(false); setCheckedTemplateIds([]); };
  const saveEmployee = () => { if (!draft.name.trim() || !draft.email.trim()) { setAddError("Name and email are required."); return; } if (!draft.password || draft.password.length < 8) { setAddError("Set a password of at least 8 characters — you'll share this with them directly."); return; } if (draft.password !== draft.confirmPassword) { setAddError("Passwords don't match."); return; } setAddError(""); const id = Date.now(); const { password, confirmPassword, ...employeeRecord } = draft; setEmployees(prev => [...prev, { id, ...employeeRecord, allowedModules: { ...DEFAULT_EMPLOYEE_ACCESS } }]); setAddingEmployee(false); setActiveId(id); };
  const toggleAccess = (employeeId, moduleKey) => { setEmployees(prev => prev.map(e => e.id === employeeId ? { ...e, allowedModules: { ...(e.allowedModules || DEFAULT_EMPLOYEE_ACCESS), [moduleKey]: !((e.allowedModules || DEFAULT_EMPLOYEE_ACCESS)[moduleKey]) } } : e)); };
  const addTask = () => { if (!newTaskTitle.trim() || !activeId) return; setTasks(prev => [...prev, { id: Date.now(), employeeId: activeId, title: newTaskTitle, due: newTaskDue || "No due date", done: false }]); setNewTaskTitle(""); setNewTaskDue(""); };
  const toggleTask = (taskId) => { setTasks(prev => prev.map(t => t.id === taskId ? { ...t, done: !t.done } : t)); };
  const toggleTemplateChecked = (id) => { setCheckedTemplateIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]); };
  const addNewTemplate = () => { if (!newTemplateTitle.trim()) return; setStageTasks(prev => [...prev, { id: Date.now(), stage: pickerStage, title: newTemplateTitle }]); setNewTemplateTitle(""); };
  const addSelectedTemplateTasks = () => { if (!activeId || checkedTemplateIds.length === 0) return; const toAdd = stageTasks.filter(t => checkedTemplateIds.includes(t.id)); const newTasks = toAdd.map((t, i) => ({ id: Date.now() + i, employeeId: activeId, title: t.title, due: "TBD", done: false })); setTasks(prev => [...prev, ...newTasks]); setCheckedTemplateIds([]); };
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between flex-wrap gap-3"><div><h1 className="text-2xl mb-1" style={{ ...fontDisplay, color: T.ink }}>Employees</h1><p className="text-sm" style={{ color: T.muted, ...fontBody }}>Your internal team and the tasks assigned to each of them.</p></div><button onClick={openAdd} className="px-4 py-2 rounded-lg text-sm flex items-center gap-1.5" style={{ backgroundColor: T.accent, color: "#fff", ...fontBody }}><Plus size={14} /> Add Employee</button></div>
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-2 rounded-xl overflow-hidden" style={{ backgroundColor: T.surface, border: `1px solid ${T.border}` }}>
          {employees.map((e, i) => { const count = tasks.filter(t => t.employeeId === e.id && !t.done).length; return (<button key={e.id} onClick={() => selectEmployee(e.id)} className="w-full flex items-center gap-3 px-5 py-4 text-left" style={{ borderBottom: i < employees.length - 1 ? `1px solid ${T.border}` : "none", backgroundColor: activeId === e.id ? T.accentSoft : "transparent" }}><div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-xs" style={{ backgroundColor: T.accent, color: "#fff", ...fontBody }}>{e.name.split(" ").map(p => p[0]).join("").slice(0, 2).toUpperCase()}</div><div className="flex-1 min-w-0"><div className="text-sm truncate" style={{ color: T.ink, ...fontBody }}>{e.name}</div><div className="text-xs truncate" style={{ color: T.muted, ...fontBody }}>{e.role}</div></div>{count > 0 && <span className="text-xs px-2 py-0.5 rounded-full shrink-0" style={{ backgroundColor: T.warnSoft, color: T.warn, ...fontBody }}>{count}</span>}</button>); })}
          {employees.length === 0 && <div className="px-5 py-10 text-center text-sm" style={{ color: T.muted, ...fontBody }}>No employees yet.</div>}
        </div>
        <div className="lg:col-span-3 rounded-xl" style={{ backgroundColor: T.surface, border: `1px solid ${T.border}` }}>
          {addingEmployee ? (
            <div className="p-5 flex flex-col gap-4"><div className="flex items-center justify-between"><span className="text-sm font-medium" style={{ color: T.ink, ...fontBody }}>New Employee</span><button onClick={() => setAddingEmployee(false)} style={{ color: T.muted }}><X size={16} /></button></div>{[{ key: "name", label: "Full Name" }, { key: "email", label: "Email (their login)" }, { key: "role", label: "Role (e.g. Visa Officer)" }].map(f => (<div key={f.key}><label className="text-xs block mb-1.5" style={{ color: T.muted, ...fontBody }}>{f.label}</label><input value={draft[f.key]} onChange={e => setDraft(prev => ({ ...prev, [f.key]: e.target.value }))} className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={{ border: `1px solid ${T.border}`, color: T.ink, ...fontBody, backgroundColor: T.bg }} /></div>))}<div className="pt-2" style={{ borderTop: `1px solid ${T.border}` }}><p className="text-xs mb-3" style={{ color: T.muted, ...fontBody }}>No email invites are set up yet, so set their password here and share it with them yourself — they can change it after logging in.</p><div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><div><label className="text-xs block mb-1.5" style={{ color: T.muted, ...fontBody }}>Set Password</label><input type="password" value={draft.password} onChange={e => setDraft(prev => ({ ...prev, password: e.target.value }))} className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={{ border: `1px solid ${T.border}`, color: T.ink, ...fontBody, backgroundColor: T.bg }} /></div><div><label className="text-xs block mb-1.5" style={{ color: T.muted, ...fontBody }}>Confirm Password</label><input type="password" value={draft.confirmPassword} onChange={e => setDraft(prev => ({ ...prev, confirmPassword: e.target.value }))} className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={{ border: `1px solid ${T.border}`, color: T.ink, ...fontBody, backgroundColor: T.bg }} /></div></div></div>{addError && <div className="text-xs" style={{ color: T.danger, ...fontBody }}>{addError}</div>}<button onClick={saveEmployee} className="mt-2 px-4 py-2 rounded-lg text-sm" style={{ backgroundColor: T.accent, color: "#fff", ...fontBody }}>Save Employee</button></div>
          ) : !active ? (
            <div className="h-full flex items-center justify-center text-center px-8 py-16"><p className="text-sm" style={{ color: T.muted, ...fontBody }}>Select an employee to view their tasks.</p></div>
          ) : (
            <div className="p-5 flex flex-col gap-5">
              <div><span className="text-sm font-medium" style={{ color: T.ink, ...fontBody }}>{active.name}'s Tasks</span><div className="text-xs mt-0.5" style={{ color: T.muted, ...fontBody }}>{active.email} · {active.role}</div></div>
              <div className="rounded-lg p-3" style={{ border: `1px solid ${T.border}`, backgroundColor: T.bg }}><div className="flex items-center gap-1.5 mb-0.5"><UserCog size={13} style={{ color: T.muted }} /><span className="text-xs font-medium" style={{ color: T.ink, ...fontBody }}>Dashboard Access</span></div><p className="text-[11px] mb-2.5" style={{ color: T.muted, ...fontBody }}>What {active.name.split(" ")[0]} can see once they log in. Only you can change this.</p><div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">{ALL_MODULES.map(m => { const checked = !!(active.allowedModules || DEFAULT_EMPLOYEE_ACCESS)[m.key]; return (<label key={m.key} className="flex items-center gap-1.5 text-xs cursor-pointer" style={{ color: T.ink, ...fontBody }}><input type="checkbox" checked={checked} onChange={() => toggleAccess(active.id, m.key)} style={{ accentColor: T.accent }} />{m.label}</label>); })}</div></div>
              <div className="flex flex-col gap-2">{activeTasks.map(t => (<div key={t.id} className="flex items-start gap-3 px-3 py-2.5 rounded-lg" style={{ border: `1px solid ${T.border}` }}><button onClick={() => toggleTask(t.id)} className="mt-0.5 shrink-0"><div className="w-4 h-4 rounded flex items-center justify-center" style={{ border: `1.5px solid ${t.done ? T.accent : T.border}`, backgroundColor: t.done ? T.accent : "transparent" }}>{t.done && <Check size={11} color="#fff" />}</div></button><div className="flex-1 min-w-0"><div className="text-sm" style={{ color: t.done ? T.muted : T.ink, textDecoration: t.done ? "line-through" : "none", ...fontBody }}>{t.title}</div><div className="text-xs mt-0.5" style={{ color: T.muted, ...fontBody }}>Due {t.due}</div></div></div>))}{activeTasks.length === 0 && <div className="text-xs text-center py-6" style={{ color: T.muted, ...fontBody }}>No tasks assigned yet.</div>}</div>
              <div className="pt-4 flex flex-col gap-3" style={{ borderTop: `1px solid ${T.border}` }}><label className="text-xs font-medium" style={{ color: T.ink, ...fontBody }}>Add Pipeline Task</label><div className="flex gap-1.5 flex-wrap">{stages.map(stage => <button key={stage} onClick={() => { setPickerStage(stage); setCheckedTemplateIds([]); }} className="px-2.5 py-1 rounded-full text-xs" style={{ ...fontBody, backgroundColor: pickerStage === stage ? T.ink : T.bg, color: pickerStage === stage ? "#fff" : T.muted, border: `1px solid ${pickerStage === stage ? T.ink : T.border}` }}>{stage}</button>)}</div><div className="flex flex-col gap-1.5">{stageTemplates.map(t => <label key={t.id} className="flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer" style={{ border: `1px solid ${T.border}`, backgroundColor: T.bg }}><input type="checkbox" checked={checkedTemplateIds.includes(t.id)} onChange={() => toggleTemplateChecked(t.id)} className="w-4 h-4 shrink-0" style={{ accentColor: T.accent }} /><span className="text-sm flex-1" style={{ color: T.ink, ...fontBody }}>{t.title}</span></label>)}{stageTemplates.length === 0 && <div className="text-xs px-3 py-2" style={{ color: T.muted, ...fontBody }}>No tasks defined for this stage yet — add one below.</div>}</div><div className="flex gap-2"><input value={newTemplateTitle} onChange={e => setNewTemplateTitle(e.target.value)} placeholder={`New task for "${pickerStage}"`} className="flex-1 rounded-lg px-3 py-2 text-sm outline-none" style={{ border: `1px solid ${T.border}`, color: T.ink, ...fontBody, backgroundColor: T.bg }} /><button onClick={addNewTemplate} className="px-3 py-2 rounded-lg text-sm" style={{ backgroundColor: T.surface, color: T.ink, border: `1px solid ${T.border}`, ...fontBody }}><Plus size={14} /></button></div><button onClick={addSelectedTemplateTasks} disabled={checkedTemplateIds.length === 0} className="px-4 py-2 rounded-lg text-sm flex items-center justify-center gap-1.5" style={{ backgroundColor: checkedTemplateIds.length === 0 ? T.border : T.accent, color: checkedTemplateIds.length === 0 ? T.muted : "#fff", ...fontBody }}><ListChecks size={14} /> Add {checkedTemplateIds.length > 0 ? `${checkedTemplateIds.length} Task${checkedTemplateIds.length > 1 ? "s" : ""}` : "Selected Tasks"}</button></div>
              <div className="pt-4 flex flex-col gap-2" style={{ borderTop: `1px solid ${T.border}` }}><label className="text-xs" style={{ color: T.muted, ...fontBody }}>Or assign a one-off task</label><div className="flex gap-2 flex-wrap"><input value={newTaskTitle} onChange={e => setNewTaskTitle(e.target.value)} placeholder="Task description" className="flex-1 min-w-[160px] rounded-lg px-3 py-2 text-sm outline-none" style={{ border: `1px solid ${T.border}`, color: T.ink, ...fontBody, backgroundColor: T.bg }} /><input value={newTaskDue} onChange={e => setNewTaskDue(e.target.value)} placeholder="Due (e.g. Aug 29)" className="w-32 rounded-lg px-3 py-2 text-sm outline-none" style={{ border: `1px solid ${T.border}`, color: T.ink, ...fontBody, backgroundColor: T.bg }} /><button onClick={addTask} className="px-4 py-2 rounded-lg text-sm" style={{ backgroundColor: T.surface, color: T.ink, border: `1px solid ${T.border}`, ...fontBody }}>Assign</button></div></div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Bookings({ bookings }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between"><div><h1 className="text-2xl mb-1" style={{ ...fontDisplay, color: T.ink }}>Calendar</h1><p className="text-sm" style={{ color: T.muted, ...fontBody }}>Scheduled meetings with clients.</p></div><button className="px-4 py-2 rounded-lg text-sm flex items-center gap-1.5" style={{ backgroundColor: T.accent, color: "#fff", ...fontBody }}><Plus size={14} /> Add Booking</button></div>
      <div className="rounded-xl overflow-hidden" style={{ backgroundColor: T.surface, border: `1px solid ${T.border}` }}>{bookings.map((b, i) => (<div key={b.id} className="flex items-center justify-between px-5 py-4" style={{ borderBottom: i < bookings.length - 1 ? `1px solid ${T.border}` : "none" }}><div className="flex items-center gap-4"><div className="w-11 h-11 rounded-lg flex flex-col items-center justify-center" style={{ backgroundColor: T.accentSoft }}><Clock size={16} style={{ color: T.accent }} /></div><div><div className="text-sm" style={{ color: T.ink, ...fontBody }}>{b.name}</div><div className="text-xs" style={{ color: T.muted, ...fontBody }}>{b.purpose}</div></div></div><div className="flex items-center gap-6"><span className="text-sm" style={{ ...fontMono, color: T.ink }}>{b.date} · {b.time}</span><Badge status={b.status} /></div></div>))}{bookings.length === 0 && <div className="px-5 py-10 text-center text-sm" style={{ color: T.muted, ...fontBody }}>No bookings yet.</div>}</div>
      <div className="rounded-xl p-5 text-sm" style={{ backgroundColor: T.infoSoft, color: T.info, ...fontBody, border: `1px solid ${T.border}` }}>No calendar connected yet. Meetings are scheduled here manually until you connect Google Calendar or Cal.com in Settings → Integrations.</div>
    </div>
  );
}

function Media() {
  return (<div className="flex flex-col gap-6"><div className="flex items-center justify-between"><div><h1 className="text-2xl mb-1" style={{ ...fontDisplay, color: T.ink }}>Media</h1><p className="text-sm" style={{ color: T.muted, ...fontBody }}>Images used across your website.</p></div><button className="px-4 py-2 rounded-lg text-sm flex items-center gap-1.5" style={{ backgroundColor: T.accent, color: "#fff", ...fontBody }}><Upload size={14} /> Upload</button></div><div className="grid grid-cols-2 sm:grid-cols-4 gap-4">{MEDIA.map(m => <div key={m.id} className="rounded-xl overflow-hidden group relative" style={{ border: `1px solid ${T.border}` }}><img src={m.url} alt="" className="w-full h-32 object-cover" /></div>)}</div></div>);
}

function Settings({ pipelineStages, setPipelineStages, currency, setCurrency, modules, setModules, chatWidgetCode, setChatWidgetCode, settings, onSaveSettings }) {
  const [tab, setTab] = useState("Business");
  const tabs = ["Business", "Branding", "Social", "SEO", "Pipeline", "Modules", "Integrations"];
  const [newStageName, setNewStageName] = useState("");
  const [form, setForm] = useState(null);
  const [savedFlash, setSavedFlash] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (settings) {
      setForm({
        business_name: settings.business_name || "",
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
      });
    }
  }, [settings]);

  const update = (key, val) => setForm(prev => ({ ...prev, [key]: val }));

  const handleSave = async () => {
    if (!form) return;
    setSaving(true); setSavedFlash(false);
    try {
      await onSaveSettings(form);
      setSavedFlash(true); setTimeout(() => setSavedFlash(false), 1800);
    } catch (err) {
    } finally { setSaving(false); }
  };

  const Field = ({ label, fieldKey, placeholder }) => form ? (
    <div>
      <label className="text-xs block mb-1.5" style={{ color: T.muted, ...fontBody }}>{label}</label>
      <input value={form[fieldKey] || ""} onChange={e => update(fieldKey, e.target.value)} placeholder={placeholder} className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={{ border: `1px solid ${T.border}`, color: T.ink, ...fontBody, backgroundColor: T.bg }} />
    </div>
  ) : null;

  const addStage = () => { if (!newStageName.trim() || pipelineStages.includes(newStageName.trim())) return; setPipelineStages(prev => [...prev, newStageName.trim()]); setNewStageName(""); };
  const removeStage = (stage) => { if (pipelineStages.length <= 2) return; setPipelineStages(prev => prev.filter(s => s !== stage)); };
  const renameStage = (oldName, newName) => { setPipelineStages(prev => prev.map(s => s === oldName ? newName : s)); };
  const moveStage = (index, dir) => { setPipelineStages(prev => { const next = [...prev]; const target = index + dir; if (target < 0 || target >= next.length) return prev; [next[index], next[target]] = [next[target], next[index]]; return next; }); };
  const MODULE_INFO = [{ key: "pipeline", label: "Pipeline", desc: "Kanban board for tracking leads through your sales stages." }, { key: "bookings", label: "Calendar", desc: "Scheduled meetings/appointments with clients." }, { key: "employees", label: "Employees", desc: "Internal staff, task assignment, and pipeline automation." }, { key: "services", label: "Catalog", desc: "Manage the products, services, and packages you offer clients." }];
  return (
    <div className="flex flex-col gap-6">
      <div><h1 className="text-2xl mb-1" style={{ ...fontDisplay, color: T.ink }}>Settings</h1><p className="text-sm" style={{ color: T.muted, ...fontBody }}>Business info, branding, and site-wide details.</p></div>
      <div className="flex gap-1 border-b flex-wrap" style={{ borderColor: T.border }}>{tabs.map(t => <button key={t} onClick={() => setTab(t)} className="px-4 py-2 text-sm -mb-px" style={{ ...fontBody, color: tab === t ? T.ink : T.muted, borderBottom: tab === t ? `2px solid ${T.accent}` : "2px solid transparent", fontWeight: tab === t ? 500 : 400 }}>{t}</button>)}</div>
      <div className="rounded-xl p-6 max-w-xl" style={{ backgroundColor: T.surface, border: `1px solid ${T.border}` }}>
        {!form ? <div className="text-sm" style={{ color: T.muted, ...fontBody }}>Loading settings...</div> : (<>
        {tab === "Business" && (<div className="flex flex-col gap-4"><Field label="Business Name" fieldKey="business_name" /><Field label="Email" fieldKey="contact_email" /><Field label="Phone" fieldKey="contact_phone" /><Field label="Address" fieldKey="address" /><div><label className="text-xs block mb-1.5" style={{ color: T.muted, ...fontBody }}>Currency Symbol</label><input value={form.currency_symbol || ""} onChange={e => update("currency_symbol", e.target.value)} className="w-20 rounded-lg px-3 py-2 text-sm outline-none text-center" style={{ border: `1px solid ${T.border}`, color: T.ink, ...fontBody, backgroundColor: T.bg }} /><p className="text-xs mt-1.5" style={{ color: T.muted, ...fontBody }}>Used across Pipeline, Clients, and form Monetary fields.</p></div></div>)}
        {tab === "Branding" && (<div className="flex flex-col gap-4"><div className="flex gap-4"><div className="flex-1"><label className="text-xs block mb-1.5" style={{ color: T.muted, ...fontBody }}>Primary Color</label><div className="flex items-center gap-2"><div className="w-9 h-9 rounded-lg" style={{ backgroundColor: T.accent, border: `1px solid ${T.border}` }} /><span className="text-sm" style={{ ...fontMono, color: T.ink }}>#6EBE3D</span></div></div><div className="flex-1"><label className="text-xs block mb-1.5" style={{ color: T.muted, ...fontBody }}>Accent Color</label><div className="flex items-center gap-2"><div className="w-9 h-9 rounded-lg" style={{ backgroundColor: T.warn, border: `1px solid ${T.border}` }} /><span className="text-sm" style={{ ...fontMono, color: T.ink }}>#E08A2C</span></div></div></div><Field label="Logo" fieldKey="logo_url" placeholder="Upload logo file" /></div>)}
        {tab === "Social" && (<div className="flex flex-col gap-4"><Field label="Facebook" fieldKey="facebook_url" placeholder="facebook.com/yourpage" /><Field label="Instagram" fieldKey="instagram_url" placeholder="instagram.com/yourpage" /><Field label="LinkedIn" fieldKey="linkedin_url" placeholder="linkedin.com/company/yourpage" /></div>)}
        {tab === "SEO" && (<div className="flex flex-col gap-4"><Field label="Site Title" fieldKey="seo_title" /><Field label="Meta Description" fieldKey="seo_description" /></div>)}
        {tab === "Pipeline" && (<div className="flex flex-col gap-4"><p className="text-xs" style={{ color: T.muted, ...fontBody }}>These stages appear as columns in the Pipeline board, in this order. Every business's sales process is different — rename, reorder, add, or remove stages to match yours.</p><div className="flex flex-col gap-2">{pipelineStages.map((stage, i) => (<div key={stage} className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ border: `1px solid ${T.border}`, backgroundColor: T.bg }}><div className="flex flex-col"><button onClick={() => moveStage(i, -1)} disabled={i === 0} style={{ color: i === 0 ? T.border : T.muted }}><ChevronRight size={12} style={{ transform: "rotate(-90deg)" }} /></button><button onClick={() => moveStage(i, 1)} disabled={i === pipelineStages.length - 1} style={{ color: i === pipelineStages.length - 1 ? T.border : T.muted }}><ChevronRight size={12} style={{ transform: "rotate(90deg)" }} /></button></div><input value={stage} onChange={e => renameStage(stage, e.target.value)} className="flex-1 text-sm outline-none bg-transparent" style={{ color: T.ink, ...fontBody }} /><button onClick={() => removeStage(stage)} disabled={pipelineStages.length <= 2} style={{ color: pipelineStages.length <= 2 ? T.border : T.danger }}><Trash2 size={14} /></button></div>))}</div><div className="flex gap-2 pt-2"><input value={newStageName} onChange={e => setNewStageName(e.target.value)} placeholder="New stage name" className="flex-1 rounded-lg px-3 py-2 text-sm outline-none" style={{ border: `1px solid ${T.border}`, color: T.ink, ...fontBody, backgroundColor: T.bg }} /><button onClick={addStage} className="px-4 py-2 rounded-lg text-sm flex items-center gap-1.5" style={{ backgroundColor: T.accent, color: "#fff", ...fontBody }}><Plus size={14} /> Add Stage</button></div></div>)}
        {tab === "Modules" && (<div className="flex flex-col gap-4"><p className="text-xs" style={{ color: T.muted, ...fontBody }}>Turn off anything this business doesn't need — hidden modules disappear from the sidebar entirely.</p>{MODULE_INFO.map(m => (<label key={m.key} className="flex items-start gap-3 px-3 py-3 rounded-lg cursor-pointer" style={{ border: `1px solid ${T.border}`, backgroundColor: T.bg }}><input type="checkbox" checked={!!modules[m.key]} onChange={e => setModules(prev => ({ ...prev, [m.key]: e.target.checked }))} className="mt-0.5" style={{ accentColor: T.accent }} /><div><div className="text-sm" style={{ color: T.ink, ...fontBody, fontWeight: 500 }}>{m.label}</div><div className="text-xs mt-0.5" style={{ color: T.muted, ...fontBody }}>{m.desc}</div></div></label>))}</div>)}
        {tab === "Integrations" && (<div className="flex flex-col gap-4"><div><h3 className="text-sm font-medium mb-1" style={{ color: T.ink, ...fontBody }}>Chat Widget</h3><p className="text-xs" style={{ color: T.muted, ...fontBody }}>Paste the embed code from any chat provider — Facebook Messenger Chat Plugin, Tawk.to, Crisp, Tidio, or a WhatsApp click-to-chat link. It shows up on your live website automatically, no developer needed.</p></div><textarea rows={6} value={form.chat_widget_code || ""} onChange={e => update("chat_widget_code", e.target.value)} placeholder={'<!-- Paste your widget script here, e.g. Facebook Messenger Chat Plugin or Tawk.to code -->'} className="w-full rounded-lg px-3 py-2 text-xs font-mono outline-none" style={{ border: `1px solid ${T.border}`, color: T.ink, backgroundColor: T.bg }} /><div className="rounded-lg p-3 text-xs" style={{ backgroundColor: T.infoSoft, color: T.info, ...fontBody }}>Recommended for this business: Facebook Messenger Chat Plugin (ties into the Facebook page you already use) or Tawk.to (free, no Facebook page needed).</div></div>)}
        <button onClick={handleSave} disabled={saving} className="mt-6 px-4 py-2 rounded-lg text-sm flex items-center gap-1.5" style={{ backgroundColor: T.accent, color: "#fff", ...fontBody, opacity: saving ? 0.7 : 1 }}>{savedFlash ? <><Check size={14} /> Saved</> : saving ? "Saving..." : "Save Changes"}</button>
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

function LoginScreen({ onAuth }) {
  const [mode, setMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!email.trim() || !password) {
      setError("Please enter your email and password.");
      return;
    }
    setLoading(true);
    try {
      if (mode === "signup") {
        const { data, error: signUpError } = await supabase.auth.signUp({ email: email.trim(), password });
        if (signUpError) throw signUpError;
        if (!data.session) {
          setError("Account created. Please sign in with your email and password.");
          setMode("signin");
        }
      } else {
        const { data, error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (signInError) throw signInError;
      }
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: T.bg, ...fontBody }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');`}</style>
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4" style={{ backgroundColor: T.sidebarBg }}>
            <svg viewBox="0 0 24 24" width="28" height="28" fill="none"><path d="M13 3 L13 21 L9 21 L9 11 L2 19 Z" fill={T.accent} /></svg>
          </div>
          <h1 className="text-2xl mb-1" style={{ ...fontDisplay, color: T.ink }}>Air Fair Travel & Immigration</h1>
          <p className="text-sm" style={{ color: T.muted, ...fontBody }}>Dashboard login</p>
        </div>
        <div className="rounded-2xl p-8" style={{ backgroundColor: T.surface, border: `1px solid ${T.border}` }}>
          <div className="flex gap-1 mb-6 p-1 rounded-lg" style={{ backgroundColor: T.bg }}>
            <button onClick={() => { setMode("signin"); setError(""); }} className="flex-1 py-2 rounded-md text-sm font-medium transition-all" style={{ ...fontBody, backgroundColor: mode === "signin" ? T.surface : "transparent", color: mode === "signin" ? T.ink : T.muted, border: mode === "signin" ? `1px solid ${T.border}` : "1px solid transparent" }}>Sign In</button>
            <button onClick={() => { setMode("signup"); setError(""); }} className="flex-1 py-2 rounded-md text-sm font-medium transition-all" style={{ ...fontBody, backgroundColor: mode === "signup" ? T.surface : "transparent", color: mode === "signup" ? T.ink : T.muted, border: mode === "signup" ? `1px solid ${T.border}` : "1px solid transparent" }}>Create Account</button>
          </div>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="text-xs block mb-1.5" style={{ color: T.muted, ...fontBody }}>Email</label>
              <div className="relative">
                <Mail size={15} style={{ position: "absolute", left: 12, top: 12, color: T.muted }} />
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="your@email.com" className="w-full rounded-lg pl-9 pr-3 py-2.5 text-sm outline-none" style={{ border: `1px solid ${T.border}`, color: T.ink, ...fontBody, backgroundColor: T.bg }} autoFocus />
              </div>
            </div>
            <div>
              <label className="text-xs block mb-1.5" style={{ color: T.muted, ...fontBody }}>Password</label>
              <div className="relative">
                <Lock size={15} style={{ position: "absolute", left: 12, top: 12, color: T.muted }} />
                <input type={showPassword ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} placeholder={mode === "signup" ? "At least 8 characters" : "Enter your password"} className="w-full rounded-lg pl-9 pr-9 py-2.5 text-sm outline-none" style={{ border: `1px solid ${T.border}`, color: T.ink, ...fontBody, backgroundColor: T.bg }} />
                <button type="button" onClick={() => setShowPassword(s => !s)} className="absolute right-2 top-2 p-1" style={{ color: T.muted }}>{showPassword ? <EyeOff size={15} /> : <Eye size={15} />}</button>
              </div>
            </div>
            {error && <div className="text-xs rounded-lg px-3 py-2" style={{ color: T.danger, backgroundColor: T.dangerSoft, ...fontBody }}>{error}</div>}
            <button type="submit" disabled={loading} className="w-full py-2.5 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-opacity" style={{ backgroundColor: T.accent, color: "#fff", ...fontBody, opacity: loading ? 0.7 : 1 }}>
              {loading ? <><Loader2 size={15} className="animate-spin" /> {mode === "signup" ? "Creating account..." : "Signing in..."}</> : mode === "signup" ? "Create Account" : "Sign In"}
            </button>
          </form>
        </div>
        <p className="text-center text-xs mt-6" style={{ color: T.muted, ...fontBody }}>Use your dashboard account email and password to sign in.</p>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [session, setSession] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [page, setPage] = useState("overview");
  const [collapsed, setCollapsed] = useState(false);
  const [submissions, setSubmissions] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [employeeTasks, setEmployeeTasks] = useState([]);
  const [stageTasks, setStageTasks] = useState([]);
  const [services, setServices] = useState([]);
  const [pipelineStages, setPipelineStages] = useState(["New Lead", "Contacted", "Qualified", "Proposal Sent", "Booked Appointment", "Close"]);
  const [currency, setCurrency] = useState("\u20B1");
  const [modules, setModules] = useState({ pipeline: true, bookings: true, employees: true, services: true });
  const [chatWidgetCode, setChatWidgetCode] = useState("");
  const [siteSettings, setSiteSettings] = useState(null);
  const [loaded, setLoaded] = useState(false);

  const loadAll = useCallback(async () => {
    try {
      const [subsRes, contactsRes, bookingsRes, employeesRes, tasksRes, stageTasksRes, servicesRes, stagesRes, settingsRes] = await Promise.all([
        supabase.from("form_submissions").select("*").order("created_at", { ascending: false }),
        supabase.from("contacts").select("*").order("created_at", { ascending: false }),
        supabase.from("bookings").select("*").order("created_at", { ascending: false }),
        supabase.from("employees").select("*").order("created_at", { ascending: false }),
        supabase.from("employee_tasks").select("*").order("created_at", { ascending: false }),
        supabase.from("stage_task_templates").select("*").order("created_at", { ascending: false }),
        supabase.from("services").select("*").order("sort_order", { ascending: true }),
        supabase.from("pipeline_stages").select("*").order("sort_order", { ascending: true }),
        fetchSiteSettings(),
      ]);
      if (subsRes.data) setSubmissions(subsRes.data.map(r => ({ id: r.id, name: r.name, email: r.email, type: r.form_type, date: r.created_at ? new Date(r.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "", status: r.status })));
      if (contactsRes.data) setContacts(contactsRes.data.map(r => ({ id: r.id, submissionId: r.submission_id, name: r.name, email: r.email, category: r.category, status: r.status, amount: r.amount ? Number(r.amount) : null, assignedEmployeeId: r.assigned_employee_id })));
      if (bookingsRes.data) setBookings(bookingsRes.data.map(r => ({ id: r.id, contactId: r.contact_id, name: r.name, purpose: r.purpose, date: r.date || "TBD", time: r.time || "", status: r.status })));
      if (employeesRes.data) setEmployees(employeesRes.data.map(r => ({ id: r.id, name: r.name, email: r.email, role: r.role, allowedModules: r.allowed_modules || { ...DEFAULT_EMPLOYEE_ACCESS } })));
      if (tasksRes.data) setEmployeeTasks(tasksRes.data.map(r => ({ id: r.id, employeeId: r.employee_id, contactId: r.contact_id, title: r.title, due: r.due_date || "No due date", done: r.is_done })));
      if (stageTasksRes.data) setStageTasks(stageTasksRes.data.map(r => ({ id: r.id, stage: r.stage, title: r.title })));
      if (servicesRes.data) setServices(servicesRes.data.map(dbRowToService));
      if (stagesRes.data && stagesRes.data.length > 0) setPipelineStages(stagesRes.data.map(r => r.name));
      if (settingsRes) {
        setSiteSettings(settingsRes);
        if (settingsRes.currency_symbol) setCurrency(settingsRes.currency_symbol);
        if (settingsRes.enabled_modules) setModules(prev => ({ ...prev, ...settingsRes.enabled_modules }));
        if (settingsRes.chat_widget_code !== undefined) setChatWidgetCode(settingsRes.chat_widget_code);
      }
    } catch (err) { /* database not yet set up */ } finally { setLoaded(true); }
  }, []);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      if (!mounted) return;
      setSession(s);
      setAuthReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });
    return () => { mounted = false; sub.subscription.unsubscribe(); };
  }, []);

  useEffect(() => { if (session) loadAll(); }, [session, loadAll]);

  const handleSignOut = async () => {
    setSigningOut(true);
    await supabase.auth.signOut();
    setSigningOut(false);
    setSession(null);
    setLoaded(false);
  };

  const categories = Array.from(new Set(services.map(s => s.category).filter(Boolean)));

  const handleSaveService = async (draft, existingId) => {
    const dbRow = serviceToDbRow(draft);
    if (existingId) {
      const { error } = await supabase.from("services").update(dbRow).eq("id", existingId);
      if (error) throw error;
      setServices(prev => prev.map(s => s.id === existingId ? { ...draft, id: existingId } : s));
    } else {
      const { data, error } = await supabase.from("services").insert(dbRow).select().single();
      if (error) throw error;
      setServices(prev => [...prev, { ...draft, id: data.id }]);
    }
  };

  const handleDeleteService = async (id) => {
    const { error } = await supabase.from("services").delete().eq("id", id);
    if (error) throw error;
    setServices(prev => prev.filter(s => s.id !== id));
  };

  const handleConvertToCase = async (submission) => {
    const category = inferCategory(submission.type, categories);
    const { data, error } = await supabase.from("contacts").insert({ submission_id: submission.id, name: submission.name, email: submission.email, category, status: pipelineStages[0] }).select().single();
    const newContact = data ? { id: data.id, submissionId: data.submission_id, name: data.name, email: data.email, category: data.category, status: data.status, amount: null, assignedEmployeeId: null } : { id: Date.now(), submissionId: submission.id, name: submission.name, email: submission.email, category, status: pipelineStages[0], amount: null, assignedEmployeeId: null };
    setContacts(prev => [...prev, newContact]);
    setSubmissions(prev => prev.map(s => s.id === submission.id ? { ...s, status: "Contacted" } : s));
    setPage("pipeline");
  };

  const handleStageChange = async (contact, newStatus) => {
    if (!contact.assignedEmployeeId) return;
    await supabase.from("contacts").update({ status: newStatus }).eq("id", contact.id);
    const templates = stageTasks.filter(t => t.stage === newStatus);
    if (templates.length === 0) return;
    const newTasks = [];
    for (const t of templates) {
      const { data, error: taskError } = await supabase.from("employee_tasks").insert({ employee_id: contact.assignedEmployeeId, contact_id: contact.id, title: `${t.title} — ${contact.name}`, is_done: false }).select().single();
      if (!taskError && data) newTasks.push({ id: data.id, employeeId: data.employee_id, contactId: data.contact_id, title: data.title, due: "TBD", done: false });
    }
    if (newTasks.length > 0) setEmployeeTasks(prev => [...prev, ...newTasks]);
  };

  const handleSaveSettings = async (formData) => {
    const saved = await saveSiteSettings(formData);
    setSiteSettings(saved);
    if (saved.currency_symbol) setCurrency(saved.currency_symbol);
    if (saved.chat_widget_code !== undefined) setChatWidgetCode(saved.chat_widget_code);
    if (saved.enabled_modules) setModules(prev => ({ ...prev, ...saved.enabled_modules }));
  };

  const pageComponents = {
    overview: <Overview goTo={setPage} submissions={submissions} bookings={bookings} contacts={contacts} stages={pipelineStages} currency={currency} />,
    "edit-website": <EditWebsite />,
    services: <Catalog services={services} onSaveService={handleSaveService} onDeleteService={handleDeleteService} categories={categories} currency={currency} />,
    forms: <Forms submissions={submissions} contacts={contacts} onConvertToCase={handleConvertToCase} currency={currency} />,
    pipeline: <Contacts contacts={contacts} setContacts={setContacts} bookings={bookings} employees={employees} onStageChange={handleStageChange} stages={pipelineStages} categories={categories} currency={currency} />,
    clients: <ClientsDirectory contacts={contacts} bookings={bookings} goTo={setPage} categories={categories} stages={pipelineStages} currency={currency} />,
    employees: <Employees employees={employees} setEmployees={setEmployees} tasks={employeeTasks} setTasks={setEmployeeTasks} stageTasks={stageTasks} setStageTasks={setStageTasks} stages={pipelineStages} />,
    bookings: <Bookings bookings={bookings} />,
    media: <Media />,
    settings: <Settings pipelineStages={pipelineStages} setPipelineStages={setPipelineStages} currency={currency} setCurrency={setCurrency} modules={modules} setModules={setModules} chatWidgetCode={chatWidgetCode} setChatWidgetCode={setChatWidgetCode} settings={siteSettings} onSaveSettings={handleSaveSettings} />,
  };

  const visibleNav = NAV.filter(n => !n.moduleKey || modules[n.moduleKey]);
  const activeLabel = visibleNav.find(n => n.id === page)?.label ?? NAV.find(n => n.id === page)?.label ?? "";

  if (!authReady) {
    return <div className="w-full min-h-screen flex items-center justify-center" style={{ backgroundColor: T.bg, ...fontBody }}><Loader2 size={24} className="animate-spin" style={{ color: T.muted }} /></div>;
  }

  if (!session) {
    return <LoginScreen />;
  }

  return (
    <div className="w-full min-h-screen flex" style={{ backgroundColor: T.bg, ...fontBody }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');`}</style>
      <aside className="flex flex-col shrink-0 transition-all duration-200" style={{ backgroundColor: T.sidebarBg, width: collapsed ? 76 : 240 }}>
        <div className="flex items-center gap-2.5 px-4 h-16" style={{ borderBottom: "1px solid #1F3A52" }}>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: T.accent }}><svg viewBox="0 0 24 24" width="16" height="16" fill="none"><path d="M13 3 L13 21 L9 21 L9 11 L2 19 Z" fill="#13293F" /></svg></div>
          {!collapsed && <div className="leading-tight"><div className="text-sm" style={{ color: "#fff", ...fontDisplay }}>Air Fair</div><div className="text-[9px] uppercase" style={{ color: T.sidebarText, letterSpacing: "0.08em", ...fontBody }}>Travel & Immigration</div></div>}
          <button onClick={() => setCollapsed(c => !c)} className="ml-auto" style={{ color: T.sidebarText }}>{collapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}</button>
        </div>
        <nav className="flex-1 py-3 px-2 flex flex-col gap-0.5 overflow-y-auto">
          {visibleNav.map(n => { const Icon = n.icon; const active = page === n.id; return (<button key={n.id} onClick={() => setPage(n.id)} className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-left" style={{ backgroundColor: active ? T.sidebarActiveBg : "transparent", color: active ? T.sidebarTextActive : T.sidebarText, fontWeight: active ? 500 : 400 }}><Icon size={17} />{!collapsed && <span>{n.label}</span>}</button>); })}
        </nav>
        {!collapsed && <div className="mx-3 mb-3 rounded-xl overflow-hidden relative" style={{ height: 130 }}><img src="https://picsum.photos/seed/wing/300/200" alt="" className="w-full h-full object-cover" /><div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(16,22,37,0) 20%, rgba(16,22,37,0.92) 100%)" }} /><div className="absolute bottom-0 left-0 right-0 p-3"><div className="text-xs font-medium mb-0.5" style={{ color: "#fff", ...fontBody }}>Delivering Journeys.</div><div className="text-xs mb-1.5" style={{ color: "#fff", ...fontBody }}>Simplifying Visas.</div><div className="w-6 h-0.5 rounded" style={{ backgroundColor: T.accent }} /></div></div>}
      </aside>
      <div className="flex-1 flex flex-col min-w-0">
        <div className="h-16 flex items-center justify-between px-8 shrink-0" style={{ borderBottom: `1px solid ${T.border}` }}>
          <div className="text-sm" style={{ color: T.ink, fontWeight: 600, ...fontBody }}>{activeLabel}</div>
          <div className="flex items-center gap-5"><Search size={17} style={{ color: T.muted }} /><div className="relative"><Bell size={17} style={{ color: T.muted }} /><span className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 rounded-full flex items-center justify-center text-[9px]" style={{ backgroundColor: T.danger, color: "#fff", ...fontBody }}>3</span></div><div className="flex items-center gap-2"><div className="w-8 h-8 rounded-full flex items-center justify-center text-xs" style={{ backgroundColor: T.accent, color: "#fff", ...fontBody }}>AF</div><span className="text-sm hidden sm:inline" style={{ color: T.ink, ...fontBody }}>{session.user.email}</span><button onClick={handleSignOut} disabled={signingOut} title="Sign out" className="p-1.5 rounded-md transition-colors" style={{ color: T.muted }}>{signingOut ? <Loader2 size={15} className="animate-spin" /> : <LogOut size={16} />}</button></div></div>
        </div>
        <div className="flex-1 overflow-auto px-8 py-8">{pageComponents[page]}</div>
      </div>
    </div>
  );
}
