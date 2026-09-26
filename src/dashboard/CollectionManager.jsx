// List + single-screen editor for collections of CMS documents: immigration
// services, visa destinations, travel packages, popular destinations, news
// and testimonials. Services also get their form (builder + live preview)
// and poster on the same screen; the item and its form publish together.
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Archive, ArchiveRestore, ArrowLeft, Copy, Plus, Search } from "lucide-react";
import { T, fontBody, Badge, Button, EmptyState, FieldLabel, FilterPills, LabeledInput, LabeledSelect, Modal, Notice, PageTitle, Panel, Spinner, Tabs, inputStyle } from "./ui.jsx";
import ContentEditor from "./ContentEditor.jsx";
import { FormBuilder, FormPreview } from "./FormBuilder.jsx";
import { PublishBar, friendlyError, previewUrlFor, useDocumentEditor, useDocumentList } from "./DocumentWorkflow.jsx";
import { archiveDocument, createDocument, docStatus, getDocument, listDocuments, saveDraft } from "./api.js";
import { imageSrc } from "../lib/cmsAdapters.js";
import { supabase } from "../lib/supabase.js";
import TravelPosterEditor from "../components/travel/TravelPosterEditor.jsx";

export const COLLECTIONS = {
  immigration_service: { label: "Immigration services", singular: "immigration service", form: "own", poster: false, titleKey: "title" },
  visa_destination: { label: "Visa destinations", singular: "visa destination", form: "visa-inquiry", poster: "visa", titleKey: "title" },
  travel_package: { label: "Travel packages", singular: "travel package", form: "travel-inquiry", poster: "travel", titleKey: "title" },
  travel_destination: { label: "Popular destinations", singular: "destination", titleKey: "name" },
  news_article: { label: "News & articles", singular: "article", titleKey: "title" },
  testimonial: { label: "Testimonials", singular: "testimonial", titleKey: "clientName" },
};

const slugify = text => String(text || "").toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);

function thumbnailOf(content = {}) {
  return imageSrc(content.heroImage || content.image || content.photo || content.gallery?.[0] || content.featuredImage) || "";
}

function defaultFormSlug(doc) {
  const cfg = COLLECTIONS[doc.kind];
  if (!cfg?.form) return null;
  return cfg.form === "own" ? `immigration-${doc.slug}` : cfg.form;
}

// The form a service uses: explicit link, else content.formKey, else default.
function resolveFormDoc(doc, forms) {
  if (!doc) return null;
  return forms.find(f => f.id === doc.form_document_id)
    || forms.find(f => f.slug === doc.draft?.formKey)
    || forms.find(f => f.slug === defaultFormSlug(doc))
    || null;
}

function Flags({ content }) {
  return <>
    {content?.featured && <Badge status="Qualified" label="Featured" />}
    {content?.showOnHome && <Badge status="Pending" label="Homepage" />}
    {content?.card?.showOnHome && <Badge status="Pending" label="Homepage" />}
    {content?.type === "story" && <Badge status="Pending" label="Homepage" />}
    {content?.type === "guide" && <Badge status="Draft" label="Guide" />}
  </>;
}

