// Renders a form from its schema: sections, two-column rows, design elements
// and every field type. Used by the website's forms AND the dashboard's Form
// Studio canvas/preview, so the preview matches the live form exactly.
import React, { useCallback, useMemo, useRef, useState } from "react";
import DynamicFormField from "../immigration/DynamicFormField.jsx";
import { FormSubmitError, newId as newSubmissionId } from "../../lib/formSubmit.js";
import {
  defaultValueOf, elementId, fileProblem, inlineParts, inputFields, isInput, isRow, sectionsOf, validateValue, visibleIds,
} from "../../../supabase/functions/_shared/forms/schema.ts";

const SAFE_IMAGE = /^(https:\/\/|\/(?!\/)|data:image\/(png|jpe?g|webp|gif);)/i;

export function submitElementOf(schema) {
  for (const section of sectionsOf(schema || {})) {
    for (const el of section.fields || []) {
      if (el.type === "submit") return el;
      if (isRow(el)) for (const col of el.children || []) for (const child of col || []) if (child.type === "submit") return child;
    }
  }
  return null;
}

export function TextWithLinks({ text }) {
  return inlineParts(text).map((part, i) => (part.href
    ? <a key={i} href={part.href} target={/^https?:/i.test(part.href) ? "_blank" : undefined} rel={/^https?:/i.test(part.href) ? "noopener noreferrer" : undefined}>{part.text}</a>
    : <React.Fragment key={i}>{part.text}</React.Fragment>));
}

// One design element.
export function DesignElement({ el, footer }) {
  const align = el.align ? { textAlign: el.align } : undefined;
  switch (el.type) {
    case "heading": {
      const Tag = el.level === 2 ? "h4" : "h5";
      return <Tag className={`svc-form-heading svc-form-heading-${el.level === 2 ? "lg" : "md"}`} style={align}>{el.text}</Tag>;
    }
    case "paragraph":
      return <p className="svc-form-text" style={align}><TextWithLinks text={el.text || ""} /></p>;
    case "divider":
      return <hr className="svc-form-divider" />;
    case "spacer":
      return <div className={`svc-form-spacer svc-form-spacer-${el.size || "md"}`} aria-hidden="true" />;
    case "image":
      return SAFE_IMAGE.test(el.url || "")
        ? <div className="svc-form-image" style={{ textAlign: el.align || "center" }}><img src={el.url} alt={el.alt || ""} style={{ width: `${Math.min(100, Math.max(10, Number(el.width) || 100))}%` }} loading="lazy" /></div>
        : null;
    case "submit":
      return footer ? <div className="svc-form-submit-slot">{footer}</div> : null;
    default:
      return null;
  }
}

// Any element: field, design element or row (with its columns).
export function FormElementView({ el, values, errors, onChange, visible, footer, renderChild }) {
  const id = elementId(el);
  if (visible && !visible.has(id)) return null;
  if (isRow(el)) {
    const columns = el.columns === 1 ? 1 : 2;
    return (
      <div className={`svc-form-row svc-form-row-${columns}`}>
        {Array.from({ length: columns }, (_v, c) => (
          <div className="svc-form-col-stack" key={c}>
            {((el.children || [])[c] || []).map(child => (renderChild
              ? renderChild(child, { rowId: id, column: c })
              : <FormElementView key={elementId(child)} el={child} values={values} errors={errors} onChange={onChange} visible={visible} footer={footer} />))}
          </div>
        ))}
      </div>
    );
  }
  if (isInput(el)) return <DynamicFormField field={{ ...el, id }} value={values[el.name]} error={errors?.[el.name]} onChange={onChange} />;
  const node = <DesignElement el={el} footer={footer} />;
  return node ? <div className="svc-field svc-field-full svc-form-design">{node}</div> : null;
}

/**
 * The whole form body.
 * schema   normalized form schema
 * footer   consent + submit button + messages; rendered where the form's
 *          "Submit button" element is, or at the end
 * numbered "sections" layout: numbered section titles (immigration forms)
 * device   "mobile" forces the stacked phone layout (used by the Studio)
 */
