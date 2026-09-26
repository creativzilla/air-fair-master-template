import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Copy, DownloadCloud, ExternalLink, Search, Trash2, Upload } from "lucide-react";
import { T, fontBody, Badge, Button, Drawer, EmptyState, FieldLabel, FilterPills, Modal, Notice, PageTitle, Panel, Spinner, inputStyle } from "./ui.jsx";
import { deleteMedia, findMediaUsage, importPendingMedia, listMedia, publishDocuments, updateMedia, uploadMedia } from "./api.js";

const isPending = item => !item.storage_path;

function useMediaList() {
  const [items, setItems] = useState(null);
  const [error, setError] = useState("");
  const reload = useCallback(async () => {
    try { setItems(await listMedia()); setError(""); } catch (err) { setError(err.message || "Could not load media."); setItems([]); }
  }, []);
  useEffect(() => { reload(); }, [reload]);
  return { items, setItems, error, reload };
}

function UploadButton({ onUploaded, label = "Upload" }) {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const onFiles = async e => {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (!files.length) return;
    setBusy(true); setError("");
    try {
      const uploaded = [];
      for (const file of files) uploaded.push(await uploadMedia(file));
      onUploaded(uploaded);
    } catch (err) {
      setError(err.message || "Upload failed.");
    } finally { setBusy(false); }
  };
  return (
    <div className="flex flex-col items-end gap-1">
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple onChange={onFiles} style={{ display: "none" }} />
      <Button icon={Upload} busy={busy} onClick={() => inputRef.current?.click()}>{busy ? "Uploading..." : label}</Button>
      {error && <span className="text-xs" style={{ color: T.danger, ...fontBody }}>{error}</span>}
    </div>
  );
}

function MediaGrid({ items, onSelect, selectedId }) {
  if (!items.length) return <EmptyState>No images match.</EmptyState>;
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {items.map(item => (
        <button key={item.id} type="button" onClick={() => onSelect(item)} className="rounded-xl overflow-hidden text-left relative"
          style={{ border: `2px solid ${selectedId === item.id ? T.accent : T.border}`, backgroundColor: T.bg }}>
          <img src={item.url} alt={item.alt_text || ""} loading="lazy" className="w-full h-28 object-cover" />
          <div className="px-2 py-1.5 text-[11px] truncate" style={{ color: T.muted, ...fontBody }}>{item.file_name || item.url.split("/").pop().split("?")[0]}</div>
          {isPending(item) && <span className="absolute top-1.5 left-1.5"><Badge status="Pending" label="Not in Storage" /></span>}
        </button>
      ))}
    </div>
  );
}

function useFiltered(items, query, filter) {
  return useMemo(() => {
    const q = query.trim().toLowerCase();
    return (items || []).filter(item => {
      if (filter === "pending" && !isPending(item)) return false;
      if (filter === "storage" && isPending(item)) return false;
      if (!q) return true;
      return [item.file_name, item.alt_text, item.url].some(v => (v || "").toLowerCase().includes(q));
    });
  }, [items, query, filter]);
}

// Picker used by every image field in the dashboard.
export function MediaPickerModal({ onClose, onPick }) {
  const { items, setItems, error } = useMediaList();
  const [query, setQuery] = useState("");
  const filtered = useFiltered(items, query, "all");
  return (
    <Modal title="Choose an image" onClose={onClose} wide footer={<UploadButton label="Upload new" onUploaded={uploaded => { setItems(prev => [...uploaded, ...(prev || [])]); onPick(uploaded[0]); }} />}>
      <div className="flex flex-col gap-4">
        <div className="relative max-w-sm"><Search size={14} style={{ color: T.muted, position: "absolute", left: 10, top: 10 }} /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search images" className="w-full rounded-lg pl-8 pr-3 py-2 text-sm outline-none" style={inputStyle} /></div>
        {error && <Notice tone="danger">{error}</Notice>}
        {items === null ? <Spinner /> : <MediaGrid items={filtered} onSelect={onPick} />}
      </div>
    </Modal>
  );
}

