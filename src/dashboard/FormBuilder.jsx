// Form builder for CMS form documents. Edits the same schema the website
// renders (sections → fields), and previews with the website's own field
// components so what you see is what visitors get.
import React, { useMemo, useState } from "react";
import {
  AlignLeft, ArrowDown, ArrowUp, Calendar, ChevronDown, ChevronRight, Circle, Globe, Hash, Mail, Monitor, Phone,
  Plus, Smartphone, SquareCheck as CheckSquare, TextCursorInput, ToggleLeft, Trash2, Upload,
} from "lucide-react";
import { T, fontBody, FieldLabel, LabeledInput, LabeledTextarea, Notice, Panel, ToggleRow, inputStyle } from "./ui.jsx";
import DynamicFormField, { isFieldVisible } from "../components/immigration/DynamicFormField.jsx";
import FormSection from "../components/immigration/FormSection.jsx";

export const FIELD_TYPES = [
  { type: "text", label: "Short text", icon: TextCursorInput },
  { type: "email", label: "Email", icon: Mail },
  { type: "tel", label: "Phone", icon: Phone },
  { type: "date", label: "Date", icon: Calendar },
  { type: "number", label: "Number", icon: Hash },
  { type: "textarea", label: "Long text", icon: AlignLeft },
  { type: "select", label: "Dropdown", icon: ChevronDown },
  { type: "radio", label: "Multiple choice", icon: Circle },
  { type: "yesno", label: "Yes / No", icon: ToggleLeft },
  { type: "checkbox", label: "Checkbox", icon: CheckSquare },
  { type: "country", label: "Country", icon: Globe },
  { type: "file", label: "File upload", icon: Upload },
];
const TYPE_META = Object.fromEntries(FIELD_TYPES.map(t => [t.type, t]));
const WITH_OPTIONS = new Set(["select", "radio"]);
const WITH_PLACEHOLDER = new Set(["text", "email", "tel", "number", "textarea", "select", "country"]);

const toKey = label => label.toLowerCase().replace(/[^a-z0-9]+(.)?/g, (_, c) => (c ? c.toUpperCase() : "")).replace(/^[^a-z]+/, "") || "field";

function uniqueName(base, taken) {
  let name = base;
  let i = 2;
  while (taken.has(name)) name = `${base}${i++}`;
  return name;
}

function allFields(form) {
  return (form.sections || []).flatMap(section => section.fields || []);
}

function IconButton({ onClick, label, disabled, danger, children }) {
  return <button type="button" onClick={onClick} disabled={disabled} aria-label={label} title={label} className="p-1 rounded" style={{ color: disabled ? T.border : danger ? T.danger : T.muted }}>{children}</button>;
}

