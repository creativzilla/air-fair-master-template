import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Download, Mail, Paperclip, Phone, Search, UserPlus, Users } from "lucide-react";
import { T, fontBody, fontMono, Badge, Button, Drawer, EmptyState, FieldLabel, FilterPills, Notice, PageTitle, Panel, Spinner, StageBadge, Tabs, formatDateTime, inputStyle } from "./ui.jsx";
import { FormBuilder, FormPreview } from "./FormBuilder.jsx";
import { PublishBar, friendlyError, useDocumentEditor, useDocumentList } from "./DocumentWorkflow.jsx";
import { docStatus, getVersionContent, signedAttachmentUrl } from "./api.js";
import { supabase } from "../lib/supabase.js";

const STATUSES = ["New", "Contacted", "Qualified", "Closed", "Archived"];
const FAMILIES = [
  { value: "all", label: "All forms" },
  { value: "immigration", label: "Immigration" },
  { value: "visa", label: "Visa" },
  { value: "travel", label: "Travel" },
  { value: "contact", label: "Website contact" },
];

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
  return row.form_type;
}

const META_KEYS = new Set(["service_id", "service_slug", "service_name", "service_category", "country_name", "country_slug", "visa_type", "package_name", "package_slug", "source_page", "submitted_at", "agreed_to_privacy_policy", "attachment_upload_failed"]);

function useSubmissions() {
  const [rows, setRows] = useState(null);
  const [leads, setLeads] = useState({});
  const [error, setError] = useState("");
  const reload = useCallback(async () => {
    const [subs, contacts] = await Promise.all([
      supabase.from("form_submissions").select("*").order("created_at", { ascending: false }).limit(1000),
      supabase.from("contacts").select("id,submission_id,status,category,assigned_employee_id"),
    ]);
    if (subs.error) { setError(subs.error.message); setRows([]); return; }
    setRows(subs.data || []);
    const map = {};
    (contacts.data || []).forEach(c => { if (c.submission_id) map[c.submission_id] = c; });
    setLeads(map);
    setError("");
  }, []);
  useEffect(() => { reload(); }, [reload]);
  return { rows, setRows, leads, error, reload };
}

function Answers({ row }) {
  const [form, setForm] = useState(undefined);
  useEffect(() => {
    let active = true;
    (async () => {
      let content = null;
      if (row.form_version_id) { try { content = (await getVersionContent(row.form_version_id)).content; } catch { /* staff can't read versions */ } }
      if (!content && row.form_key) {
        const { data } = await supabase.from("cms_published").select("content").eq("kind", "form").eq("slug", row.form_key).maybeSingle();
        content = data?.content || null;
      }
      if (active) setForm(content);
    })();
    return () => { active = false; };
  }, [row.form_version_id, row.form_key]);

  const data = row.raw_data || {};
  if (form === undefined) return <Spinner label="Loading answers..." />;
  const known = new Set();
  const sections = (form?.sections || []).map(section => ({
    title: section.title,
    items: (section.fields || []).filter(f => data[f.name] !== undefined).map(f => { known.add(f.name); return { label: f.label, value: data[f.name] }; }),
  })).filter(s => s.items.length);
  const other = Object.entries(data).filter(([k]) => !known.has(k) && !META_KEYS.has(k));
  const format = v => (Array.isArray(v) ? v.join(", ") : typeof v === "boolean" ? (v ? "Yes" : "No") : String(v));

  return (
    <div className="flex flex-col gap-4">
      {sections.map((s, i) => (
        <div key={i}>
          {s.title && <div className="text-[11px] font-semibold uppercase mb-2" style={{ color: T.muted, letterSpacing: "0.05em", ...fontBody }}>{s.title}</div>}
          <dl className="flex flex-col gap-2">{s.items.map(item => <div key={item.label}><dt className="text-xs" style={{ color: T.muted, ...fontBody }}>{item.label}</dt><dd className="text-sm whitespace-pre-wrap" style={{ color: T.ink, ...fontBody }}>{format(item.value)}</dd></div>)}</dl>
        </div>
      ))}
      {other.length > 0 && <div>
        <div className="text-[11px] font-semibold uppercase mb-2" style={{ color: T.muted, letterSpacing: "0.05em", ...fontBody }}>{sections.length ? "Other details" : "Answers"}</div>
        <dl className="flex flex-col gap-2">{other.map(([k, v]) => <div key={k}><dt className="text-xs" style={{ color: T.muted, ...fontBody }}>{k}</dt><dd className="text-sm whitespace-pre-wrap" style={{ color: T.ink, ...fontBody }}>{format(v)}</dd></div>)}</dl>
      </div>}
    </div>
  );
}

