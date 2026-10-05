// Pure, immutable edits of a form schema for the Form Studio. Every function
// returns a new schema (the old one is kept for undo).
//
// A location in the form: { sectionId, rowId, column, index }
//   rowId/column are null for the section's own list; index is the position.
import {
  ELEMENT_TYPES, elementId, inputFields, isInput, isRow, newId, normalizeOptions, toKey, typeInfo, uniqueKey, walk,
} from "../../../supabase/functions/_shared/forms/schema.ts";

const clone = value => JSON.parse(JSON.stringify(value));

export function takenKeys(schema, exceptId = null) {
  return new Set(inputFields(schema).filter(f => elementId(f) !== exceptId).map(f => f.name).filter(Boolean));
}

// A new element of the palette type, with a fresh id and a unique key.
export function createElement(type, schema) {
  const info = typeInfo(type) || { label: type };
  if (type === "row1" || type === "row2") {
    const columns = type === "row1" ? 1 : 2;
    return { id: newId("row"), type: "row", columns, children: Array.from({ length: columns }, () => []) };
  }
  if (info.kind === "design") {
    const base = { id: newId("el"), type };
    if (type === "heading") return { ...base, text: "Heading", level: 3 };
    if (type === "paragraph") return { ...base, text: "Add some text. Links: [our services](/philippine-immigration-services)" };
    if (type === "spacer") return { ...base, size: "md" };
    if (type === "image") return { ...base, url: "", alt: "", width: 100, align: "center" };
    if (type === "submit") return { ...base, text: schema.submitLabel || "Submit" };
    return base;
  }
  const labels = { text: "Short answer", textarea: "Your message", email: "Email address", tel: "Phone number", number: "Number", date: "Date",
    select: "Choose an option", radio: "Choose one", checkboxGroup: "Choose all that apply", yesno: "Yes or no?", country: "Country",
    consent: "I agree to the terms", file: "Upload a document", address: "Address", hidden: "Hidden value" };
  const label = labels[type] || info.label;
  const key = uniqueKey(type === "email" ? "email" : type === "tel" ? "phone" : toKey(label), takenKeys(schema));
  const el = { id: newId("f"), type, name: key, label, required: false };
  if (type === "select" || type === "radio" || type === "checkboxGroup") el.options = [{ label: "Option 1", value: "option1" }, { label: "Option 2", value: "option2" }];
  if (type === "file") el.file = { accept: [".pdf", "image/*"], maxMB: 10 };
  if (type === "hidden") el.default = "";
  if (type === "email" && !inputFields(schema).some(f => f.mapTo === "email")) { el.mapTo = "email"; el.required = true; }
  return el;
}

export function sectionIndex(schema, sectionId) {
  return (schema.sections || []).findIndex(s => s.id === sectionId);
}

export function listAt(schema, loc) {
  const section = (schema.sections || [])[sectionIndex(schema, loc.sectionId)];
  if (!section) return null;
  if (!loc.rowId) return section.fields || [];
  const row = (section.fields || []).find(el => elementId(el) === loc.rowId);
  return row ? ((row.children || [])[loc.column] || []) : null;
}

function withList(schema, loc, fn) {
  const next = clone(schema);
  const section = next.sections[sectionIndex(next, loc.sectionId)];
  if (!loc.rowId) { section.fields = fn(section.fields || []); return next; }
  const row = section.fields.find(el => elementId(el) === loc.rowId);
  row.children = row.children || [];
  row.children[loc.column] = fn(row.children[loc.column] || []);
  return next;
}

export function findLocation(schema, id) {
  const hit = walk(schema).find(l => l.id === id);
  if (!hit) return null;
  return { sectionId: hit.sectionId, rowId: hit.parentId, column: hit.column, index: hit.index };
}

export function findElement(schema, id) {
  return walk(schema).find(l => l.id === id)?.el || null;
}

