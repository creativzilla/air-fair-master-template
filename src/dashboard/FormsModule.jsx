import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Download, Mail, Paperclip, Pencil, Phone, Search, UserPlus, Users } from "lucide-react";
import { T, fontBody, fontMono, Badge, Button, Drawer, EmptyState, FieldLabel, FilterPills, Notice, PageTitle, Panel, Spinner, StageBadge, Tabs, formatDateTime, inputStyle } from "./ui.jsx";
import { friendlyError, useDocumentList } from "./DocumentWorkflow.jsx";
import { docStatus, getVersionContent, signedAttachmentUrl } from "./api.js";
import { supabase } from "../lib/supabase.js";
import { CONTEXT_KEYS, elementId, formatAnswer, inputFields, isInput, normalizeSchema, walk } from "../../supabase/functions/_shared/forms/schema.ts";

const FormStudio = React.lazy(() => import("./formStudio/FormStudio.jsx"));

const STATUSES = ["New", "Contacted", "Qualified", "Closed", "Archived"];
const PAGE_SIZE = 25;
const FAMILIES = [
  { value: "all", label: "All forms" },
  { value: "immigration", label: "Immigration" },
  { value: "visa", label: "Visa" },
  { value: "travel", label: "Travel" },
  { value: "contact", label: "Website contact" },
];
// Keys the server stores about the page/routing; not answers.
const META_KEYS = new Set([...CONTEXT_KEYS, "form_id", "service_type", "source", "mapped_service", "mapped_message"]);

function familyOf(row) {
  const key = row.form_key || row.form_type || "";
  if (key.startsWith("immigration")) return "immigration";
  if (key.startsWith("visa")) return "visa";
  if (key.startsWith("travel")) return "travel";
  if (key === "website-contact" || key === "website_inquiry") return "contact";
  return "other";
}

function formLabel(row) {
  const d = row.raw_data || {};
  const name = d.service_name || d.country_name || d.package_name;
  const family = familyOf(row);
  if (name) return family === "visa" ? `Visa — ${name}` : name;
  if (family === "contact") return "Website contact form";
  return row.form_key || row.form_type;
}

// PostgREST "or" filter values can't contain these characters unescaped.
const searchTerm = q => q.replace(/[,()*%\\]/g, " ").trim();

function applyFilters(query, { status, family, formKey, q }) {
  let next = status === "All" ? query.neq("status", "Archived") : query.eq("status", status);
  if (formKey) next = next.eq("form_key", formKey);
  else if (family === "immigration") next = next.like("form_key", "immigration-%");
  else if (family === "visa") next = next.eq("form_key", "visa-inquiry");
  else if (family === "travel") next = next.eq("form_key", "travel-inquiry");
  else if (family === "contact") next = next.eq("form_key", "website-contact");
  const term = searchTerm(q || "");
  if (term) next = next.or(`name.ilike.*${term}*,email.ilike.*${term}*,phone.ilike.*${term}*`);
  return next;
}

// ---------------------------------------------------------------- answers (labelled from the submitted version)
const contentCache = new Map();
async function formContentFor(row) {
  const key = row.form_version_id || `published:${row.form_key}`;
  if (contentCache.has(key)) return contentCache.get(key);
  let content = null;
  if (row.form_version_id) { try { content = (await getVersionContent(row.form_version_id)).content; } catch { /* staff can't read versions */ } }
  if (!content && row.form_key) {
    const { data } = await supabase.from("cms_published").select("content").eq("kind", "form").eq("slug", row.form_key).maybeSingle();
    content = data?.content || null;
  }
  contentCache.set(key, content);
  return content;
}

async function registryFor(formKey) {
  if (!formKey) return [];
  const { data: doc } = await supabase.from("cms_documents").select("id").eq("kind", "form").eq("slug", formKey).maybeSingle();
  if (!doc) return [];
  const { data } = await supabase.from("form_fields").select("element_id,kind,type,field_key,label,settings,position,is_archived").eq("form_document_id", doc.id).eq("kind", "input").order("position");
  return data || [];
}

