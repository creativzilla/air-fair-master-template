// Team resources: internal files shared by the whole team (templates,
// checklists, government forms, guides), stored in the private
// "team-resources" bucket and opened through short-lived signed URLs.
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Download, Eye, FileSpreadsheet, FileText, Image as ImageIcon, Pencil, Search, Trash2, Upload, X } from "lucide-react";
import { T, fontBody, Button, EmptyState, FieldLabel, FilterPills, Notice, Panel, Spinner, formatDateTime, inputStyle } from "./ui.jsx";
import { supabase } from "../lib/supabase.js";

const BUCKET = "team-resources";
const MAX_BYTES = 25 * 1024 * 1024;
export const RESOURCE_CATEGORIES = ["Forms & templates", "Checklists", "Government forms", "Guides & SOPs", "Price sheets", "Marketing", "Other"];
const EXT_TYPES = {
  pdf: "application/pdf", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", heic: "image/heic", heif: "image/heif",
  doc: "application/msword", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint", pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  txt: "text/plain", csv: "text/csv", zip: "application/zip",
};
const ALLOWED = new Set(Object.values(EXT_TYPES));
const typeOf = file => (ALLOWED.has(file.type) ? file.type : EXT_TYPES[(file.name.split(".").pop() || "").toLowerCase()] || file.type || "");
const formatSize = bytes => (bytes == null ? "" : bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`);
const titleFromFile = name => name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();

export function isMissingTableError(err) {
  const msg = err?.message || "";
  return err?.code === "PGRST205" || /schema cache|does not exist/i.test(msg);
}

export const SETUP_MESSAGE = "This feature needs its database update. Run “npx supabase@2.118.0 db push” in the project folder (it applies only the Documents migration), then reload.";

function ResourceIcon({ mime }) {
  const m = mime || "";
  const Icon = m.startsWith("image/") ? ImageIcon : /sheet|excel|csv/.test(m) ? FileSpreadsheet : FileText;
  return <span className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: T.infoSoft, color: T.info }}><Icon size={17} /></span>;
}

function UploadPanel({ onUploaded }) {
  const inputRef = useRef(null);
  const [category, setCategory] = useState(RESOURCE_CATEGORIES[0]);
  const [description, setDescription] = useState("");
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState(null);
  const [errors, setErrors] = useState([]);

  const upload = async fileList => {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    const problems = [];
    const added = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setProgress(`Uploading ${i + 1} of ${files.length}: ${file.name}`);
      const mime = typeOf(file);
      if (!ALLOWED.has(mime)) { problems.push(`${file.name}: file type not allowed.`); continue; }
      if (file.size > MAX_BYTES) { problems.push(`${file.name}: larger than 25 MB.`); continue; }
      const id = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      const path = `${id}-${file.name.replace(/[^\w.-]+/g, "_").slice(-100)}`;
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: mime, upsert: false });
      if (upErr) { problems.push(`${file.name}: ${upErr.message}`); continue; }
      const { data, error } = await supabase.from("team_resources").insert({
        title: titleFromFile(file.name).slice(0, 200) || file.name, description: description.trim() || null, category,
        file_name: file.name.slice(0, 255), storage_path: path, mime_type: mime, size_bytes: file.size,
      }).select().single();
      if (error) { problems.push(`${file.name}: ${isMissingTableError(error) ? SETUP_MESSAGE : error.message}`); await supabase.storage.from(BUCKET).remove([path]); continue; }
      added.push(data);
    }
    setProgress(null);
    setErrors([...new Set(problems)]);
    if (added.length) { setDescription(""); onUploaded(added); }
  };

  return (
    <Panel className="p-5 flex flex-col gap-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <FieldLabel>Category</FieldLabel>
          <select value={category} onChange={e => setCategory(e.target.value)} className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={{ ...inputStyle, backgroundColor: "#fff" }}>
            {RESOURCE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <FieldLabel>Description (optional)</FieldLabel>
          <input value={description} onChange={e => setDescription(e.target.value)} placeholder="e.g. Use for SRRV applicants over 50" className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={inputStyle} />
        </div>
      </div>
      <input ref={inputRef} type="file" multiple accept={Object.keys(EXT_TYPES).map(e => `.${e}`).join(",")} style={{ display: "none" }} onChange={e => { upload(e.target.files); e.target.value = ""; }} />
      <button type="button" disabled={!!progress} onClick={() => inputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); upload(e.dataTransfer.files); }}
        className="rounded-xl flex flex-col items-center justify-center gap-2 py-8 px-4 text-center"
        style={{ border: `1.5px dashed ${dragging ? T.accent : T.border}`, backgroundColor: dragging ? T.accentSoft : T.bg }}>
        <Upload size={22} style={{ color: T.accent }} />
        <span className="text-sm font-semibold" style={{ color: T.ink, ...fontBody }}>{progress || "Drop files here or click to upload"}</span>
        <span className="text-xs" style={{ color: T.muted, ...fontBody }}>PDF, images, Word, Excel, PowerPoint, CSV, text or ZIP · up to 25 MB each · saved in “{category}”</span>
      </button>
      {errors.length > 0 && <Notice tone="danger">{errors.map(e => <span key={e} className="block">{e}</span>)}</Notice>}
    </Panel>
  );
}

function EditRow({ item, onSave, onCancel }) {
  const [title, setTitle] = useState(item.title);
  const [description, setDescription] = useState(item.description || "");
  const [category, setCategory] = useState(item.category);
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
      <div className="sm:col-span-2"><FieldLabel>Title</FieldLabel><input value={title} onChange={e => setTitle(e.target.value)} className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={inputStyle} /></div>
      <div><FieldLabel>Category</FieldLabel><select value={category} onChange={e => setCategory(e.target.value)} className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={{ ...inputStyle, backgroundColor: "#fff" }}>{[...new Set([category, ...RESOURCE_CATEGORIES])].map(c => <option key={c} value={c}>{c}</option>)}</select></div>
      <div><FieldLabel>Description</FieldLabel><input value={description} onChange={e => setDescription(e.target.value)} className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={inputStyle} /></div>
      <div className="sm:col-span-2 flex gap-2 justify-end"><Button tone="outline" small icon={X} onClick={onCancel}>Cancel</Button><Button small disabled={!title.trim()} onClick={() => onSave({ title: title.trim(), description: description.trim() || null, category })}>Save</Button></div>
    </div>
  );
}

export default function TeamResources({ role }) {
  const [items, setItems] = useState(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [busy, setBusy] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [people, setPeople] = useState({});
  const isAdmin = role === "admin";

  const load = useCallback(async () => {
    const { data, error: err } = await supabase.from("team_resources").select("*").order("created_at", { ascending: false });
    if (err) { setError(isMissingTableError(err) ? SETUP_MESSAGE : err.message); setItems([]); return; }
    setItems(data || []); setError("");
    const { data: profiles } = await supabase.from("profiles").select("id,email,full_name");
    setPeople(Object.fromEntries((profiles || []).map(p => [p.id, p.full_name || p.email])));
  }, []);
  useEffect(() => { load(); }, [load]);

  const open = async (item, download) => {
    const tab = download ? null : window.open("about:blank", "_blank");
    setBusy(`${download ? "dl" : "view"}-${item.id}`); setError("");
    try {
      const { data, error: err } = await supabase.storage.from(BUCKET).createSignedUrl(item.storage_path, 60, download ? { download: item.file_name } : undefined);
      if (err) throw err;
      if (tab) tab.location.href = data.signedUrl;
      else { const a = document.createElement("a"); a.href = data.signedUrl; a.rel = "noopener"; document.body.appendChild(a); a.click(); a.remove(); }
    } catch (err) { tab?.close(); setError(err.message || "Could not open the file."); } finally { setBusy(null); }
  };

  const save = async (item, patch) => {
    const { data, error: err } = await supabase.from("team_resources").update(patch).eq("id", item.id).select().single();
    if (err) { setError(err.message); return; }
    setItems(prev => prev.map(r => (r.id === item.id ? data : r)));
    setEditingId(null);
  };

  const remove = async item => {
    if (!window.confirm(`Delete "${item.title}" for everyone?`)) return;
    setBusy(`del-${item.id}`); setError("");
    const { error: storageErr } = await supabase.storage.from(BUCKET).remove([item.storage_path]);
    if (storageErr) { setError(storageErr.message); setBusy(null); return; }
    const { error: rowErr } = await supabase.from("team_resources").delete().eq("id", item.id);
    setBusy(null);
    if (rowErr) { setError(rowErr.message); return; }
    setItems(prev => prev.filter(r => r.id !== item.id));
  };

  const categories = useMemo(() => ["All", ...new Set([...RESOURCE_CATEGORIES.filter(c => (items || []).some(r => r.category === c)), ...(items || []).map(r => r.category)])], [items]);
  const shown = (items || []).filter(r => {
    if (category !== "All" && r.category !== category) return false;
    const q = query.trim().toLowerCase();
    return !q || [r.title, r.description, r.file_name, r.category].some(v => (v || "").toLowerCase().includes(q));
  });

  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm" style={{ color: T.muted, ...fontBody }}>Files for internal use only — templates, checklists, government forms and guides your team downloads often. Not linked to a client and never shown on the website.</p>
      <UploadPanel onUploaded={added => setItems(prev => [...added, ...(prev || [])])} />
      {error && <Notice tone={error === SETUP_MESSAGE ? "warn" : "danger"}>{error}</Notice>}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        {categories.length > 1 ? <FilterPills options={categories.map(c => ({ value: c, label: c === "All" ? `All (${(items || []).length})` : c }))} active={category} onChange={setCategory} /> : <span />}
        <div className="relative w-full sm:w-64"><Search size={14} style={{ color: T.muted, position: "absolute", left: 10, top: 10 }} /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search resources" className="w-full rounded-lg pl-8 pr-3 py-2 text-sm outline-none" style={inputStyle} /></div>
      </div>
      <Panel className="overflow-hidden">
        {items === null ? <Spinner /> : shown.length === 0 ? <EmptyState>{(items || []).length ? "No resources match." : "No resources yet. Upload the files your team uses often."}</EmptyState> : shown.map((item, i) => (
          <div key={item.id} className="flex items-start gap-3 px-5 py-4 flex-wrap sm:flex-nowrap" style={{ borderBottom: i < shown.length - 1 ? `1px solid ${T.border}` : "none" }}>
            <ResourceIcon mime={item.mime_type} />
            {editingId === item.id ? <EditRow item={item} onCancel={() => setEditingId(null)} onSave={patch => save(item, patch)} /> : (<>
              <div className="flex-1 min-w-[180px]">
                <div className="flex items-center gap-2 flex-wrap"><span className="text-sm font-semibold" style={{ color: T.ink, ...fontBody }}>{item.title}</span><span className="text-[11px] px-2 py-0.5 rounded-full" style={{ backgroundColor: T.bg, color: T.muted, border: `1px solid ${T.border}`, ...fontBody }}>{item.category}</span></div>
                {item.description && <p className="text-xs mt-1" style={{ color: T.ink, ...fontBody }}>{item.description}</p>}
                <div className="text-xs mt-1 break-all" style={{ color: T.muted, ...fontBody }}>{item.file_name} · {formatSize(item.size_bytes)} · {formatDateTime(item.created_at)}{item.uploaded_by && people[item.uploaded_by] ? ` · ${people[item.uploaded_by]}` : ""}</div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <Button tone="ghost" small icon={Pencil} onClick={() => setEditingId(item.id)} title="Edit details">{""}</Button>
                <Button tone="outline" small icon={Eye} busy={busy === `view-${item.id}`} onClick={() => open(item, false)}>View</Button>
                <Button tone="soft" small icon={Download} busy={busy === `dl-${item.id}`} onClick={() => open(item, true)}>Download</Button>
                {isAdmin && <Button tone="danger" small icon={Trash2} busy={busy === `del-${item.id}`} onClick={() => remove(item)} title="Delete">{""}</Button>}
              </div>
            </>)}
          </div>
        ))}
      </Panel>
    </div>
  );
}
