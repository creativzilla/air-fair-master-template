// Form Studio: full-screen visual form builder (admins only).
//   left:   searchable library of fields and design elements (drag or click)
//   centre: the form as visitors see it; select, drag to reorder, drop new items
//   right:  settings for the selected item, or the whole form
// Edits autosave to the form's draft; the live form changes only on Publish.
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlignLeft, ArrowDown, ArrowUp, Calendar, CheckCircle2, ChevronDown, Circle, CloudOff, Columns2, Copy, Eye, EyeOff, FileUp, GripVertical, Hash,
  Heading as HeadingIcon, Image as ImageIcon, LayoutPanelTop, Loader2, Mail, MapPin, Minus, Monitor, MousePointerClick, PanelLeft, PanelRight, Pencil,
  Phone, Plus, Redo2, Rows3, Search, Send, Smartphone, SquareCheck, Tablet, TextCursorInput, ToggleLeft, Trash2, Type, Undo2, X, Globe, MoveVertical, ListChecks,
} from "lucide-react";
import { T, fontBody, Badge, Button, Notice } from "../ui.jsx";
import { FormElementView, submitElementOf } from "../../components/forms/FormRenderer.jsx";
import { getFieldWidth } from "../../components/immigration/DynamicFormField.jsx";
import { ELEMENT_TYPES, elementId, isInput, isRow } from "../../../supabase/functions/_shared/forms/schema.ts";
import {
  addSection, canPlace, createElement, duplicateById, findElement, findLocation, insertAt, insertionPoint, moveSection, moveTo, nudge,
  removeById, removeSection,
} from "./tree.js";
import { useFormDraft } from "./useFormDraft.js";
import StudioInspector, { FormSettings } from "./StudioInspector.jsx";
import { PreviewCanvas } from "./FormPreviewPanel.jsx";

const ICONS = {
  text: TextCursorInput, textarea: AlignLeft, email: Mail, tel: Phone, number: Hash, date: Calendar, select: ChevronDown, radio: Circle,
  checkboxGroup: ListChecks, yesno: ToggleLeft, country: Globe, consent: SquareCheck, file: FileUp, address: MapPin, hidden: EyeOff,
  heading: HeadingIcon, paragraph: Type, divider: Minus, spacer: MoveVertical, image: ImageIcon, submit: Send,
  section: LayoutPanelTop, row1: Rows3, row2: Columns2,
};
const DEVICES = { desktop: { width: 720, icon: Monitor, label: "Desktop" }, tablet: { width: 560, icon: Tablet, label: "Tablet" }, mobile: { width: 375, icon: Smartphone, label: "Mobile" } };
const DRAG_NEW = "application/x-af-new";
const DRAG_MOVE = "application/x-af-move";

function isTyping(target) {
  const tag = target?.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target?.isContentEditable;
}