function FieldEditor({ field, onChange, earlierFields, takenNames }) {
  const options = Array.isArray(field.options) ? field.options.map(o => (typeof o === "string" ? o : o.label)) : [];
  const showWhen = Array.isArray(field.showWhen) ? field.showWhen[0] : field.showWhen;
  const conditionField = earlierFields.find(f => f.name === showWhen?.field);
  const conditionChoices = conditionField ? (conditionField.type === "yesno" ? ["Yes", "No"] : (conditionField.options || []).map(o => (typeof o === "string" ? o : o.value))) : [];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3">
      <LabeledInput label="Question / label" value={field.label} onChange={label => onChange({ ...field, label })} />
      <div>
        <FieldLabel hint="Used to store the answer. Letters and numbers only.">Field key</FieldLabel>
        <input value={field.name} onChange={e => { const name = e.target.value.replace(/[^A-Za-z0-9_]/g, ""); if (name && !takenNames.has(name)) onChange({ ...field, name }); }} className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={inputStyle} />
      </div>
      <div>
        <FieldLabel>Field type</FieldLabel>
        <select value={field.type} onChange={e => { const type = e.target.value; const next = { ...field, type }; if (WITH_OPTIONS.has(type) && !next.options?.length) next.options = ["Option 1", "Option 2"]; if (!WITH_OPTIONS.has(type) && type !== "checkbox") delete next.options; onChange(next); }} className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={{ ...inputStyle, backgroundColor: "#fff" }}>
          {FIELD_TYPES.map(t => <option key={t.type} value={t.type}>{t.label}</option>)}
        </select>
      </div>
      <div>
        <FieldLabel>Width</FieldLabel>
        <select value={field.width || ""} onChange={e => { const next = { ...field }; if (e.target.value) next.width = e.target.value; else delete next.width; onChange(next); }} className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={{ ...inputStyle, backgroundColor: "#fff" }}>
          <option value="">Automatic</option><option value="half">Half width</option><option value="full">Full width</option>
        </select>
      </div>
      {WITH_PLACEHOLDER.has(field.type) && <LabeledInput label={field.type === "select" || field.type === "country" ? "First (empty) option text" : "Placeholder"} value={field.placeholder || ""} onChange={placeholder => { const next = { ...field, placeholder }; if (!placeholder) delete next.placeholder; onChange(next); }} />}
      {(WITH_OPTIONS.has(field.type) || field.type === "checkbox") && (
        <div className="sm:col-span-2">
          <LabeledTextarea label={field.type === "checkbox" ? "Options (one per line — leave empty for a single tick box)" : "Options (one per line)"} rows={4} value={options.join("\n")}
            onChange={text => { const list = text.split("\n").map(s => s.trimStart()).filter((s, i, arr) => s || i < arr.length - 1); const next = { ...field }; if (list.some(Boolean)) next.options = list; else delete next.options; onChange(next); }} />
        </div>
      )}
      <div className="sm:col-span-2 flex flex-col gap-2">
        <ToggleRow label="Required" checked={!!field.required} onChange={required => onChange({ ...field, required })} />
        <div className="rounded-lg p-3 flex flex-col gap-2" style={{ backgroundColor: T.bg, border: `1px solid ${T.border}` }}>
          <ToggleRow label="Only show this question depending on an earlier answer" checked={!!showWhen} disabled={earlierFields.length === 0}
            onChange={on => { const next = { ...field }; if (on) next.showWhen = { field: earlierFields[earlierFields.length - 1]?.name, equals: "Yes" }; else delete next.showWhen; onChange(next); }} />
          {showWhen && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <select value={showWhen.field || ""} onChange={e => onChange({ ...field, showWhen: { ...showWhen, field: e.target.value } })} className="rounded-lg px-3 py-2 text-sm outline-none" style={{ ...inputStyle, backgroundColor: "#fff" }}>
                {earlierFields.map(f => <option key={f.name} value={f.name}>{f.label || f.name}</option>)}
              </select>
              {conditionChoices.length > 0 ? (
                <select value={showWhen.equals ?? ""} onChange={e => onChange({ ...field, showWhen: { field: showWhen.field, equals: e.target.value } })} className="rounded-lg px-3 py-2 text-sm outline-none" style={{ ...inputStyle, backgroundColor: "#fff" }}>
                  {conditionChoices.map(c => <option key={c} value={c}>is "{c}"</option>)}
                </select>
              ) : (
                <input value={showWhen.equals ?? ""} placeholder="equals…" onChange={e => onChange({ ...field, showWhen: { field: showWhen.field, equals: e.target.value } })} className="rounded-lg px-3 py-2 text-sm outline-none" style={inputStyle} />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function AddFieldMenu({ onAdd }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button type="button" onClick={() => setOpen(o => !o)} className="text-xs px-2.5 py-1.5 rounded-md flex items-center gap-1" style={{ backgroundColor: T.bg, color: T.ink, border: `1px dashed ${T.border}`, ...fontBody }}><Plus size={12} /> Add field</button>
      {open && (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mt-2">
          {FIELD_TYPES.map(t => { const Icon = t.icon; return (
            <button key={t.type} type="button" onClick={() => { onAdd(t.type); setOpen(false); }} className="flex flex-col items-center gap-1.5 rounded-lg py-2.5 px-1 text-center" style={{ border: `1px solid ${T.border}`, backgroundColor: "#fff" }}>
              <Icon size={15} style={{ color: T.ink }} /><span className="text-[10.5px] leading-tight" style={{ color: T.ink, ...fontBody }}>{t.label}</span>
            </button>
          ); })}
        </div>
      )}
    </div>
  );
}

export function FormBuilder({ form, onChange }) {
  const [openField, setOpenField] = useState(null);
  const sections = form.sections || [];
  const flat = allFields(form);
  const takenNames = new Set(flat.map(f => f.name));

  const setSections = next => onChange({ ...form, sections: next });
  const updateSection = (si, patch) => setSections(sections.map((s, i) => (i === si ? { ...s, ...patch } : s)));
  const updateField = (si, fi, field) => updateSection(si, { fields: sections[si].fields.map((f, i) => (i === fi ? field : f)) });
  const moveField = (si, fi, dir) => {
    const fields = [...sections[si].fields];
    const target = fi + dir;
    if (target >= 0 && target < fields.length) {
      [fields[fi], fields[target]] = [fields[target], fields[fi]];
      updateSection(si, { fields });
    } else if (sections[si + dir]) {
      // Move across section boundary.
      const [moved] = fields.splice(fi, 1);
      const next = sections.map((s, i) => (i === si ? { ...s, fields } : s));
      const dest = next[si + dir];
      next[si + dir] = { ...dest, fields: dir > 0 ? [moved, ...dest.fields] : [...dest.fields, moved] };
      setSections(next);
    }
  };
  const removeField = (si, fi) => {
    const field = sections[si].fields[fi];
    const dependents = flat.filter(f => (Array.isArray(f.showWhen) ? f.showWhen : f.showWhen ? [f.showWhen] : []).some(c => c.field === field.name));
    if (dependents.length && !window.confirm(`${dependents.length} question(s) only show depending on "${field.label}". Remove it anyway? They will then always show.`)) return;
    const next = sections.map((s, i) => ({
      ...s,
      fields: (i === si ? s.fields.filter((_, j) => j !== fi) : s.fields).map(f => {
        if (!f.showWhen) return f;
        const conds = (Array.isArray(f.showWhen) ? f.showWhen : [f.showWhen]).filter(c => c.field !== field.name);
        const copy = { ...f };
        if (conds.length) copy.showWhen = Array.isArray(f.showWhen) ? conds : conds[0]; else delete copy.showWhen;
        return copy;
      }),
    }));
    setSections(next);
  };
  const addField = (si, type) => {
    const meta = TYPE_META[type];
    const name = uniqueName(toKey(meta.label), takenNames);
    const field = { name, label: meta.label, type, required: false };
    if (WITH_OPTIONS.has(type)) field.options = ["Option 1", "Option 2"];
    updateSection(si, { fields: [...(sections[si].fields || []), field] });
    setOpenField(`${si}:${sections[si].fields?.length || 0}`);
  };
  const addSection = () => setSections([...sections, { id: uniqueName("section", new Set(sections.map(s => s.id))), title: "New section", fields: [] }]);
  const moveSection = (si, dir) => { const next = [...sections]; [next[si], next[si + dir]] = [next[si + dir], next[si]]; setSections(next); };
  const removeSection = si => {
    if (sections[si].fields?.length && !window.confirm(`Remove "${sections[si].title || "this section"}" and its ${sections[si].fields.length} field(s)?`)) return;
    setSections(sections.filter((_, i) => i !== si));
  };

  const showSectionTitles = form.layout === "sections";
  const fieldsBefore = (si, fi) => sections.slice(0, si).flatMap(s => s.fields).concat(sections[si].fields.slice(0, fi)).filter(f => f.type !== "file");

  return (
    <div className="flex flex-col gap-4">
      <Panel className="p-4 flex flex-col gap-3">
        <h3 className="text-sm font-medium" style={{ color: T.ink, ...fontBody }}>Form texts</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <LabeledInput label="Heading" value={form.title} hint={form.title?.includes("{title}") ? "{title} is replaced with the page's title." : undefined} onChange={title => onChange({ ...form, title })} />
          <LabeledInput label="Submit button text" value={form.submitLabel} onChange={submitLabel => onChange({ ...form, submitLabel })} />
          <div className="sm:col-span-2"><LabeledTextarea label="Intro text" rows={2} value={form.description} onChange={description => onChange({ ...form, description })} /></div>
          <LabeledInput label="Success heading" value={form.successTitle} onChange={successTitle => onChange({ ...form, successTitle })} />
          <LabeledInput label="Privacy note (under the button)" value={form.privacyNote} onChange={privacyNote => onChange({ ...form, privacyNote })} />
          <div className="sm:col-span-2"><LabeledTextarea label="Success message" rows={2} value={form.successMessage} onChange={successMessage => onChange({ ...form, successMessage })} /></div>
        </div>
        {form.consent !== undefined && (
          <div className="rounded-lg p-3 flex flex-col gap-2" style={{ backgroundColor: T.bg, border: `1px solid ${T.border}` }}>
            <ToggleRow label="Ask visitors to agree to the Privacy Policy" checked={!!form.consent} onChange={on => onChange({ ...form, consent: on ? { required: true, text: "I agree to the processing of my personal data in accordance with the Privacy Policy.", linkLabel: "Privacy Policy", linkHref: "/#contact" } : null })} />
            {form.consent && <LabeledInput label="Consent text (the words matching the link text become the link)" value={form.consent.text} onChange={text => onChange({ ...form, consent: { ...form.consent, text } })} />}
          </div>
        )}
      </Panel>

      {sections.map((section, si) => (
        <Panel key={section.id || si} className="p-4 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            {showSectionTitles ? <input value={section.title || ""} onChange={e => updateSection(si, { title: e.target.value })} placeholder="Section title" className="flex-1 min-w-0 rounded-lg px-3 py-2 text-sm font-medium outline-none" style={inputStyle} />
              : <span className="flex-1 text-sm font-medium" style={{ color: T.ink, ...fontBody }}>Fields</span>}
            {showSectionTitles && <>
              <IconButton label="Move section up" disabled={si === 0} onClick={() => moveSection(si, -1)}><ArrowUp size={14} /></IconButton>
              <IconButton label="Move section down" disabled={si === sections.length - 1} onClick={() => moveSection(si, 1)}><ArrowDown size={14} /></IconButton>
              <IconButton label="Remove section" danger disabled={sections.length === 1} onClick={() => removeSection(si)}><Trash2 size={14} /></IconButton>
            </>}
          </div>
          <div className="flex flex-col gap-2">
            {(section.fields || []).map((field, fi) => {
              const key = `${si}:${fi}`;
              const Icon = TYPE_META[field.type]?.icon || TextCursorInput;
              const open = openField === key;
              return (
                <div key={field.name} className="rounded-lg" style={{ border: `1px solid ${open ? T.accent : T.border}`, backgroundColor: "#fff" }}>
                  <div className="flex items-center gap-2 px-3 py-2">
                    <button type="button" onClick={() => setOpenField(open ? null : key)} className="flex items-center gap-2 flex-1 min-w-0 text-left">
                      {open ? <ChevronDown size={14} style={{ color: T.muted }} /> : <ChevronRight size={14} style={{ color: T.muted }} />}
                      <Icon size={14} style={{ color: T.muted }} className="shrink-0" />
                      <span className="text-sm truncate" style={{ color: T.ink, ...fontBody }}>{field.label || field.name}</span>
                      {field.required && <span className="text-xs" style={{ color: T.danger }}>*</span>}
                      {field.showWhen && <span className="text-[10px] px-1.5 py-0.5 rounded-full shrink-0" style={{ backgroundColor: T.infoSoft, color: T.info, ...fontBody }}>conditional</span>}
                    </button>
                    <IconButton label="Move up" disabled={si === 0 && fi === 0} onClick={() => moveField(si, fi, -1)}><ArrowUp size={14} /></IconButton>
                    <IconButton label="Move down" disabled={si === sections.length - 1 && fi === section.fields.length - 1} onClick={() => moveField(si, fi, 1)}><ArrowDown size={14} /></IconButton>
                    <IconButton label="Remove field" danger onClick={() => removeField(si, fi)}><Trash2 size={14} /></IconButton>
                  </div>
                  {open && <div className="px-3 pb-3" style={{ borderTop: `1px solid ${T.border}` }}>
                    <FieldEditor field={field} onChange={next => updateField(si, fi, next)} earlierFields={fieldsBefore(si, fi)} takenNames={new Set([...takenNames].filter(n => n !== field.name))} />
                  </div>}
                </div>
              );
            })}
            {(section.fields || []).length === 0 && <p className="text-xs" style={{ color: T.muted, ...fontBody }}>No fields in this section yet.</p>}
          </div>
          <AddFieldMenu onAdd={type => addField(si, type)} />
        </Panel>
      ))}
      {showSectionTitles && <button type="button" onClick={addSection} className="self-start text-sm px-3 py-2 rounded-lg flex items-center gap-1.5" style={{ backgroundColor: T.surface, color: T.ink, border: `1px dashed ${T.border}`, ...fontBody }}><Plus size={14} /> Add section</button>}
      {flat.length === 0 && <Notice tone="warn">This form has no fields. Visitors would only see a submit button.</Notice>}
    </div>
  );
}

// Live preview using the website's own field components and CSS.
export function FormPreview({ form, titleVars = {} }) {
  const [device, setDevice] = useState("desktop");
  const [values, setValues] = useState({});
  const onChange = (name, value) => setValues(prev => ({ ...prev, [name]: value }));
  const fill = text => (text || "").replace(/\{(\w+)\}/g, (m, k) => titleVars[k] ?? m);
  const sections = useMemo(() => (form.sections || []).map(s => ({ ...s, fields: (s.fields || []).map(f => ({ ...f, id: `preview-${f.name}` })) })), [form]);
  const flat = sections.flatMap(s => s.fields);

  return (
    <Panel className="p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between"><h3 className="text-sm font-medium" style={{ color: T.ink, ...fontBody }}>Live preview</h3>
        <div className="flex gap-1">
          <button type="button" onClick={() => setDevice("desktop")} className="p-1.5 rounded-md" style={{ backgroundColor: device === "desktop" ? T.accentSoft : "transparent" }} aria-label="Desktop preview"><Monitor size={16} style={{ color: device === "desktop" ? T.accent : T.muted }} /></button>
          <button type="button" onClick={() => setDevice("mobile")} className="p-1.5 rounded-md" style={{ backgroundColor: device === "mobile" ? T.accentSoft : "transparent" }} aria-label="Mobile preview"><Smartphone size={16} style={{ color: device === "mobile" ? T.accent : T.muted }} /></button>
        </div>
      </div>
      <p className="text-xs" style={{ color: T.muted, ...fontBody }}>Try the fields — conditional questions appear as you answer. Nothing is submitted.</p>
      <div className="travel-site mx-auto w-full" style={{ maxWidth: device === "mobile" ? 380 : 620, background: "transparent" }}>
        <div className="svc-form-card">
          <form onSubmit={e => e.preventDefault()} noValidate>
            <div className="svc-form-head"><h3>{fill(form.title)}</h3>{form.description && <p>{form.description}</p>}</div>
            {form.layout === "sections"
              ? sections.map((section, index) => <FormSection key={section.id} section={section} index={index} values={values} errors={{}} onFieldChange={onChange} />)
              : <div className="svc-form-grid">{flat.filter(f => isFieldVisible(f, values)).map(field => <DynamicFormField key={field.name} field={field} value={values[field.name]} onChange={onChange} />)}</div>}
            {form.consent && <label className="svc-checkbox-row vcp-agree-row"><input type="checkbox" /><span>{form.consent.text}{form.consent.required && <span className="required-mark">*</span>}</span></label>}
            <button className="green-button svc-submit-btn" type="button">{form.submitLabel || "Submit"}</button>
            {form.privacyNote && <p className="svc-privacy-note">{form.privacyNote}</p>}
          </form>
        </div>
      </div>
    </Panel>
  );
}
