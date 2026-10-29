// Form schema shared by the dashboard Form Studio, the website renderer and the
// form-submit Edge Function (pure TypeScript: runs in the browser, Deno and
// Node tests). One definition of element types, stable IDs, visibility rules,
// validation and publish checks, so the editor, the live form and the server
// always agree.
//
// A form document's content (cms_documents.draft / cms_published.content):
//   { schemaVersion: 2, title, description, layout, submitLabel, privacyNote,
//     successTitle, successMessage, successRedirect, successActions, consent,
//     sections: [ { id, type?: "section", title, description, fields: [Element] } ] }
// Element:
//   input   { id, type, name (internal key), label, placeholder, help, required,
//             default, width, hideLabel, options, validation, file, showWhen,
//             mapTo, sensitive }
//   design  { id, type: heading | paragraph | divider | spacer | image | submit, ... }
//   row     { id, type: "row", columns: 1 | 2, children: [[Element], [Element]] }
//
// Field IDs never change once created (renaming the label or key, or moving the
// field, keeps the ID); answers are stored against them. Older forms have no
// IDs: their ID is derived from the key ("k_" + key), which is stable until the
// Studio first saves the form, after which the ID is stored explicitly.

export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
export type Values = Record<string, unknown>;

export interface Condition {
  fieldId?: string;
  field?: string; // legacy: the controlling field's key
  equals?: unknown;
  notEquals?: unknown;
  in?: unknown[];
  isFilled?: boolean;
}

export interface Option { label: string; value: string }

export interface FormElement {
  id?: string;
  type: string;
  name?: string;
  label?: string;
  placeholder?: string;
  help?: string;
  required?: boolean;
  default?: unknown;
  width?: "full" | "half";
  hideLabel?: boolean;
  options?: Array<string | Option>;
  validation?: { minLength?: number; maxLength?: number; min?: number; max?: number; pattern?: string; patternMessage?: string };
  file?: { accept?: string[]; maxMB?: number };
  showWhen?: Condition | Condition[];
  mapTo?: "fullName" | "email" | "phone" | "service" | "message" | null;
  sensitive?: boolean;
  // design
  text?: string;
  level?: number;
  align?: "left" | "center" | "right";
  size?: "sm" | "md" | "lg";
  url?: string;
  alt?: string;
  fullWidth?: boolean;
  // row
  columns?: number;
  children?: FormElement[][];
  [key: string]: unknown;
}

