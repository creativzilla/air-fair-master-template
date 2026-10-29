// Visual editor (Pages): pick a page by category, see the real page, click a
// section on it to edit that section in the side panel. Typing updates the
// preview at once; Save draft / Publish work as everywhere else. Layout and
// design stay locked: only content (text, images, buttons, visibility).
//
// The page runs in a same-origin iframe at ?preview=1&visual=1 (drafts, see
// src/lib/cms.js); src/components/visual/VisualOverlay.jsx draws the outlines
// and reports clicks. Messages: src/lib/visualMode.js.
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ChevronDown, ChevronRight, ExternalLink, Eye, EyeOff, Monitor, MousePointerClick, RefreshCw, Smartphone, Tablet } from "lucide-react";
import { T, fontBody, Badge, Button, EmptyState, Notice, Panel, Spinner } from "./ui.jsx";
import ContentEditor from "./ContentEditor.jsx";
import { PublishBar, previewUrlFor, useDocumentEditor, useDocumentList } from "./DocumentWorkflow.jsx";
import { docStatus } from "./api.js";
import { FALLBACK_DOCS } from "../lib/cmsFallback.js";
import { VE } from "../lib/visualMode.js";

const PAGE_ORDER = ["home", "immigration-hub", "visa-hub", "travel-hub", "news"];
const GROUPS = [
  { kind: "page", label: "Pages" },
  { kind: "immigration_service", label: "Immigration services" },
  { kind: "visa_destination", label: "Visa destinations" },
  { kind: "travel_package", label: "Travel packages" },
];
// Header and footer live in the site-wide document; clicking them on any page edits it.
const GLOBAL_PARTS = {
  header: { label: "Header", keys: ["browserBar", "promiseBar", "logo", "nav"] },
  footer: { label: "Footer", keys: ["footer"] },
};
const DEVICES = [
  { id: "desktop", icon: Monitor, label: "Desktop", width: "100%" },
  { id: "tablet", icon: Tablet, label: "Tablet", width: "820px" },
  { id: "mobile", icon: Smartphone, label: "Mobile", width: "390px" },
];

