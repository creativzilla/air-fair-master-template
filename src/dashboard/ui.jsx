// Shared dashboard design tokens and building blocks. Extracted from
// pages/Dashboard.jsx (same values and markup) so the new CMS modules look
// native to the existing dashboard.
import React, { useEffect, useRef, useState } from "react";
import { Check, ImagePlus, Loader as Loader2, Plus, X } from "lucide-react";
import { MediaPickerModal } from "./MediaLibrary.jsx";

export const T = {
  bg: "#F7F9F5", surface: "#FFFFFF", ink: "#151A22", muted: "#7C8894",
  border: "#E8ECE4", sidebarBg: "#13293F", sidebarText: "#8FA0AF",
  sidebarTextActive: "#FFFFFF", sidebarActiveBg: "#6EBE3D",
  accent: "#6EBE3D", accentSoft: "#EAF6E1", warn: "#E08A2C", warnSoft: "#FCEEDC",
  danger: "#D64545", dangerSoft: "#FBE7E7", info: "#3B7DDB", infoSoft: "#E8F0FC",
  violet: "#7C5CBF", violetSoft: "#EFE9F7", teal: "#1D8A8A", tealSoft: "#E1F2F2",
};

export const fontDisplay = { fontFamily: "'Inter', sans-serif", fontWeight: 700 };
export const fontBody = { fontFamily: "'Inter', sans-serif" };
export const fontMono = { fontFamily: "'Inter', sans-serif", fontWeight: 600 };

export const STATUS_STYLE = {
  New: { bg: T.infoSoft, fg: T.info },
  Contacted: { bg: T.warnSoft, fg: T.warn },
  Qualified: { bg: T.accentSoft, fg: T.accent },
  Confirmed: { bg: T.accentSoft, fg: T.accent },
  Pending: { bg: T.infoSoft, fg: T.info },
  Completed: { bg: T.accentSoft, fg: T.accent },
  Cancelled: { bg: T.border, fg: T.muted },
  Closed: { bg: T.border, fg: T.muted },
  Archived: { bg: T.border, fg: T.muted },
  Published: { bg: T.accentSoft, fg: T.accent },
  Draft: { bg: T.border, fg: T.muted },
  "Unpublished changes": { bg: T.warnSoft, fg: T.warn },
  admin: { bg: T.violetSoft, fg: T.violet },
  editor: { bg: T.infoSoft, fg: T.info },
  staff: { bg: T.tealSoft, fg: T.teal },
  none: { bg: T.border, fg: T.muted },
  Deactivated: { bg: T.dangerSoft, fg: T.danger },
};

const COLOR_PALETTE = [
  { bg: T.infoSoft, fg: T.info }, { bg: T.warnSoft, fg: T.warn },
  { bg: T.accentSoft, fg: T.accent }, { bg: T.violetSoft, fg: T.violet },
  { bg: T.tealSoft, fg: T.teal }, { bg: T.dangerSoft, fg: T.danger },
];
export function paletteColor(i) { return COLOR_PALETTE[((i % COLOR_PALETTE.length) + COLOR_PALETTE.length) % COLOR_PALETTE.length]; }

export function Badge({ status, label }) {
  const s = STATUS_STYLE[status] || { bg: T.border, fg: T.muted };
  return <span className="px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap" style={{ backgroundColor: s.bg, color: s.fg, ...fontBody }}>{label || status}</span>;
}

export function StageBadge({ stage, stages }) {
  const idx = stages.indexOf(stage);
  const s = paletteColor(idx >= 0 ? idx : 0);
  return <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: s.bg, color: s.fg, ...fontBody }}>{stage}</span>;
}

export function CategoryTag({ category, categories }) {
  const idx = categories ? categories.indexOf(category) : -1;
  const c = paletteColor(idx >= 0 ? idx : 0).fg;
  return <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ border: `1px solid ${c}`, color: c, ...fontBody }}>{category}</span>;
}

export const inputStyle = { border: `1px solid ${T.border}`, color: T.ink, ...fontBody, backgroundColor: T.bg };
export const catalogInputStyle = inputStyle;

export function FieldLabel({ children, hint }) {
  return <label className="text-[13px] font-semibold block mb-2" style={{ color: T.ink, ...fontBody }}>{children}{hint && <span className="block text-[11px] font-normal mt-0.5" style={{ color: T.muted }}>{hint}</span>}</label>;
}