function valueOf(row, field) {
  const answers = row.answers || {};
  const id = elementId(field);
  if (answers[id] !== undefined) return answers[id];
  return (row.raw_data || {})[field.name];
}

function AnswerValue({ field, value, onOpenFile }) {
  if (value && typeof value === "object" && typeof value.file === "string") {
    return <button type="button" onClick={() => onOpenFile(value.file)} className="flex items-center gap-1.5 text-sm" style={{ color: T.accent, ...fontBody }}><Paperclip size={13} /> {value.name || "Attachment"}</button>;
  }
  return <span>{formatAnswer(field, value)}</span>;
}

function Answers({ row, onOpenFile }) {
  const [state, setState] = useState(undefined);
  useEffect(() => {
    let active = true;
    (async () => {
      const [content, registry] = await Promise.all([formContentFor(row), registryFor(row.form_key)]);
      if (active) setState({ schema: content ? normalizeSchema(content) : null, registry });
    })();
    return () => { active = false; };
  }, [row]);
  if (state === undefined) return <Spinner label="Loading answers..." />;

  const data = row.raw_data || {};
  const answers = row.answers || {};
  const shown = new Set();
  const groups = [];
  if (state.schema) {
    const located = walk(state.schema);
    for (const section of state.schema.sections || []) {
      const items = located.filter(l => l.sectionId === section.id && isInput(l.el) && l.el.name).map(l => l.el)
        .map(f => { shown.add(elementId(f)); shown.add(f.name); return { field: f, value: valueOf(row, f) }; })
        .filter(item => item.value !== undefined && item.value !== null && item.value !== "");
      if (items.length) groups.push({ title: section.title, items });
    }
  }
  // Answers to fields that are no longer in that version (renamed or removed): use the field registry.
  const extra = [];
  for (const [id, value] of Object.entries(answers)) {
    if (shown.has(id)) continue;
    const reg = state.registry.find(r => r.element_id === id);
    extra.push({ field: { name: reg?.field_key || id, label: reg?.label || id, type: reg?.type, options: reg?.settings?.options }, value, archived: reg?.is_archived });
    if (reg?.field_key) shown.add(reg.field_key);
  }
  for (const [key, value] of Object.entries(data)) {
    if (shown.has(key) || META_KEYS.has(key) || value === undefined || value === null || value === "") continue;
    const reg = state.registry.find(r => r.field_key === key);
    extra.push({ field: { name: key, label: reg?.label || key, type: reg?.type, options: reg?.settings?.options }, value, archived: reg?.is_archived });
  }

  return (
    <div className="flex flex-col gap-4">
      {groups.map((g, i) => (
        <div key={i}>
          {g.title && <div className="text-[11px] font-semibold uppercase mb-2" style={{ color: T.muted, letterSpacing: "0.05em", ...fontBody }}>{g.title}</div>}
          <dl className="flex flex-col gap-2">{g.items.map(item => (
            <div key={elementId(item.field)}><dt className="text-xs" style={{ color: T.muted, ...fontBody }}>{item.field.label || item.field.name}{item.field.sensitive ? " (sensitive)" : ""}</dt>
              <dd className="text-sm whitespace-pre-wrap" style={{ color: T.ink, ...fontBody }}><AnswerValue field={item.field} value={item.value} onOpenFile={onOpenFile} /></dd></div>
          ))}</dl>
        </div>
      ))}
      {extra.length > 0 && <div>
        <div className="text-[11px] font-semibold uppercase mb-2" style={{ color: T.muted, letterSpacing: "0.05em", ...fontBody }}>{groups.length ? "Other answers" : "Answers"}</div>
        <dl className="flex flex-col gap-2">{extra.map((item, i) => (
          <div key={i}><dt className="text-xs" style={{ color: T.muted, ...fontBody }}>{item.field.label}{item.archived ? " (field since removed)" : ""}</dt>
            <dd className="text-sm whitespace-pre-wrap" style={{ color: T.ink, ...fontBody }}><AnswerValue field={item.field} value={item.value} onOpenFile={onOpenFile} /></dd></div>
        ))}</dl>
      </div>}
      {!groups.length && !extra.length && <p className="text-sm" style={{ color: T.muted, ...fontBody }}>No answers.</p>}
    </div>
  );
}

