import React, { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, ExternalLink, Globe, LayoutTemplate } from "lucide-react";
import { T, fontBody, Badge, EmptyState, Notice, PageTitle, Panel, Spinner } from "./ui.jsx";
import ContentEditor from "./ContentEditor.jsx";
import { PublishBar, previewUrlFor, useDocumentEditor, useDocumentList } from "./DocumentWorkflow.jsx";
import { docStatus } from "./api.js";
import { FALLBACK_DOCS } from "../lib/cmsFallback.js";

const PAGE_ORDER = ["home", "immigration-hub", "visa-hub", "travel-hub", "news"];

function SectionCard({ section, onChange, samples, defaultOpen }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Panel>
      <div className="flex items-center gap-3 px-4 py-3">
        <button type="button" onClick={() => setOpen(o => !o)} className="flex items-center gap-2 flex-1 min-w-0 text-left">
          {open ? <ChevronDown size={16} style={{ color: T.muted }} /> : <ChevronRight size={16} style={{ color: T.muted }} />}
          <span className="text-sm font-medium truncate" style={{ color: section.visible === false ? T.muted : T.ink, ...fontBody }}>{section.label || section.key}</span>
          {section.visible === false && <Badge status="Draft" label="Hidden" />}
        </button>
        <label className="flex items-center gap-2 text-xs shrink-0" style={{ color: T.muted, ...fontBody }}>
          <input type="checkbox" checked={section.visible !== false} onChange={e => onChange({ ...section, visible: e.target.checked })} style={{ accentColor: T.accent }} />
          Show on website
        </label>
      </div>
      {open && <div className="px-4 pb-4 pt-3" style={{ borderTop: `1px solid ${T.border}` }}>
        <ContentEditor value={section.fields || {}} samples={samples} onChange={fields => onChange({ ...section, fields })} />
      </div>}
    </Panel>
  );
}

function PageDocumentEditor({ docId, role, onChanged }) {
  const editor = useDocumentEditor(docId);
  const { doc, draft, setDraft } = editor;

  const fallbackSections = useMemo(() => {
    if (!doc) return {};
    const fb = FALLBACK_DOCS.find(d => d.kind === doc.kind && d.slug === doc.slug);
    return Object.fromEntries((fb?.content?.sections || []).map(s => [s.key, s.fields]));
  }, [doc]);

  if (!doc || !draft) return editor.error ? <Notice tone="danger">{editor.error}</Notice> : <Spinner />;

  const isPage = doc.kind === "page";
  const sections = draft.sections || [];
  const updateSection = (index, next) => setDraft({ ...draft, sections: sections.map((s, i) => (i === index ? next : s)) });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <h2 className="text-lg" style={{ color: T.ink, ...fontBody, fontWeight: 600 }}>{doc.title}</h2>
          <p className="text-xs" style={{ color: T.muted, ...fontBody }}>{isPage ? "Sections are listed in the same order as on the page. Layout and design stay locked." : "Header, footer and text shared by every page."}</p>
        </div>
        <a href={previewUrlFor(doc)} target="_blank" rel="noreferrer" className="text-sm flex items-center gap-1.5 px-3 py-2 rounded-lg shrink-0" style={{ color: T.accent, border: `1px solid ${T.border}`, ...fontBody }}><ExternalLink size={14} /> View live page</a>
      </div>
      <div className="sticky z-10" style={{ top: 0 }}><PublishBar editor={editor} role={role} onPublished={onChanged} /></div>

      {isPage ? (<>
        {draft.seo && (
          <Panel className="p-4">
            <h3 className="text-sm font-medium mb-3" style={{ color: T.ink, ...fontBody }}>SEO</h3>
            <ContentEditor value={draft.seo} onChange={seo => setDraft({ ...draft, seo })} hiddenKeys={["note"]} />
            {draft.seo.note && <p className="text-xs mt-2" style={{ color: T.muted, ...fontBody }}>{draft.seo.note}</p>}
          </Panel>
        )}
        {sections.map((section, index) => (
          <SectionCard key={section.key} section={section} defaultOpen={index === 0} samples={[fallbackSections[section.key]].filter(Boolean)} onChange={next => updateSection(index, next)} />
        ))}
      </>) : (
        <Panel className="p-4"><ContentEditor value={draft} onChange={setDraft} samples={FALLBACK_DOCS.filter(d => d.kind === "global").map(d => d.content)} /></Panel>
      )}
    </div>
  );
}

// "Edit Website" module: pick a page, edit each section in page order.
export default function PagesEditor({ role }) {
  const { docs, error, reload } = useDocumentList(["page", "global"]);
  const [selectedId, setSelectedId] = useState(null);

  const ordered = useMemo(() => {
    const list = docs || [];
    const pages = PAGE_ORDER.map(slug => list.find(d => d.kind === "page" && d.slug === slug)).filter(Boolean);
    const otherPages = list.filter(d => d.kind === "page" && !PAGE_ORDER.includes(d.slug));
    const global = list.filter(d => d.kind === "global");
    return [...pages, ...otherPages, ...global];
  }, [docs]);

  useEffect(() => { if (!selectedId && ordered.length) setSelectedId(ordered[0].id); }, [ordered, selectedId]);

  return (
    <div className="flex flex-col gap-6">
      <PageTitle title="Pages" subtitle="Edit the text and images on each page. Changes stay as drafts until an admin publishes them." />
      {error && <Notice tone="danger">{error}</Notice>}
      {docs === null ? <Spinner /> : ordered.length === 0 ? <Panel><EmptyState>No pages found. Run the CMS content import first.</EmptyState></Panel> : (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 dash-grid-5">
          <Panel className="lg:col-span-1 overflow-hidden self-start">
            {ordered.map((doc, i) => {
              const Icon = doc.kind === "global" ? Globe : LayoutTemplate;
              return (
                <button key={doc.id} type="button" onClick={() => setSelectedId(doc.id)} className="w-full flex items-center gap-3 px-4 py-3 text-left"
                  style={{ borderBottom: i < ordered.length - 1 ? `1px solid ${T.border}` : "none", backgroundColor: selectedId === doc.id ? T.accentSoft : "transparent" }}>
                  <Icon size={16} style={{ color: T.muted }} className="shrink-0" />
                  <div className="flex-1 min-w-0"><div className="text-sm truncate" style={{ color: T.ink, ...fontBody }}>{doc.kind === "global" ? "Site-wide (header & footer)" : doc.title}</div>
                    <div className="mt-1"><Badge status={docStatus(doc)} /></div></div>
                </button>
              );
            })}
          </Panel>
          <div className="lg:col-span-3 min-w-0">{selectedId && <PageDocumentEditor key={selectedId} docId={selectedId} role={role} onChanged={reload} />}</div>
        </div>
      )}
    </div>
  );
}
