// Right panel of the Form Studio: settings for the selected field, design
// element, row or section, or the whole form when nothing is selected.
import React, { useState } from "react";
import { ArrowDown, ArrowUp, Copy, Plus, Trash2 } from "lucide-react";
import { T, fontBody, FieldLabel, ImagePickerButton, Notice, Tabs, ToggleRow, inputStyle } from "../ui.jsx";
import {
  CHOICE_TYPES, KEY_PATTERN, elementId, inputFields, isInput, isMultiValue, isRow, isSingleCheckbox, normalizeOptions, toKey, typeInfo,
} from "../../../supabase/functions/_shared/forms/schema.ts";
import { findElement, findLocation, mapElements, renameKey, setMapping, takenKeys, updateById, updateSection } from "./tree.js";

const box = "w-full rounded-lg px-3 py-2 text-sm outline-none";
const select = { ...inputStyle, backgroundColor: "#fff" };

function Text({ label, hint, value, onChange, placeholder, multiline, rows = 3, error, type = "text" }) {
  return (
    <div>
      <FieldLabel hint={hint}>{label}</FieldLabel>
      {multiline
        ? <textarea rows={rows} value={value ?? ""} placeholder={placeholder} onChange={e => onChange(e.target.value)} className={box} style={inputStyle} />
        : <input type={type} value={value ?? ""} placeholder={placeholder} onChange={e => onChange(e.target.value)} className={box} style={{ ...inputStyle, ...(error ? { borderColor: T.danger } : {}) }} />}
      {error && <p className="text-[11px] mt-1" style={{ color: T.danger, ...fontBody }}>{error}</p>}
    </div>
  );
}