export interface FormSchema {
  schemaVersion?: number;
  title?: string;
  description?: string;
  layout?: string;
  submitLabel?: string;
  privacyNote?: string;
  successTitle?: string;
  successMessage?: string;
  successRedirect?: string;
  successActions?: Array<{ label: string; href: string }>;
  consent?: { required?: boolean; text?: string; linkLabel?: string; linkHref?: string } | null;
  sections?: Array<{ id?: string; type?: string; title?: string; description?: string; fields?: FormElement[] }>;
  fields?: FormElement[]; // very old single-list forms
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Element types
// ---------------------------------------------------------------------------
export interface TypeInfo { type: string; kind: "input" | "design" | "layout"; label: string; group: string; keywords?: string }

export const ELEMENT_TYPES: TypeInfo[] = [
  { type: "text", kind: "input", label: "Single-line text", group: "Inputs", keywords: "short name" },
  { type: "textarea", kind: "input", label: "Multiline text", group: "Inputs", keywords: "long message paragraph" },
  { type: "email", kind: "input", label: "Email", group: "Inputs" },
  { type: "tel", kind: "input", label: "Phone", group: "Inputs", keywords: "mobile whatsapp" },
  { type: "number", kind: "input", label: "Number", group: "Inputs" },
  { type: "date", kind: "input", label: "Date", group: "Inputs", keywords: "calendar birthday" },
  { type: "select", kind: "input", label: "Dropdown", group: "Choices", keywords: "select" },
  { type: "radio", kind: "input", label: "Radio buttons", group: "Choices", keywords: "multiple choice single" },
  { type: "checkboxGroup", kind: "input", label: "Checkbox group", group: "Choices", keywords: "multi select" },
  { type: "yesno", kind: "input", label: "Yes / No", group: "Choices" },
  { type: "country", kind: "input", label: "Country", group: "Choices", keywords: "nationality" },
  { type: "consent", kind: "input", label: "Single checkbox / consent", group: "Choices", keywords: "agree terms privacy" },
  { type: "file", kind: "input", label: "File upload", group: "Advanced", keywords: "document attachment passport" },
  { type: "address", kind: "input", label: "Address", group: "Advanced", keywords: "street city" },
  { type: "hidden", kind: "input", label: "Hidden field", group: "Advanced", keywords: "tracking utm" },
  { type: "heading", kind: "design", label: "Heading", group: "Design", keywords: "title" },
  { type: "paragraph", kind: "design", label: "Paragraph", group: "Design", keywords: "text description" },
  { type: "divider", kind: "design", label: "Divider", group: "Design", keywords: "line separator" },
  { type: "spacer", kind: "design", label: "Spacer", group: "Design", keywords: "gap space" },
  { type: "image", kind: "design", label: "Image", group: "Design", keywords: "picture photo" },
  { type: "submit", kind: "design", label: "Submit button", group: "Design", keywords: "send button" },
  { type: "section", kind: "layout", label: "Section", group: "Layout", keywords: "container group step" },
  { type: "row1", kind: "layout", label: "One-column row", group: "Layout", keywords: "row" },
  { type: "row2", kind: "layout", label: "Two-column row", group: "Layout", keywords: "row columns" },
];
// Legacy "checkbox": a single tick box, or a group when it has options.
const INPUT_TYPES = new Set(ELEMENT_TYPES.filter(t => t.kind === "input").map(t => t.type).concat(["checkbox"]));
const DESIGN_TYPES = new Set(ELEMENT_TYPES.filter(t => t.kind === "design").map(t => t.type));
export const CHOICE_TYPES = new Set(["select", "radio", "checkboxGroup"]);
export const KEY_PATTERN = /^[A-Za-z][A-Za-z0-9_]{0,63}$/;

export const isInput = (el: FormElement | null | undefined) => !!el && INPUT_TYPES.has(el.type);
export const isDesign = (el: FormElement | null | undefined) => !!el && DESIGN_TYPES.has(el.type);
export const isRow = (el: FormElement | null | undefined) => !!el && el.type === "row";
export const typeInfo = (type: string) => ELEMENT_TYPES.find(t => t.type === type);

// A checkbox with options behaves as a group (legacy forms).
export function isMultiValue(el: FormElement): boolean {
  return el.type === "checkboxGroup" || (el.type === "checkbox" && Array.isArray(el.options) && el.options.length > 0);
}
export function isSingleCheckbox(el: FormElement): boolean {
  return el.type === "consent" || (el.type === "checkbox" && !(Array.isArray(el.options) && el.options.length > 0));
}

export function elementId(el: FormElement): string {
  return el.id || (el.name ? `k_${el.name}` : "");
}

export function normalizeOptions(options: FormElement["options"]): Option[] {
  return (options || []).map(o => (typeof o === "string" ? { label: o, value: o } : { label: String(o?.label ?? o?.value ?? ""), value: String(o?.value ?? o?.label ?? "") }));
}

export function newId(prefix = "el"): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  const raw = c?.randomUUID ? c.randomUUID().replace(/-/g, "") : Math.random().toString(16).slice(2) + Date.now().toString(16);
  return `${prefix}_${raw.slice(0, 12)}`;
}

export function toKey(label: string): string {
  const camel = String(label || "").toLowerCase().replace(/[^a-z0-9]+(.)?/g, (_m: string, c: string) => (c ? c.toUpperCase() : "")).replace(/^[^a-z]+/, "");
  return (camel || "field").slice(0, 48);
}

