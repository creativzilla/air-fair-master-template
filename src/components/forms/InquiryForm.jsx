import React, { useState } from "react";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { submitWebsiteForm } from "../../lib/formSubmit.js";
import { fillTemplate } from "../../lib/cmsAdapters.js";
import DynamicFormField, { isFieldVisible, validateFieldValue } from "../immigration/DynamicFormField.jsx";

function ConsentText({ consent }) {
  const { text = "", linkLabel, linkHref } = consent;
  const at = linkLabel ? text.indexOf(linkLabel) : -1;
  if (at < 0) return text;
  return <>{text.slice(0, at)}<a href={linkHref}>{linkLabel}</a>{text.slice(at + linkLabel.length)}</>;
}

// Sidebar inquiry form used by visa destination and travel package pages.
// Everything shown — fields, texts, consent, success message — comes from the
// published form document ({title} is replaced with the page's title).
export default function InquiryForm({ form, formType, source, titleVars, metadata }) {
  const fields = form?.fields || [];
  const consent = form?.consent;
  const [values, setValues] = useState({});
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [agreeError, setAgreeError] = useState("");

  const handleFieldChange = (name, value) => {
    setValues(prev => ({ ...prev, [name]: value }));
    setErrors(prev => (prev[name] ? { ...prev, [name]: null } : prev));
  };

  const handleSubmit = async event => {
    event.preventDefault();
    setSubmitError("");

    const visibleFields = fields.filter(field => isFieldVisible(field, values));
    const nextErrors = {};
    visibleFields.forEach(field => {
      const message = validateFieldValue(field, values[field.name]);
      if (message) nextErrors[field.name] = message;
    });

    const nextAgreeError = consent?.required && !agreed ? "Please agree to the Privacy Policy before submitting." : "";

    if (Object.keys(nextErrors).length > 0 || nextAgreeError) {
      setErrors(nextErrors);
      setAgreeError(nextAgreeError);
      return;
    }

    setSubmitting(true);
    try {
      await submitWebsiteForm({
        form,
        formType,
        source,
        fields: visibleFields,
        values,
        metadata: { ...metadata, ...(consent ? { agreed_to_privacy_policy: agreed } : {}) },
      });
      setSubmitted(true);
    } catch {
      setSubmitError("Something went wrong submitting your inquiry. Please try again or contact us directly.");
    } finally {
      setSubmitting(false);
    }
  };

  const [primaryAction, secondaryAction] = form?.successActions || [];

  return (
    <div className="svc-form-card">
      {submitted ? (
        <div className="svc-success">
          <ShieldCheck size={40} />
          <h3>{form?.successTitle}</h3>
          <p>{fillTemplate(form?.successMessage, titleVars)}</p>
          <div className="svc-success-actions">
            {primaryAction && (
              <a className="green-button" href={primaryAction.href}>
                {primaryAction.label}
              </a>
            )}
            {secondaryAction && (
              <a className="outline-green-button" href={secondaryAction.href}>
                {secondaryAction.label}
              </a>
            )}
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} noValidate>
          <div className="svc-form-head">
            <h3>{fillTemplate(form?.title, titleVars)}</h3>
            {form?.description && <p>{form.description}</p>}
          </div>

          <div className="svc-form-grid">
            {fields
              .filter(field => isFieldVisible(field, values))
              .map(field => (
                <DynamicFormField
                  key={field.name}
                  field={{ ...field, id: field.name }}
                  value={values[field.name]}
                  error={errors[field.name]}
                  onChange={handleFieldChange}
                />
              ))}
          </div>

          {consent && (
            <label className="svc-checkbox-row vcp-agree-row">
              <input
                type="checkbox"
                checked={agreed}
                onChange={e => {
                  setAgreed(e.target.checked);
                  if (agreeError) setAgreeError("");
                }}
              />
              <span>
                <ConsentText consent={consent} />
                {consent.required && <span className="required-mark">*</span>}
              </span>
            </label>
          )}
          {agreeError && <p className="svc-field-error">{agreeError}</p>}

          <button className="green-button svc-submit-btn" type="submit" disabled={submitting}>
            {submitting ? "Submitting..." : form?.submitLabel} {!submitting && <ArrowRight size={15} />}
          </button>
          {submitError && <p className="svc-submit-error">{submitError}</p>}
          {form?.privacyNote && (
            <p className="svc-privacy-note">
              <ShieldCheck size={12} /> {form.privacyNote}
            </p>
          )}
        </form>
      )}
    </div>
  );
}