function Choice({ label, hint, value, onChange, options }) {
  return (
    <div>
      <FieldLabel hint={hint}>{label}</FieldLabel>
      <select value={value ?? ""} onChange={e => onChange(e.target.value)} className={box} style={select}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

const num = v => (v === "" || v === null || v === undefined ? undefined : Number(v));

function IconBtn({ label, onClick, disabled, danger, children }) {
  return <button type="button" aria-label={label} title={label} onClick={onClick} disabled={disabled} className="p-1.5 rounded-md" style={{ color: disabled ? T.border : danger ? T.danger : T.muted }}>{children}</button>;
}

// ---------------------------------------------------------------- choices
function ChoicesEditor({ options, onChange }) {
  const list = normalizeOptions(options);
  const values = list.map(o => o.value);
  const dupes = new Set(values.filter((v, i) => values.indexOf(v) !== i));
  const set = (i, patch) => onChange(list.map((o, j) => (j === i ? { ...o, ...patch } : o)));
  const move = (i, d) => { const next = [...list]; [next[i], next[i + d]] = [next[i + d], next[i]]; onChange(next); };
  return (
    <div className="flex flex-col gap-2">
      <FieldLabel hint="Label is what visitors see; value is what's saved (keep it stable once you have answers).">Choices</FieldLabel>
      {list.map((o, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <input aria-label={`Choice ${i + 1} label`} value={o.label} onChange={e => {
            const label = e.target.value;
            // The value follows the label until it's edited separately.
            const auto = o.value === toKey(o.label) || o.value === o.label || !o.value;
            set(i, auto ? { label, value: toKey(label) || label } : { label });
          }} className="flex-1 min-w-0 rounded-md px-2 py-1.5 text-sm outline-none" style={inputStyle} />
          <input aria-label={`Choice ${i + 1} value`} value={o.value} onChange={e => set(i, { value: e.target.value })} className="w-24 rounded-md px-2 py-1.5 text-xs outline-none" style={{ ...inputStyle, borderColor: dupes.has(o.value) ? T.danger : undefined }} />
          <IconBtn label="Move up" disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp size={13} /></IconBtn>
          <IconBtn label="Move down" disabled={i === list.length - 1} onClick={() => move(i, 1)}><ArrowDown size={13} /></IconBtn>
          <IconBtn label="Remove choice" danger disabled={list.length <= 1} onClick={() => onChange(list.filter((_, j) => j !== i))}><Trash2 size={13} /></IconBtn>
        </div>
      ))}
      {dupes.size > 0 && <p className="text-[11px]" style={{ color: T.danger, ...fontBody }}>Two choices have the same value.</p>}
      <button type="button" onClick={() => { const n = list.length + 1; onChange([...list, { label: `Option ${n}`, value: `option${n}` }]); }} className="self-start text-xs px-2.5 py-1.5 rounded-md flex items-center gap-1" style={{ backgroundColor: T.accentSoft, color: T.accent, ...fontBody }}><Plus size={12} /> Add choice</button>
    </div>
  );
}

// ---------------------------------------------------------------- field settings
const FILE_TYPES = [
  { value: ".pdf", label: "PDF" }, { value: "image/*", label: "Images (JPG, PNG, WEBP, HEIC)" }, { value: ".doc,.docx", label: "Word documents" },
];
const CONTACT_MAP = [
  { value: "", label: "Don't save to the contact" }, { value: "fullName", label: "Full name" }, { value: "email", label: "Email" },
  { value: "phone", label: "Phone" }, { value: "service", label: "Service requested" }, { value: "message", label: "Inquiry message" },
];

function DefaultValue({ el, set }) {
  if (el.type === "file" || el.type === "address") return null;
  if (el.type === "hidden") return <Text label="Value" hint="Saved with every submission; visitors never see it." value={el.default} onChange={v => set({ default: v })} />;
  if (isSingleCheckbox(el)) return <ToggleRow label="Ticked by default" checked={el.default === true} onChange={on => set({ default: on || undefined })} />;
  if (isMultiValue(el)) {
    const chosen = Array.isArray(el.default) ? el.default : [];
    return (
      <div><FieldLabel>Selected by default</FieldLabel>
        <div className="flex flex-col gap-1">{normalizeOptions(el.options).map(o => <ToggleRow key={o.value} label={o.label} checked={chosen.includes(o.value)} onChange={on => set({ default: on ? [...chosen, o.value] : chosen.filter(v => v !== o.value) })} />)}</div>
      </div>
    );
  }
  if (el.type === "select" || el.type === "radio" || el.type === "yesno") {
    const opts = el.type === "yesno" ? normalizeOptions(["Yes", "No"]) : normalizeOptions(el.options);
    return <Choice label="Default value" value={el.default ?? ""} onChange={v => set({ default: v || undefined })} options={[{ value: "", label: "None" }, ...opts]} />;
  }
  return <Text label="Default value" type={el.type === "date" ? "date" : el.type === "number" ? "number" : "text"} value={el.default} onChange={v => set({ default: v || undefined })} />;
}

function KeyEditor({ el, schema, onRename }) {
  const [text, setText] = useState(el.name || "");
  const taken = takenKeys(schema, elementId(el));
  const problem = !KEY_PATTERN.test(text) ? "Start with a letter; use letters, numbers and _ only." : taken.has(text) ? "Another field already uses this key." : "";
  // Applied when you leave the box (or press Enter), only if valid and unique.
  const commit = () => { if (!problem && text !== el.name) onRename(text); };
  return (
    <div>
      <FieldLabel hint="Where the answer is stored. Changing it later doesn't affect saved answers (they're linked to the field itself).">Internal field key</FieldLabel>
      <input value={text} onChange={e => setText(e.target.value.replace(/[^A-Za-z0-9_]/g, ""))}
        onBlur={commit} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); commit(); } }}
        className={box} style={{ ...inputStyle, ...(problem ? { borderColor: T.danger } : {}), fontFamily: "ui-monospace, Consolas, monospace" }} aria-invalid={!!problem} />
      {problem && <p className="text-[11px] mt-1" style={{ color: T.danger, ...fontBody }}>{problem} The key stays “{el.name}”.</p>}
      <p className="text-[11px] mt-1" style={{ color: T.muted, ...fontBody }}>Field ID: <code>{elementId(el)}</code></p>
    </div>
  );
}

