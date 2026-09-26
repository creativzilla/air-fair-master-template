// Client documents: files the team keeps for each CRM client, stored in the
// private "client-documents" bucket and opened through short-lived signed
// URLs. Also lists files the client attached to website forms.
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Download, Eye, FileText, FolderOpen, Image as ImageIcon, Paperclip, Search, Trash2, Upload } from "lucide-react";
import { T, fontBody, Badge, Button, EmptyState, FieldLabel, Notice, PageTitle, Panel, Spinner, Tabs, formatDateTime, inputStyle } from "./ui.jsx";
import TeamResources, { SETUP_MESSAGE, isMissingTableError } from "./TeamResources.jsx";
import { supabase } from "../lib/supabase.js";

const BUCKET = "client-documents";
const MAX_BYTES = 25 * 1024 * 1024;
const ALLOWED = new Set([
  "application/pdf", "image/jpeg", "image/png", "image/webp", "image/heic", "image/heif",
  "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "text/plain",
]);
const EXT_TYPES = { pdf: "application/pdf", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", heic: "image/heic", heif: "image/heif", doc: "application/msword", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", xls: "application/vnd.ms-excel", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", txt: "text/plain" };
export const DOCUMENT_CATEGORIES = ["Passport", "Visa", "ID / ACR I-Card", "Birth / Marriage certificate", "Bank & financial", "Employment", "Application form", "Receipt / Payment", "Contract", "Other"];

const formatSize = bytes => (bytes == null ? "" : bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`);
const typeOf = file => file.type || EXT_TYPES[(file.name.split(".").pop() || "").toLowerCase()] || "";

async function signedUrl(bucket, path, downloadName) {
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 60, downloadName ? { download: downloadName } : undefined);
  if (error) throw error;
  return data.signedUrl;
}

function FileIcon({ mime }) {
  const Icon = (mime || "").startsWith("image/") ? ImageIcon : FileText;
  return <span className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: T.accentSoft, color: T.accent }}><Icon size={17} /></span>;
}

function useDocumentCounts() {
  const [counts, setCounts] = useState({});
  const reload = useCallback(async () => {
    const { data } = await supabase.from("client_documents").select("contact_id");
    const next = {};
    (data || []).forEach(r => { next[r.contact_id] = (next[r.contact_id] || 0) + 1; });
    setCounts(next);
  }, []);
  useEffect(() => { reload(); }, [reload]);
  return { counts, reload };
}

function UploadZone({ contactId, onUploaded }) {
  const inputRef = useRef(null);
  const [category, setCategory] = useState("Other");
  const [note, setNote] = useState("");
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState(null);
  const [errors, setErrors] = useState([]);

  const upload = async fileList => {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    const problems = [];
    const uploaded = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setProgress(`Uploading ${i + 1} of ${files.length}: ${file.name}`);
      const mime = typeOf(file);
      if (!ALLOWED.has(mime)) { problems.push(`${file.name}: file type not allowed (use PDF, images, Word, Excel or text).`); continue; }
      if (file.size > MAX_BYTES) { problems.push(`${file.name}: larger than 25 MB.`); continue; }
      const id = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      const path = `${contactId}/${id}-${file.name.replace(/[^\w.-]+/g, "_").slice(-100)}`;
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: mime, upsert: false });
      if (upErr) { problems.push(`${file.name}: ${upErr.message}`); continue; }
      const { data, error } = await supabase.from("client_documents").insert({
        contact_id: contactId, file_name: file.name.slice(0, 255), storage_path: path, mime_type: mime, size_bytes: file.size, category, note: note.trim() || null,
      }).select().single();
      if (error) { problems.push(isMissingTableError(error) ? SETUP_MESSAGE : `${file.name}: ${error.message}`); await supabase.storage.from(BUCKET).remove([path]); continue; }
      uploaded.push(data);
    }
    setProgress(null);
    setErrors([...new Set(problems)]);
    if (uploaded.length) { setNote(""); onUploaded(uploaded); }
  };

  return (
    <Panel className="p-5 flex flex-col gap-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <FieldLabel>Category</FieldLabel>
          <select value={category} onChange={e => setCategory(e.target.value)} className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={{ ...inputStyle, backgroundColor: "#fff" }}>
            {DOCUMENT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <FieldLabel>Note (optional)</FieldLabel>
          <input value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. Expires March 2031" className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={inputStyle} />
        </div>
      </div>
      <input ref={inputRef} type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.webp,.heic,.heif,.doc,.docx,.xls,.xlsx,.txt" style={{ display: "none" }} onChange={e => { upload(e.target.files); e.target.value = ""; }} />
      <button type="button" disabled={!!progress} onClick={() => inputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); upload(e.dataTransfer.files); }}
        className="rounded-xl flex flex-col items-center justify-center gap-2 py-8 px-4 text-center"
        style={{ border: `1.5px dashed ${dragging ? T.accent : T.border}`, backgroundColor: dragging ? T.accentSoft : T.bg }}>
        <Upload size={22} style={{ color: T.accent }} />
        <span className="text-sm font-semibold" style={{ color: T.ink, ...fontBody }}>{progress || "Drop files here or click to upload"}</span>
        <span className="text-xs" style={{ color: T.muted, ...fontBody }}>PDF, images, Word, Excel or text · up to 25 MB each · saved as “{category}”</span>
      </button>
      {errors.length > 0 && <Notice tone="danger">{errors.map(e => <span key={e} className="block">{e}</span>)}</Notice>}
    </Panel>
  );
}

function ClientFiles({ contact, role, onCountChanged }) {
  const [docs, setDocs] = useState(null);
  const [attachments, setAttachments] = useState([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(null);
  const [filter, setFilter] = useState("All");
  const isAdmin = role === "admin";

  const load = useCallback(async () => {
    setError("");
    const { data, error: err } = await supabase.from("client_documents").select("*").eq("contact_id", contact.id).order("created_at", { ascending: false });
    if (err) { setError(isMissingTableError(err) ? SETUP_MESSAGE : err.message); setDocs([]); } else setDocs(data || []);
    // Files the client attached to website forms (linked submission, or same email).
    const ors = [contact.submissionId && `id.eq.${contact.submissionId}`, contact.email && `email.eq."${contact.email.replace(/"/g, "")}"`].filter(Boolean);
    if (ors.length) {
      const { data: subs } = await supabase.from("form_submissions").select("id,form_type,created_at,attachments").or(ors.join(","));
      setAttachments((subs || []).flatMap(s => (Array.isArray(s.attachments) ? s.attachments : []).map(a => ({ ...a, submittedAt: s.created_at, formType: s.form_type }))));
    } else setAttachments([]);
  }, [contact.id, contact.submissionId, contact.email]);
  useEffect(() => { setDocs(null); load(); }, [load]);

  const open = async (bucket, path, downloadName, key) => {
    const tab = downloadName ? null : window.open("about:blank", "_blank");
    setBusy(key); setError("");
    try {
      const url = await signedUrl(bucket, path, downloadName);
      if (tab) tab.location.href = url;
      else { const a = document.createElement("a"); a.href = url; a.rel = "noopener"; document.body.appendChild(a); a.click(); a.remove(); }
    } catch (err) { tab?.close(); setError(err.message || "Could not open the file."); } finally { setBusy(null); }
  };

  const remove = async doc => {
    if (!window.confirm(`Delete "${doc.file_name}" permanently?`)) return;
    setBusy(`del-${doc.id}`); setError("");
    const { error: storageErr } = await supabase.storage.from(BUCKET).remove([doc.storage_path]);
    if (storageErr) { setError(storageErr.message); setBusy(null); return; }
    const { error: rowErr } = await supabase.from("client_documents").delete().eq("id", doc.id);
    setBusy(null);
    if (rowErr) { setError(rowErr.message); return; }
    setDocs(prev => prev.filter(d => d.id !== doc.id));
    onCountChanged();
  };

  const updateField = async (doc, patch) => {
    const { data, error: err } = await supabase.from("client_documents").update(patch).eq("id", doc.id).select().single();
    if (err) setError(err.message); else setDocs(prev => prev.map(d => (d.id === doc.id ? data : d)));
  };

  const categories = useMemo(() => ["All", ...new Set((docs || []).map(d => d.category))], [docs]);
  const shown = (docs || []).filter(d => filter === "All" || d.category === filter);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-lg" style={{ color: T.ink, ...fontBody, fontWeight: 600 }}>{contact.name}</h2>
        <p className="text-xs" style={{ color: T.muted, ...fontBody }}>{[contact.email, contact.phone, contact.category].filter(Boolean).join(" · ")}</p>
      </div>
      <UploadZone contactId={contact.id} onUploaded={added => { setDocs(prev => [...added, ...(prev || [])]); onCountChanged(); }} />
      {error && <Notice tone="danger">{error}</Notice>}
      <Panel className="overflow-hidden">
        <div className="flex items-center justify-between gap-3 flex-wrap px-5 py-3" style={{ borderBottom: `1px solid ${T.border}` }}>
          <h3 className="text-sm font-semibold" style={{ color: T.ink, ...fontBody }}>Documents {docs && <span style={{ color: T.muted, fontWeight: 400 }}>({docs.length})</span>}</h3>
          {categories.length > 2 && (
            <select value={filter} onChange={e => setFilter(e.target.value)} className="rounded-lg px-2 py-1.5 text-xs outline-none" style={{ ...inputStyle, backgroundColor: "#fff" }}>
              {categories.map(c => <option key={c} value={c}>{c === "All" ? "All categories" : c}</option>)}
            </select>
          )}
        </div>
        {docs === null ? <Spinner /> : shown.length === 0 ? <EmptyState>{docs.length ? "No documents in this category." : "No documents yet. Upload the client's files above."}</EmptyState> : shown.map((doc, i) => (
          <div key={doc.id} className="flex items-start gap-3 px-5 py-3.5 flex-wrap sm:flex-nowrap" style={{ borderBottom: i < shown.length - 1 ? `1px solid ${T.border}` : "none" }}>
            <FileIcon mime={doc.mime_type} />
            <div className="flex-1 min-w-[180px]">
              <div className="text-sm font-medium break-all" style={{ color: T.ink, ...fontBody }}>{doc.file_name}</div>
              <div className="text-xs mt-0.5" style={{ color: T.muted, ...fontBody }}>{formatSize(doc.size_bytes)} · {formatDateTime(doc.created_at)}</div>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <select value={doc.category} onChange={e => updateField(doc, { category: e.target.value })} className="rounded-md px-2 py-1 text-xs outline-none" style={{ ...inputStyle, backgroundColor: "#fff" }} aria-label="Category">
                  {[...new Set([doc.category, ...DOCUMENT_CATEGORIES])].map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <input defaultValue={doc.note || ""} onBlur={e => { const v = e.target.value.trim() || null; if (v !== (doc.note || null)) updateField(doc, { note: v }); }} placeholder="Add a note" className="flex-1 min-w-[120px] rounded-md px-2 py-1 text-xs outline-none" style={inputStyle} aria-label="Note" />
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <Button tone="outline" small icon={Eye} busy={busy === `view-${doc.id}`} onClick={() => open(BUCKET, doc.storage_path, null, `view-${doc.id}`)}>View</Button>
              <Button tone="soft" small icon={Download} busy={busy === `dl-${doc.id}`} onClick={() => open(BUCKET, doc.storage_path, doc.file_name, `dl-${doc.id}`)}>Download</Button>
              {isAdmin && <Button tone="danger" small icon={Trash2} busy={busy === `del-${doc.id}`} onClick={() => remove(doc)} title="Delete">{""}</Button>}
            </div>
          </div>
        ))}
      </Panel>

      {attachments.length > 0 && (
        <Panel className="overflow-hidden">
          <div className="px-5 py-3" style={{ borderBottom: `1px solid ${T.border}` }}><h3 className="text-sm font-semibold" style={{ color: T.ink, ...fontBody }}>Sent through website forms <span style={{ color: T.muted, fontWeight: 400 }}>({attachments.length})</span></h3></div>
          {attachments.map((a, i) => (
            <div key={a.path} className="flex items-center gap-3 px-5 py-3" style={{ borderBottom: i < attachments.length - 1 ? `1px solid ${T.border}` : "none" }}>
              <Paperclip size={15} style={{ color: T.muted }} className="shrink-0" />
              <div className="flex-1 min-w-0"><div className="text-sm truncate" style={{ color: T.ink, ...fontBody }}>{a.name}</div><div className="text-xs" style={{ color: T.muted, ...fontBody }}>{formatSize(a.size)} · {formatDateTime(a.submittedAt)}</div></div>
              <Button tone="soft" small icon={Download} busy={busy === `att-${a.path}`} onClick={() => open("form-attachments", a.path, a.name, `att-${a.path}`)}>Download</Button>
            </div>
          ))}
        </Panel>
      )}
    </div>
  );
}