// Rows can't go inside rows; only one Submit button per form.
export function canPlace(schema, el, loc) {
  if (isRow(el) && loc.rowId) return false;
  if (el.type === "submit" && walk(schema).some(l => l.el.type === "submit" && l.id !== elementId(el))) return false;
  return true;
}

export function insertAt(schema, loc, el) {
  if (!canPlace(schema, el, loc)) return schema;
  return withList(schema, loc, list => { const copy = [...list]; copy.splice(Math.max(0, Math.min(loc.index, copy.length)), 0, el); return copy; });
}

export function removeById(schema, id) {
  const loc = findLocation(schema, id);
  if (!loc) return schema;
  let next = withList(schema, loc, list => list.filter(el => elementId(el) !== id));
  // Conditions that pointed at a removed field no longer apply.
  const gone = new Set([id, ...walk({ sections: [{ id: "x", fields: [findElement(schema, id)] }] }).map(l => l.id)]);
  const goneKeys = new Set([...gone].map(i => findElement(schema, i)?.name).filter(Boolean));
  next = mapElements(next, el => {
    if (!el.showWhen) return el;
    const conds = (Array.isArray(el.showWhen) ? el.showWhen : [el.showWhen]).filter(c => !(c.fieldId && gone.has(c.fieldId)) && !(!c.fieldId && goneKeys.has(c.field)));
    const copy = { ...el };
    if (conds.length) copy.showWhen = conds; else delete copy.showWhen;
    return copy;
  });
  return next;
}

export function moveTo(schema, id, loc) {
  const el = findElement(schema, id);
  const from = findLocation(schema, id);
  if (!el || !from || !canPlace(schema, el, loc)) return schema;
  // Dropping a row into its own column is not allowed.
  if (loc.rowId && loc.rowId === id) return schema;
  const sameList = from.sectionId === loc.sectionId && from.rowId === loc.rowId && from.column === loc.column;
  const target = { ...loc, index: sameList && loc.index > from.index ? loc.index - 1 : loc.index };
  if (sameList && target.index === from.index) return schema;
  const without = withList(schema, from, list => list.filter(item => elementId(item) !== id));
  return insertAt(without, target, el);
}

// One step up or down within its list (crossing into the neighbouring section at the ends).
export function nudge(schema, id, dir) {
  const loc = findLocation(schema, id);
  if (!loc) return schema;
  const list = listAt(schema, loc);
  const target = loc.index + dir;
  if (target >= 0 && target < list.length) return moveTo(schema, id, { ...loc, index: dir > 0 ? target + 1 : target });
  if (loc.rowId) return schema;
  const si = sectionIndex(schema, loc.sectionId) + dir;
  const section = schema.sections[si];
  if (!section) return schema;
  return moveTo(schema, id, { sectionId: section.id, rowId: null, column: null, index: dir > 0 ? 0 : (section.fields || []).length });
}

// Copy with fresh ids, and fresh unique keys for every field inside.
export function duplicateById(schema, id) {
  const el = findElement(schema, id);
  const loc = findLocation(schema, id);
  if (!el || !loc || el.type === "submit") return { schema, id: null };
  const taken = takenKeys(schema);
  const fresh = item => {
    const copy = clone(item);
    copy.id = newId(isInput(copy) ? "f" : isRow(copy) ? "row" : "el");
    if (isInput(copy)) {
      copy.name = uniqueKey(copy.name || toKey(copy.label || "field"), taken);
      taken.add(copy.name);
      if (copy.mapTo === "email" || copy.mapTo === "fullName" || copy.mapTo === "phone") delete copy.mapTo; // only one per form
      if (copy.label) copy.label = `${copy.label} (copy)`;
    }
    if (isRow(copy)) copy.children = (copy.children || []).map(col => (col || []).map(fresh));
    return copy;
  };
  const copy = fresh(el);
  return { schema: insertAt(schema, { ...loc, index: loc.index + 1 }, copy), id: copy.id };
}