export function FormBody({ schema, values, errors, onChange, footer, numbered, device }) {
  const visible = useMemo(() => visibleIds(schema, values), [schema, values]);
  const hasSubmitEl = !!submitElementOf(schema);
  const sections = sectionsOf(schema);
  return (
    <div className={device ? `fr-device-${device}` : undefined}>
      {sections.map((section, index) => {
        const shown = (section.fields || []).filter(el => visible.has(elementId(el)) && !(isInput(el) && el.type === "hidden"));
        if (!shown.length && !numbered) return null;
        if (numbered && !shown.some(el => isInput(el) || isRow(el))) return null;
        const grid = (
          <div className="svc-form-grid">
            {(section.fields || []).map(el => <FormElementView key={elementId(el)} el={el} values={values} errors={errors} onChange={onChange} visible={visible} footer={footer} />)}
          </div>
        );
        if (numbered) {
          return (
            <div className="svc-form-section" key={section.id || index}>
              <div className="svc-form-section-title">
                <span className="svc-form-section-num">{String(index + 1).padStart(2, "0")}</span>
                <h4>{section.title}</h4>
              </div>
              {section.description && <p className="svc-form-text">{section.description}</p>}
              {grid}
            </div>
          );
        }
        return (
          <div className={sections.length > 1 ? "svc-form-section" : undefined} key={section.id || index}>
            {sections.length > 1 && section.title && <h4 className="svc-form-heading svc-form-heading-md">{section.title}</h4>}
            {sections.length > 1 && section.description && <p className="svc-form-text">{section.description}</p>}
            {grid}
          </div>
        );
      })}
      {!hasSubmitEl && footer}
    </div>
  );
}

// Values, visibility, validation and submit state for one form.
export function useFormRunner(schema) {
  const initial = useMemo(() => {
    const v = {};
    for (const f of inputFields(schema || {})) {
      const d = defaultValueOf(f);
      if (d !== undefined && f.name) v[f.name] = d;
    }
    return v;
  }, [schema]);
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState("");
  // Same id for every retry of this submission: the server saves it once.
  const submissionId = useRef(null);
  // Synchronous guard: two fast clicks can't both start a submission.
  const busy = useRef(false);

  const onChange = useCallback((name, value) => {
    setValues(prev => ({ ...prev, [name]: value }));
    setErrors(prev => (prev[name] ? { ...prev, [name]: null } : prev));
  }, []);

  // Validates visible fields; returns the visible input fields, or null.
  const validate = useCallback(() => {
    const visible = visibleIds(schema, values);
    const fields = inputFields(schema).filter(f => visible.has(elementId(f)));
    const next = {};
    for (const f of fields) {
      const value = values[f.name];
      const problem = f.type === "file" && value ? fileProblem(f, value) : validateValue(f, typeof value === "string" ? value.trim() : value);
      if (problem) next[f.name] = problem;
    }
    setErrors(next);
    if (Object.keys(next).length) {
      // Move focus to the first problem so keyboard and screen-reader users find it.
      const first = fields.find(f => next[f.name]);
      if (first && typeof document !== "undefined") setTimeout(() => document.getElementById(`field-${elementId(first)}`)?.focus(), 0);
      return null;
    }
    return fields;
  }, [schema, values]);

  // work(fields, values, submissionId) does the saving; fallback is the message
  // shown for unexpected errors (FormSubmitError messages are shown as-is).
  const run = useCallback(async (work, fallback = "Something went wrong. Please try again.") => {
    if (busy.current) return;
    setSubmitError("");
    const fields = validate();
    if (!fields) return;
    busy.current = true;
    if (!submissionId.current) submissionId.current = newSubmissionId();
    setSubmitting(true);
    try {
      await work(fields, values, submissionId.current);
      submissionId.current = null;
      setSubmitted(true);
    } catch (err) {
      setSubmitError(err instanceof FormSubmitError ? err.message : fallback);
      if (err instanceof FormSubmitError && err.fieldErrors) setErrors(err.fieldErrors);
    } finally {
      busy.current = false;
      setSubmitting(false);
    }
  }, [validate, values]);

  return { values, errors, setErrors, onChange, submitting, submitted, submitError, setSubmitError, run, validate };
}
