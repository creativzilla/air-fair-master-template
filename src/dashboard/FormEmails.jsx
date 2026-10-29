// Dashboard > Form Emails (admin only; RLS and the Edge Function enforce it).
// - Auto-replies: one client auto-reply per category (general, immigration,
//   visa, travel) plus optional overrides for a single form_id. A new service
//   or package has no override, so it uses its category's default.
// - Preview uses the same renderer as the Edge Function; "Send test" goes only
//   to an inbox already configured under "Inboxes & sending".
// - Inboxes & sending: the existing email settings and log.
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Save, Send, Trash2 } from "lucide-react";
import { T, fontBody, Badge, Button, FieldLabel, LabeledSelect, Notice, PageTitle, Panel, Tabs, ToggleRow, inputStyle } from "./ui.jsx";
import { supabase } from "../lib/supabase.js";
import EmailSettings from "./EmailSettings.jsx";
import {
  DEFAULT_AUTO_REPLIES, TEMPLATE_LIMITS, TEMPLATE_VARIABLES, renderAutoReply, unknownVariables,
} from "../../supabase/functions/_shared/forms/templates.ts";

const CATEGORIES = [
  ["general", "General / contact form"],
  ["immigration", "Immigration services"],
  ["visa", "Visa inquiries"],
  ["travel", "Travel packages"],
];
const CATEGORY_LABEL = Object.fromEntries(CATEGORIES);
// Published CMS kinds that have their own inquiry form, and their form_id prefix.
const ITEM_KINDS = [
  ["immigration_service", "immigration", "immigration-"],
  ["visa_destination", "visa", "visa-inquiry-"],
  ["travel_package", "travel", "travel-inquiry-"],
];
const SAMPLE_ITEMS = { general: "", immigration: "Pre-Arranged Working Visa (9G)", visa: "Japan Tourist Visa", travel: "Bali, Indonesia" };
const INBOX_KEYS = ["staff_inbox", "inbox_general", "inbox_immigration", "inbox_visa", "inbox_travel", "test_redirect_to"];

const keyOf = row => (row.form_id ? `form:${row.form_id}` : `default:${row.service_type}`);

async function functionError(err) {
  let message = err.message;
  try { message = (await err.context?.json?.())?.error || message; } catch { /* keep message */ }
  return /not found|404|Failed to send/i.test(message) ? "The form-submit Edge Function isn't deployed yet." : message;
}

export default function FormEmails() {
  const [tab, setTab] = useState("auto-replies");
  return (
    <div className="flex flex-col gap-6">
      <PageTitle title="Form Emails" subtitle="What clients receive after submitting a website form, and where your team is notified." />
      <Tabs tabs={[{ id: "auto-replies", label: "Client auto-replies" }, { id: "inboxes", label: "Inboxes & sending" }]} active={tab} onChange={setTab} />
      {tab === "auto-replies" ? <AutoReplies /> : <EmailSettings />}
    </div>
  );
}