export function uniqueKey(base: string, taken: Set<string>): string {
  const clean = KEY_PATTERN.test(base) ? base : toKey(base);
  let key = clean;
  let i = 2;
  while (taken.has(key)) key = `${clean}${i++}`;
  return key;
}

// ---------------------------------------------------------------------------
// Walking the tree
// ---------------------------------------------------------------------------
export interface Located {
  el: FormElement;
  id: string;
  sectionIndex: number;
  sectionId: string;
  parentId: string | null; // row id when inside a row
  column: number | null;
  index: number;           // position within its list
  order: number;           // document order across the whole form
}

export function sectionsOf(schema: FormSchema): NonNullable<FormSchema["sections"]> {
  if (Array.isArray(schema?.sections) && schema.sections.length) return schema.sections;
  if (Array.isArray(schema?.fields)) return [{ id: "main", title: "", fields: schema.fields }];
  return [];
}

export function walk(schema: FormSchema): Located[] {
  const out: Located[] = [];
  let order = 0;
  sectionsOf(schema).forEach((section, sectionIndex) => {
    const sectionId = section.id || `section${sectionIndex + 1}`;
    (section.fields || []).forEach((el, index) => {
      out.push({ el, id: elementId(el), sectionIndex, sectionId, parentId: null, column: null, index, order: order++ });
      if (isRow(el)) {
        (el.children || []).forEach((col, column) => (col || []).forEach((child, childIndex) => {
          out.push({ el: child, id: elementId(child), sectionIndex, sectionId, parentId: elementId(el), column, index: childIndex, order: order++ });
        }));
      }
    });
  });
  return out;
}

export function inputFields(schema: FormSchema): FormElement[] {
  return walk(schema).map(l => l.el).filter(isInput);
}

// Give every element and section an id (older forms have none). Inputs get the
// key-derived id so existing answers keep matching. Returns a new object.
export function normalizeSchema(schema: FormSchema): FormSchema {
  const seen = new Set<string>();
  const fix = (el: FormElement): FormElement => {
    const copy: FormElement = { ...el };
    if (!copy.type && copy.name) copy.type = "text"; // very old fields had no type
    let id = elementId(copy) || newId(isInput(copy) ? "f" : "el");
    if (seen.has(id)) id = newId(isInput(copy) ? "f" : "el");
    seen.add(id);
    copy.id = id;
    if (isRow(copy)) {
      const columns = copy.columns === 1 ? 1 : 2;
      const kids = Array.isArray(copy.children) ? copy.children : [];
      copy.columns = columns;
      copy.children = Array.from({ length: columns }, (_v, i) => (kids[i] || []).map(fix));
    }
    return copy;
  };
  const sections = sectionsOf(schema).map((section, i) => ({
    ...section,
    id: section.id || `section${i + 1}`,
    fields: (section.fields || []).map(fix),
  }));
  const out: FormSchema = { ...schema, schemaVersion: 2, sections };
  delete out.fields;
  return out;
}

// ---------------------------------------------------------------------------
// Visibility
// ---------------------------------------------------------------------------
function conditionsOf(el: FormElement): Condition[] {
  if (!el.showWhen) return [];
  return Array.isArray(el.showWhen) ? el.showWhen : [el.showWhen];
}

function isEmpty(value: unknown): boolean {
  if (value === undefined || value === null || value === "" || value === false) return true;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === "object") return Object.values(value as Record<string, unknown>).every(v => v === undefined || v === null || String(v).trim() === "");
  return false;
}

// values are keyed by field key (name). `byId` resolves conditions that point
// at a field id to that field's key.
export function conditionsMet(el: FormElement, values: Values, byId: Map<string, FormElement>): boolean {
  return conditionsOf(el).every(c => {
    const target = c.fieldId ? byId.get(c.fieldId) : undefined;
    const key = target?.name || c.field;
    if (!key) return true;
    const v = values[key];
    const matches = (expected: unknown) => (Array.isArray(v) ? v.map(String).includes(String(expected)) : String(v ?? "") === String(expected));
    if (c.equals !== undefined) return matches(c.equals);
    if (c.notEquals !== undefined) return !matches(c.notEquals);
    if (Array.isArray(c.in)) return c.in.some(matches);
    if (c.isFilled !== undefined) return c.isFilled ? !isEmpty(v) : isEmpty(v);
    return true;
  });
}

