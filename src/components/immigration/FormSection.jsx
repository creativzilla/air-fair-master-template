import React from "react";
import DynamicFormField, { isFieldVisible } from "./DynamicFormField.jsx";

export default function FormSection({ section, index, values, errors, onFieldChange }) {
  const visibleFields = section.fields.filter(field => isFieldVisible(field, values));
  if (visibleFields.length === 0) return null;

  return (
    <div className="svc-form-section">
      <div className="svc-form-section-title">
        <span className="svc-form-section-num">{String(index + 1).padStart(2, "0")}</span>
        <h4>{section.title}</h4>
      </div>
      <div className="svc-form-grid">
        {visibleFields.map(field => (
          <DynamicFormField
            key={field.id}
            field={field}
            value={values[field.name]}
            error={errors[field.name]}
            onChange={onFieldChange}
          />
        ))}
      </div>
    </div>
  );
}
