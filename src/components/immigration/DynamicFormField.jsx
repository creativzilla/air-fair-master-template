import React from "react";
import { COUNTRIES } from "../../lib/countries.js";

const FULL_WIDTH_TYPES = ["textarea", "radio", "yesno", "checkboxGroup", "file"];

export function getFieldWidth(field) {
  if (field.width) return field.width;
  return FULL_WIDTH_TYPES.includes(field.type) ? "full" : "half";
}

export function isFieldVisible(field, values) {
  if (!field.showWhen) return true;
  const conditions = Array.isArray(field.showWhen) ? field.showWhen : [field.showWhen];
  return conditions.every(condition => {
    const currentValue = values[condition.field];
    if (condition.equals !== undefined) return currentValue === condition.equals;
    if (condition.notEquals !== undefined) return currentValue !== condition.notEquals;
    if (condition.in) return condition.in.includes(currentValue);
    return true;
  });
}

export function validateFieldValue(field, value) {
  if (field.required) {
    if (field.type === "checkbox" && !field.options) {
      if (!value) return "This field is required.";
    } else if (value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0)) {
      return "This field is required.";
    }
  }
  if (value && field.type === "email") {
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(value)) return "Enter a valid email address.";
  }
  return null;
}

function normalizeOptions(options) {
  return (options || []).map(option =>
    typeof option === "string" ? { label: option, value: option } : option
  );
}

export default function DynamicFormField({ field, value, error, onChange }) {
  const width = getFieldWidth(field);
  const fieldId = `field-${field.id}`;
  const className = `svc-field${width === "full" ? " svc-field-full" : ""}${error ? " has-error" : ""}`;

  const label = field.label && (
    <label htmlFor={fieldId}>
      {field.label}
      {field.required && <span className="required-mark">*</span>}
    </label>
  );

  const errorNode = error && <span className="svc-field-error">{error}</span>;

  switch (field.type) {
    case "textarea":
      return (
        <div className={className}>
          {label}
          <textarea
            id={fieldId}
            rows={4}
            placeholder={field.placeholder || ""}
            value={value || ""}
            onChange={e => onChange(field.name, e.target.value)}
          />
          {errorNode}
        </div>
      );

    case "select": {
      const options = normalizeOptions(field.options);
      return (
        <div className={className}>
          {label}
          <select id={fieldId} value={value || ""} onChange={e => onChange(field.name, e.target.value)}>
            <option value="">{field.placeholder || "Select an option"}</option>
            {options.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {errorNode}
        </div>
      );
    }

    case "country":
      return (
        <div className={className}>
          {label}
          <select id={fieldId} value={value || ""} onChange={e => onChange(field.name, e.target.value)}>
            <option value="">{field.placeholder || "Select country"}</option>
            {COUNTRIES.map(country => (
              <option key={country} value={country}>
                {country}
              </option>
            ))}
          </select>
          {errorNode}
        </div>
      );

    case "radio": {
      const options = normalizeOptions(field.options);
      return (
        <div className={className}>
          {label}
          <div className="svc-radio-group" role="radiogroup" aria-label={field.label}>
            {options.map(option => (
              <label key={option.value} className={`svc-radio-pill${value === option.value ? " checked" : ""}`}>
                <input
                  type="radio"
                  name={field.name}
                  value={option.value}
                  checked={value === option.value}
                  onChange={() => onChange(field.name, option.value)}
                />
                {option.label}
              </label>
            ))}
          </div>
          {errorNode}
        </div>
      );
    }

    case "yesno":
      return (
        <div className={className}>
          {label}
          <div className="svc-radio-group" role="radiogroup" aria-label={field.label}>
            {["Yes", "No"].map(option => (
              <label key={option} className={`svc-radio-pill${value === option ? " checked" : ""}`}>
                <input
                  type="radio"
                  name={field.name}
                  value={option}
                  checked={value === option}
                  onChange={() => onChange(field.name, option)}
                />
                {option}
              </label>
            ))}
          </div>
          {errorNode}
        </div>
      );

    case "checkbox":
      if (field.options) {
        const options = normalizeOptions(field.options);
        const selected = Array.isArray(value) ? value : [];
        return (
          <div className={className}>
            {label}
            <div className="svc-radio-group">
              {options.map(option => (
                <label key={option.value} className={`svc-radio-pill${selected.includes(option.value) ? " checked" : ""}`}>
                  <input
                    type="checkbox"
                    checked={selected.includes(option.value)}
                    onChange={() => {
                      const next = selected.includes(option.value)
                        ? selected.filter(v => v !== option.value)
                        : [...selected, option.value];
                      onChange(field.name, next);
                    }}
                  />
                  {option.label}
                </label>
              ))}
            </div>
            {errorNode}
          </div>
        );
      }
      return (
        <div className={className}>
          <label className="svc-checkbox-row" htmlFor={fieldId}>
            <input
              id={fieldId}
              type="checkbox"
              checked={!!value}
              onChange={e => onChange(field.name, e.target.checked)}
            />
            <span>
              {field.label}
              {field.required && <span className="required-mark">*</span>}
            </span>
          </label>
          {errorNode}
        </div>
      );

    case "file":
      return (
        <div className={className}>
          {label}
          <input
            id={fieldId}
            type="file"
            onChange={e => onChange(field.name, e.target.files?.[0] || null)}
          />
          {value?.name && <span className="svc-file-name">{value.name}</span>}
          {errorNode}
        </div>
      );

    case "date":
    case "number":
    case "text":
    case "email":
    case "tel":
    default:
      return (
        <div className={className}>
          {label}
          <input
            id={fieldId}
            type={field.type === "date" || field.type === "number" || field.type === "email" || field.type === "tel" ? field.type : "text"}
            placeholder={field.placeholder || ""}
            value={value || ""}
            onChange={e => onChange(field.name, e.target.value)}
          />
          {errorNode}
        </div>
      );
  }
}
