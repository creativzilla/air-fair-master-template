import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Eye, History, RotateCcw, Save, Send, Undo2 } from "lucide-react";
import { T, fontBody, Badge, Button, Drawer, EmptyState, Notice, Spinner, formatDateTime, useUnsavedWarning } from "./ui.jsx";
import { ConflictError, docStatus, fetchProfilesMap, getDocument, listDocuments, listVersions, publishDocuments, restoreVersion, saveDraft, unpublishDocument } from "./api.js";
import { buildIndex } from "../lib/cmsAdapters.js";
import { FALLBACK_DOCS } from "../lib/cmsFallback.js";

const PAGE_URLS = { home: "/", "immigration-hub": "/philippine-immigration-services", "visa-hub": "/visa-assistance/international-tourist-visa", "travel-hub": "/travel-tours", news: "/news" };

export function previewUrlFor(doc) {
  if (!doc) return "/";
  switch (doc.kind) {
    case "page": return PAGE_URLS[doc.slug] || "/";
    case "immigration_service": return `/philippine-immigration-services/${doc.slug}`;
    case "visa_destination": return `/visa-assistance/${doc.slug}`;
    case "travel_package": return `/travel-tours/${doc.slug}`;
    case "travel_destination": return "/travel-tours#destinations";
    case "news_article": return `/news/${doc.slug}`;
    case "testimonial": return "/#about";
    default: return "/";
  }
}

// Draft content merged over the code fallback, so fields the CMS has never
// stored (e.g. newly editable labels) show up in the editor too.
function editableContent(doc) {
  const row = { document_id: doc.id, version_id: null, kind: doc.kind, slug: doc.slug, title: doc.title, sort_order: doc.sort_order, content: doc.draft };
  return buildIndex([row], FALLBACK_DOCS).get(doc.kind, doc.slug)?.content || doc.draft || {};
}

export function useDocumentEditor(docId) {
  const [doc, setDoc] = useState(null);
  const [draft, setDraft] = useState(null);
  const [meta, setMeta] = useState({ title: "", slug: "", sort_order: 0 });
  const [baseline, setBaseline] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const adopt = useCallback(fresh => {
    const content = editableContent(fresh);
    const nextMeta = { title: fresh.title, slug: fresh.slug, sort_order: fresh.sort_order };
    setDoc(fresh);
    setDraft(content);
    setMeta(nextMeta);
    setBaseline(JSON.stringify([content, nextMeta]));
  }, []);

  const reload = useCallback(async () => {
    if (!docId) return;
    setError("");
    try { adopt(await getDocument(docId)); } catch (err) { setError(err.message || "Could not load this item."); }
  }, [docId, adopt]);

  useEffect(() => { setDoc(null); setDraft(null); reload(); }, [reload]);

  const dirty = !!doc && JSON.stringify([draft, meta]) !== baseline;
  useUnsavedWarning(dirty);

  // overrides: { draft, title, slug, sort_order, form_document_id } applied on top of the editor state.
  const save = useCallback(async (overrides = {}) => {
    if (!doc) return null;
    setSaving(true); setError("");
    try {
      const saved = await saveDraft(doc, { draft, title: meta.title, slug: meta.slug, sort_order: Number(meta.sort_order) || 0, ...overrides });
      adopt(saved);
      return saved;
    } catch (err) {
      setError(err instanceof ConflictError ? err.message : friendlyError(err));
      throw err;
    } finally { setSaving(false); }
  }, [doc, draft, meta, adopt]);

  return { doc, setDoc: adopt, draft, setDraft, meta, setMeta, dirty, save, saving, error, setError, reload };
}

export function friendlyError(err) {
  const msg = err?.message || String(err);
  if (/duplicate key|cms_documents_kind_slug_key/i.test(msg)) return "That URL slug is already used by another item.";
  if (/slug/i.test(msg) && /check/i.test(msg)) return "URL slug can only contain lowercase letters, numbers and single dashes.";
  if (/row-level security|permission denied|42501|Only admins/i.test(msg)) return "You don't have permission to do that. Ask an admin.";
  return msg;
}