// ---------------------------------------------------------------- toolbar
function SaveStatus({ draft }) {
  const { status, error, savedAt, retry } = draft;
  if (status === "saving") return <span className="flex items-center gap-1.5 text-xs" style={{ color: T.muted, ...fontBody }} role="status"><Loader2 size={13} className="animate-spin" /> Saving…</span>;
  if (status === "pending") return <span className="text-xs" style={{ color: T.muted, ...fontBody }} role="status">Unsaved changes…</span>;
  if (status === "failed") return (
    <span className="flex items-center gap-1.5 text-xs" style={{ color: T.danger, ...fontBody }} role="alert" title={error}>
      <CloudOff size={13} /> Failed to save <button type="button" onClick={retry} className="underline font-semibold">Retry</button>
    </span>
  );
  if (status === "conflict") return <span className="text-xs" style={{ color: T.warn, ...fontBody }} role="alert">Changed elsewhere</span>;
  if (status === "loading") return <span className="text-xs" style={{ color: T.muted, ...fontBody }}>Loading…</span>;
  return <span className="flex items-center gap-1.5 text-xs" style={{ color: T.accent, ...fontBody }} role="status"><CheckCircle2 size={13} /> Saved{savedAt ? ` ${savedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : ""}</span>;
}

function ToolButton({ label, onClick, disabled, active, children }) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} disabled={disabled} aria-pressed={active}
      className="p-2 rounded-lg flex items-center gap-1.5 text-xs" style={{ color: disabled ? T.border : active ? T.accent : T.ink, backgroundColor: active ? T.accentSoft : "transparent", ...fontBody }}>
      {children}
    </button>
  );
}

// ---------------------------------------------------------------- library
function Library({ onAdd, onDragStart }) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const items = ELEMENT_TYPES.filter(t => !q || `${t.label} ${t.keywords || ""} ${t.type}`.toLowerCase().includes(q));
  const groups = [...new Set(items.map(t => t.group))];
  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="p-3 shrink-0" style={{ borderBottom: `1px solid ${T.border}` }}>
        <div className="relative"><Search size={14} style={{ color: T.muted, position: "absolute", left: 10, top: 10 }} />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search fields and elements" aria-label="Search fields and elements"
            className="w-full rounded-lg pl-8 pr-3 py-2 text-sm outline-none" style={{ border: `1px solid ${T.border}`, backgroundColor: T.bg, ...fontBody }} />
        </div>
        <p className="text-[11px] mt-2" style={{ color: T.muted, ...fontBody }}>Drag onto the form, or click to add after the selected item.</p>
      </div>
      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-4">
        {groups.map(g => (
          <div key={g}>
            <p className="text-[10.5px] uppercase tracking-wide mb-2" style={{ color: T.muted, ...fontBody, letterSpacing: "0.06em" }}>{g}</p>
            <div className="grid grid-cols-2 gap-1.5">
              {items.filter(t => t.group === g).map(t => {
                const Icon = ICONS[t.type] || Plus;
                return (
                  <button key={t.type} type="button" draggable onDragStart={e => onDragStart(e, { kind: "new", type: t.type })} onClick={() => onAdd(t.type)}
                    className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs" style={{ border: `1px solid ${T.border}`, backgroundColor: "#fff", color: T.ink, cursor: "grab", ...fontBody }}>
                    <Icon size={14} style={{ color: T.muted, flexShrink: 0 }} /><span className="leading-tight">{t.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        {!items.length && <p className="text-xs" style={{ color: T.muted, ...fontBody }}>Nothing matches “{query}”.</p>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- canvas (edit mode)
function ElementFrame({ el, ctx, loc, inRow }) {
  const id = elementId(el);
  const selected = ctx.selected?.kind === "element" && ctx.selected.id === id;
  const drop = ctx.dropHint?.targetId === id ? ctx.dropHint.edge : null;
  const full = isRow(el) || !isInput(el) || inRow || getFieldWidth(el) === "full";
  const conditional = !!el.showWhen;
  const onDragOver = e => {
    if (!ctx.dragging.current) return;
    e.preventDefault(); e.stopPropagation();
    const r = e.currentTarget.getBoundingClientRect();
    const edge = e.clientY < r.top + r.height / 2 ? "before" : "after";
    ctx.setDropHint({ targetId: id, edge, loc: { ...loc, index: loc.index + (edge === "after" ? 1 : 0) } });
  };
  return (
    <div
      className="studio-el relative rounded-lg"
      style={{
        gridColumn: full ? "1 / -1" : "auto",
        outline: selected ? `2px solid ${T.accent}` : "1px dashed transparent",
        outlineOffset: 3,
        boxShadow: drop === "before" ? `0 -3px 0 0 ${T.info}` : drop === "after" ? `0 3px 0 0 ${T.info}` : "none",
      }}
      onClick={e => { e.stopPropagation(); ctx.select({ kind: "element", id }); }}
      onDragOver={onDragOver}
      onDrop={e => { e.preventDefault(); e.stopPropagation(); ctx.drop(); }}
      data-element-id={id}
    >
      <div className="studio-el-bar absolute -top-3 right-1 z-10 items-center gap-0.5 rounded-md px-1" style={{ backgroundColor: "#fff", border: `1px solid ${T.border}`, display: selected ? "flex" : undefined }}>
        <span draggable onDragStart={e => { e.stopPropagation(); ctx.onDragStart(e, { kind: "move", id }); }} title="Drag to move" aria-label="Drag to move" className="p-1 cursor-grab" style={{ color: T.muted }}><GripVertical size={13} /></span>
        <button type="button" aria-label="Move up" title="Move up" className="p-1" style={{ color: T.muted }} onClick={e => { e.stopPropagation(); ctx.actions.nudge(id, -1); }}><ArrowUp size={13} /></button>
        <button type="button" aria-label="Move down" title="Move down" className="p-1" style={{ color: T.muted }} onClick={e => { e.stopPropagation(); ctx.actions.nudge(id, 1); }}><ArrowDown size={13} /></button>
        {el.type !== "submit" && <button type="button" aria-label="Duplicate" title="Duplicate" className="p-1" style={{ color: T.muted }} onClick={e => { e.stopPropagation(); ctx.actions.duplicate(id); }}><Copy size={13} /></button>}
        <button type="button" aria-label="Delete" title="Delete" className="p-1" style={{ color: T.danger }} onClick={e => { e.stopPropagation(); ctx.actions.remove(id); }}><Trash2 size={13} /></button>
      </div>
      {(conditional || el.type === "hidden" || el.mapTo) && (
        <div className="flex gap-1 mb-1 flex-wrap">
          {conditional && <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: T.infoSoft, color: T.info, ...fontBody }}>Shown conditionally</span>}
          {el.mapTo && <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: T.accentSoft, color: T.accent, ...fontBody }}>Contact: {el.mapTo === "fullName" ? "name" : el.mapTo}</span>}
        </div>
      )}
      {isRow(el) ? <RowFrame el={el} ctx={ctx} loc={loc} /> : (
        <div style={{ pointerEvents: "none" }} aria-hidden="true">
          {el.type === "hidden"
            ? <div className="text-xs rounded-md px-3 py-2" style={{ backgroundColor: T.bg, border: `1px dashed ${T.border}`, color: T.muted, ...fontBody }}>Hidden field <code>{el.name}</code>{el.default ? ` = "${el.default}"` : ""}</div>
            : el.type === "submit"
              ? <button className="green-button svc-submit-btn" type="button" tabIndex={-1}>{el.text || ctx.schema.submitLabel || "Submit"}</button>
              : el.type === "image" && !el.url
                ? <div className="text-xs rounded-md px-3 py-6 text-center" style={{ backgroundColor: T.bg, border: `1px dashed ${T.border}`, color: T.muted, ...fontBody }}>Image: choose one in the settings panel</div>
                : <FormElementView el={el} values={ctx.previewValues} errors={{}} onChange={() => {}} />}
        </div>
      )}
    </div>
  );
}

function EndZone({ ctx, loc, label, empty }) {
  const active = ctx.dropHint?.zoneKey === `${loc.sectionId}|${loc.rowId}|${loc.column}`;
  return (
    <div
      className="rounded-lg flex items-center justify-center text-[11px]"
      style={{ gridColumn: "1 / -1", minHeight: empty ? 56 : 18, border: `1px dashed ${active ? T.info : empty ? T.border : "transparent"}`, backgroundColor: active ? T.infoSoft : "transparent", color: T.muted, ...fontBody }}
      onDragOver={e => { if (!ctx.dragging.current) return; e.preventDefault(); e.stopPropagation(); ctx.setDropHint({ zoneKey: `${loc.sectionId}|${loc.rowId}|${loc.column}`, loc }); }}
      onDrop={e => { e.preventDefault(); e.stopPropagation(); ctx.drop(); }}
      onClick={e => { if (empty && !loc.rowId) { e.stopPropagation(); ctx.select({ kind: "section", id: loc.sectionId }); } }}
    >
      {empty ? label : null}
    </div>
  );
}

function RowFrame({ el, ctx, loc }) {
  const id = elementId(el);
  const columns = el.columns === 1 ? 1 : 2;
  return (
    <div className={`svc-form-row svc-form-row-${columns}`}>
      {Array.from({ length: columns }, (_v, c) => {
        const list = (el.children || [])[c] || [];
        return (
          <div className="svc-form-col-stack rounded-md p-1.5" key={c} style={{ border: `1px dashed ${T.border}` }}>
            {list.map((child, i) => <ElementFrame key={elementId(child)} el={child} ctx={ctx} inRow loc={{ sectionId: loc.sectionId, rowId: id, column: c, index: i }} />)}
            <EndZone ctx={ctx} loc={{ sectionId: loc.sectionId, rowId: id, column: c, index: list.length }} empty={!list.length} label={`Drop into column ${c + 1}`} />
          </div>
        );
      })}
    </div>
  );
}

function EditCanvas({ ctx }) {
  const { schema } = ctx;
  const numbered = schema.layout === "sections";
  const submitEl = submitElementOf(schema);
  return (
    <>
      {schema.sections.map((section, si) => {
        const selected = ctx.selected?.kind === "section" && ctx.selected.id === section.id;
        return (
          <div key={section.id} className="svc-form-section rounded-lg" style={{ outline: selected ? `2px solid ${T.accent}` : "none", outlineOffset: 6 }}>
            <button type="button" onClick={e => { e.stopPropagation(); ctx.select({ kind: "section", id: section.id }); }} className="w-full text-left" aria-label={`Section ${si + 1} settings`}>
              {numbered ? (
                <div className="svc-form-section-title"><span className="svc-form-section-num">{String(si + 1).padStart(2, "0")}</span><h4>{section.title || "Untitled section"}</h4></div>
              ) : schema.sections.length > 1 ? <h4 className="svc-form-heading svc-form-heading-md" style={{ marginBottom: 10 }}>{section.title || "Untitled section"}</h4>
                : <span className="block text-[10.5px] uppercase tracking-wide mb-2" style={{ color: T.muted, ...fontBody }}>Section settings</span>}
            </button>
            {section.description && <p className="svc-form-text" style={{ marginBottom: 10 }}>{section.description}</p>}
            <div className="svc-form-grid">
              {(section.fields || []).map((el, i) => <ElementFrame key={elementId(el)} el={el} ctx={ctx} loc={{ sectionId: section.id, rowId: null, column: null, index: i }} />)}
              <EndZone ctx={ctx} loc={{ sectionId: section.id, rowId: null, column: null, index: (section.fields || []).length }} empty={!(section.fields || []).length} label="Drag fields here, or click one in the library" />
            </div>
          </div>
        );
      })}
      <button type="button" onClick={e => { e.stopPropagation(); ctx.actions.addSection(); }} className="w-full text-xs rounded-lg py-2 mt-2 flex items-center justify-center gap-1.5" style={{ border: `1px dashed ${T.border}`, color: T.muted, ...fontBody }}><Plus size={13} /> Add section</button>
      {!submitEl && (
        <div style={{ pointerEvents: "none", marginTop: 14 }} aria-hidden="true">
          <button className="green-button svc-submit-btn" type="button" tabIndex={-1}>{schema.submitLabel || "Submit"}</button>
          {schema.privacyNote && <p className="svc-privacy-note">{schema.privacyNote}</p>}
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------- the studio
export default function FormStudio({ docId, onClose, titleVars = {}, onPublished }) {
  const draft = useFormDraft(docId);
  const { schema, setSchema } = draft;
  const [selected, setSelected] = useState(null);
  const [device, setDevice] = useState("desktop");
  const [mode, setMode] = useState("edit");
  const [panel, setPanel] = useState(null); // small screens: "library" | "inspector"
  const [leftTab, setLeftTab] = useState("fields"); // left panel: "fields" | "settings"
  const [dropHint, setDropHint] = useState(null);
  const [problems, setProblems] = useState([]);
  const [publishing, setPublishing] = useState(false);
  const [message, setMessage] = useState("");
  const [name, setName] = useState("");
  const dragging = useRef(null);

  useEffect(() => { if (draft.doc) setName(draft.doc.title.replace(/^Form — /, "")); }, [draft.doc?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const select = useCallback(next => { setSelected(next); if (next) setPanel(p => (p === "library" ? "inspector" : p)); }, []);

  const actions = useMemo(() => ({
    add: type => {
      if (!schema) return;
      if (type === "section") { const r = addSection(schema, selected?.kind === "section" ? selected.id : findLocation(schema, selected?.id)?.sectionId); setSchema(r.schema); select({ kind: "section", id: r.id }); return; }
      const el = createElement(type, schema);
      let loc = insertionPoint(schema, selected);
      if (!canPlace(schema, el, loc)) {
        if (el.type === "submit") { setMessage("This form already has a Submit button."); return; }
        const parent = findLocation(schema, loc.rowId);
        loc = parent ? { ...parent, index: parent.index + 1 } : insertionPoint(schema, null);
      }
      setSchema(insertAt(schema, loc, el));
      select({ kind: "element", id: el.id });
    },
    remove: id => { const next = removeById(schema, id); setSchema(next); setSelected(null); },
    duplicate: id => { const r = duplicateById(schema, id); if (r.id) { setSchema(r.schema); select({ kind: "element", id: r.id }); } },
    nudge: (id, dir) => setSchema(nudge(schema, id, dir)),
    addSection: () => { const r = addSection(schema, null); setSchema(r.schema); select({ kind: "section", id: r.id }); },
    moveSection: (id, dir) => setSchema(moveSection(schema, id, dir)),
    removeSection: id => {
      const section = schema.sections.find(s => s.id === id);
      if (section?.fields?.length && !window.confirm(`Delete "${section.title || "this section"}" and the ${section.fields.length} item(s) in it? Saved answers are kept.`)) return;
      setSchema(removeSection(schema, id)); setSelected(null);
    },
  }), [schema, selected, setSchema, select]);

  const onDragStart = useCallback((e, payload) => {
    dragging.current = payload;
    e.dataTransfer.effectAllowed = payload.kind === "new" ? "copy" : "move";
    e.dataTransfer.setData(payload.kind === "new" ? DRAG_NEW : DRAG_MOVE, payload.kind === "new" ? payload.type : payload.id);
    e.dataTransfer.setData("text/plain", payload.kind === "new" ? payload.type : payload.id);
  }, []);
  useEffect(() => {
    const end = () => { dragging.current = null; setDropHint(null); };
    window.addEventListener("dragend", end);
    return () => window.removeEventListener("dragend", end);
  }, []);

  const drop = useCallback(() => {
    const payload = dragging.current;
    const hint = dropHint;
    dragging.current = null;
    setDropHint(null);
    if (!payload || !hint?.loc || !schema) return;
    if (payload.kind === "new") {
      if (payload.type === "section") { actions.addSection(); return; }
      const el = createElement(payload.type, schema);
      if (!canPlace(schema, el, hint.loc)) { setMessage(el.type === "submit" ? "This form already has a Submit button." : "Rows can't go inside another row."); return; }
      setSchema(insertAt(schema, hint.loc, el));
      select({ kind: "element", id: el.id });
    } else {
      const el = findElement(schema, payload.id);
      if (el && !canPlace(schema, el, hint.loc)) { setMessage("Rows can't go inside another row."); return; }
      setSchema(moveTo(schema, payload.id, hint.loc));
      select({ kind: "element", id: payload.id });
    }
  }, [dropHint, schema, setSchema, select, actions]);

  // Keyboard: undo/redo, delete, duplicate, escape.
  useEffect(() => {
    const onKey = e => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "z" && !isTyping(e.target)) { e.preventDefault(); if (e.shiftKey) draft.redo(); else draft.undo(); return; }
      if (mod && e.key.toLowerCase() === "y" && !isTyping(e.target)) { e.preventDefault(); draft.redo(); return; }
      if (isTyping(e.target) || mode !== "edit") return;
      if ((e.key === "Delete" || e.key === "Backspace") && selected?.kind === "element") { e.preventDefault(); actions.remove(selected.id); }
      if (mod && e.key.toLowerCase() === "d" && selected?.kind === "element") { e.preventDefault(); actions.duplicate(selected.id); }
      if (e.key === "Escape") setSelected(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [draft, actions, selected, mode]);

  const publish = async () => {
    setMessage(""); setProblems([]); setPublishing(true);
    try {
      const result = await draft.publish();
      if (!result.ok) setProblems(result.problems);
      else { setMessage("Published. The live form now uses this version."); onPublished?.(); }
    } catch (err) {
      setProblems([{ message: /permission|42501|Only admins/i.test(err?.message || "") ? "Only admins can publish forms." : err?.message || "Couldn't publish." }]);
    } finally { setPublishing(false); }
  };

  const close = async () => {
    if (draft.unsaved) {
      await draft.flush();
      if (draft.unsaved && !window.confirm("Some changes aren't saved yet. Close anyway? (They stay in this browser and are offered again next time.)")) return;
    }
    onClose?.();
  };

  const previewValues = useMemo(() => ({}), []);
  if (!schema) {
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center" style={{ backgroundColor: T.bg }}>
        {draft.status === "failed" ? <div className="max-w-md flex flex-col gap-3"><Notice tone="danger">{draft.error}</Notice><Button tone="outline" onClick={onClose}>Close</Button></div> : <Loader2 size={22} className="animate-spin" style={{ color: T.muted }} />}
      </div>
    );
  }

  const ctx = { schema, selected, select, dropHint, setDropHint, dragging, drop, onDragStart, actions, previewValues };
  const deviceWidth = DEVICES[device].width;
  const titleText = (schema.title || "").replace(/\{(\w+)\}/g, (m, k) => titleVars[k] ?? m);

  return (
    <div className="fixed inset-0 z-[60] flex flex-col" style={{ backgroundColor: T.bg, ...fontBody }} role="dialog" aria-modal="true" aria-label="Form Studio">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 flex-wrap shrink-0" style={{ backgroundColor: T.surface, borderBottom: `1px solid ${T.border}`, paddingTop: "calc(8px + env(safe-area-inset-top, 0px))" }}>
        <ToolButton label="Close the Form Studio" onClick={close}><X size={17} /></ToolButton>
        <input value={name} onChange={e => setName(e.target.value)} onBlur={() => { const t = name.trim(); if (t && `Form — ${t}` !== draft.doc.title && t !== draft.doc.title) draft.renameForm(`Form — ${t}`).catch(() => {}); }}
          aria-label="Form name" className="text-sm font-semibold rounded-md px-2 py-1 outline-none min-w-0 flex-1 sm:flex-none sm:w-64" style={{ color: T.ink, border: "1px solid transparent" }} />
        <Badge status={draft.publishState} />
        <div className="flex items-center gap-0.5 ml-1">
          <ToolButton label="Undo (Ctrl+Z)" onClick={draft.undo} disabled={!draft.canUndo}><Undo2 size={16} /></ToolButton>
          <ToolButton label="Redo (Ctrl+Shift+Z)" onClick={draft.redo} disabled={!draft.canRedo}><Redo2 size={16} /></ToolButton>
        </div>
        <SaveStatus draft={draft} />
        <div className="flex-1" />
        <div className="flex items-center gap-0.5 rounded-lg p-0.5" style={{ backgroundColor: T.bg }}>
          {Object.entries(DEVICES).map(([key, d]) => { const Icon = d.icon; return <ToolButton key={key} label={`${d.label} preview`} active={device === key} onClick={() => setDevice(key)}><Icon size={15} /></ToolButton>; })}
        </div>
        <ToolButton label="Fields and elements" active={panel === "library"} onClick={() => setPanel(p => (p === "library" ? null : "library"))}><PanelLeft size={16} /><span className="lg:hidden">Add</span></ToolButton>
        <ToolButton label="Settings panel" active={panel === "inspector"} onClick={() => setPanel(p => (p === "inspector" ? null : "inspector"))}><PanelRight size={16} /><span className="lg:hidden">Settings</span></ToolButton>
        <Button tone="outline" small icon={mode === "edit" ? Eye : Pencil} onClick={() => { setMode(m => (m === "edit" ? "preview" : "edit")); setSelected(null); }}>{mode === "edit" ? "Preview" : "Back to editing"}</Button>
        <Button small icon={Send} busy={publishing} disabled={draft.status === "loading" || draft.status === "conflict"} onClick={publish}>Publish</Button>
      </div>

      {/* Notices */}
      {(draft.recovery || draft.status === "conflict" || draft.status === "failed" || problems.length > 0 || message) && (
        <div className="px-4 pt-3 flex flex-col gap-2 shrink-0">
          {draft.recovery && <Notice tone="warn">
            <span className="flex items-center gap-2 flex-wrap">Unsaved changes from {new Date(draft.recovery.at).toLocaleString()} were found in this browser.
              <button type="button" className="underline font-semibold" onClick={draft.restoreRecovery}>Restore them</button>
              <button type="button" className="underline" onClick={draft.dismissRecovery}>Discard</button></span>
          </Notice>}
          {draft.status === "conflict" && <Notice tone="warn">
            <span className="flex items-center gap-2 flex-wrap">{draft.error}
              <button type="button" className="underline font-semibold" onClick={draft.keepMine}>Keep my version</button>
              <button type="button" className="underline" onClick={draft.takeTheirs}>Load the other version</button></span>
          </Notice>}
          {draft.status === "failed" && <Notice tone="danger">Couldn't save: {draft.error}. Your edits are kept in this browser; saving retries automatically, or click Retry.</Notice>}
          {problems.length > 0 && <Notice tone="danger">
            <span className="font-semibold">Fix these before publishing (the live form hasn't changed):</span>
            <ul className="list-disc pl-5 mt-1">{problems.map((p, i) => <li key={i}>{p.id ? <button type="button" className="underline text-left" onClick={() => { setMode("edit"); select({ kind: "element", id: p.id }); }}>{p.message}</button> : p.message}</li>)}</ul>
          </Notice>}
          {message && <Notice tone="success"><span className="flex items-center gap-2">{message}<button type="button" className="underline" onClick={() => setMessage("")}>OK</button></span></Notice>}
        </div>
      )}

      {/* Panels */}
      <div className="flex-1 min-h-0 flex relative">
        {mode === "edit" && (
          <aside className={`studio-panel studio-left ${panel === "library" ? "open" : ""}`} style={{ backgroundColor: T.surface, borderRight: `1px solid ${T.border}` }} aria-label="Fields and elements">
            <div className="flex shrink-0 px-3 pt-2 gap-4" role="tablist" aria-label="Left panel" style={{ borderBottom: `1px solid ${T.border}` }}>
              {[["fields", "Fields"], ["settings", "Form settings"]].map(([id, label]) => (
                <button key={id} type="button" role="tab" aria-selected={leftTab === id} onClick={() => setLeftTab(id)} className="pb-2.5 pt-1 text-sm -mb-px"
                  style={{ color: leftTab === id ? T.ink : T.muted, fontWeight: leftTab === id ? 600 : 400, borderBottom: `2px solid ${leftTab === id ? T.accent : "transparent"}`, ...fontBody }}>{label}</button>
              ))}
            </div>
            {leftTab === "fields"
              ? <Library onAdd={type => { actions.add(type); }} onDragStart={onDragStart} />
              : <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4"><FormSettings schema={schema} setSchema={setSchema} /></div>}
          </aside>
        )}
        <main className="flex-1 min-w-0 overflow-y-auto" onClick={() => setSelected(null)} style={{ padding: "24px 16px 80px" }}>
          <div className="travel-site mx-auto" style={{ maxWidth: deviceWidth, background: "transparent", transition: "max-width .2s ease" }}>
            <div className="svc-form-card">
              <div className="svc-form-head"><h3>{titleText || "Untitled form"}</h3>{schema.description && <p>{schema.description}</p>}</div>
              {mode === "edit" ? <div className={device === "mobile" ? "fr-device-mobile" : undefined}><EditCanvas ctx={ctx} /></div> : <PreviewCanvas schema={schema} device={device} />}
            </div>
          </div>
          {mode === "edit" && <p className="text-center text-[11px] mt-4 flex items-center justify-center gap-1.5" style={{ color: T.muted }}><MousePointerClick size={12} /> Click an item to edit it. Del deletes, Ctrl+D duplicates, Ctrl+Z undoes.</p>}
        </main>
        {mode === "edit" && (
          <aside className={`studio-panel studio-right ${panel === "inspector" ? "open" : ""}`} style={{ backgroundColor: T.surface, borderLeft: `1px solid ${T.border}` }} aria-label="Settings">
            <StudioInspector schema={schema} setSchema={setSchema} selected={selected} onSelect={setSelected} actions={actions} />
          </aside>
        )}
      </div>
      <style>{`
        .studio-panel{width:300px;flex-shrink:0;min-height:0;display:flex;flex-direction:column}
        .studio-el .studio-el-bar{display:none}
        .studio-el:hover .studio-el-bar{display:flex}
        .studio-el:hover{outline-color:${T.border} !important}
        .fr-device-mobile .studio-el{grid-column:1 / -1 !important}
        @media (max-width: 1023px){
          .studio-panel{position:absolute;top:0;bottom:0;z-index:20;width:min(340px,92vw);box-shadow:0 10px 40px rgba(16,24,40,.18);transform:translateX(-110%);transition:transform .2s ease}
          .studio-right{right:0;transform:translateX(110%)}
          .studio-left{left:0}
          .studio-panel.open{transform:none}
        }
      `}</style>
    </div>
  );
}