function SubmissionDrawer({ row, lead, stages, role, onClose, onUpdated, onCreateLead, goTo }) {
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
        {data.attachment_upload_failed && <Notice tone="warn">The visitor tried to attach a file ({data.attachment_upload_failed.join(", ")}) but the upload failed.</Notice>}
        <Answers row={row} />
        <div>
          <FieldLabel>Internal notes</FieldLabel>
          <textarea rows={3} value={notes} onChange={e => setNotes(e.target.value)} className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={inputStyle} placeholder="Only visible to your team" />
        </div>
        <div className="text-xs flex flex-col gap-0.5" style={{ color: T.muted, ...fontBody }}>
          {row.source_page && <span>Submitted from {row.source_page}</span>}
          {data.agreed_to_privacy_policy && <span>Agreed to the Privacy Policy</span>}
        </div>
        {error && <Notice tone="danger">{error}</Notice>}
      </div>
    </Drawer>
  );
}

function exportCsv(rows) {
  const header = ["Received", "Name", "Email", "Phone", "Form", "Status"];
  const esc = v => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = [header.join(","), ...rows.map(r => [formatDateTime(r.created_at), r.name, r.email, r.phone, formLabel(r), r.status].map(esc).join(","))];
  const url = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/csv" }));
  const a = document.createElement("a");
  a.href = url; a.download = `submissions-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
  URL.revokeObjectURL(url);
}

function SubmissionsInbox({ role, stages, goTo, onConvertToCase }) {
  const { rows, setRows, leads, error, reload } = useSubmissions();
  const [status, setStatus] = useState("All");
  const [family, setFamily] = useState("all");
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState(null);

  const filtered = useMemo(() => (rows || []).filter(r => {
    if (status === "All" ? r.status === "Archived" : r.status !== status) return false;
    if (family !== "all" && familyOf(r) !== family) return false;
    const q = query.trim().toLowerCase();
    return !q || [r.name, r.email, r.phone, formLabel(r)].some(v => (v || "").toLowerCase().includes(q));
  }), [rows, status, family, query]);

  const open = rows?.find(r => r.id === openId);
  const counts = useMemo(() => Object.fromEntries(STATUSES.map(s => [s, (rows || []).filter(r => r.status === s).length])), [rows]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <FilterPills options={[{ value: "All", label: "Open" }, ...STATUSES.map(s => ({ value: s, label: `${s} (${counts[s] || 0})` }))]} active={status} onChange={setStatus} />
        <Button tone="outline" small icon={Download} disabled={!filtered.length} onClick={() => exportCsv(filtered)}>Export CSV</Button>
      </div>
      <div className="flex items-center gap-3 flex-wrap">
        <select value={family} onChange={e => setFamily(e.target.value)} className="rounded-lg px-3 py-2 text-sm outline-none" style={{ ...inputStyle, backgroundColor: "#fff" }}>{FAMILIES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}</select>
        <div className="relative flex-1 min-w-[200px] max-w-sm"><Search size={14} style={{ color: T.muted, position: "absolute", left: 10, top: 10 }} /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search name, email, phone or form" className="w-full rounded-lg pl-8 pr-3 py-2 text-sm outline-none" style={inputStyle} /></div>
      </div>
      {error && <Notice tone="danger">{error}</Notice>}
      {rows === null ? <Spinner /> : (
        <Panel className="overflow-x-auto">
          <table className="w-full text-sm" style={{ minWidth: 720 }}>
            <thead><tr style={{ borderBottom: `1px solid ${T.border}` }}>{["Name", "Contact", "Form", "Received", "Status", "Lead"].map(h => <th key={h} className="text-left px-5 py-3 text-xs uppercase tracking-wide" style={{ color: T.muted, ...fontBody, letterSpacing: "0.05em" }}>{h}</th>)}</tr></thead>
            <tbody>
              {filtered.map((r, i) => (
                <tr key={r.id} onClick={() => setOpenId(r.id)} className="cursor-pointer hover:opacity-80" style={{ borderBottom: i < filtered.length - 1 ? `1px solid ${T.border}` : "none" }}>
                  <td className="px-5 py-3" style={{ color: T.ink, ...fontBody }}><span className="flex items-center gap-1.5">{r.name || "—"}{Array.isArray(r.attachments) && r.attachments.length > 0 && <Paperclip size={12} style={{ color: T.muted }} />}</span></td>
                  <td className="px-5 py-3" style={{ color: T.muted, ...fontBody }}><div className="truncate max-w-[200px]">{r.email}</div><div className="text-xs">{r.phone}</div></td>
                  <td className="px-5 py-3" style={{ color: T.ink, ...fontBody }}>{formLabel(r)}</td>
                  <td className="px-5 py-3 whitespace-nowrap" style={{ ...fontMono, color: T.muted }}>{formatDateTime(r.created_at)}</td>
                  <td className="px-5 py-3"><Badge status={r.status} /></td>
                  <td className="px-5 py-3">{leads[r.id] ? <StageBadge stage={leads[r.id].status} stages={stages} /> : <span className="text-xs" style={{ color: T.muted }}>—</span>}</td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={6}><EmptyState>No submissions in this view.</EmptyState></td></tr>}
            </tbody>
          </table>
        </Panel>
      )}
      {open && <SubmissionDrawer key={open.id} row={open} lead={leads[open.id]} stages={stages} role={role} goTo={goTo} onClose={() => setOpenId(null)}
        onUpdated={updated => setRows(prev => prev.map(r => (r.id === updated.id ? updated : r)))}
        onCreateLead={async row => { await onConvertToCase({ id: row.id, name: row.name, email: row.email, type: row.form_type }); await reload(); }} />}
    </div>
  );
}

function FormDocumentScreen({ docId, role, onBack, onChanged }) {
  const editor = useDocumentEditor(docId);
  const [tab, setTab] = useState("build");
  if (!editor.doc || !editor.draft) return editor.error ? <Notice tone="danger">{editor.error}</Notice> : <Spinner />;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3"><button type="button" onClick={onBack} className="flex items-center gap-1 text-sm" style={{ color: T.muted, ...fontBody }}><ArrowLeft size={15} /> All forms</button><h2 className="text-lg truncate" style={{ color: T.ink, ...fontBody, fontWeight: 600 }}>{editor.doc.title.replace(/^Form — /, "")}</h2></div>
      <div className="sticky z-10" style={{ top: 0 }}><PublishBar editor={editor} role={role} onPublished={onChanged} /></div>
      <Tabs tabs={[{ id: "build", label: "Build" }, { id: "preview", label: "Preview" }]} active={tab} onChange={setTab} />
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4 dash-grid-5">
        <div className={`xl:col-span-3 min-w-0 ${tab === "preview" ? "hidden xl:block" : ""}`}><FormBuilder form={editor.draft} onChange={editor.setDraft} /></div>
        <div className={`xl:col-span-2 min-w-0 ${tab === "build" ? "hidden xl:block" : ""}`}><FormPreview form={editor.draft} titleVars={{ title: "Japan Tourist Visa" }} /></div>
      </div>
    </div>
  );
}

function FormsLibrary({ role }) {
  const { docs, error, reload } = useDocumentList("form");
  const [openId, setOpenId] = useState(null);
  if (openId) return <FormDocumentScreen docId={openId} role={role} onBack={() => setOpenId(null)} onChanged={reload} />;
  const describe = doc => doc.slug === "visa-inquiry" ? "All visa destinations" : doc.slug === "travel-inquiry" ? "All travel packages" : doc.slug === "website-contact" ? "Homepage contact section" : doc.slug.startsWith("immigration-") ? "Immigration service" : "Custom form";
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm" style={{ color: T.muted, ...fontBody }}>Forms can also be edited from each service's screen. Shared forms are used by several pages.</p>
      {error && <Notice tone="danger">{error}</Notice>}
      {docs === null ? <Spinner /> : (
        <Panel className="overflow-hidden">
          {docs.map((doc, i) => (
            <button key={doc.id} type="button" onClick={() => setOpenId(doc.id)} className="w-full flex items-center gap-3 px-5 py-3.5 text-left" style={{ borderBottom: i < docs.length - 1 ? `1px solid ${T.border}` : "none" }}>
              <div className="flex-1 min-w-0"><div className="text-sm truncate" style={{ color: T.ink, ...fontBody }}>{doc.title.replace(/^Form — /, "")}</div><div className="text-xs mt-0.5" style={{ color: T.muted, ...fontBody }}>{describe(doc)} · {(doc.draft?.sections || []).reduce((n, s) => n + (s.fields?.length || 0), 0)} fields</div></div>
              <Badge status={docStatus(doc)} />
            </button>
          ))}
        </Panel>
      )}
    </div>
  );
}

// "Forms" module: submissions inbox (default) and the form builder.
export default function FormsModule({ role, stages, goTo, onConvertToCase }) {
  const [tab, setTab] = useState("submissions");
  const canBuild = role === "admin" || role === "editor";
  return (
    <div className="flex flex-col gap-6">
      <PageTitle title="Forms" subtitle="Every enquiry from the website, and the forms visitors fill in." actions={<Button tone="soft" icon={Users} onClick={() => goTo("pipeline")}>Open Pipeline</Button>} />
      {canBuild && <Tabs tabs={[{ id: "submissions", label: "Submissions" }, { id: "builder", label: "Form builder" }]} active={tab} onChange={setTab} />}
      {tab === "submissions" || !canBuild ? <SubmissionsInbox role={role} stages={stages} goTo={goTo} onConvertToCase={onConvertToCase} /> : <FormsLibrary role={role} />}
    </div>
  );
}