// Status + Save draft / Preview / Publish / Unpublish / History.
// `companions` are other documents published together (e.g. the service's form).
export function PublishBar({ editor, role, companions = [], onPublished, extraDirty = false, onSaveAll }) {
  const { doc, dirty, save, saving } = editor;
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const isAdmin = role === "admin";
  const anyDirty = dirty || extraDirty;
  const status = docStatus(doc);
  const companionChanged = companions.some(c => docStatus(c) !== "Published");

  const saveAll = async () => (onSaveAll ? onSaveAll() : save());

  const run = async (label, fn) => {
    setBusy(label); setError(""); setMessage("");
    try { await fn(); } catch (err) { setError(friendlyError(err)); } finally { setBusy(""); }
  };

  const onSave = () => run("save", async () => { await saveAll(); await onPublished?.(); setMessage("Draft saved. It is not on the website until it is published."); });
  const onPreview = () => {
    // Open the tab synchronously (pop-up blockers), then point it at the page once the draft is saved.
    const tab = window.open("about:blank", "_blank");
    const url = previewUrlFor(doc);
    const target = url.includes("#") ? url.replace("#", "?preview=1#") : `${url}?preview=1`;
    run("preview", async () => {
      try {
        if (anyDirty) await saveAll();
        if (tab) tab.location.href = target; else window.open(target, "_blank");
      } catch (err) {
        tab?.close();
        throw err;
      }
    });
  };
  const onPublish = () => run("publish", async () => {
    if (anyDirty) await saveAll();
    await publishDocuments([doc.id, ...companions.map(c => c.id)], null);
    await editor.reload();
    await onPublished?.();
    setMessage("Published. The website now shows this version.");
  });
  const onUnpublish = () => run("unpublish", async () => {
    if (!window.confirm("Take this off the website? The draft is kept and can be published again.")) return;
    await unpublishDocument(doc.id);
    await editor.reload();
    await onPublished?.();
    setMessage("Unpublished. It no longer appears on the website.");
  });

  if (!doc) return null;
  return (
    <div className="rounded-xl px-4 py-3 flex flex-col gap-2" style={{ backgroundColor: T.surface, border: `1px solid ${T.border}` }}>
      <div className="flex items-center gap-2 flex-wrap">
        <Badge status={status} />
        {anyDirty && <Badge status="Pending" label="Unsaved edits" />}
        {doc.published_at && <span className="text-xs" style={{ color: T.muted, ...fontBody }}>Last published {formatDateTime(doc.published_at)}</span>}
        <div className="flex-1" />
        <Button tone="ghost" small icon={History} onClick={() => setHistoryOpen(true)}>History</Button>
        <Button tone="outline" small icon={Eye} busy={busy === "preview"} onClick={onPreview}>Preview</Button>
        <Button tone="soft" small icon={Save} busy={busy === "save" || saving} disabled={!anyDirty} onClick={onSave}>Save draft</Button>
        {isAdmin && doc.published_version_id && <Button tone="outline" small icon={Undo2} busy={busy === "unpublish"} onClick={onUnpublish}>Unpublish</Button>}
        <Button small icon={Send} busy={busy === "publish"} disabled={!isAdmin || (!anyDirty && status === "Published" && !companionChanged)}
          title={isAdmin ? undefined : "Only admins can publish"} onClick={onPublish}>Publish</Button>
      </div>
      {!isAdmin && <p className="text-xs" style={{ color: T.muted, ...fontBody }}>Editors save drafts and use Preview; an admin publishes changes to the website.</p>}
      {message && <Notice tone="success">{message}</Notice>}
      {(error || editor.error) && <Notice tone="danger">{error || editor.error}</Notice>}
      {historyOpen && <HistoryDrawer doc={doc} onClose={() => setHistoryOpen(false)} onRestored={async () => { await editor.reload(); setHistoryOpen(false); setMessage("Version restored into the draft. Review it, then publish."); }} canRestore={role === "admin" || role === "editor"} dirty={anyDirty} />}
    </div>
  );
}

const ACTION_LABEL = { save: "Draft saved", publish: "Published", restore: "Restored", unpublish: "Unpublished" };
const ACTION_STATUS = { save: "Draft", publish: "Published", restore: "Pending", unpublish: "Archived" };

export function HistoryDrawer({ doc, onClose, onRestored, canRestore, dirty }) {
  const [versions, setVersions] = useState(null);
  const [people, setPeople] = useState({});
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    listVersions(doc.id).then(setVersions).catch(err => { setError(err.message); setVersions([]); });
    fetchProfilesMap().then(setPeople).catch(() => {});
  }, [doc.id]);

  const restore = async version => {
    if (dirty && !window.confirm("You have unsaved edits. Restoring replaces them. Continue?")) return;
    setBusy(version.id); setError("");
    try { await restoreVersion(version.id); await onRestored(); } catch (err) { setError(friendlyError(err)); } finally { setBusy(null); }
  };

  const publishedVersionId = doc.published_version_id;
  return (
    <Drawer title={`History — ${doc.title}`} onClose={onClose}>
      <p className="text-xs mb-4" style={{ color: T.muted, ...fontBody }}>Every save and publish is kept. Restoring copies that version into the draft; the website only changes when it is published again.</p>
      {error && <div className="mb-3"><Notice tone="danger">{error}</Notice></div>}
      {versions === null ? <Spinner /> : versions.length === 0 ? <EmptyState>No history yet.</EmptyState> : (
        <ol className="flex flex-col">
          {versions.map(v => (
            <li key={v.id} className="flex items-start gap-3 py-3" style={{ borderBottom: `1px solid ${T.border}` }}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap"><span className="text-sm font-medium" style={{ color: T.ink, ...fontBody }}>v{v.version_no}</span><Badge status={ACTION_STATUS[v.action]} label={ACTION_LABEL[v.action]} />{v.id === publishedVersionId && <Badge status="Published" label="Live now" />}</div>
                <div className="text-xs mt-1" style={{ color: T.muted, ...fontBody }}>{formatDateTime(v.created_at)}{v.created_by && people[v.created_by] ? ` · ${people[v.created_by]}` : v.created_by ? "" : " · system"}</div>
                {v.note && <div className="text-xs mt-1" style={{ color: T.ink, ...fontBody }}>{v.note}</div>}
              </div>
              {canRestore && v.action !== "unpublish" && <Button tone="outline" small icon={RotateCcw} busy={busy === v.id} onClick={() => restore(v)}>Restore</Button>}
            </li>
          ))}
        </ol>
      )}
    </Drawer>
  );
}

// Loads every document of the given kinds with status, for list screens.
export function useDocumentList(kinds) {
  const key = Array.isArray(kinds) ? kinds.join(",") : kinds;
  const [docs, setDocs] = useState(null);
  const [error, setError] = useState("");
  const reload = useCallback(async () => {
    try {
      setDocs(await listDocuments(key.split(",")));
      setError("");
    } catch (err) { setError(err.message); setDocs([]); }
  }, [key]);
  useEffect(() => { reload(); }, [reload]);
  const samplesByKind = useMemo(() => {
    const map = {};
    [...(docs || []).map(d => ({ kind: d.kind, content: d.draft })), ...FALLBACK_DOCS].forEach(d => { (map[d.kind] ||= []).push(d.content); });
    return map;
  }, [docs]);
  return { docs, setDocs, error, reload, samplesByKind };
}