function AutoReplies() {
  const [rows, setRows] = useState(null);
  const [items, setItems] = useState([]);
  const [settings, setSettings] = useState(null);
  const [businessName, setBusinessName] = useState("Air Fair Travel & Immigration");
  const [loadError, setLoadError] = useState("");
  const [selected, setSelected] = useState("default:general");
  const [adding, setAdding] = useState(false);

  const load = async () => {
    const { data, error } = await supabase.from("email_templates").select("*").order("form_id", { nullsFirst: true });
    if (error) {
      setLoadError(/email_templates/.test(error.message)
        ? "Auto-reply templates aren't set up yet. Push the latest database update (npx supabase@2.118.0 db push)."
        : error.message);
      setRows(false);
      return;
    }
    setRows(data);
  };

  useEffect(() => {
    load();
    (async () => {
      const [{ data: cms }, { data: email }, { data: site }] = await Promise.all([
        supabase.from("cms_published").select("kind,slug,title").in("kind", ITEM_KINDS.map(k => k[0])).order("sort_order"),
        supabase.from("email_settings").select("*").eq("id", 1).maybeSingle(),
        supabase.from("site_settings").select("business_name").order("updated_at", { ascending: false }).limit(1).maybeSingle(),
      ]);
      setItems((cms || []).map(row => {
        const [, serviceType, prefix] = ITEM_KINDS.find(k => k[0] === row.kind);
        return { formId: prefix + row.slug, serviceType, name: row.title || row.slug };
      }));
      setSettings(email || null);
      if (site?.business_name) setBusinessName(site.business_name);
    })();
  }, []);

  const forms = useMemo(() => [{ formId: "contact-home", serviceType: "general", name: "Contact form (home page)" }, ...items], [items]);
  const formName = formId => forms.find(f => f.formId === formId)?.name || formId;
  const inboxes = useMemo(() => [...new Set(INBOX_KEYS.map(k => settings?.[k]).filter(Boolean).map(e => e.toLowerCase()))], [settings]);

  if (rows === null) return <Panel className="p-6"><p className="text-sm" style={{ color: T.muted, ...fontBody }}>Loading auto-replies...</p></Panel>;
  if (rows === false) return <Panel className="p-6"><Notice tone="warn">{loadError}</Notice></Panel>;

  // A category with no row yet (shouldn't happen after the migration's seed) edits the built-in copy.
  const entries = [
    ...CATEGORIES.map(([type]) => rows.find(r => !r.form_id && r.service_type === type) || { service_type: type, form_id: null, enabled: true, ...DEFAULT_AUTO_REPLIES[type] }),
    ...rows.filter(r => r.form_id),
  ];
  const current = entries.find(e => keyOf(e) === selected) || entries[0];
  const overridden = new Set(rows.filter(r => r.form_id).map(r => r.form_id));

  const onSaved = row => { setRows(prev => [...prev.filter(r => r.id !== row.id), row]); setSelected(keyOf(row)); };
  const onDeleted = row => { setRows(prev => prev.filter(r => r.id !== row.id)); setSelected(`default:${row.service_type}`); };
  const pick = key => { setAdding(false); setSelected(key); };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)] gap-6 items-start">
      <Panel className="p-3">
        <SideList title="Category defaults" entries={entries.filter(e => !e.form_id)} selected={selected} onSelect={pick} label={e => CATEGORY_LABEL[e.service_type]} />
        <div className="mt-4">
          <SideList title="Form-specific overrides" entries={entries.filter(e => e.form_id)} selected={selected} onSelect={pick}
            label={e => formName(e.form_id)} empty="None. Every form uses its category default." />
        </div>
        <div className="mt-3 px-2"><Button small tone="soft" icon={Plus} onClick={() => setAdding(true)}>Add override</Button></div>
      </Panel>

      {adding ? (
        <AddOverride forms={forms.filter(f => !overridden.has(f.formId))} rows={rows}
          onCancel={() => setAdding(false)} onCreated={row => { setAdding(false); onSaved(row); }} />
      ) : (
        <Editor key={keyOf(current)} entry={current} name={current.form_id ? formName(current.form_id) : null}
          sampleItems={forms.filter(f => f.serviceType === current.service_type && f.formId !== "contact-home")}
          inboxes={inboxes} settings={settings} businessName={businessName} onSaved={onSaved} onDeleted={onDeleted} />
      )}
    </div>
  );
}

function SideList({ title, entries, selected, onSelect, label, empty }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide px-2 mb-1.5" style={{ color: T.muted, ...fontBody }}>{title}</p>
      {entries.length === 0 && empty && <p className="text-xs px-2" style={{ color: T.muted, ...fontBody }}>{empty}</p>}
      {entries.map(e => {
        const active = keyOf(e) === selected;
        return (
          <button key={keyOf(e)} type="button" onClick={() => onSelect(keyOf(e))}
            className="w-full text-left rounded-lg px-2 py-2 text-sm flex items-center justify-between gap-2"
            style={{ ...fontBody, color: T.ink, backgroundColor: active ? T.accentSoft : "transparent", fontWeight: active ? 600 : 400 }}>
            <span className="truncate">{label(e)}</span>
            <Badge status={e.enabled ? "Confirmed" : "Cancelled"} label={e.enabled ? "On" : "Off"} />
          </button>
        );
      })}
    </div>
  );
}