// Which elements are visible for these answers. A field hidden by its own
// condition (or inside a hidden row) also hides fields that depend on it,
// because its value no longer counts.
export function visibleIds(schema: FormSchema, values: Values): Set<string> {
  const located = walk(schema);
  const byId = new Map(located.map(l => [l.id, l.el] as [string, FormElement]));
  const effective: Values = {};
  const visible = new Set<string>();
  const hiddenRows = new Set<string>();
  for (const l of located) {
    if (l.parentId && hiddenRows.has(l.parentId)) continue;
    const shown = conditionsMet(l.el, effective, byId);
    if (!shown) { if (isRow(l.el)) hiddenRows.add(l.id); continue; }
    visible.add(l.id);
    if (isInput(l.el) && l.el.name) effective[l.el.name] = values[l.el.name];
  }
  return visible;
}

// ---------------------------------------------------------------------------
// Validation (browser and server use the same rules)
// ---------------------------------------------------------------------------
const EMAIL = /^[^\s@<>()[\]\\,;:"]{1,64}@[^\s@]+\.[^\s@]{2,}$/;
// Lenient on purpose (people type numbers many ways): phone characters only,
// 6 to 20 digits, an optional extension, and a short note like "/ Viber".
const PHONE = /^[+()0-9 ./-]+(?:\s*(?:ext\.?|x)\s*\d{1,6})?(?:\s*[/,]?\s*(?:viber|whatsapp|wechat|line|mobile|home|work|office))?$/i;
function isPhone(text: string): boolean {
  const digits = (text.match(/\d/g) || []).length;
  return text.length <= 40 && digits >= 6 && digits <= 20 && PHONE.test(text);
}
const DATE = /^\d{4}-\d{2}-\d{2}$/;
export const ADDRESS_PARTS = ["line1", "line2", "city", "region", "postalCode", "country"] as const;
export const DEFAULT_TEXT_MAX = 2000;
export const DEFAULT_TEXTAREA_MAX = 10_000;

export function defaultValueOf(el: FormElement): unknown {
  if (el.default === undefined || el.default === null || el.default === "") return isMultiValue(el) ? [] : undefined;
  if (isMultiValue(el)) return Array.isArray(el.default) ? el.default.map(String) : [String(el.default)];
  if (isSingleCheckbox(el)) return el.default === true || el.default === "true";
  return el.default;
}

// Error message for one value, or null. `value` is what the visitor entered.
export function validateValue(el: FormElement, value: unknown): string | null {
  const rules = el.validation || {};
  if (el.type === "hidden") return null;
  if (isSingleCheckbox(el)) {
    if (el.required && value !== true) return el.type === "consent" ? "Please tick this box to continue." : "This field is required.";
    return value === undefined || value === null || typeof value === "boolean" ? null : "Invalid value.";
  }
  if (isEmpty(typeof value === "string" ? value.trim() : value)) return el.required ? (el.type === "file" ? "Please attach a file." : "This field is required.") : null;

  if (el.type === "address") {
    if (typeof value !== "object" || Array.isArray(value)) return "Invalid address.";
    const a = value as Record<string, unknown>;
    for (const [k, v] of Object.entries(a)) {
      if (!(ADDRESS_PARTS as readonly string[]).includes(k) || (v !== undefined && v !== null && typeof v !== "string")) return "Invalid address.";
      if (typeof v === "string" && v.length > 300) return "Address is too long.";
    }
    if (el.required && (!String(a.line1 || "").trim() || !String(a.city || "").trim() || !String(a.country || "").trim())) return "Enter street, city and country.";
    return null;
  }
  if (el.type === "file") return null; // checked against the uploaded file

  if (isMultiValue(el)) {
    if (!Array.isArray(value) || !value.every(v => typeof v === "string")) return "Invalid selection.";
    const allowed = new Set(normalizeOptions(el.options).map(o => o.value));
    if (value.some(v => !allowed.has(v as string))) return "Choose from the listed options.";
    if (rules.min !== undefined && value.length < rules.min) return `Choose at least ${rules.min}.`;
    if (rules.max !== undefined && value.length > rules.max) return `Choose at most ${rules.max}.`;
    return null;
  }

  if (typeof value !== "string" && typeof value !== "number") return "Invalid value.";
  const text = String(value).trim();
  if (el.type === "select" || el.type === "radio") {
    const allowed = new Set(normalizeOptions(el.options).map(o => o.value));
    if (!allowed.has(text)) return "Choose from the listed options.";
    return null;
  }
  if (el.type === "yesno" && text !== "Yes" && text !== "No") return "Choose Yes or No.";
  if (el.type === "email" && !EMAIL.test(text)) return "Enter a valid email address.";
  if (el.type === "tel" && !isPhone(text)) return "Enter a valid phone number.";
  if (el.type === "date") {
    if (!DATE.test(text) || Number.isNaN(Date.parse(text))) return "Enter a valid date.";
  }
  if (el.type === "number") {
    const n = Number(text);
    if (!Number.isFinite(n)) return "Enter a number.";
    if (rules.min !== undefined && n < rules.min) return `Must be at least ${rules.min}.`;
    if (rules.max !== undefined && n > rules.max) return `Must be at most ${rules.max}.`;
  }
  const max = rules.maxLength ?? (el.type === "textarea" ? DEFAULT_TEXTAREA_MAX : DEFAULT_TEXT_MAX);
  if (text.length > max) return `Use at most ${max} characters.`;
  if (rules.minLength !== undefined && text.length < rules.minLength) return `Use at least ${rules.minLength} characters.`;
  if (rules.pattern) {
    let re: RegExp | null = null;
    try { re = new RegExp(`^(?:${rules.pattern})$`); } catch { re = null; }
    if (re && !re.test(text)) return rules.patternMessage || "Please check the format.";
  }
  return null;
}

export function fileProblem(el: FormElement, file: { name?: string; size?: number; type?: string }): string | null {
  const maxMB = el.file?.maxMB ?? 10;
  if (typeof file.size === "number" && file.size > maxMB * 1024 * 1024) return `File is larger than ${maxMB} MB.`;
  const accept = (el.file?.accept || []).map(a => a.toLowerCase().trim()).filter(Boolean);
  if (accept.length) {
    const name = String(file.name || "").toLowerCase();
    const type = String(file.type || "").toLowerCase();
    const ok = accept.some(a => (a.startsWith(".") ? name.endsWith(a) : a.endsWith("/*") ? type.startsWith(a.slice(0, -1)) : type === a));
    if (!ok) return "This file type isn't allowed.";
  }
  return null;
}

// Keys the website adds about the page the form is on; never answers.
export const CONTEXT_KEYS = new Set([
  "service_id", "service_slug", "service_name", "service_category", "country_name", "country_slug", "visa_type",
  "package_name", "package_slug", "source_page", "submitted_at", "agreed_to_privacy_policy", "attachment_upload_failed",
]);

export interface AttachmentInput { field: string; path: string; name: string; size: number; type: string }

export interface CheckedSubmission {
  ok: boolean;
  errors: Record<string, string>;   // key -> message
  unknownKeys: string[];
  values: Values;                    // key -> clean value (visible inputs only)
  answers: Record<string, unknown>;  // field id -> clean value
  context: Values;                   // allowed page context keys
  mapped: { fullName?: string; email?: string; phone?: string; service?: string; message?: string };
}

// Server-side check of a submission against the PUBLISHED schema. Client field
// types and rules are never trusted: everything comes from `schema`.
export function checkSubmission(schema: FormSchema, raw: Values, attachments: AttachmentInput[] = []): CheckedSubmission {
  const fields = inputFields(schema);
  const byKey = new Map(fields.filter(f => f.name).map(f => [f.name as string, f] as [string, FormElement]));
  const errors: Record<string, string> = {};
  const unknownKeys: string[] = [];
  const context: Values = {};
  for (const key of Object.keys(raw || {})) {
    if (CONTEXT_KEYS.has(key)) { context[key] = raw[key]; continue; }
    if (!byKey.has(key)) unknownKeys.push(key);
  }
  const filesByField = new Map<string, AttachmentInput[]>();
  for (const a of attachments) {
    const f = byKey.get(a.field);
    if (!f || f.type !== "file") { unknownKeys.push(`file:${a.field}`); continue; }
    filesByField.set(a.field, [...(filesByField.get(a.field) || []), a]);
  }

  // Hidden fields always carry their configured value (never the browser's).
  const input: Values = { ...raw };
  for (const f of fields) if (f.type === "hidden" && f.name) input[f.name] = f.default ?? "";

  const visible = visibleIds(schema, input);
  const values: Values = {};
  const answers: Record<string, unknown> = {};
  for (const f of fields) {
    const key = f.name;
    const id = elementId(f);
    if (!key || !visible.has(id)) continue;
    let value = input[key];
    if (f.type === "file") {
      const files = filesByField.get(key) || [];
      if (files.length > 1) { errors[key] = "Attach one file."; continue; }
      if (!files.length) { if (f.required) errors[key] = "Please attach a file."; continue; }
      const problem = fileProblem(f, files[0]);
      if (problem) { errors[key] = problem; continue; }
      values[key] = files[0].name;
      answers[id] = { file: files[0].path, name: files[0].name, size: files[0].size, type: files[0].type };
      continue;
    }
    if (typeof value === "string") value = value.trim();
    if (f.type === "number" && typeof value === "string" && value !== "") value = Number(value);
    const problem = validateValue(f, value);
    if (problem) { errors[key] = problem; continue; }
    if (isEmpty(value) && !isSingleCheckbox(f)) continue;
    if (isSingleCheckbox(f) && value !== true) continue;
    values[key] = value;
    answers[id] = value;
  }

  const mapped: CheckedSubmission["mapped"] = {};
  for (const f of fields) {
    if (!f.mapTo || !f.name || values[f.name] === undefined) continue;
    const v = values[f.name];
    (mapped as Record<string, string>)[f.mapTo] = Array.isArray(v) ? v.join(", ") : String(v);
  }
  return { ok: !Object.keys(errors).length && !unknownKeys.length, errors, unknownKeys, values, answers, context, mapped };
}

// ---------------------------------------------------------------------------
// Publishing checks
// ---------------------------------------------------------------------------
export interface Problem { id?: string; message: string }

export function validateForPublish(schema: FormSchema): Problem[] {
  const problems: Problem[] = [];
  const located = walk(schema);
  const ids = new Map<string, number>();
  const keys = new Map<string, string>();
  const byId = new Map(located.map(l => [l.id, l.el] as [string, FormElement]));
  const byKey = new Map(located.filter(l => isInput(l.el) && l.el.name).map(l => [l.el.name as string, l.el] as [string, FormElement]));
  for (const l of located) {
    const el = l.el;
    const name = el.label || el.name || typeInfo(el.type)?.label || el.type;
    if (!l.id) problems.push({ message: `"${name}" has no ID.` });
    ids.set(l.id, (ids.get(l.id) || 0) + 1);
    if (!isInput(el) && !isDesign(el) && !isRow(el)) problems.push({ id: l.id, message: `Unknown element type "${el.type}".` });
    if (isRow(el) && l.parentId) problems.push({ id: l.id, message: "Rows can't be placed inside another row." });
    if (!isInput(el)) continue;
    if (!el.name || !KEY_PATTERN.test(el.name)) problems.push({ id: l.id, message: `"${name}": the internal key must start with a letter and use only letters, numbers and _.` });
    else if (keys.has(el.name)) problems.push({ id: l.id, message: `Two fields use the internal key "${el.name}".` });
    else keys.set(el.name, l.id);
    if (CONTEXT_KEYS.has(el.name || "")) problems.push({ id: l.id, message: `"${el.name}" is reserved; choose another internal key.` });
    if (el.type !== "hidden" && !String(el.label || "").trim()) problems.push({ id: l.id, message: "A field has no label." });
    if (CHOICE_TYPES.has(el.type) && !normalizeOptions(el.options).filter(o => o.value).length) problems.push({ id: l.id, message: `"${name}" needs at least one choice.` });
    const values = normalizeOptions(el.options).map(o => o.value);
    if (new Set(values).size !== values.length) problems.push({ id: l.id, message: `"${name}" has duplicate choices.` });
    if (el.validation?.pattern) { try { new RegExp(el.validation.pattern); } catch { problems.push({ id: l.id, message: `"${name}": the validation pattern is invalid.` }); } }
    for (const c of conditionsOf(el)) {
      const target = c.fieldId ? byId.get(c.fieldId) : c.field ? byKey.get(c.field) : undefined;
      if (!target) problems.push({ id: l.id, message: `"${name}" depends on a field that no longer exists.` });
      else if (target === el) problems.push({ id: l.id, message: `"${name}" can't depend on itself.` });
    }
  }
  for (const [id, count] of ids) if (count > 1) problems.push({ id, message: `Two elements share the ID "${id}".` });
  if (!located.some(l => isInput(l.el) && l.el.type !== "hidden")) problems.push({ message: "Add at least one field visitors can fill in." });
  // Replies, the auto-reply and the CRM lead all need the visitor's email.
  const emailField = located.find(l => isInput(l.el) && (l.el.mapTo === "email" || (l.el.name === "email" && l.el.type === "email")));
  if (!emailField) problems.push({ message: 'Add an Email field and set "Save to contact" to Email, so you can reply to visitors.' });
  else if (!emailField.el.required || emailField.el.showWhen) problems.push({ id: emailField.id, message: "The contact Email field must be required and always visible." });
  return problems;
}

// ---------------------------------------------------------------------------
// Display
// ---------------------------------------------------------------------------
export function formatAnswer(el: FormElement | undefined, value: unknown): string {
  if (value === undefined || value === null) return "";
  if (value === true) return "Yes";
  if (value === false) return "No";
  const label = (v: unknown) => {
    const o = el ? normalizeOptions(el.options).find(x => x.value === String(v)) : undefined;
    return o ? o.label : String(v);
  };
  if (Array.isArray(value)) return value.map(label).join(", ");
  if (typeof value === "object") {
    const v = value as Record<string, unknown>;
    if (typeof v.name === "string" && typeof v.file === "string") return v.name;
    return ADDRESS_PARTS.map(p => v[p]).filter(x => typeof x === "string" && x.trim()).join(", ");
  }
  return label(value);
}

// Paragraph text: plain text where [label](url) becomes a link. Only http(s),
// mailto, tel and site-relative URLs; everything else stays plain text. The
// result is rendered as text nodes (never HTML), so it can't inject markup.
export type TextPart = { text: string; href?: string };
export function inlineParts(text: string): TextPart[] {
  const parts: TextPart[] = [];
  const re = /\[([^\]\n]{1,200})\]\(([^)\s]{1,500})\)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  const src = String(text || "");
  while ((m = re.exec(src))) {
    if (m.index > last) parts.push({ text: src.slice(last, m.index) });
    const href = m[2];
    const safe = /^(https?:\/\/|mailto:|tel:|\/(?!\/)|#)/i.test(href);
    parts.push(safe ? { text: m[1], href } : { text: m[0] });
    last = m.index + m[0].length;
  }
  if (last < src.length) parts.push({ text: src.slice(last) });
  return parts;
}