function LogicEditor({ el, schema, setSchema }) {
  const id = elementId(el);
  const conditions = el.showWhen ? (Array.isArray(el.showWhen) ? el.showWhen : [el.showWhen]) : [];
  const candidates = inputFields(schema).filter(f => elementId(f) !== id && f.type !== "file" && f.type !== "hidden");
  const save = list => setSchema(updateById(schema, id, cur => { const copy = { ...cur }; if (list.length) copy.showWhen = list; else delete copy.showWhen; return copy; }), `logic:${id}`);
  const targetOf = c => candidates.find(f => (c.fieldId ? elementId(f) === c.fieldId : f.name === c.field));
  const opOf = c => (c.isFilled === true ? "filled" : c.isFilled === false ? "empty" : c.notEquals !== undefined ? "not" : "is");
  const build = (target, op, value) => {
    const base = { fieldId: elementId(target), field: target.name };
    if (op === "filled") return { ...base, isFilled: true };
    if (op === "empty") return { ...base, isFilled: false };
    return op === "not" ? { ...base, notEquals: value } : { ...base, equals: value };
  };
  const choicesOf = t => (t?.type === "yesno" ? ["Yes", "No"] : CHOICE_TYPES.has(t?.type) || isMultiValue(t || {}) ? normalizeOptions(t.options).map(o => o.value) : isSingleCheckbox(t || {}) ? ["true"] : null);
  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs" style={{ color: T.muted, ...fontBody }}>{conditions.length ? "Show this field only when ALL of these are true. Hidden fields aren't required and their answers aren't saved." : "Always shown. Add a rule to show it only for certain answers."}</p>
      {conditions.map((c, i) => {
        const target = targetOf(c);
        const op = opOf(c);
        const choices = choicesOf(target);
        const value = c.equals ?? c.notEquals ?? "";
        const update = next => save(conditions.map((x, j) => (j === i ? next : x)));
        return (
          <div key={i} className="rounded-lg p-2.5 flex flex-col gap-2" style={{ border: `1px solid ${T.border}`, backgroundColor: T.bg }}>
            <select aria-label="Field" value={target ? elementId(target) : ""} onChange={e => { const t = candidates.find(f => elementId(f) === e.target.value); if (t) update(build(t, op, choicesOf(t)?.[0] ?? "")); }} className={box} style={select}>
              {!target && <option value="">(field removed)</option>}
              {candidates.map(f => <option key={elementId(f)} value={elementId(f)}>{f.label || f.name}</option>)}
            </select>
            <div className="flex gap-2">
              <select aria-label="Condition" value={op} onChange={e => target && update(build(target, e.target.value, value))} className="rounded-lg px-2 py-2 text-sm outline-none" style={select}>
                <option value="is">is</option><option value="not">is not</option><option value="filled">is answered</option><option value="empty">is empty</option>
              </select>
              {(op === "is" || op === "not") && (choices
                ? <select aria-label="Value" value={String(value)} onChange={e => target && update(build(target, op, e.target.value === "true" && isSingleCheckbox(target) ? true : e.target.value))} className="flex-1 min-w-0 rounded-lg px-2 py-2 text-sm outline-none" style={select}>
                    {choices.map(v => <option key={v} value={v}>{v === "true" ? "ticked" : normalizeOptions(target.options).find(o => o.value === v)?.label || v}</option>)}
                  </select>
                : <input aria-label="Value" value={String(value)} onChange={e => target && update(build(target, op, e.target.value))} className="flex-1 min-w-0 rounded-lg px-2 py-2 text-sm outline-none" style={inputStyle} />)}
              <IconBtn label="Remove rule" danger onClick={() => save(conditions.filter((_, j) => j !== i))}><Trash2 size={14} /></IconBtn>
            </div>
          </div>
        );
      })}
      <button type="button" disabled={!candidates.length} onClick={() => { const t = candidates[0]; save([...conditions, build(t, "is", choicesOf(t)?.[0] ?? "")]); }}
        className="self-start text-xs px-2.5 py-1.5 rounded-md flex items-center gap-1" style={{ backgroundColor: T.accentSoft, color: T.accent, opacity: candidates.length ? 1 : 0.5, ...fontBody }}><Plus size={12} /> Add rule</button>
    </div>
  );
}