function SubmissionDrawer({ row, lead, stages, onClose, onUpdated, onCreateLead, goTo }) {
  const [notes, setNotes] = useState(row.notes || "");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const data = row.raw_data || {};

  const update = async (label, patch) => {
    setBusy(label); setError("");
    const { data: updated, error: err } = await supabase.from("form_submissions").update(patch).eq("id", row.id).select().single();
    setBusy("");
    if (err) setError(friendlyError(err)); else onUpdated(updated);
  };

  // Private files: a short-lived signed link, only for signed-in team members.
  const openAttachment = async path => {
    const tab = window.open("about:blank", "_blank");
    try { const url = await signedAttachmentUrl(path); if (tab) tab.location.href = url; } catch (err) { tab?.close(); setError(err.message); }
  };

  return (
    <Drawer title={row.name || "Submission"} onClose={onClose} footer={<>
      <Button tone="outline" busy={busy === "archive"} disabled={row.status === "Archived"} onClick={() => update("archive", { status: "Archived" })}>Archive</Button>
      <Button busy={busy === "notes"} disabled={notes === (row.notes || "")} onClick={() => update("notes", { notes: notes || null })}>Save notes</Button>
    </>}>
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <div className="text-xs" style={{ color: T.muted, ...fontBody }}>{formLabel(row)} · {formatDateTime(row.created_at)}</div>
          <div className="flex gap-2 flex-wrap">
            {row.email && <a href={`mailto:${row.email}?subject=${encodeURIComponent("Re: your inquiry with Air Fair Travel & Immigration")}`}><Button tone="outline" small icon={Mail}>{row.email}</Button></a>}
            {row.phone && <a href={`tel:${row.phone}`}><Button tone="outline" small icon={Phone}>{row.phone}</Button></a>}
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <FieldLabel>Status</FieldLabel>
            <select value={row.status} onChange={e => update("status", { status: e.target.value })} className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={{ ...inputStyle, backgroundColor: "#fff" }}>{STATUSES.map(s => <option key={s} value={s}>{s}</option>)}</select>
          </div>
          <div>
            <FieldLabel>CRM lead</FieldLabel>
            {lead ? <div className="flex items-center gap-2 flex-wrap"><StageBadge stage={lead.status} stages={stages} /><button type="button" className="text-xs underline" style={{ color: T.accent, ...fontBody }} onClick={() => goTo("pipeline")}>Open pipeline</button></div>
              : <Button tone="soft" small icon={UserPlus} onClick={() => onCreateLead(row)}>Add to pipeline</Button>}
          </div>
        </div>
        {Array.isArray(row.attachments) && row.attachments.length > 0 && (
          <div>
            <FieldLabel>Attachments</FieldLabel>
            <div className="flex flex-col gap-1.5">{row.attachments.map(a => <button key={a.path} type="button" onClick={() => openAttachment(a.path)} className="flex items-center gap-2 text-sm text-left" style={{ color: T.accent, ...fontBody }}><Paperclip size={14} /> {a.name} <span className="text-xs" style={{ color: T.muted }}>({Math.round((a.size || 0) / 1024)} KB)</span></button>)}</div>
          </div>
        )}
        {data.attachment_upload_failed && <Notice tone="warn">The visitor tried to attach a file ({[].concat(data.attachment_upload_failed).join(", ")}) but the upload failed.</Notice>}
        <Answers row={row} onOpenFile={openAttachment} />
        <div>
          <FieldLabel>Internal notes</FieldLabel>
          <textarea rows={3} value={notes} onChange={e => setNotes(e.target.value)} className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={inputStyle} placeholder="Only visible to your team" />
        </div>
        <div className="text-xs flex flex-col gap-0.5" style={{ color: T.muted, ...fontBody }}>
          {row.source_page && <span>Submitted from {row.source_page}</span>}
          {(row.form_id || data.form_id) && <span>Form ID: {row.form_id || data.form_id}</span>}
          {row.form_version_id && <span>Form version: {row.form_version_id.slice(0, 8)}</span>}
          {data.agreed_to_privacy_policy && <span>Agreed to the Privacy Policy</span>}
        </div>
        {error && <Notice tone="danger">{error}</Notice>}
      </div>
    </Drawer>
  );
}