export function LabeledInput({ label, value, onChange, placeholder, type = "text", hint, disabled }) {
  return (<div><FieldLabel hint={hint}>{label}</FieldLabel><input type={type} value={value ?? ""} placeholder={placeholder} disabled={disabled} onChange={e => onChange(e.target.value)} className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={{ ...inputStyle, opacity: disabled ? 0.6 : 1 }} /></div>);
}
export function LabeledTextarea({ label, value, onChange, placeholder, rows = 3, hint }) {
  return (<div><FieldLabel hint={hint}>{label}</FieldLabel><textarea rows={rows} value={value ?? ""} placeholder={placeholder} onChange={e => onChange(e.target.value)} className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={inputStyle} /></div>);
}
export function LabeledSelect({ label, value, onChange, options, hint }) {
  return (<div><FieldLabel hint={hint}>{label}</FieldLabel><select value={value ?? ""} onChange={e => onChange(e.target.value)} className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={{ ...inputStyle, backgroundColor: "#fff" }}>{options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select></div>);
}
export function ToggleRow({ label, checked, onChange, disabled }) {
  return (<label className="flex items-center gap-2.5 text-sm cursor-pointer" style={{ color: T.ink, ...fontBody, opacity: disabled ? 0.6 : 1 }}><input type="checkbox" checked={!!checked} disabled={disabled} onChange={e => onChange(e.target.checked)} style={{ accentColor: T.accent }} />{label}</label>);
}

// Opens the media library to choose or upload an image; returns the URL.
export function ImagePickerButton({ onPicked, label = "Replace Image" }) {
  const [open, setOpen] = useState(false);
  return (<>
    <button type="button" onClick={() => setOpen(true)} className="px-3 py-2 rounded-lg text-xs flex items-center gap-1.5" style={{ backgroundColor: T.accentSoft, color: T.accent, ...fontBody }}><ImagePlus size={13} /> {label}</button>
    {open && <MediaPickerModal onClose={() => setOpen(false)} onPick={media => { onPicked(media.url, media); setOpen(false); }} />}
  </>);
}

export function GalleryEditor({ label, images, onChange }) {
  const [open, setOpen] = useState(false);
  const removeImage = idx => onChange(images.filter((_, i) => i !== idx));
  return (<div><FieldLabel>{label}</FieldLabel><div className="flex flex-wrap gap-2">{(images || []).map((img, i) => (<div key={i} className="relative"><img src={img} alt="" className="w-16 h-12 object-cover rounded-md" style={{ border: `1px solid ${T.border}` }} /><button type="button" onClick={() => removeImage(i)} className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full flex items-center justify-center" style={{ backgroundColor: T.danger }} aria-label="Remove image"><X size={10} color="#fff" /></button></div>))}<button type="button" onClick={() => setOpen(true)} className="w-16 h-12 rounded-md flex items-center justify-center" style={{ border: `1.5px dashed ${T.border}`, backgroundColor: T.bg }} aria-label="Add image"><Plus size={14} style={{ color: T.muted }} /></button></div>{open && <MediaPickerModal onClose={() => setOpen(false)} onPick={media => { onChange([...(images || []), media.url]); setOpen(false); }} />}</div>);
}

// ---------------------------------------------------------------------------
// Layout primitives
// ---------------------------------------------------------------------------

export function PageTitle({ title, subtitle, actions }) {
  return (
    <div className="flex items-start justify-between flex-wrap gap-3">
      <div className="min-w-0"><h1 className="text-2xl mb-1" style={{ ...fontDisplay, color: T.ink }}>{title}</h1>{subtitle && <p className="text-sm" style={{ color: T.muted, ...fontBody }}>{subtitle}</p>}</div>
      {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
    </div>
  );
}

export function Panel({ children, className = "", style }) {
  return <div className={`rounded-xl ${className}`} style={{ backgroundColor: T.surface, border: `1px solid ${T.border}`, ...style }}>{children}</div>;
}

const BUTTON_TONES = {
  primary: { backgroundColor: T.accent, color: "#fff" },
  soft: { backgroundColor: T.accentSoft, color: T.accent },
  outline: { backgroundColor: T.surface, color: T.ink, border: `1px solid ${T.border}` },
  danger: { backgroundColor: T.dangerSoft, color: T.danger },
  ghost: { backgroundColor: "transparent", color: T.muted },
};

export function Button({ tone = "primary", icon: Icon, children, busy, disabled, title, onClick, type = "button", small }) {
  const off = disabled || busy;
  return (
    <button type={type} onClick={onClick} disabled={off} title={title}
      className={`${small ? "px-2.5 py-1.5 text-xs" : "px-4 py-2 text-sm"} rounded-lg flex items-center justify-center gap-1.5 shrink-0`}
      style={{ ...BUTTON_TONES[tone], ...fontBody, opacity: off ? 0.55 : 1, cursor: off ? "not-allowed" : "pointer" }}>
      {busy ? <Loader2 size={small ? 12 : 14} className="animate-spin" /> : Icon && <Icon size={small ? 12 : 14} />}{children}
    </button>
  );
}

export function Spinner({ label = "Loading..." }) {
  return <div className="flex items-center gap-2 text-sm py-10 justify-center" style={{ color: T.muted, ...fontBody }}><Loader2 size={16} className="animate-spin" /> {label}</div>;
}

export function Notice({ tone = "info", children }) {
  const tones = { info: [T.infoSoft, T.info], warn: [T.warnSoft, T.warn], danger: [T.dangerSoft, T.danger], success: [T.accentSoft, T.accent] };
  const [bg, fg] = tones[tone];
  return <div className="rounded-lg px-3 py-2 text-xs" role={tone === "danger" ? "alert" : "status"} style={{ backgroundColor: bg, color: fg, ...fontBody }}>{children}</div>;
}

export function Tabs({ tabs, active, onChange }) {
  return (
    <div className="flex gap-5 border-b overflow-x-auto" style={{ borderColor: T.border }}>
      {tabs.map(t => <button key={t.id} type="button" onClick={() => onChange(t.id)} className="pb-3 text-sm -mb-px whitespace-nowrap" style={{ ...fontBody, color: active === t.id ? T.ink : T.muted, borderBottom: active === t.id ? `2px solid ${T.accent}` : "2px solid transparent", fontWeight: active === t.id ? 600 : 400 }}>{t.label}{t.count !== undefined && <span className="ml-1.5 text-xs" style={{ color: T.muted }}>{t.count}</span>}</button>)}
    </div>
  );
}

export function FilterPills({ options, active, onChange }) {
  return (
    <div className="flex gap-2 flex-wrap">
      {options.map(o => { const value = typeof o === "string" ? o : o.value; const label = typeof o === "string" ? o : o.label; return <button key={value} type="button" onClick={() => onChange(value)} className="px-3 py-1.5 rounded-full text-xs" style={{ ...fontBody, backgroundColor: active === value ? T.ink : T.surface, color: active === value ? "#fff" : T.muted, border: `1px solid ${active === value ? T.ink : T.border}` }}>{label}</button>; })}
    </div>
  );
}

export function Modal({ title, onClose, children, footer, wide }) {
  useEffect(() => {
    const onKey = e => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(21,26,34,0.45)" }} role="dialog" aria-modal="true" aria-label={title}>
      <div className={`w-full ${wide ? "max-w-4xl" : "max-w-lg"} rounded-2xl flex flex-col dash-modal-full`} style={{ backgroundColor: T.surface, maxHeight: "90vh" }}>
        <div className="flex items-center justify-between px-6 pt-5 pb-4" style={{ borderBottom: `1px solid ${T.border}` }}><h2 className="text-base font-semibold" style={{ color: T.ink, ...fontBody }}>{title}</h2><button type="button" onClick={onClose} style={{ color: T.muted }} aria-label="Close"><X size={18} /></button></div>
        <div className="px-6 py-5 overflow-y-auto flex-1">{children}</div>
        {footer && <div className="px-6 py-4 flex justify-end gap-2 flex-wrap" style={{ borderTop: `1px solid ${T.border}` }}>{footer}</div>}
      </div>
    </div>
  );
}

export function Drawer({ title, onClose, children, footer }) {
  useEffect(() => {
    const onKey = e => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex justify-end" style={{ backgroundColor: "rgba(21,26,34,0.35)" }} onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }} role="dialog" aria-modal="true" aria-label={title}>
      <div className="h-full w-full max-w-xl flex flex-col" style={{ backgroundColor: T.surface, boxShadow: "-8px 0 24px rgba(21,26,34,0.12)" }}>
        <div className="flex items-center justify-between px-5 h-16 shrink-0" style={{ borderBottom: `1px solid ${T.border}` }}><h2 className="text-base font-semibold truncate" style={{ color: T.ink, ...fontBody }}>{title}</h2><button type="button" onClick={onClose} style={{ color: T.muted }} aria-label="Close"><X size={18} /></button></div>
        <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>
        {footer && <div className="px-5 py-4 flex justify-end gap-2 flex-wrap" style={{ borderTop: `1px solid ${T.border}`, paddingBottom: "calc(16px + env(safe-area-inset-bottom))" }}>{footer}</div>}
      </div>
    </div>
  );
}

export function EmptyState({ children }) {
  return <div className="px-5 py-10 text-center text-sm" style={{ color: T.muted, ...fontBody }}>{children}</div>;
}

export function SavedFlash({ show }) {
  if (!show) return null;
  return <span className="text-xs flex items-center gap-1" style={{ color: T.accent, ...fontBody }}><Check size={13} /> Saved</span>;
}

// Warns before leaving the page with unsaved edits.
export function useUnsavedWarning(dirty) {
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
  useEffect(() => {
    const handler = e => { if (dirtyRef.current) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);
}

export function formatDateTime(value) {
  if (!value) return "";
  return new Date(value).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}