function NewItemModal({ kind, docs, forms, onClose, onCreated }) {
  const cfg = COLLECTIONS[kind];
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [fromId, setFromId] = useState(docs[0]?.id || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const create = async () => {
    setError("");
    if (!title.trim() || !slug) { setError("Enter a name and URL slug."); return; }
    setBusy(true);
    try {
      const source = docs.find(d => d.id === fromId);
      const draft = JSON.parse(JSON.stringify(source?.draft || {}));
      draft[cfg.titleKey] = title.trim();
      if ("slug" in draft) draft.slug = slug;
      if ("featured" in draft) draft.featured = false;
      if ("showOnHome" in draft) draft.showOnHome = false;
      if (draft.card) draft.card = { ...draft.card, showOnHome: false, showOnHub: true };
      if (draft.seo) draft.seo = { title: `${title.trim()} | Airfair`, description: "" };
      delete draft.formKey;
      let formDocumentId = null;
      if (cfg.form === "own" && source) {
        const sourceForm = resolveFormDoc(source, forms);
        const newForm = await createDocument({ kind: "form", slug: `immigration-${slug}`, title: `Form — ${title.trim()}`, sort_order: 100, draft: sourceForm?.draft || { title: "Start Your Assessment", layout: "sections", sections: [] } });
        formDocumentId = newForm.id;
        draft.formKey = newForm.slug;
      }
      const maxSort = Math.max(0, ...docs.map(d => d.sort_order || 0));
      const created = await createDocument({ kind, slug, title: title.trim(), sort_order: maxSort + 1, draft, form_document_id: formDocumentId });
      onCreated(created);
    } catch (err) {
      setError(friendlyError(err));
    } finally { setBusy(false); }
  };

  return (
    <Modal title={`New ${cfg.singular}`} onClose={onClose} footer={<><Button tone="outline" onClick={onClose}>Cancel</Button><Button busy={busy} onClick={create}>Create draft</Button></>}>
      <div className="flex flex-col gap-4">
        <LabeledInput label="Name" value={title} onChange={v => { setTitle(v); if (!slugTouched) setSlug(slugify(v)); }} />
        <LabeledInput label="URL slug" hint={previewUrlFor({ kind, slug: slug || "your-slug" })} value={slug} onChange={v => { setSlugTouched(true); setSlug(slugify(v)); }} />
        {docs.length > 0 && <LabeledSelect label="Start from a copy of" value={fromId} onChange={setFromId} options={docs.map(d => ({ value: d.id, label: d.title }))} />}
        <p className="text-xs" style={{ color: T.muted, ...fontBody }}>The new item is created as a draft with the copied content{cfg.form === "own" ? " and its own copy of the form" : ""}. Nothing appears on the website until an admin publishes it.</p>
        {error && <Notice tone="danger">{error}</Notice>}
      </div>
    </Modal>
  );
}

function ItemEditor({ docId, kind, role, forms, samples, onBack, onChanged, reloadForms }) {
  const cfg = COLLECTIONS[kind];
  const editor = useDocumentEditor(docId);
  const { doc, draft, setDraft, meta, setMeta } = editor;
  const formDoc = useMemo(() => resolveFormDoc(doc, forms), [doc, forms]);
  const formEditor = useDocumentEditor(formDoc?.id || null);
  const [formTab, setFormTab] = useState("build");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState("");
  const isAdmin = role === "admin";

  const sharedBy = useMemo(() => {
    if (!formDoc || cfg.form === "own") return 0;
    return samples.docs.filter(d => resolveFormDoc(d, forms)?.id === formDoc.id).length;
  }, [formDoc, samples.docs, forms, cfg.form]);

  const saveAll = useCallback(async () => {
    const titleFromContent = draft?.[cfg.titleKey];
    const nextDraft = { ...draft };
    if ("slug" in nextDraft) nextDraft.slug = meta.slug;
    await editor.save({ draft: nextDraft, title: (typeof titleFromContent === "string" && titleFromContent.trim()) || meta.title });
    if (formEditor.dirty) await formEditor.save();
    await reloadForms();
  }, [draft, meta, cfg.titleKey, editor, formEditor, reloadForms]);

  const makeCustomForm = async () => {
    setBusy("custom"); setNotice("");
    try {
      if (editor.dirty || formEditor.dirty) await saveAll();
      const fresh = await getDocument(docId);
      const newForm = await createDocument({ kind: "form", slug: `${kind === "visa_destination" ? "visa" : "travel"}-${doc.slug}`, title: `Form — ${doc.title}`, sort_order: 200, draft: formEditor.draft });
      const nextDraft = { ...fresh.draft, formKey: newForm.slug };
      editor.setDoc(await saveDraft(fresh, { draft: nextDraft, form_document_id: newForm.id }));
      await reloadForms();
      setNotice("This item now has its own form. Changes to it won't affect other items. Publish to use it on the website.");
    } catch (err) { setNotice(friendlyError(err)); } finally { setBusy(""); }
  };

  const archive = async () => {
    if (!window.confirm(`Archive "${doc.title}"? It is removed from the website and hidden here, but kept with its history.`)) return;
    setBusy("archive");
    try { await archiveDocument(doc); await onChanged(); onBack(); } catch (err) { setNotice(friendlyError(err)); setBusy(""); }
  };

  if (!doc || !draft) return editor.error ? <Notice tone="danger">{editor.error}</Notice> : <Spinner />;

  const posterSlug = cfg.poster === "visa" ? `visa-${doc.slug}` : cfg.poster === "travel" ? doc.slug : null;
  // Publish the form together with the item only when it has changes.
  const companions = formDoc && formEditor.doc && (formEditor.dirty || docStatus(formEditor.doc) !== "Published") ? [formEditor.doc] : [];
  const hidden = ["slug", "seo", "formKey", "_doc"];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3 flex-wrap">
        <button type="button" onClick={onBack} className="flex items-center gap-1 text-sm" style={{ color: T.muted, ...fontBody }}><ArrowLeft size={15} /> {cfg.label}</button>
        <h2 className="text-lg flex-1 min-w-0 truncate" style={{ color: T.ink, ...fontBody, fontWeight: 600 }}>{doc.title}</h2>
        {isAdmin && <Button tone="outline" small icon={Archive} busy={busy === "archive"} onClick={archive}>Archive</Button>}
      </div>
      <div className="sticky z-10" style={{ top: 0 }}>
        <PublishBar editor={editor} role={role} companions={companions} extraDirty={formEditor.dirty} onSaveAll={saveAll} onPublished={async () => { await formEditor.reload(); await onChanged(); }} />
      </div>
      {notice && <Notice tone="info">{notice}</Notice>}

      <Panel className="p-6 grid grid-cols-1 sm:grid-cols-3 gap-5">
        <LabeledInput label="Name in dashboard lists" value={meta.title} onChange={title => setMeta({ ...meta, title })} />
        <LabeledInput label="URL slug" hint={doc.published_version_id && !isAdmin ? "Only admins can change the URL of a published item." : previewUrlFor({ kind, slug: meta.slug })} disabled={!!doc.published_version_id && !isAdmin} value={meta.slug} onChange={slug => setMeta({ ...meta, slug: slugify(slug) })} />
        <LabeledInput label="Order in lists" type="number" value={meta.sort_order} onChange={v => setMeta({ ...meta, sort_order: v })} />
      </Panel>

      <Panel className="p-6">
        <h3 className="text-base font-semibold mb-5" style={{ color: T.ink, ...fontBody }}>Content</h3>
        <ContentEditor value={draft} onChange={setDraft} samples={samples.byKind[kind] || []} hiddenKeys={hidden} />
      </Panel>

      {draft.seo && (
        <Panel className="p-6">
          <h3 className="text-base font-semibold mb-5" style={{ color: T.ink, ...fontBody }}>SEO</h3>
          <ContentEditor value={draft.seo} onChange={seo => setDraft({ ...draft, seo })} />
        </Panel>
      )}

      {cfg.form && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h3 className="text-base" style={{ color: T.ink, ...fontBody, fontWeight: 600 }}>Form</h3>
            {sharedBy > 1 && <Button tone="outline" small icon={Copy} busy={busy === "custom"} onClick={makeCustomForm}>Use a separate form for this item</Button>}
          </div>
          {sharedBy > 1 && <Notice tone="warn">This form is shared by {sharedBy} {cfg.label.toLowerCase()}. Edits here change it for all of them.</Notice>}
          {!formDoc ? <Notice tone="warn">No form is linked to this item.</Notice> : !formEditor.draft ? <Spinner /> : (<>
            <Tabs tabs={[{ id: "build", label: "Build" }, { id: "preview", label: "Preview" }]} active={formTab} onChange={setFormTab} />
            <div className="grid grid-cols-1 xl:grid-cols-5 gap-4 dash-grid-5">
              <div className={`xl:col-span-3 min-w-0 ${formTab === "preview" ? "hidden xl:block" : ""}`}><FormBuilder form={formEditor.draft} onChange={formEditor.setDraft} /></div>
              <div className={`xl:col-span-2 min-w-0 ${formTab === "build" ? "hidden xl:block" : ""}`}><div className="xl:sticky" style={{ top: 96 }}><FormPreview form={formEditor.draft} titleVars={{ title: draft.title || doc.title }} /></div></div>
            </div>
            {formEditor.error && <Notice tone="danger">{formEditor.error}</Notice>}
          </>)}
        </div>
      )}

      {posterSlug && (
        <div className="flex flex-col gap-2">
          <h3 className="text-base" style={{ color: T.ink, ...fontBody, fontWeight: 600 }}>Sidebar poster</h3>
          <p className="text-xs" style={{ color: T.muted, ...fontBody }}>An uploaded poster replaces the default one immediately (it is not part of the draft).</p>
          <TravelPosterEditor fixedSlug={posterSlug} />
        </div>
      )}
    </div>
  );
}

