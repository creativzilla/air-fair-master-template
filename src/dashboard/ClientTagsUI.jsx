// Tag chips, the tag picker (client drawer) and the Manage tags dialog.
import React, { useState } from "react";
import { Download, Plus, Tag, Trash2, X } from "lucide-react";
import { supabase } from "../lib/supabase.js";
import { T, fontBody, Button, Modal, Notice, inputStyle } from "./ui.jsx";
import { TAG_COLORS, createTag, tagColor } from "./clientTags.js";

export function TagChip({ tag, onRemove, count, active, onClick }) {
  const c = tagColor(tag.color);
  const Comp = onClick ? "button" : "span";
  return <Comp type={onClick ? "button" : undefined} onClick={onClick} title={tag.description || undefined} aria-pressed={onClick ? !!active : undefined}
    className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs whitespace-nowrap"
    style={{ backgroundColor: c.bg, color: c.fg, ...fontBody, outline: active ? `2px solid ${c.fg}` : "none", outlineOffset: 1 }}>
    {tag.name}{count !== undefined && <span style={{ opacity: 0.7 }}>{count}</span>}
    {onRemove && <button type="button" aria-label={`Remove ${tag.name}`} onClick={e => { e.stopPropagation(); onRemove(); }}><X size={11} /></button>}
  </Comp>;
}

// Selected tags as chips plus a searchable "Add tag" list that can create a new tag.
export function TagPicker({ tags, value, onChange, onTagCreated, disabled }) {
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const selected = value.map(id => tags.find(t => t.id === id)).filter(Boolean);
  const q = term.trim().toLowerCase();
  const options = tags.filter(t => !value.includes(t.id) && (!q || t.name.toLowerCase().includes(q)));
  const exact = tags.some(t => t.name.toLowerCase() === q);
  const create = async () => {
    setBusy(true); setError("");
    try { const tag = await createTag(term); onTagCreated(tag); onChange([...value, tag.id]); setTerm(""); }
    catch (err) { setError(err.message); } finally { setBusy(false); }
  };
  return <div>
    <div className="flex flex-wrap gap-1.5 items-center">
      {selected.map(t => <TagChip key={t.id} tag={t} onRemove={disabled ? undefined : () => onChange(value.filter(id => id !== t.id))} />)}
      {!selected.length && <span className="text-xs" style={{ color: T.muted, ...fontBody }}>No tags</span>}
      {!disabled && <button type="button" onClick={() => setOpen(v => !v)} className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs" style={{ border: `1px dashed ${T.border}`, color: T.muted, ...fontBody }}><Plus size={11} />Add tag</button>}
    </div>
    {open && !disabled && <div className="mt-2 rounded-lg p-2 flex flex-col gap-2" style={{ border: `1px solid ${T.border}`, backgroundColor: T.surface }}>
      <input autoFocus value={term} onChange={e => setTerm(e.target.value)} placeholder="Search or create a tag" maxLength={40} aria-label="Search tags"
        onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); if (options[0] && (exact || !q)) { onChange([...value, options[0].id]); setTerm(""); } else if (q && !exact) create(); } if (e.key === "Escape") setOpen(false); }}
        className="w-full rounded-md px-2 py-1.5 text-sm outline-none" style={inputStyle} />
      <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto">
        {options.map(t => <TagChip key={t.id} tag={t} onClick={() => { onChange([...value, t.id]); setTerm(""); }} />)}
        {!options.length && !q && <span className="text-xs" style={{ color: T.muted }}>All tags added.</span>}
      </div>
      {q && !exact && <Button small tone="outline" icon={Plus} busy={busy} onClick={create}>Create tag "{term.trim()}"</Button>}
      {error && <p className="text-xs" style={{ color: T.danger }}>{error}</p>}
    </div>}
  </div>;
}