const visualUrl = doc => {
  const url = previewUrlFor(doc);
  const [path, hash] = url.split("#");
  return `${path}?preview=1&visual=1${hash ? `#${hash}` : ""}`;
};
const docKey = doc => (doc?.kind === "page" ? `page:${doc.slug}` : doc?.kind === "global" ? "global:site" : null);
const pathOf = href => String(href || "").split(/[?#]/)[0].replace(/\/+$/, "") || "/";

// Pages opened by a homepage card: the card shows the start of this Description.
function CardTextNote() {
  return <Notice tone="info">The first lines of the Description below also show on the homepage card that opens this page. Edit them here; the card updates too.</Notice>;
}

function SectionList({ sections, onPick }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs" style={{ color: T.muted, ...fontBody }}>Click a section on the page, or pick one here.</p>
      {sections.map(s => (
        <button key={s.key} type="button" onClick={() => onPick(s.key)} className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-left text-sm"
          style={{ border: `1px solid ${T.border}`, backgroundColor: T.surface, color: s.visible === false ? T.muted : T.ink, ...fontBody }}>
          <span className="flex-1 min-w-0 truncate">{s.label || s.key}</span>
          {s.visible === false && <Badge status="Draft" label="Hidden" />}
          <ChevronRight size={14} style={{ color: T.muted }} />
        </button>
      ))}
    </div>
  );
}

export default function VisualEditor({ role }) {
  const kinds = useMemo(() => ["page", "global", ...GROUPS.slice(1).map(g => g.kind)], []);
  const { docs, error, reload, samplesByKind } = useDocumentList(kinds);
  const [pageId, setPageId] = useState(null);      // document shown in the preview
  const [target, setTarget] = useState({ part: "page", k: null }); // part: "page" | "global"
  const [device, setDevice] = useState("desktop");
  const [openGroups, setOpenGroups] = useState({ page: true });
  const [frameKey, setFrameKey] = useState(0);
  const frameRef = useRef(null);

  const globalDoc = useMemo(() => (docs || []).find(d => d.kind === "global"), [docs]);
  const grouped = useMemo(() => {
    const list = docs || [];
    return GROUPS.map(g => {
      let items = list.filter(d => d.kind === g.kind);
      if (g.kind === "page") items = [...PAGE_ORDER.map(s => items.find(d => d.slug === s)).filter(Boolean), ...items.filter(d => !PAGE_ORDER.includes(d.slug))];
      else items = [...items].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || String(a.title).localeCompare(String(b.title)));
      return { ...g, items };
    });
  }, [docs]);
  useEffect(() => { if (!pageId && grouped[0]?.items[0]) setPageId(grouped[0].items[0].id); }, [grouped, pageId]);

  const pageEditor = useDocumentEditor(pageId);
  const globalEditor = useDocumentEditor(globalDoc?.id || null);
  const editor = target.part === "global" ? globalEditor : pageEditor;
  const pageDoc = pageEditor.doc;

  // ---- messages to the preview -------------------------------------------
  const post = useCallback(message => {
    const win = frameRef.current?.contentWindow;
    if (win) win.postMessage(message, window.location.origin);
  }, []);
  const targetDoc = target.part === "global" ? "global:site" : docKey(pageDoc);
  const sendDrafts = useCallback(() => {
    for (const ed of [pageEditor, globalEditor]) {
      if (ed.doc && ed.draft && ed.dirty) post({ type: VE.draft, kind: ed.doc.kind, slug: ed.doc.slug, content: ed.draft });
    }
    const labels = {};
    if (pageDoc?.kind === "page") (pageEditor.draft?.sections || []).forEach(s => { labels[`page:${pageDoc.slug}|${s.key}`] = s.label || s.key; });
    Object.entries(GLOBAL_PARTS).forEach(([k, p]) => { labels[`global:site|${k}`] = `${p.label} (all pages)`; });
    post({ type: VE.labels, labels });
    post({ type: VE.highlight, doc: target.k ? targetDoc : null, k: target.k });
  }, [pageEditor, globalEditor, pageDoc, post, target, targetDoc]);

  // Live preview of unsaved edits (debounced while typing).
  const sendRef = useRef(sendDrafts);
  sendRef.current = sendDrafts;
  useEffect(() => { const t = setTimeout(() => sendRef.current(), 120); return () => clearTimeout(t); }, [pageEditor.draft, globalEditor.draft, target]);

  // ---- messages from the preview -----------------------------------------
  useEffect(() => {
    const onMessage = e => {
      if (e.origin !== window.location.origin || e.source !== frameRef.current?.contentWindow) return;
      const m = e.data || {};
      if (m.type === VE.ready) sendRef.current();
      if (m.type === VE.select) {
        if (m.doc === "global:site") setTarget({ part: "global", k: GLOBAL_PARTS[m.k] ? m.k : null });
        else setTarget({ part: "page", k: m.k || null });
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  const choosePage = (doc, k = null) => {
    if (doc.id !== pageId) {
      if (pageEditor.dirty && !window.confirm(`"${pageDoc?.title}" has unsaved edits. Leave without saving them?`)) return;
      setPageId(doc.id);
    }
    setTarget({ part: "page", k });
  };

  // Is the open page linked from a homepage card? (the card shows its Description)
  const homeDoc = useMemo(() => (docs || []).find(d => d.kind === "page" && d.slug === "home"), [docs]);
  const hasCard = useMemo(() => {
    if (!pageDoc || pageDoc.slug === "home" || !["page", "immigration_service"].includes(pageDoc.kind)) return false;
    const items = (homeDoc?.draft?.sections || []).find(s => s.key === "categories")?.fields?.items || [];
    return items.some(item => pathOf(item.href) === pathOf(previewUrlFor(pageDoc)));
  }, [pageDoc, homeDoc]);
  const pickSection = k => { setTarget({ part: "page", k }); post({ type: VE.scrollTo, doc: docKey(pageDoc), k }); };

  // ---- side panel ---------------------------------------------------------
  const isPage = pageDoc?.kind === "page";
  const sections = isPage ? pageEditor.draft?.sections || [] : [];
  const sectionIndex = isPage && target.part === "page" ? sections.findIndex(s => s.key === target.k) : -1;
  const section = sectionIndex >= 0 ? sections[sectionIndex] : null;
  const fallbackFields = useMemo(() => {
    if (!pageDoc || !section) return [];
    const fb = FALLBACK_DOCS.find(d => d.kind === pageDoc.kind && d.slug === pageDoc.slug);
    return [fb?.content?.sections?.find(s => s.key === section.key)?.fields].filter(Boolean);
  }, [pageDoc, section]);
  const updateSection = next => pageEditor.setDraft({ ...pageEditor.draft, sections: sections.map((s, i) => (i === sectionIndex ? next : s)) });

  const globalPart = target.part === "global" ? GLOBAL_PARTS[target.k] : null;
  const globalValue = globalPart && globalEditor.draft ? Object.fromEntries(globalPart.keys.filter(k => k in globalEditor.draft).map(k => [k, globalEditor.draft[k]])) : null;

  let panelTitle = pageDoc?.title || "";
  let body = null;
  if (target.part === "global") {
    panelTitle = globalPart ? `${globalPart.label} (all pages)` : "Header & footer";
    body = !globalEditor.draft ? <Spinner /> : (
      <ContentEditor value={globalValue || globalEditor.draft} samples={FALLBACK_DOCS.filter(d => d.kind === "global").map(d => d.content)}
        onChange={v => globalEditor.setDraft(globalValue ? { ...globalEditor.draft, ...v } : v)} />
    );
  } else if (!pageEditor.draft) {
    body = pageEditor.error ? <Notice tone="danger">{pageEditor.error}</Notice> : <Spinner />;
  } else if (!isPage) {
    body = <div className="flex flex-col gap-4">
      {hasCard && <CardTextNote />}
      <ContentEditor value={pageEditor.draft} samples={samplesByKind[pageDoc.kind] || []} onChange={pageEditor.setDraft} />
    </div>;
  } else if (target.k === "seo") {
    panelTitle = "SEO (search & share text)";
    body = <ContentEditor value={pageEditor.draft.seo || {}} onChange={seo => pageEditor.setDraft({ ...pageEditor.draft, seo })} />;
  } else if (section) {
    panelTitle = section.label || section.key;
    body = (
      <div className="flex flex-col gap-5">
        <label className="flex items-center gap-2 text-xs" style={{ color: T.muted, ...fontBody }}>
          <input type="checkbox" checked={section.visible !== false} onChange={e => updateSection({ ...section, visible: e.target.checked })} style={{ accentColor: T.accent }} />
          {section.visible === false ? <EyeOff size={13} /> : <Eye size={13} />} Show this section on the website
        </label>
        {hasCard && section.key === "hero" && <CardTextNote />}
        <ContentEditor value={section.fields || {}} samples={fallbackFields} onChange={fields => updateSection({ ...section, fields })} />
      </div>
    );
  } else {
    body = <SectionList sections={[...sections, ...(pageEditor.draft.seo ? [{ key: "seo", label: "SEO (search & share text)" }] : [])]} onPick={k => (k === "seo" ? setTarget({ part: "page", k }) : pickSection(k))} />;
  }
  const canGoBack = target.part === "global" || (isPage && target.k);

  if (error) return <Notice tone="danger">{error}</Notice>;
  if (docs === null) return <Spinner />;
  if (!docs.length) return <Panel><EmptyState>No pages found. Run the CMS content import first.</EmptyState></Panel>;

  return (
    <div className="grid gap-4 ve-grid" style={{ gridTemplateColumns: "220px minmax(0,1fr) 380px" }}>
      <style>{`@media (max-width: 1279px){.ve-grid{grid-template-columns:1fr !important}.ve-frame-wrap{height:70vh !important}}
        .ve-panel{scrollbar-width:thin;scrollbar-color:#B7C2CC transparent}
        .ve-panel::-webkit-scrollbar{width:10px}.ve-panel::-webkit-scrollbar-thumb{background:#B7C2CC;border-radius:8px;border:2px solid #fff}
        .ve-panel::-webkit-scrollbar-track{background:transparent}`}</style>
      {/* Pages by category */}
      <Panel className="overflow-hidden self-start">
        {grouped.map(g => g.items.length > 0 && (
          <div key={g.kind} style={{ borderBottom: `1px solid ${T.border}` }}>
            <button type="button" onClick={() => setOpenGroups(o => ({ ...o, [g.kind]: !o[g.kind] }))} className="w-full flex items-center gap-2 px-3 py-2.5 text-left">
              {openGroups[g.kind] ? <ChevronDown size={14} style={{ color: T.muted }} /> : <ChevronRight size={14} style={{ color: T.muted }} />}
              <span className="text-[11px] font-semibold uppercase tracking-wide flex-1" style={{ color: T.muted, ...fontBody }}>{g.label}</span>
              <span className="text-[11px]" style={{ color: T.muted, ...fontBody }}>{g.items.length}</span>
            </button>
            {openGroups[g.kind] && g.items.map(d => (
              <button key={d.id} type="button" onClick={() => choosePage(d)} className="w-full text-left px-4 py-2 text-sm flex items-center gap-2"
                style={{ backgroundColor: d.id === pageId ? T.accentSoft : "transparent", color: T.ink, ...fontBody }}>
                <span className="flex-1 min-w-0 truncate">{d.title}</span>
                {docStatus(d) !== "Published" && <span className="w-2 h-2 rounded-full shrink-0" title={docStatus(d)} style={{ backgroundColor: T.warn }} />}
              </button>
            ))}
          </div>
        ))}
        <p className="px-3 py-2.5 text-[11px]" style={{ color: T.muted, ...fontBody }}>Header and footer: click them on any page.</p>
      </Panel>

      {/* Live page */}
      <div className="flex flex-col gap-2 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs flex items-center gap-1.5" style={{ color: T.muted, ...fontBody }}><MousePointerClick size={13} /> Click any section to edit it. Links don't open here.</span>
          <div className="flex-1" />
          <div className="flex rounded-lg overflow-hidden" style={{ border: `1px solid ${T.border}` }}>
            {DEVICES.map(d => <button key={d.id} type="button" title={d.label} aria-label={d.label} aria-pressed={device === d.id} onClick={() => setDevice(d.id)} className="px-2.5 py-1.5"
              style={{ backgroundColor: device === d.id ? T.accentSoft : T.surface, color: device === d.id ? T.accent : T.muted }}><d.icon size={15} /></button>)}
          </div>
          <Button tone="outline" small icon={RefreshCw} onClick={() => setFrameKey(k => k + 1)}>Reload</Button>
          {pageDoc && <a href={previewUrlFor(pageDoc)} target="_blank" rel="noreferrer" className="text-xs flex items-center gap-1 px-2.5 py-1.5 rounded-lg" style={{ color: T.accent, border: `1px solid ${T.border}`, ...fontBody }}><ExternalLink size={13} /> Live page</a>}
        </div>
        <div className="ve-frame-wrap rounded-xl overflow-hidden flex justify-center" style={{ border: `1px solid ${T.border}`, backgroundColor: "#E9EDF2", height: "calc(100vh - 230px)", minHeight: 520 }}>
          {pageDoc && <iframe key={`${pageDoc.id}-${frameKey}`} ref={frameRef} title={`Preview: ${pageDoc.title}`} src={visualUrl(pageDoc)}
            style={{ width: DEVICES.find(d => d.id === device).width, maxWidth: "100%", height: "100%", border: 0, backgroundColor: "#fff" }} />}
        </div>
      </div>

      {/* Side panel */}
      <div className="flex flex-col gap-3 min-w-0">
        {editor.doc && <PublishBar editor={editor} role={role} onPublished={reload} />}
        <Panel className="p-4 flex flex-col gap-4 overflow-y-auto ve-panel" style={{ maxHeight: "calc(100vh - 300px)", minHeight: 300, scrollbarGutter: "stable" }}>
          <div className="flex items-center gap-2">
            {canGoBack && <button type="button" onClick={() => setTarget({ part: "page", k: null })} aria-label="All sections" className="p-1 rounded" style={{ color: T.muted }}><ArrowLeft size={16} /></button>}
            <h3 className="text-sm font-semibold flex-1 min-w-0 truncate" style={{ color: T.ink, ...fontBody }}>{panelTitle}</h3>
          </div>
          {target.part === "global" && <Notice tone="info">The header and footer appear on every page. Changes here update all pages.</Notice>}
          {body}
        </Panel>
      </div>
    </div>
  );
}