export default function ClientDocuments({ contacts, role, selectedContactId, onSelectContact }) {
  const [tab, setTab] = useState("clients");
  const { counts, reload } = useDocumentCounts();
  const [query, setQuery] = useState("");
  const [onlyWithFiles, setOnlyWithFiles] = useState(false);
  const selected = contacts.find(c => c.id === selectedContactId) || null;

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return contacts
      .filter(c => !q || [c.name, c.email, c.phone].some(v => (v || "").toLowerCase().includes(q)))
      .filter(c => !onlyWithFiles || counts[c.id])
      .sort((a, b) => (counts[b.id] || 0) - (counts[a.id] || 0) || a.name.localeCompare(b.name));
  }, [contacts, query, onlyWithFiles, counts]);

  return (
    <div className="flex flex-col gap-6">
      <PageTitle title="Documents" subtitle="Client files and your team's internal resources. Everything here is private to your team." />
      <Tabs tabs={[{ id: "clients", label: "Client files" }, { id: "resources", label: "Team resources" }]} active={tab} onChange={setTab} />
      {tab === "resources" ? <TeamResources role={role} /> : contacts.length === 0 ? <Panel><EmptyState>No clients yet. Clients appear here once they are in the Pipeline.</EmptyState></Panel> : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 dash-grid-3">
          <div className={`flex flex-col gap-3 ${selected ? "hidden lg:flex" : ""}`}>
            <div className="relative"><Search size={14} style={{ color: T.muted, position: "absolute", left: 10, top: 10 }} /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search clients" className="w-full rounded-lg pl-8 pr-3 py-2 text-sm outline-none" style={inputStyle} /></div>
            <label className="flex items-center gap-2 text-xs" style={{ color: T.muted, ...fontBody }}><input type="checkbox" checked={onlyWithFiles} onChange={e => setOnlyWithFiles(e.target.checked)} style={{ accentColor: T.accent }} /> Only clients with documents</label>
            <Panel className="overflow-hidden">
              {list.map((c, i) => (
                <button key={c.id} type="button" onClick={() => onSelectContact(c.id)} className="w-full flex items-center gap-3 px-4 py-3 text-left"
                  style={{ borderBottom: i < list.length - 1 ? `1px solid ${T.border}` : "none", backgroundColor: selected?.id === c.id ? T.accentSoft : "transparent" }}>
                  <FolderOpen size={16} style={{ color: counts[c.id] ? T.accent : T.muted }} className="shrink-0" />
                  <div className="flex-1 min-w-0"><div className="text-sm truncate" style={{ color: T.ink, ...fontBody }}>{c.name}</div><div className="text-xs truncate" style={{ color: T.muted, ...fontBody }}>{c.email}</div></div>
                  {counts[c.id] ? <Badge status="Qualified" label={String(counts[c.id])} /> : null}
                </button>
              ))}
              {list.length === 0 && <EmptyState>No clients match.</EmptyState>}
            </Panel>
          </div>
          <div className="lg:col-span-2 min-w-0">
            {selected ? (<>
              <button type="button" onClick={() => onSelectContact(null)} className="lg:hidden text-sm mb-3" style={{ color: T.muted, ...fontBody }}>← All clients</button>
              <ClientFiles key={selected.id} contact={selected} role={role} onCountChanged={reload} />
            </>) : <Panel><EmptyState>Choose a client to see and upload their documents.</EmptyState></Panel>}
          </div>
        </div>
      )}
    </div>
  );
}