function AddOverride({ forms, rows, onCancel, onCreated }) {
  const [formId, setFormId] = useState(forms[0]?.formId || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const create = async () => {
    const form = forms.find(f => f.formId === formId);
    if (!form) return;
    // Start from the category's current default so the admin only changes what differs.
    const base = rows.find(r => !r.form_id && r.service_type === form.serviceType) || DEFAULT_AUTO_REPLIES[form.serviceType];
    setBusy(true);
    const { data, error: err } = await supabase.from("email_templates")
      .insert({ service_type: form.serviceType, form_id: form.formId, enabled: true, subject: base.subject, body: base.body }).select().single();
    setBusy(false);
    if (err) { setError(err.message); return; }
    onCreated(data);
  };
  return (
    <Panel className="p-6 max-w-xl">
      <div className="flex flex-col gap-4">
        <h3 className="text-sm font-semibold" style={{ color: T.ink, ...fontBody }}>New form-specific override</h3>
        <p className="text-xs" style={{ color: T.muted, ...fontBody }}>
          Only needed when one service or package should get a different message. While the override is on it replaces the category default for that form only.
        </p>
        {forms.length === 0 ? <Notice>Every form already has an override.</Notice> : (
          <LabeledSelect label="Form" value={formId} onChange={setFormId}
            options={forms.map(f => ({ value: f.formId, label: `${CATEGORY_LABEL[f.serviceType]}: ${f.name}` }))} />
        )}
        {error && <Notice tone="danger">{error}</Notice>}
        <div className="flex gap-2">
          <Button icon={Plus} busy={busy} disabled={!formId} onClick={create}>Create override</Button>
          <Button tone="outline" onClick={onCancel}>Cancel</Button>
        </div>
      </div>
    </Panel>
  );
}

function Editor({ entry, name, sampleItems, inboxes, settings, businessName, onSaved, onDeleted }) {
  const [draft, setDraft] = useState({ enabled: entry.enabled, subject: entry.subject, body: entry.body });
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [sampleForm, setSampleForm] = useState(entry.form_id || sampleItems[0]?.formId || "");
  const [testTo, setTestTo] = useState(inboxes[0] || "");
  const bodyRef = useRef(null);
  const type = entry.service_type;

  useEffect(() => { if (!testTo && inboxes[0]) setTestTo(inboxes[0]); }, [inboxes, testTo]);

  const set = patch => { setDraft(prev => ({ ...prev, ...patch })); setNotice(""); setError(""); };
  const dirty = draft.enabled !== entry.enabled || draft.subject !== entry.subject || draft.body !== entry.body || !entry.id;
  const unknown = unknownVariables(`${draft.subject} ${draft.body}`);
  const problem = !draft.subject.trim() ? "Enter a subject."
    : !draft.body.trim() ? "Enter a message."
    : draft.subject.length > TEMPLATE_LIMITS.subject ? `The subject is longer than ${TEMPLATE_LIMITS.subject} characters.`
    : draft.body.length > TEMPLATE_LIMITS.body ? `The message is longer than ${TEMPLATE_LIMITS.body} characters.`
    : unknown.length ? `Unknown variable(s): ${unknown.map(v => `{{${v}}}`).join(", ")}. Use only the variables listed below.`
    : "";

  const itemName = entry.form_id === "contact-home" ? "" : sampleItems.find(i => i.formId === sampleForm)?.name || SAMPLE_ITEMS[type];
  const preview = useMemo(() => renderAutoReply({ subject: draft.subject, body: draft.body }, {
    serviceType: type, itemName: itemName || null, reference: "AF-TEST01", customerName: "Maria Santos",
    submittedAt: new Date(), businessName, replyEmail: settings?.[`inbox_${type}`] || settings?.staff_inbox || null, redirectedFrom: null,
  }), [draft.subject, draft.body, type, itemName, businessName, settings]);

  const insertVariable = variable => {
    const el = bodyRef.current;
    const token = `{{${variable}}}`;
    const at = el ? el.selectionStart : draft.body.length;
    const end = el ? el.selectionEnd : at;
    set({ body: draft.body.slice(0, at) + token + draft.body.slice(end) });
    requestAnimationFrame(() => { if (el) { el.focus(); el.selectionStart = el.selectionEnd = at + token.length; } });
  };

  const save = async () => {
    if (problem) { setError(problem); return; }
    setBusy("save");
    const values = { enabled: draft.enabled, subject: draft.subject.trim(), body: draft.body.trim() };
    const query = entry.id
      ? supabase.from("email_templates").update(values).eq("id", entry.id)
      : supabase.from("email_templates").insert({ service_type: type, form_id: null, ...values });
    const { data, error: err } = await query.select().single();
    setBusy("");
    if (err) { setError(err.message); return; }
    onSaved(data);
    setNotice("Saved. New submissions use this version.");
  };

  const remove = async () => {
    setBusy("delete");
    const { error: err } = await supabase.from("email_templates").delete().eq("id", entry.id);
    setBusy("");
    if (err) { setError(err.message); return; }
    onDeleted(entry);
  };

  const sendTest = async () => {
    if (problem) { setError(problem); return; }
    setBusy("test"); setError(""); setNotice("");
    const { data, error: err } = await supabase.functions.invoke("form-submit", {
      body: { action: "send_template_test", service_type: type, form_id: entry.form_id || sampleForm || null, subject: draft.subject, body: draft.body, to: testTo },
    });
    setBusy("");
    if (err) { setError(await functionError(err)); return; }
    if (data?.status === "sent") setNotice(`Test sent to ${testTo}. It appears in the log under "Inboxes & sending".`);
    else if (data?.status === "queued_for_retry") setNotice("The email provider didn't accept the test yet; it will retry automatically. Check the log under \"Inboxes & sending\".");
    else setError("The test wasn't sent. Check the log under \"Inboxes & sending\" for the reason.");
  };

  return (
    <div className="flex flex-col gap-6 min-w-0">
      <Panel className="p-6">
        <div className="flex flex-col gap-5">
          <div>
            <h3 className="text-sm font-semibold mb-1" style={{ color: T.ink, ...fontBody }}>
              {entry.form_id ? `Override: ${name}` : `Default auto-reply: ${CATEGORY_LABEL[type]}`}
            </h3>
            <p className="text-xs" style={{ color: T.muted, ...fontBody }}>
              {entry.form_id
                ? `Used only for the "${name}" form (${entry.form_id}) while switched on. When off, that form uses the ${CATEGORY_LABEL[type]} default.`
                : `Sent to clients after any ${CATEGORY_LABEL[type].toLowerCase()} form, including services and packages added later, unless that form has its own override.`}
            </p>
          </div>

          <ToggleRow label={entry.form_id ? "Use this override" : "Send an auto-reply for this category"} checked={draft.enabled} onChange={enabled => set({ enabled })} />
          {!draft.enabled && !entry.form_id && <Notice tone="warn">Clients won't get an auto-reply for these forms. Your team is still notified and the inquiry is still saved.</Notice>}

          <div>
            <FieldLabel hint={`${draft.subject.length}/${TEMPLATE_LIMITS.subject}`}>Subject</FieldLabel>
            <input value={draft.subject} onChange={e => set({ subject: e.target.value })} maxLength={TEMPLATE_LIMITS.subject}
              className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={inputStyle} />
          </div>
          <div>
            <FieldLabel hint={`Plain text. A blank line starts a new paragraph. ${draft.body.length}/${TEMPLATE_LIMITS.body}`}>Message</FieldLabel>
            <textarea ref={bodyRef} rows={14} value={draft.body} onChange={e => set({ body: e.target.value })} maxLength={TEMPLATE_LIMITS.body}
              className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={{ ...inputStyle, fontFamily: "ui-monospace, Menlo, Consolas, monospace", lineHeight: 1.5 }} />
          </div>
          <div>
            <FieldLabel hint="Click to insert at the cursor. Values are filled in safely (the client's own text is never inserted as HTML).">Variables</FieldLabel>
            <div className="flex flex-wrap gap-1.5">
              {TEMPLATE_VARIABLES.map(v => (
                <button key={v.name} type="button" title={v.description} onClick={() => insertVariable(v.name)}
                  className="text-xs px-2 py-1 rounded-md" style={{ backgroundColor: T.infoSoft, color: T.info, ...fontBody }}>{`{{${v.name}}}`}</button>
              ))}
            </div>
          </div>

          {problem && (draft.subject || draft.body) && <Notice tone="warn">{problem}</Notice>}
          {error && <Notice tone="danger">{error}</Notice>}
          {notice && <Notice tone="success">{notice}</Notice>}
          <div className="flex flex-wrap gap-2 items-center">
            <Button icon={Save} busy={busy === "save"} disabled={!dirty || !!problem} onClick={save}>Save</Button>
            {entry.form_id && !confirmDelete && <Button tone="danger" icon={Trash2} onClick={() => setConfirmDelete(true)}>Delete override</Button>}
            {confirmDelete && (
              <>
                <span className="text-xs" style={{ color: T.danger, ...fontBody }}>Delete this override? The form goes back to the category default.</span>
                <Button tone="danger" small busy={busy === "delete"} onClick={remove}>Yes, delete</Button>
                <Button tone="outline" small onClick={() => setConfirmDelete(false)}>Keep</Button>
              </>
            )}
          </div>
        </div>
      </Panel>

      <Panel className="p-6">
        <div className="flex flex-col gap-4">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <h3 className="text-sm font-semibold" style={{ color: T.ink, ...fontBody }}>Preview</h3>
              <p className="text-xs" style={{ color: T.muted, ...fontBody }}>Sample client "Maria Santos", reference AF-TEST01. Shows unsaved changes.</p>
            </div>
            {!entry.form_id && sampleItems.length > 0 && (
              <div className="w-64 max-w-full">
                <LabeledSelect label="Preview as" value={sampleForm} onChange={setSampleForm} options={sampleItems.map(i => ({ value: i.formId, label: i.name }))} />
              </div>
            )}
          </div>
          <div className="rounded-lg px-3 py-2 text-sm" style={{ border: `1px solid ${T.border}`, color: T.ink, ...fontBody }}>
            <span style={{ color: T.muted }}>Subject: </span>{preview.subject}
          </div>
          {/* sandbox="" : no scripts, forms or navigation inside the preview */}
          <iframe title="Email preview" sandbox="" srcDoc={preview.html} className="w-full rounded-lg"
            style={{ height: 520, border: `1px solid ${T.border}`, backgroundColor: "#fff" }} />

          <div className="flex flex-wrap items-end gap-2">
            {inboxes.length === 0 ? (
              <Notice tone="warn">Add your monitored staff inbox under "Inboxes & sending" to send a test.</Notice>
            ) : (
              <>
                <div className="w-72 max-w-full">
                  <LabeledSelect label="Send a test to" value={testTo} onChange={setTestTo} options={inboxes.map(e => ({ value: e, label: e }))}
                    hint="Only inboxes configured in Form Emails. Marked [TEST]." />
                </div>
                <Button tone="outline" icon={Send} busy={busy === "test"} disabled={!!problem || !testTo} onClick={sendTest}>Send test</Button>
              </>
            )}
          </div>
        </div>
      </Panel>
    </div>
  );
}