function FieldSettings({ el, schema, setSchema, inRow }) {
  const id = elementId(el);
  const [tab, setTab] = useState("general");
  const set = (patch, key) => setSchema(updateById(schema, id, cur => {
    const copy = { ...cur, ...patch };
    for (const [k, v] of Object.entries(patch)) if (v === undefined || v === "") delete copy[k];
    return copy;
  }), key || `field:${id}:${Object.keys(patch).join(",")}`);
  const rules = el.validation || {};
  const setRule = patch => {
    const next = { ...rules, ...patch };
    for (const [k, v] of Object.entries(next)) if (v === undefined || v === "" || Number.isNaN(v)) delete next[k];
    set({ validation: Object.keys(next).length ? next : undefined }, `rules:${id}`);
  };
  const textual = ["text", "textarea", "email", "tel"].includes(el.type);
  const placeholderTypes = ["text", "textarea", "email", "tel", "number", "select", "country"];
  return (
    <div className="flex flex-col gap-4">
      <Tabs tabs={[{ id: "general", label: "General" }, { id: "rules", label: "Validation" }, { id: "logic", label: el.showWhen ? "Logic •" : "Logic" }, { id: "contact", label: "Contact" }]} active={tab} onChange={setTab} />
      {tab === "general" && <>
        <Text label={el.type === "hidden" ? "Name (dashboard only)" : el.type === "consent" ? "Checkbox text" : "Label"} value={el.label} onChange={label => set({ label }, `label:${id}`)} multiline={el.type === "consent"} rows={2} />
        <KeyEditor el={el} schema={schema} onRename={key => setSchema(renameKey(schema, id, key), `key:${id}`)} />
        {placeholderTypes.includes(el.type) && <Text label={el.type === "select" || el.type === "country" ? "Empty option text" : "Placeholder"} value={el.placeholder} onChange={placeholder => set({ placeholder }, `ph:${id}`)} />}
        {el.type !== "hidden" && <Text label="Help text" hint="Shown under the field." value={el.help} onChange={help => set({ help }, `help:${id}`)} multiline rows={2} />}
        {CHOICE_TYPES.has(el.type) && <ChoicesEditor options={el.options} onChange={options => set({ options }, `opts:${id}`)} />}
        {el.type === "file" && (
          <div className="flex flex-col gap-2">
            <FieldLabel hint="Checked again on the server after upload.">Allowed files</FieldLabel>
            {FILE_TYPES.map(t => {
              const accept = el.file?.accept || [];
              const parts = t.value.split(",");
              const on = parts.every(p => accept.includes(p));
              return <ToggleRow key={t.value} label={t.label} checked={on} onChange={v => set({ file: { ...el.file, accept: v ? [...new Set([...accept, ...parts])] : accept.filter(a => !parts.includes(a)) } })} />;
            })}
            <Text label="Maximum size (MB, up to 10)" type="number" value={el.file?.maxMB ?? 10} onChange={v => set({ file: { ...el.file, maxMB: Math.min(10, Math.max(1, Number(v) || 10)) } })} />
          </div>
        )}
        <DefaultValue el={el} set={patch => set(patch, `default:${id}`)} />
        {el.type !== "hidden" && <ToggleRow label="Required" checked={!!el.required} onChange={required => set({ required: required || undefined })} />}
        {el.type !== "hidden" && !isSingleCheckbox(el) && <ToggleRow label="Hide the label (screen readers still read it)" checked={!!el.hideLabel} onChange={hideLabel => set({ hideLabel: hideLabel || undefined })} />}
        {!inRow && el.type !== "hidden" && <Choice label="Width" hint="Half-width fields sit side by side on larger screens and stack on phones." value={el.width || ""} onChange={width => set({ width: width || undefined })}
          options={[{ value: "", label: "Automatic" }, { value: "half", label: "Half width" }, { value: "full", label: "Full width" }]} />}
        {inRow && <p className="text-xs" style={{ color: T.muted, ...fontBody }}>Inside a row: the field fills its column. Columns stack on phones.</p>}
      </>}
      {tab === "rules" && <>
        {textual && <div className="grid grid-cols-2 gap-2">
          <Text label="Min length" type="number" value={rules.minLength} onChange={v => setRule({ minLength: num(v) })} />
          <Text label="Max length" type="number" value={rules.maxLength} onChange={v => setRule({ maxLength: num(v) })} />
        </div>}
        {(el.type === "number" || isMultiValue(el)) && <div className="grid grid-cols-2 gap-2">
          <Text label={isMultiValue(el) ? "Min choices" : "Minimum"} type="number" value={rules.min} onChange={v => setRule({ min: num(v) })} />
          <Text label={isMultiValue(el) ? "Max choices" : "Maximum"} type="number" value={rules.max} onChange={v => setRule({ max: num(v) })} />
        </div>}
        {(el.type === "text" || el.type === "tel") && <>
          <Text label="Pattern (advanced)" hint={'A regular expression the whole answer must match, e.g. [A-Z]{2}[0-9]{7}'} value={rules.pattern} onChange={v => setRule({ pattern: v })} />
          {rules.pattern && <Text label="Message when it doesn't match" value={rules.patternMessage} onChange={v => setRule({ patternMessage: v })} />}
        </>}
        <p className="text-xs" style={{ color: T.muted, ...fontBody }}>
          {el.type === "email" ? "Email addresses are always checked." : el.type === "tel" ? "Phone numbers are always checked (6–25 digits, +, spaces, dashes)." : el.type === "date" ? "Dates are always checked." : "Rules apply in the browser and again on the server."}
        </p>
      </>}
      {tab === "logic" && <LogicEditor el={el} schema={schema} setSchema={setSchema} />}
      {tab === "contact" && <>
        <Choice label="Save to contact" hint="Copies the answer to the CRM lead created from each submission." value={el.mapTo || ""} options={CONTACT_MAP}
          onChange={mapTo => setSchema(setMapping(schema, id, mapTo || null))} />
        {el.mapTo === "email" && el.type !== "email" && <Notice tone="warn">Use an Email field for the contact's email.</Notice>}
        <ToggleRow label="Leave out of notification emails (sensitive)" checked={!!el.sensitive} onChange={sensitive => set({ sensitive: sensitive || undefined })} />
        <p className="text-xs" style={{ color: T.muted, ...fontBody }}>Answers are always saved and visible in the dashboard. File uploads are never attached or linked in emails.</p>
      </>}
    </div>
  );
}

// ---------------------------------------------------------------- design elements
function DesignSettings({ el, schema, setSchema }) {
  const id = elementId(el);
  const set = (patch, key) => setSchema(updateById(schema, id, patch), key || `design:${id}:${Object.keys(patch).join(",")}`);
  const alignOpts = [{ value: "left", label: "Left" }, { value: "center", label: "Centre" }, { value: "right", label: "Right" }];
  switch (el.type) {
    case "heading": return <>
      <Text label="Heading" value={el.text} onChange={text => set({ text }, `text:${id}`)} />
      <Choice label="Size" value={String(el.level || 3)} onChange={v => set({ level: Number(v) })} options={[{ value: "2", label: "Large" }, { value: "3", label: "Medium" }]} />
      <Choice label="Alignment" value={el.align || "left"} onChange={align => set({ align })} options={alignOpts} />
    </>;
    case "paragraph": return <>
      <Text label="Text" multiline rows={6} hint="Plain text. Links: [link text](https://example.com) or [text](/page). Other formatting isn't allowed." value={el.text} onChange={text => set({ text }, `text:${id}`)} />
      <Choice label="Alignment" value={el.align || "left"} onChange={align => set({ align })} options={alignOpts} />
    </>;
    case "spacer": return <Choice label="Height" value={el.size || "md"} onChange={size => set({ size })} options={[{ value: "sm", label: "Small" }, { value: "md", label: "Medium" }, { value: "lg", label: "Large" }]} />;
    case "image": return <>
      <div className="flex flex-col gap-2"><FieldLabel>Image</FieldLabel><ImagePickerButton label={el.url ? "Replace image" : "Choose image"} onPicked={(url, media) => set({ url, alt: el.alt || media?.alt_text || "" })} /></div>
      <Text label="Image URL" hint="https:// or a site path." value={el.url} onChange={url => set({ url }, `url:${id}`)} error={el.url && !/^(https:\/\/|\/(?!\/))/i.test(el.url) ? "Use an https:// address or a path on this site." : ""} />
      <Text label="Alt text" hint="Describe the image for screen readers (leave empty if decorative)." value={el.alt} onChange={alt => set({ alt }, `alt:${id}`)} />
      <Text label="Width (%)" type="number" value={el.width ?? 100} onChange={v => set({ width: Math.min(100, Math.max(10, Number(v) || 100)) })} />
      <Choice label="Alignment" value={el.align || "center"} onChange={align => set({ align })} options={alignOpts} />
    </>;
    case "submit": return <Text label="Button text" value={el.text} onChange={text => set({ text }, `text:${id}`)} hint="The submit button appears here instead of at the end." />;
    case "divider": return <p className="text-sm" style={{ color: T.muted, ...fontBody }}>A thin line between parts of the form.</p>;
    default: return null;
  }
}

function RowSettings({ el, schema, setSchema }) {
  const id = elementId(el);
  return (
    <Choice label="Columns" hint="Two columns sit side by side on larger screens and stack on phones." value={String(el.columns === 1 ? 1 : 2)} options={[{ value: "1", label: "One column" }, { value: "2", label: "Two columns" }]}
      onChange={v => setSchema(updateById(schema, id, cur => {
        const columns = Number(v);
        const kids = cur.children || [];
        const children = columns === 1 ? [[...(kids[0] || []), ...(kids[1] || [])]] : [kids[0] || [], kids[1] || []];
        return { ...cur, columns, children };
      }))} />
  );
}

function SectionSettings({ section, schema, setSchema, numbered }) {
  const set = (patch, key) => setSchema(updateSection(schema, section.id, patch), key);
  return <>
    <Text label="Section title" hint={numbered ? "Shown as a numbered step." : "Shown above the section when the form has several sections."} value={section.title} onChange={title => set({ title }, `stitle:${section.id}`)} />
    <Text label="Description" multiline rows={2} value={section.description} onChange={description => set({ description: description || undefined }, `sdesc:${section.id}`)} />
  </>;
}

export function FormSettings({ schema, setSchema }) {
  const set = (patch, key) => setSchema({ ...schema, ...patch }, key || `form:${Object.keys(patch).join(",")}`);
  const redirectBad = schema.successRedirect && !/^(\/(?!\/)|https:\/\/)/i.test(schema.successRedirect);
  return (
    <div className="flex flex-col gap-4">
      <Text label="Form heading" hint={schema.title?.includes("{title}") ? "{title} becomes the page's title (e.g. the visa or package name)." : undefined} value={schema.title} onChange={title => set({ title })} />
      <Text label="Intro text" multiline rows={2} value={schema.description} onChange={description => set({ description })} />
      <Text label="Submit button text" value={schema.submitLabel} onChange={submitLabel => set({ submitLabel })} />
      {schema.layout !== "contact" && <Choice label="Layout" value={schema.layout === "sections" ? "sections" : "grid"} onChange={layout => set({ layout })}
        options={[{ value: "grid", label: "Plain (sections as headings)" }, { value: "sections", label: "Numbered steps (one per section)" }]} />}
      <div className="h-px" style={{ backgroundColor: T.border }} />
      <Text label="Success heading" value={schema.successTitle} onChange={successTitle => set({ successTitle })} />
      <Text label="Success message" multiline rows={3} value={schema.successMessage} onChange={successMessage => set({ successMessage })} />
      <Text label="Redirect after submitting (optional)" hint="A page on this site (/thank-you) or an https:// link. Leave empty to show the success message." value={schema.successRedirect}
        onChange={successRedirect => set({ successRedirect: successRedirect || undefined })} error={redirectBad ? "Use a path starting with / or an https:// link." : ""} />
      <Text label="Privacy note (under the button)" value={schema.privacyNote} onChange={privacyNote => set({ privacyNote })} />
      {schema.consent !== undefined && <div className="rounded-lg p-3 flex flex-col gap-2" style={{ backgroundColor: T.bg, border: `1px solid ${T.border}` }}>
        <ToggleRow label="Ask visitors to agree to the Privacy Policy" checked={!!schema.consent} onChange={on => set({ consent: on ? { required: true, text: "I agree to the processing of my personal data in accordance with the Privacy Policy.", linkLabel: "Privacy Policy", linkHref: "/#contact" } : null })} />
        {schema.consent && <Text label="Consent text" value={schema.consent.text} onChange={text => set({ consent: { ...schema.consent, text } }, "consent")} />}
      </div>}
    </div>
  );
}

export default function StudioInspector({ schema, setSchema, selected, onSelect, actions }) {
  if (selected?.kind === "section") {
    const section = schema.sections.find(s => s.id === selected.id);
    if (!section) return null;
    const i = schema.sections.indexOf(section);
    return (
      <Shell title="Section" onClose={() => onSelect(null)} actions={<>
        <IconBtn label="Move section up" disabled={i === 0} onClick={() => actions.moveSection(section.id, -1)}><ArrowUp size={15} /></IconBtn>
        <IconBtn label="Move section down" disabled={i === schema.sections.length - 1} onClick={() => actions.moveSection(section.id, 1)}><ArrowDown size={15} /></IconBtn>
        <IconBtn label="Delete section" danger disabled={schema.sections.length <= 1} onClick={() => actions.removeSection(section.id)}><Trash2 size={15} /></IconBtn>
      </>}>
        <SectionSettings section={section} schema={schema} setSchema={setSchema} numbered={schema.layout === "sections"} />
      </Shell>
    );
  }
  if (selected?.kind === "element") {
    const el = findElement(schema, selected.id);
    if (!el) return null;
    const loc = findLocation(schema, selected.id);
    const info = isRow(el) ? { label: el.columns === 1 ? "One-column row" : "Two-column row" } : typeInfo(el.type) || { label: el.type };
    return (
      <Shell title={info.label} onClose={() => onSelect(null)} actions={<>
        <IconBtn label="Move up" onClick={() => actions.nudge(selected.id, -1)}><ArrowUp size={15} /></IconBtn>
        <IconBtn label="Move down" onClick={() => actions.nudge(selected.id, 1)}><ArrowDown size={15} /></IconBtn>
        {el.type !== "submit" && <IconBtn label="Duplicate (Ctrl+D)" onClick={() => actions.duplicate(selected.id)}><Copy size={15} /></IconBtn>}
        <IconBtn label="Delete (Del)" danger onClick={() => actions.remove(selected.id)}><Trash2 size={15} /></IconBtn>
      </>}>
        {isInput(el) ? <FieldSettings key={selected.id} el={el} schema={schema} setSchema={setSchema} inRow={!!loc?.rowId} />
          : isRow(el) ? <RowSettings el={el} schema={schema} setSchema={setSchema} />
            : <DesignSettings el={el} schema={schema} setSchema={setSchema} />}
      </Shell>
    );
  }
  return null;
}

function Shell({ title, actions, onClose, children }) {
  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center gap-1 px-4 py-3 shrink-0" style={{ borderBottom: `1px solid ${T.border}` }}>
        <h3 className="text-sm font-semibold flex-1 truncate" style={{ color: T.ink, ...fontBody }}>{title}</h3>
        {actions}
        {onClose && <button type="button" onClick={onClose} className="text-xs px-2 py-1 rounded-md" style={{ color: T.muted, ...fontBody }}>Done</button>}
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4">{children}</div>
    </div>
  );
}

export { mapElements };