export function updateById(schema, id, patch) {
  return mapElements(schema, el => (elementId(el) === id ? (typeof patch === "function" ? patch(el) : { ...el, ...patch }) : el));
}

export function mapElements(schema, fn) {
  const mapEl = el => {
    const next = fn(el);
    if (isRow(next)) return { ...next, children: (next.children || []).map(col => (col || []).map(mapEl)) };
    return next;
  };
  return { ...schema, sections: (schema.sections || []).map(s => ({ ...s, fields: (s.fields || []).map(mapEl) })) };
}

// Changing a key keeps conditions that refer to the field working.
export function renameKey(schema, id, nextKey) {
  const el = findElement(schema, id);
  if (!el) return schema;
  const oldKey = el.name;
  return mapElements(schema, item => {
    let out = elementId(item) === id ? { ...item, name: nextKey } : item;
    if (out.showWhen && oldKey) {
      const conds = (Array.isArray(out.showWhen) ? out.showWhen : [out.showWhen]).map(c => (!c.fieldId && c.field === oldKey ? { ...c, fieldId: id, field: nextKey } : c.fieldId === id ? { ...c, field: nextKey } : c));
      out = { ...out, showWhen: Array.isArray(out.showWhen) ? conds : conds[0] };
    }
    return out;
  });
}

// A contact property (email, full name, ...) maps to one field at most.
export function setMapping(schema, id, mapTo) {
  return mapElements(schema, el => {
    if (elementId(el) === id) { const copy = { ...el }; if (mapTo) copy.mapTo = mapTo; else delete copy.mapTo; return copy; }
    if (mapTo && el.mapTo === mapTo) { const copy = { ...el }; delete copy.mapTo; return copy; }
    return el;
  });
}

export function addSection(schema, afterSectionId) {
  const taken = new Set((schema.sections || []).map(s => s.id));
  let i = (schema.sections || []).length + 1;
  while (taken.has(`section${i}`)) i++;
  const section = { id: `section${i}`, title: "New section", fields: [] };
  const sections = [...(schema.sections || [])];
  const at = afterSectionId ? sectionIndex(schema, afterSectionId) + 1 : sections.length;
  sections.splice(at, 0, section);
  return { schema: { ...schema, sections }, id: section.id };
}

export function updateSection(schema, sectionId, patch) {
  return { ...schema, sections: schema.sections.map(s => (s.id === sectionId ? { ...s, ...patch } : s)) };
}

export function moveSection(schema, sectionId, dir) {
  const i = sectionIndex(schema, sectionId);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= schema.sections.length) return schema;
  const sections = [...schema.sections];
  [sections[i], sections[j]] = [sections[j], sections[i]];
  return { ...schema, sections };
}

export function removeSection(schema, sectionId) {
  if ((schema.sections || []).length <= 1) return schema;
  let next = schema;
  const section = schema.sections[sectionIndex(schema, sectionId)];
  for (const el of section?.fields || []) next = removeById(next, elementId(el));
  return { ...next, sections: next.sections.filter(s => s.id !== sectionId) };
}

// Where a click-to-add element goes: after the selected element, or at the
// end of the selected (or last) section.
export function insertionPoint(schema, selected) {
  if (selected?.kind === "element") {
    const loc = findLocation(schema, selected.id);
    if (loc) {
      const el = findElement(schema, selected.id);
      if (isRow(el)) return { sectionId: loc.sectionId, rowId: selected.id, column: 0, index: ((el.children || [])[0] || []).length };
      return { ...loc, index: loc.index + 1 };
    }
  }
  const sections = schema.sections || [];
  const section = (selected?.kind === "section" && sections.find(s => s.id === selected.id)) || sections[sections.length - 1];
  return { sectionId: section.id, rowId: null, column: null, index: (section.fields || []).length };
}

export const PALETTE = ELEMENT_TYPES;
export { normalizeOptions };
