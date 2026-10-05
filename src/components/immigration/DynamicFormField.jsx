import React from "react";
import { COUNTRIES } from "../../lib/countries.js";
import {
  ADDRESS_PARTS, conditionsMet, elementId, isMultiValue, isSingleCheckbox, normalizeOptions, validateValue,
} from "../../../supabase/functions/_shared/forms/schema.ts";

// One input field of a website form (all field types of the Form Studio).
// Markup and classes are the website's own (svc-field ...), so the dashboard
// preview and the live form look the same.

const FULL_WIDTH_TYPES = ["textarea", "radio", "yesno", "checkboxGroup", "file", "address", "consent"];

export function getFieldWidth(field) {
  if (field.width) return field.width;
  if (field.type === "checkbox" && field.options?.length) return "full";
  return FULL_WIDTH_TYPES.includes(field.type) ? "full" : "half";
}

// Compatibility helpers (older callers); the renderer uses the schema module.
export function isFieldVisible(field, values) {
  return conditionsMet(field, values, new Map());
}
export function validateFieldValue(field, value) {
  return validateValue(field, value);
}

const ADDRESS_LABELS = {
  line1: "Street address", line2: "Apartment, suite, etc. (optional)", city: "City", region: "State / province", postalCode: "Postal code", country: "Country",
};