export function ManageTagsModal({ tags, counts, canDelete, onClose, onChanged }) {
  const [drafts, setDrafts] = useState(() => Object.fromEntries(tags.map(t => [t.id, { name: t.name, color: t.color, description: t.description || "" }])));
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("gray");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const run = async (key, fn) => { setBusy(key); setError(""); try { await fn(); await onChanged(); } catch (err) { setError(err.message); } finally { setBusy(""); } };
  const save = t => run(`save-${t.id}`, async () => {
    const d = drafts[t.id];
    const { error: err } = await supabase.from("client_tags").update({ name: d.name.trim(), color: d.color, description: d.description.trim() || null }).eq("id", t.id);
    if (err) throw new Error(/duplicate|unique/i.test(err.message) ? `A tag named "${d.name.trim()}" already exists.` : err.message);
  });
  const remove = t => {
    if (!window.confirm(`Delete the tag "${t.name}"? It is removed from ${counts[t.id] || 0} client(s).`)) return;
    run(`del-${t.id}`, async () => { const { error: err } = await supabase.from("client_tags").delete().eq("id", t.id); if (err) throw err; });
  };
  const ColorSelect = ({ value, onChange, label }) => <select value={value} onChange={e => onChange(e.target.value)} aria-label={label} className="rounded-md px-1.5 py-1 text-xs outline-none" style={inputStyle}>
    {Object.keys(TAG_COLORS).map(c => <option key={c} value={c}>{c}</option>)}</select>;
  return <Modal title="Manage tags" onClose={onClose} footer={<Button tone="outline" onClick={onClose}>Done</Button>}>
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2 items-end">
        <div className="flex-1 min-w-[10rem]"><label className="text-xs block mb-1" style={{ color: T.muted, ...fontBody }}>New tag</label>
          <input value={newName} onChange={e => setNewName(e.target.value)} maxLength={40} placeholder="e.g. Student visa" className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={inputStyle} /></div>
        <ColorSelect value={newColor} onChange={setNewColor} label="New tag color" />
        <Button icon={Plus} busy={busy === "new"} disabled={!newName.trim()} onClick={() => run("new", async () => { await createTag(newName, newColor); setNewName(""); })}>Add tag</Button>
      </div>
      {error && <Notice tone="danger">{error}</Notice>}
      <div className="flex flex-col divide-y rounded-lg" style={{ border: `1px solid ${T.border}` }}>
        {tags.map(t => { const d = drafts[t.id] || { name: t.name, color: t.color, description: t.description || "" };
          const changed = d.name !== t.name || d.color !== t.color || d.description !== (t.description || "");
          const set = patch => setDrafts(prev => ({ ...prev, [t.id]: { ...d, ...patch } }));
          return <div key={t.id} className="p-3 flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <Tag size={13} style={{ color: tagColor(d.color).fg }} />
              <input value={d.name} onChange={e => set({ name: e.target.value })} maxLength={40} aria-label="Tag name" className="flex-1 min-w-[8rem] rounded-md px-2 py-1 text-sm outline-none" style={inputStyle} />
              <ColorSelect value={d.color} onChange={color => set({ color })} label={`Color for ${t.name}`} />
              <span className="text-xs" style={{ color: T.muted, ...fontBody }}>{counts[t.id] || 0} clients</span>
            </div>
            <input value={d.description} onChange={e => set({ description: e.target.value })} maxLength={200} placeholder="What this tag means (optional)" aria-label="Tag description" className="w-full rounded-md px-2 py-1 text-xs outline-none" style={inputStyle} />
            <div className="flex gap-2">
              <Button small busy={busy === `save-${t.id}`} disabled={!changed || !d.name.trim()} onClick={() => save(t)}>Save</Button>
              {canDelete && <Button small tone="outline" icon={Trash2} busy={busy === `del-${t.id}`} onClick={() => remove(t)}>Delete</Button>}
            </div>
          </div>; })}
      </div>
      {!canDelete && <p className="text-xs" style={{ color: T.muted, ...fontBody }}>Only admins can delete tags.</p>}
    </div>
  </Modal>;
}