function MediaDetails({ item, role, onClose, onChanged, onDeleted }) {
  const [alt, setAlt] = useState(item.alt_text || "");
  const [usage, setUsage] = useState(null);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const isAdmin = role === "admin";

  useEffect(() => { findMediaUsage(item.url).then(setUsage).catch(() => setUsage([])); }, [item.url]);

  const run = async (label, fn) => {
    setBusy(label); setError(""); setMessage("");
    try { await fn(); } catch (err) { setError(err.message || "Something went wrong."); } finally { setBusy(""); }
  };

  return (
    <Drawer title="Image details" onClose={onClose} footer={<>
      {isAdmin && <Button tone="danger" icon={Trash2} busy={busy === "delete"} disabled={!!usage?.length} title={usage?.length ? "Remove it from the content first" : undefined}
        onClick={() => run("delete", async () => { if (!window.confirm("Delete this image permanently?")) return; await deleteMedia(item); onDeleted(item); })}>Delete</Button>}
      <Button busy={busy === "save"} onClick={() => run("save", async () => { onChanged(await updateMedia(item.id, { alt_text: alt || null })); setMessage("Saved."); })}>Save</Button>
    </>}>
      <div className="flex flex-col gap-4">
        <img src={item.url} alt={alt} className="w-full rounded-xl object-contain" style={{ maxHeight: 280, backgroundColor: T.bg, border: `1px solid ${T.border}` }} />
        {isPending(item) && <Notice tone="warn">This image still loads from its original address ({new URL(item.url, window.location.origin).host || "this website"}). Use "Import to Storage" to keep a copy in your media library.</Notice>}
        <div>
          <FieldLabel hint="Describes the image for screen readers and search engines.">Alt text</FieldLabel>
          <input value={alt} onChange={e => setAlt(e.target.value)} className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={inputStyle} />
        </div>
        <div className="text-xs flex flex-col gap-1" style={{ color: T.muted, ...fontBody }}>
          {item.width && <span>{item.width} × {item.height}px{item.size_bytes ? ` · ${(item.size_bytes / 1024).toFixed(0)} KB` : ""}</span>}
          <span className="break-all">{item.url}</span>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button tone="outline" small icon={Copy} onClick={() => { navigator.clipboard?.writeText(item.url); setMessage("URL copied."); }}>Copy URL</Button>
          <a href={item.url} target="_blank" rel="noreferrer"><Button tone="outline" small icon={ExternalLink}>Open</Button></a>
          {isPending(item) && <Button tone="soft" small icon={DownloadCloud} busy={busy === "import"} onClick={() => run("import", async () => { const { media, changedDocs } = await importPendingMedia(item); onChanged(media); setMessage(`Imported. ${changedDocs.length} draft${changedDocs.length === 1 ? "" : "s"} now use the new copy — publish them to update the website.`); })}>Import to Storage</Button>}
        </div>
        {message && <Notice tone="success">{message}</Notice>}
        {error && <Notice tone="danger">{error}</Notice>}
        <div>
          <FieldLabel>Used in</FieldLabel>
          {usage === null ? <span className="text-xs" style={{ color: T.muted }}>Checking…</span> : usage.length === 0 ? <span className="text-xs" style={{ color: T.muted, ...fontBody }}>Not used in any page or service.</span> : (
            <ul className="text-sm flex flex-col gap-1" style={{ color: T.ink, ...fontBody }}>{usage.map(u => <li key={u.id}>{u.title} <span className="text-xs" style={{ color: T.muted }}>({u.kind.replace(/_/g, " ")})</span></li>)}</ul>
          )}
        </div>
      </div>
    </Drawer>
  );
}