export default function CollectionManager({ kinds, title, subtitle, role }) {
  const [kind, setKind] = useState(kinds[0]);
  const list = useDocumentList(kinds);
  const [forms, setForms] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [creating, setCreating] = useState(false);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [archived, setArchived] = useState(null);
  const cfg = COLLECTIONS[kind];
  const canCreate = role === "admin" || role === "editor";
  const isAdmin = role === "admin";

  const reloadForms = useCallback(async () => {
    if (!kinds.some(k => COLLECTIONS[k].form)) return;
    try { setForms(await listDocuments("form")); } catch { /* shown by editor */ }
  }, [kinds]);
  useEffect(() => { reloadForms(); }, [reloadForms]);

  const docsOfKind = useMemo(() => (list.docs || []).filter(d => d.kind === kind), [list.docs, kind]);
  const samples = useMemo(() => ({ byKind: list.samplesByKind, docs: docsOfKind }), [list.samplesByKind, docsOfKind]);
  const filtered = docsOfKind.filter(d => {
    if (statusFilter !== "All" && docStatus(d) !== statusFilter) return false;
    const q = query.trim().toLowerCase();
    return !q || d.title.toLowerCase().includes(q) || d.slug.includes(q);
  });

  const loadArchived = async () => {
    const { data } = await supabase.from("cms_documents").select("id,kind,slug,title,updated_at").eq("kind", kind).eq("is_archived", true).order("updated_at", { ascending: false });
    setArchived(data || []);
  };
  const unarchive = async id => {
    const { error } = await supabase.from("cms_documents").update({ is_archived: false }).eq("id", id);
    if (!error) { await list.reload(); await loadArchived(); }
  };

  if (selectedId) {
    return <ItemEditor key={selectedId} docId={selectedId} kind={kind} role={role} forms={forms} samples={samples} reloadForms={reloadForms}
      onBack={() => setSelectedId(null)} onChanged={list.reload} />;
  }

  return (
    <div className="flex flex-col gap-6">
      <PageTitle title={title} subtitle={subtitle} actions={canCreate && <Button icon={Plus} onClick={() => setCreating(true)}>New {cfg.singular}</Button>} />
      {kinds.length > 1 && <Tabs tabs={kinds.map(k => ({ id: k, label: COLLECTIONS[k].label, count: (list.docs || []).filter(d => d.kind === k).length }))} active={kind} onChange={k => { setKind(k); setArchived(null); }} />}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <FilterPills options={["All", "Published", "Unpublished changes", "Draft"]} active={statusFilter} onChange={setStatusFilter} />
        <div className="relative w-full sm:w-64"><Search size={14} style={{ color: T.muted, position: "absolute", left: 10, top: 10 }} /><input value={query} onChange={e => setQuery(e.target.value)} placeholder={`Search ${cfg.label.toLowerCase()}`} className="w-full rounded-lg pl-8 pr-3 py-2 text-sm outline-none" style={inputStyle} /></div>
      </div>
      {list.error && <Notice tone="danger">{list.error}</Notice>}
      {list.docs === null ? <Spinner /> : (
        <Panel className="overflow-hidden">
          {filtered.map((doc, i) => {
            const thumb = thumbnailOf(doc.draft);
            return (
              <button key={doc.id} type="button" onClick={() => setSelectedId(doc.id)} className="w-full flex items-center gap-4 px-5 py-3.5 text-left hover:opacity-90" style={{ borderBottom: i < filtered.length - 1 ? `1px solid ${T.border}` : "none" }}>
                {thumb ? <img src={thumb} alt="" className="w-14 h-10 object-cover rounded-md shrink-0" style={{ border: `1px solid ${T.border}` }} /> : <span className="w-14 h-10 rounded-md shrink-0" style={{ backgroundColor: T.bg, border: `1px solid ${T.border}` }} />}
                <div className="flex-1 min-w-0">
                  <div className="text-sm truncate" style={{ color: T.ink, ...fontBody }}>{doc.title}</div>
                  <div className="flex items-center gap-2 mt-1 flex-wrap"><Badge status={docStatus(doc)} /><Flags content={doc.draft} /><span className="text-xs truncate" style={{ color: T.muted, ...fontBody }}>{previewUrlFor(doc)}</span></div>
                </div>
                <span className="text-xs px-2.5 py-1 rounded-md shrink-0" style={{ backgroundColor: T.accentSoft, color: T.accent, ...fontBody }}>Edit</span>
              </button>
            );
          })}
          {filtered.length === 0 && <EmptyState>No {cfg.label.toLowerCase()} match this view.</EmptyState>}
        </Panel>
      )}
      {isAdmin && (
        <div>
          {archived === null ? <button type="button" onClick={loadArchived} className="text-xs underline" style={{ color: T.muted, ...fontBody }}>Show archived {cfg.label.toLowerCase()}</button> : (
            <Panel className="p-4 flex flex-col gap-2">
              <FieldLabel>Archived {cfg.label.toLowerCase()}</FieldLabel>
              {archived.length === 0 ? <span className="text-xs" style={{ color: T.muted }}>None.</span> : archived.map(a => (
                <div key={a.id} className="flex items-center justify-between gap-3 text-sm" style={{ color: T.ink, ...fontBody }}><span className="truncate">{a.title}</span><Button tone="outline" small icon={ArchiveRestore} onClick={() => unarchive(a.id)}>Restore</Button></div>
              ))}
            </Panel>
          )}
        </div>
      )}
      {creating && <NewItemModal kind={kind} docs={docsOfKind} forms={forms} onClose={() => setCreating(false)} onCreated={async created => { setCreating(false); await list.reload(); await reloadForms(); setSelectedId(created.id); }} />}
    </div>
  );
}