// ---------------------------------------------------------------- CSV
// Every cell quoted; quotes doubled; cells starting with = + - @ are prefixed
// with ' so spreadsheet apps don't run them as formulas.
export function csvCell(value) {
  let text = String(value ?? "");
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

async function fetchAll(filters) {
  const rows = [];
  for (let from = 0; from < 5000; from += 1000) {
    const { data, error } = await applyFilters(supabase.from("form_submissions").select("*"), filters).order("created_at", { ascending: false }).range(from, from + 999);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return rows;
}

async function exportCsv(filters) {
  const rows = await fetchAll(filters);
  const base = ["Received", "Name", "Email", "Phone", "Form", "Status"];
  // One form: a column per field (from the field registry, removed fields included).
  const registry = filters.formKey ? (await registryFor(filters.formKey)).filter(r => r.field_key) : [];
  const header = [...base, ...registry.map(r => `${r.label || r.field_key}${r.is_archived ? " (removed)" : ""}`), ...(registry.length ? [] : ["Answers"])];
  const lines = [header.map(csvCell).join(",")];
  for (const r of rows) {
    const cells = [formatDateTime(r.created_at), r.name, r.email, r.phone, formLabel(r), r.status];
    if (registry.length) {
      for (const f of registry) {
        const v = (r.answers || {})[f.element_id] ?? (r.raw_data || {})[f.field_key];
        cells.push(formatAnswer({ type: f.type, options: f.settings?.options }, v));
      }
    } else {
      const data = r.raw_data || {};
      cells.push(Object.entries(data).filter(([k, v]) => !META_KEYS.has(k) && v !== "" && v !== null && v !== undefined).map(([k, v]) => `${k}: ${formatAnswer(undefined, v)}`).join("; "));
    }
    lines.push(cells.map(csvCell).join(","));
  }
  // Byte order mark: Excel then reads the file as UTF-8 (₱, accented names).
  const url = URL.createObjectURL(new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url; a.download = `submissions-${filters.formKey || filters.family}-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
  URL.revokeObjectURL(url);
  return rows.length;
}

// ---------------------------------------------------------------- inbox
function SubmissionsInbox({ stages, goTo, onConvertToCase }) {
  const [status, setStatus] = useState("All");
  const [family, setFamily] = useState("all");
  const [formKey, setFormKey] = useState("");
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState(null);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState({});
  const [leads, setLeads] = useState({});
  const [error, setError] = useState("");
  const [openId, setOpenId] = useState(null);
  const [exporting, setExporting] = useState(false);
  const { docs: forms } = useDocumentList("form");

  useEffect(() => { const t = setTimeout(() => setDebounced(query), 300); return () => clearTimeout(t); }, [query]);
  useEffect(() => { setPage(0); }, [status, family, formKey, debounced]);
  const filters = useMemo(() => ({ status, family, formKey, q: debounced }), [status, family, formKey, debounced]);

  const load = useCallback(async () => {
    setError("");
    const { data, error: err, count } = await applyFilters(supabase.from("form_submissions").select("*", { count: "exact" }), filters)
      .order("created_at", { ascending: false }).range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
    if (err) { setError(err.message); setRows([]); return; }
    setRows(data || []);
    setTotal(count || 0);
    const ids = (data || []).map(r => r.id);
    if (ids.length) {
      const { data: contacts } = await supabase.from("contacts").select("id,submission_id,status,category").in("submission_id", ids);
      const map = {};
      (contacts || []).forEach(c => { map[c.submission_id] = c; });
      setLeads(map);
    }
    const statusCounts = await Promise.all(STATUSES.map(s => applyFilters(supabase.from("form_submissions").select("id", { count: "exact", head: true }), { ...filters, status: s })));
    setCounts(Object.fromEntries(STATUSES.map((s, i) => [s, statusCounts[i].count || 0])));
  }, [filters, page]);
  useEffect(() => { load(); }, [load]);

  const open = rows?.find(r => r.id === openId);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <FilterPills options={[{ value: "All", label: "Open" }, ...STATUSES.map(s => ({ value: s, label: `${s} (${counts[s] ?? 0})` }))]} active={status} onChange={setStatus} />
        <Button tone="outline" small icon={Download} busy={exporting} disabled={!total} onClick={async () => { setExporting(true); try { await exportCsv(filters); } catch (err) { setError(err.message); } finally { setExporting(false); } }}>Export CSV</Button>
      </div>
      <div className="flex items-center gap-3 flex-wrap">
        <select aria-label="Form type" value={family} onChange={e => { setFamily(e.target.value); setFormKey(""); }} className="rounded-lg px-3 py-2 text-sm outline-none" style={{ ...inputStyle, backgroundColor: "#fff" }}>{FAMILIES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}</select>
        <select aria-label="Form" value={formKey} onChange={e => setFormKey(e.target.value)} className="rounded-lg px-3 py-2 text-sm outline-none max-w-[260px]" style={{ ...inputStyle, backgroundColor: "#fff" }}>
          <option value="">Any form</option>
          {(forms || []).map(f => <option key={f.id} value={f.slug}>{f.title.replace(/^Form — /, "")}</option>)}
        </select>
        <div className="relative flex-1 min-w-[200px] max-w-sm"><Search size={14} style={{ color: T.muted, position: "absolute", left: 10, top: 10 }} /><input value={query} onChange={e => setQuery(e.target.value)} aria-label="Search submissions" placeholder="Search name, email or phone" className="w-full rounded-lg pl-8 pr-3 py-2 text-sm outline-none" style={inputStyle} /></div>
      </div>
      {formKey && <p className="text-xs" style={{ color: T.muted, ...fontBody }}>Export CSV gives one column per field of this form, including fields that have since been removed.</p>}
      {error && <Notice tone="danger">{error}</Notice>}
      {rows === null ? <Spinner /> : (
        <Panel className="overflow-x-auto">
          <table className="w-full text-sm" style={{ minWidth: 720 }}>
            <thead><tr style={{ borderBottom: `1px solid ${T.border}` }}>{["Name", "Contact", "Form", "Received", "Status", "Lead"].map(h => <th key={h} className="text-left px-5 py-3 text-xs uppercase tracking-wide" style={{ color: T.muted, ...fontBody, letterSpacing: "0.05em" }}>{h}</th>)}</tr></thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.id} onClick={() => setOpenId(r.id)} onKeyDown={e => { if (e.key === "Enter") setOpenId(r.id); }} tabIndex={0} className="cursor-pointer hover:opacity-80" style={{ borderBottom: i < rows.length - 1 ? `1px solid ${T.border}` : "none" }}>
                  <td className="px-5 py-3" style={{ color: T.ink, ...fontBody }}><span className="flex items-center gap-1.5">{r.name || "—"}{Array.isArray(r.attachments) && r.attachments.length > 0 && <Paperclip size={12} style={{ color: T.muted }} />}</span></td>
                  <td className="px-5 py-3" style={{ color: T.muted, ...fontBody }}><div className="truncate max-w-[200px]">{r.email}</div><div className="text-xs">{r.phone}</div></td>
                  <td className="px-5 py-3" style={{ color: T.ink, ...fontBody }}>{formLabel(r)}</td>
                  <td className="px-5 py-3 whitespace-nowrap" style={{ ...fontMono, color: T.muted }}>{formatDateTime(r.created_at)}</td>
                  <td className="px-5 py-3"><Badge status={r.status} /></td>
                  <td className="px-5 py-3">{leads[r.id] ? <StageBadge stage={leads[r.id].status} stages={stages} /> : <span className="text-xs" style={{ color: T.muted }}>—</span>}</td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={6}><EmptyState>No submissions in this view.</EmptyState></td></tr>}
            </tbody>
          </table>
        </Panel>
      )}
      {total > PAGE_SIZE && (
        <div className="flex items-center justify-between gap-3 text-xs" style={{ color: T.muted, ...fontBody }}>
          <span>{page * PAGE_SIZE + 1}–{Math.min(total, (page + 1) * PAGE_SIZE)} of {total}</span>
          <div className="flex gap-2">
            <Button tone="outline" small icon={ChevronLeft} disabled={page === 0} onClick={() => setPage(p => p - 1)}>Previous</Button>
            <Button tone="outline" small disabled={page >= pages - 1} onClick={() => setPage(p => p + 1)}>Next <ChevronRight size={12} /></Button>
          </div>
        </div>
      )}
      {open && <SubmissionDrawer key={open.id} row={open} lead={leads[open.id]} stages={stages} goTo={goTo} onClose={() => setOpenId(null)}
        onUpdated={updated => setRows(prev => prev.map(r => (r.id === updated.id ? updated : r)))}
        onCreateLead={async row => { await onConvertToCase({ id: row.id, name: row.name, email: row.email, type: row.form_type }); await load(); }} />}
    </div>
  );
}

// ---------------------------------------------------------------- forms list (opens the Form Studio)
function FormsLibrary() {
  const { docs, error, reload } = useDocumentList("form");
  const [openId, setOpenId] = useState(null);
  const describe = doc => doc.slug === "visa-inquiry" ? "All visa destinations" : doc.slug === "travel-inquiry" ? "All travel packages" : doc.slug === "website-contact" ? "Homepage contact section" : doc.slug.startsWith("immigration-") ? "Immigration service" : "Custom form";
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm" style={{ color: T.muted, ...fontBody }}>Click a form to open it in the Form Studio. Changes autosave as a draft; the website keeps the published version until you click Publish.</p>
      {error && <Notice tone="danger">{error}</Notice>}
      {docs === null ? <Spinner /> : (
        <Panel className="overflow-hidden">
          {docs.map((doc, i) => (
            <button key={doc.id} type="button" onClick={() => setOpenId(doc.id)} className="w-full flex items-center gap-3 px-5 py-3.5 text-left" style={{ borderBottom: i < docs.length - 1 ? `1px solid ${T.border}` : "none" }}>
              <div className="flex-1 min-w-0"><div className="text-sm truncate" style={{ color: T.ink, ...fontBody }}>{doc.title.replace(/^Form — /, "")}</div><div className="text-xs mt-0.5" style={{ color: T.muted, ...fontBody }}>{describe(doc)} · {inputFields(normalizeSchema(doc.draft || {})).length} fields</div></div>
              <Badge status={docStatus(doc)} />
              <Pencil size={14} style={{ color: T.muted }} />
            </button>
          ))}
        </Panel>
      )}
      {openId && (
        <React.Suspense fallback={<Spinner label="Opening the Form Studio..." />}>
          <FormStudio docId={openId} onClose={() => { setOpenId(null); reload(); }} onPublished={reload} titleVars={{ title: "Japan Tourist Visa" }} />
        </React.Suspense>
      )}
    </div>
  );
}

// "Forms" module: submissions inbox (default) and, for admins, the forms list.
export default function FormsModule({ role, stages, goTo, onConvertToCase }) {
  const [tab, setTab] = useState("submissions");
  const canBuild = role === "admin";
  return (
    <div className="flex flex-col gap-6">
      <PageTitle title="Forms" subtitle="Every enquiry from the website, and the forms visitors fill in." actions={<Button tone="soft" icon={Users} onClick={() => goTo("pipeline")}>Open Pipeline</Button>} />
      {canBuild && <Tabs tabs={[{ id: "submissions", label: "Submissions" }, { id: "builder", label: "Form builder" }]} active={tab} onChange={setTab} />}
      {tab === "submissions" || !canBuild ? <SubmissionsInbox stages={stages} goTo={goTo} onConvertToCase={onConvertToCase} /> : <FormsLibrary />}
    </div>
  );
}