export default function MediaLibrary({ role }) {
  const { items, setItems, error } = useMediaList();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState(null);
  const [bulk, setBulk] = useState(null);
  const filtered = useFiltered(items, query, filter);
  const pendingCount = (items || []).filter(isPending).length;

  const importAll = async () => {
    const pending = (items || []).filter(isPending);
    const changed = new Map();
    const failures = [];
    for (let i = 0; i < pending.length; i++) {
      setBulk({ running: true, done: i, total: pending.length, failures, changed: changed.size });
      try {
        const { media, changedDocs } = await importPendingMedia(pending[i]);
        changedDocs.forEach(doc => changed.set(doc.id, doc));
        setItems(prev => prev.map(m => (m.id === media.id ? media : m)));
      } catch (err) {
        failures.push(`${pending[i].url}: ${err.message}`);
      }
    }
    setBulk({ running: false, done: pending.length, total: pending.length, failures, changed: changed.size, changedIds: [...changed.keys()] });
  };

  const publishChanged = async () => {
    setBulk(prev => ({ ...prev, publishing: true }));
    try {
      await publishDocuments(bulk.changedIds, "Images moved to the media library");
      setBulk(prev => ({ ...prev, publishing: false, published: true }));
    } catch (err) {
      setBulk(prev => ({ ...prev, publishing: false, failures: [...prev.failures, err.message] }));
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <PageTitle title="Media" subtitle="Images used across your website. Upload once, reuse anywhere." actions={<UploadButton onUploaded={uploaded => setItems(prev => [...uploaded, ...(prev || [])])} />} />
      {pendingCount > 0 && (
        <Panel className="p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="text-sm" style={{ color: T.ink, ...fontBody }}><strong>{pendingCount}</strong> image{pendingCount === 1 ? "" : "s"} still load from their original address (website files or Unsplash). Import them to keep your own copy — the website looks the same.</p>
            <Button tone="soft" icon={DownloadCloud} busy={bulk?.running} onClick={importAll}>Import all to Storage</Button>
          </div>
          {bulk && <Notice tone={bulk.failures.length ? "warn" : "success"}>
            {bulk.running ? `Importing ${bulk.done + 1} of ${bulk.total}…` : `Imported ${bulk.total - bulk.failures.length} of ${bulk.total}. ${bulk.changed} draft${bulk.changed === 1 ? "" : "s"} updated.`}
            {bulk.failures.length > 0 && <span className="block mt-1">Failed: {bulk.failures.join("; ")}</span>}
          </Notice>}
          {bulk && !bulk.running && bulk.changed > 0 && !bulk.published && (role === "admin"
            ? <div><Button busy={bulk.publishing} onClick={publishChanged}>Publish the {bulk.changed} updated item{bulk.changed === 1 ? "" : "s"}</Button></div>
            : <Notice tone="info">Ask an admin to publish the updated pages so the website uses the new copies.</Notice>)}
          {bulk?.published && <Notice tone="success">Published. The website now loads these images from your media library.</Notice>}
        </Panel>
      )}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <FilterPills options={[{ value: "all", label: "All" }, { value: "storage", label: "In media library" }, { value: "pending", label: "Not imported yet" }]} active={filter} onChange={setFilter} />
        <div className="relative w-full sm:w-64"><Search size={14} style={{ color: T.muted, position: "absolute", left: 10, top: 10 }} /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search images" className="w-full rounded-lg pl-8 pr-3 py-2 text-sm outline-none" style={inputStyle} /></div>
      </div>
      {error && <Notice tone="danger">{error}</Notice>}
      {items === null ? <Spinner /> : <MediaGrid items={filtered} onSelect={setSelected} selectedId={selected?.id} />}
      {selected && <MediaDetails key={selected.id} item={selected} role={role} onClose={() => setSelected(null)}
        onChanged={updated => { setItems(prev => prev.map(m => (m.id === updated.id ? updated : m))); setSelected(updated); }}
        onDeleted={deleted => { setItems(prev => prev.filter(m => m.id !== deleted.id)); setSelected(null); }} />}
    </div>
  );
}