// Compact multi-select for the Clients filters: a button that opens a checklist.
export function TagFilterDropdown({ tags, counts, value, onChange, mode, onModeChange, onManage }) {
  const [open, setOpen] = useState(false);
  const label = !value.length ? "All tags" : value.length === 1 ? tags.find(t => t.id === value[0])?.name || "1 tag" : `${value.length} tags`;
  return <div className="relative">
    <label className="block text-xs mb-1.5" style={{ color: T.muted, ...fontBody }}>Tags</label>
    <button type="button" onClick={() => setOpen(v => !v)} aria-haspopup="true" aria-expanded={open}
      className="w-full flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm text-left" style={{ ...inputStyle, backgroundColor: "#fff" }}>
      <span className="truncate" style={{ color: value.length ? T.ink : undefined }}>{label}</span><Tag size={14} style={{ color: T.muted }} />
    </button>
    {open && <>
      <button type="button" aria-label="Close tag filter" className="fixed inset-0 z-10 cursor-default" onClick={() => setOpen(false)} />
      <div className="absolute z-20 right-0 mt-1 w-64 max-w-[90vw] rounded-lg shadow-lg p-2 flex flex-col gap-1" style={{ backgroundColor: T.surface, border: `1px solid ${T.border}` }}>
        <div className="max-h-64 overflow-y-auto flex flex-col">
          {tags.map(t => { const c = tagColor(t.color); return <label key={t.id} className="flex items-center gap-2 px-2 py-1.5 rounded-md text-sm cursor-pointer hover:bg-black/5" style={{ ...fontBody }}>
            <input type="checkbox" checked={value.includes(t.id)} onChange={() => onChange(value.includes(t.id) ? value.filter(x => x !== t.id) : [...value, t.id])} style={{ accentColor: T.accent }} />
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: c.fg }} />
            <span className="flex-1 truncate" style={{ color: T.ink }}>{t.name}</span><span className="text-xs" style={{ color: T.muted }}>{counts[t.id] || 0}</span>
          </label>; })}
        </div>
        {value.length > 1 && <div className="flex rounded-md overflow-hidden text-xs mt-1" style={{ border: `1px solid ${T.border}` }} role="group" aria-label="Tag match">
          {[["any", "Match any"], ["all", "Match all"]].map(([m, l]) => <button key={m} type="button" onClick={() => onModeChange(m)} className="flex-1 px-2 py-1"
            style={{ backgroundColor: mode === m ? T.ink : T.surface, color: mode === m ? "#fff" : T.muted, ...fontBody }} aria-pressed={mode === m}>{l}</button>)}
        </div>}
        <div className="flex items-center justify-between pt-1 mt-1 border-t text-xs" style={{ borderColor: T.border }}>
          <button type="button" disabled={!value.length} onClick={() => onChange([])} className="underline disabled:opacity-40" style={{ color: T.muted }}>Clear</button>
          <button type="button" onClick={() => { setOpen(false); onManage(); }} className="underline" style={{ color: T.muted }}>Manage tags</button>
        </div>
      </div>
    </>}
  </div>;
}

// Bulk actions: pick one tag (searchable), or type a new name to create it.
export function BulkTagMenu({ tags, value, onChange, onCreate, disabled, busy }) {
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const chosen = tags.find(t => t.id === value);
  const q = term.trim().toLowerCase();
  const list = tags.filter(t => !q || t.name.toLowerCase().includes(q));
  const exact = tags.some(t => t.name.toLowerCase() === q);
  const close = () => { setOpen(false); setTerm(""); };
  return <div className="relative">
    <button type="button" disabled={disabled} onClick={() => setOpen(v => !v)} aria-haspopup="listbox" aria-expanded={open} aria-label="Tag for selected clients"
      className="flex items-center gap-2 rounded-md px-2.5 py-1 text-sm min-w-[10rem] justify-between disabled:opacity-50" style={{ border: `1px solid ${T.border}`, backgroundColor: "#fff", color: chosen ? T.ink : T.muted, ...fontBody }}>
      <span className="flex items-center gap-1.5 truncate">{chosen && <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: tagColor(chosen.color).fg }} />}{chosen ? chosen.name : "Choose a tag"}</span><Tag size={13} />
    </button>
    {open && !disabled && <>
      <button type="button" aria-label="Close tag menu" className="fixed inset-0 z-10 cursor-default" onClick={close} />
      <div className="absolute z-20 left-0 mt-1 w-64 max-w-[90vw] rounded-lg shadow-lg p-2 flex flex-col gap-1" style={{ backgroundColor: T.surface, border: `1px solid ${T.border}` }}>
        <input autoFocus value={term} onChange={e => setTerm(e.target.value)} placeholder="Search or create a tag" maxLength={40} aria-label="Search tags"
          onKeyDown={e => { if (e.key === "Escape") close(); if (e.key === "Enter") { e.preventDefault(); if (list[0] && (exact || !q)) { onChange(list[0].id); close(); } else if (q) { onCreate(term.trim()); close(); } } }}
          className="w-full rounded-md px-2 py-1.5 text-sm outline-none" style={inputStyle} />
        <div role="listbox" className="max-h-56 overflow-y-auto flex flex-col">
          {list.map(t => <button key={t.id} type="button" role="option" aria-selected={t.id === value} onClick={() => { onChange(t.id); close(); }}
            className="flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-left hover:bg-black/5" style={{ backgroundColor: t.id === value ? T.accentSoft : undefined, color: T.ink, ...fontBody }}>
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: tagColor(t.color).fg }} /><span className="truncate">{t.name}</span></button>)}
          {!list.length && <span className="px-2 py-1.5 text-xs" style={{ color: T.muted }}>No tag matches.</span>}
        </div>
        {q && !exact && <button type="button" disabled={busy} onClick={() => { onCreate(term.trim()); close(); }} className="flex items-center gap-1.5 px-2 py-1.5 rounded-md text-sm text-left border-t pt-2"
          style={{ borderColor: T.border, color: T.accent, ...fontBody }}><Plus size={13} />Create "{term.trim()}" and add to selected</button>}
      </div>
    </>}
  </div>;
}