export default function DynamicFormField({ field, value, error, onChange }) {
  if (field.type === "hidden") return null;
  const width = getFieldWidth(field);
  const fieldId = `field-${field.id || elementId(field)}`;
  const helpId = field.help ? `${fieldId}-help` : undefined;
  const errorId = error ? `${fieldId}-error` : undefined;
  const describedBy = [helpId, errorId].filter(Boolean).join(" ") || undefined;
  const className = `svc-field${width === "full" ? " svc-field-full" : ""}${error ? " has-error" : ""}`;
  const set = next => onChange(field.name, next);
  const a11y = { "aria-describedby": describedBy, "aria-invalid": error ? true : undefined, "aria-required": field.required || undefined };

  const label = field.label && (
    <label htmlFor={fieldId} className={field.hideLabel ? "sr-only" : undefined}>
      {field.label}
      {field.required && <span className="required-mark">*</span>}
    </label>
  );
  // Group label for radios/checkbox groups (not tied to a single input).
  const groupLabel = field.label && (
    <span className={`svc-field-label${field.hideLabel ? " sr-only" : ""}`} id={`${fieldId}-label`}>
      {field.label}
      {field.required && <span className="required-mark">*</span>}
    </span>
  );
  const help = field.help && <span className="svc-field-help" id={helpId}>{field.help}</span>;
  const errorNode = error && <span className="svc-field-error" id={errorId} role="alert">{error}</span>;

  if (isSingleCheckbox(field)) {
    return (
      <div className={className}>
        <label className="svc-checkbox-row" htmlFor={fieldId}>
          <input id={fieldId} type="checkbox" checked={value === true} onChange={e => set(e.target.checked)} {...a11y} />
          <span>
            {field.label}
            {field.required && <span className="required-mark">*</span>}
          </span>
        </label>
        {help}
        {errorNode}
      </div>
    );
  }

  if (isMultiValue(field)) {
    const options = normalizeOptions(field.options);
    const selected = Array.isArray(value) ? value : [];
    return (
      <div className={className}>
        {groupLabel}
        <div className="svc-radio-group" role="group" aria-labelledby={field.label ? `${fieldId}-label` : undefined} aria-describedby={describedBy}>
          {options.map(option => (
            <label key={option.value} className={`svc-radio-pill${selected.includes(option.value) ? " checked" : ""}`}>
              <input
                type="checkbox"
                checked={selected.includes(option.value)}
                onChange={() => set(selected.includes(option.value) ? selected.filter(v => v !== option.value) : [...selected, option.value])}
              />
              {option.label}
            </label>
          ))}
        </div>
        {help}
        {errorNode}
      </div>
    );
  }

  switch (field.type) {
    case "textarea":
      return (
        <div className={className}>
          {label}
          <textarea id={fieldId} rows={4} placeholder={field.placeholder || ""} value={value || ""} maxLength={field.validation?.maxLength} onChange={e => set(e.target.value)} {...a11y} />
          {help}
          {errorNode}
        </div>
      );

    case "select": {
      const options = normalizeOptions(field.options);
      return (
        <div className={className}>
          {label}
          <select id={fieldId} value={value || ""} onChange={e => set(e.target.value)} {...a11y}>
            <option value="">{field.placeholder || "Select an option"}</option>
            {options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          {help}
          {errorNode}
        </div>
      );
    }

    case "country":
      return (
        <div className={className}>
          {label}
          <select id={fieldId} value={value || ""} onChange={e => set(e.target.value)} {...a11y}>
            <option value="">{field.placeholder || "Select country"}</option>
            {COUNTRIES.map(country => <option key={country} value={country}>{country}</option>)}
          </select>
          {help}
          {errorNode}
        </div>
      );

    case "radio":
    case "yesno": {
      const options = field.type === "yesno" ? normalizeOptions(["Yes", "No"]) : normalizeOptions(field.options);
      return (
        <div className={className}>
          {groupLabel}
          <div className="svc-radio-group" role="radiogroup" aria-labelledby={field.label ? `${fieldId}-label` : undefined} aria-describedby={describedBy}>
            {options.map(option => (
              <label key={option.value} className={`svc-radio-pill${value === option.value ? " checked" : ""}`}>
                <input type="radio" name={`${fieldId}-radio`} value={option.value} checked={value === option.value} onChange={() => set(option.value)} />
                {option.label}
              </label>
            ))}
          </div>
          {help}
          {errorNode}
        </div>
      );
    }

    case "address": {
      const address = value && typeof value === "object" ? value : {};
      const part = (key, extra = {}) => (
        <input
          id={key === "line1" ? fieldId : `${fieldId}-${key}`}
          type="text"
          aria-label={ADDRESS_LABELS[key]}
          placeholder={ADDRESS_LABELS[key]}
          value={address[key] || ""}
          onChange={e => set({ ...address, [key]: e.target.value })}
          {...(key === "line1" ? a11y : {})}
          {...extra}
        />
      );
      return (
        <div className={className}>
          {label}
          <div className="svc-address">
            <div className="svc-address-full">{part("line1", { autoComplete: "address-line1" })}</div>
            <div className="svc-address-full">{part("line2", { autoComplete: "address-line2" })}</div>
            {part("city", { autoComplete: "address-level2" })}
            {part("region", { autoComplete: "address-level1" })}
            {part("postalCode", { autoComplete: "postal-code" })}
            <select aria-label="Country" value={address.country || ""} onChange={e => set({ ...address, country: e.target.value })}>
              <option value="">Country</option>
              {COUNTRIES.map(country => <option key={country} value={country}>{country}</option>)}
            </select>
          </div>
          {help}
          {errorNode}
        </div>
      );
    }

    case "file": {
      const accept = (field.file?.accept || []).join(",") || undefined;
      return (
        <div className={className}>
          {label}
          <input id={fieldId} type="file" accept={accept} onChange={e => set(e.target.files?.[0] || null)} {...a11y} />
          {value?.name && <span className="svc-file-name">{value.name}</span>}
          {help}
          {errorNode}
        </div>
      );
    }

    case "date":
    case "number":
    case "text":
    case "email":
    case "tel":
    default: {
      const type = ["date", "number", "email", "tel"].includes(field.type) ? field.type : "text";
      const rules = field.validation || {};
      const auto = { email: "email", tel: "tel" }[field.type] || (field.mapTo === "fullName" ? "name" : undefined);
      return (
        <div className={className}>
          {label}
          <input
            id={fieldId}
            type={type}
            placeholder={field.placeholder || ""}
            value={value ?? ""}
            min={type === "number" ? rules.min : undefined}
            max={type === "number" ? rules.max : undefined}
            maxLength={type === "text" || type === "email" || type === "tel" ? rules.maxLength : undefined}
            autoComplete={auto}
            onChange={e => set(e.target.value)}
            {...a11y}
          />
          {help}
          {errorNode}
        </div>
      );
    }
  }
}

export { ADDRESS_PARTS };