// Remove: lists only tags the selected clients actually have; one click removes.
export function RemoveTagMenu({ tags, present, onRemove, disabled }) {
  const [open, setOpen] = useState(false);
  const list = tags.filter(t => present[t.id]);
  return <div className="relative">
    <Button small tone="outline" disabled={disabled} onClick={() => setOpen(v => !v)}>Remove tag ▾</Button>
    {open && !disabled && <>
      <button type="button" aria-label="Close remove menu" className="fixed inset-0 z-10 cursor-default" onClick={() => setOpen(false)} />
      <div role="menu" className="absolute z-20 left-0 mt-1 w-60 max-w-[90vw] rounded-lg shadow-lg p-1 flex flex-col" style={{ backgroundColor: T.surface, border: `1px solid ${T.border}` }}>
        {list.map(t => <button key={t.id} type="button" role="menuitem" onClick={() => { setOpen(false); onRemove(t.id); }}
          className="flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-left hover:bg-black/5" style={{ color: T.ink, ...fontBody }}>
          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: tagColor(t.color).fg }} />
          <span className="flex-1 truncate">{t.name}</span><span className="text-xs" style={{ color: T.muted }}>{present[t.id]} selected</span>
        </button>)}
        {!list.length && <span className="px-2 py-1.5 text-xs" style={{ color: T.muted, ...fontBody }}>The selected clients have no tags.</span>}
      </div>
    </>}
  </div>;
}

// Download the chosen clients as Excel, CSV or PDF (print → Save as PDF).
export function DownloadMenu({ count, label, onDownload, disabled }) {
  const [open, setOpen] = useState(false);
  const pick = format => { setOpen(false); onDownload(format); };
  return <div className="relative">
    <Button small tone="outline" icon={Download} disabled={disabled || !count} onClick={() => setOpen(v => !v)}>Download ▾</Button>
    {open && <>
      <button type="button" aria-label="Close download menu" className="fixed inset-0 z-10 cursor-default" onClick={() => setOpen(false)} />
      <div role="menu" className="absolute z-20 right-0 mt-1 w-64 max-w-[90vw] rounded-lg shadow-lg p-1 flex flex-col" style={{ backgroundColor: T.surface, border: `1px solid ${T.border}` }}>
        <p className="px-2 py-1.5 text-xs" style={{ color: T.muted, ...fontBody }}>{label}</p>
        {[["xlsx", "Excel (.xlsx)"], ["csv", "CSV (.csv)"], ["pdf", "PDF (print → Save as PDF)"]].map(([f, l]) =>
          <button key={f} type="button" role="menuitem" onClick={() => pick(f)} className="px-2 py-1.5 rounded-md text-sm text-left hover:bg-black/5" style={{ color: T.ink, ...fontBody }}>{l}</button>)}
      </div>
    </>}
  </div>;
}
