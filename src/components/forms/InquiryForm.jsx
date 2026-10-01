import React, { useEffect, useState } from "react";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { submitWebsiteForm } from "../../lib/formSubmit.js";
import { useFormGuard } from "./FormGuard.jsx";
import { fillTemplate } from "../../lib/cmsAdapters.js";
import { FormBody, submitElementOf, useFormRunner } from "./FormRenderer.jsx";

function ConsentText({ consent }) {
  const { text = "", linkLabel, linkHref } = consent;
  const at = linkLabel ? text.indexOf(linkLabel) : -1;
  if (at < 0) return text;
  return <>{text.slice(0, at)}<a href={linkHref}>{linkLabel}</a>{text.slice(at + linkLabel.length)}</>;
}

// Only same-site paths or https links (set by an admin in the Form Studio).
export function safeRedirect(url) {
  return typeof url === "string" && /^(\/(?!\/)|https:\/\/)/i.test(url.trim()) ? url.trim() : "";
}

// Sidebar inquiry form used by visa destination and travel package pages.
// Everything shown — fields, texts, consent, success message — comes from the
// published form document ({title} is replaced with the page's title).
export default function InquiryForm({ form, formId, serviceType, formType, source, titleVars, metadata }) {
  const consent = form?.consent;
  const runner = useFormRunner(form?.schema);
  const { values, errors, onChange, submitting, submitted, submitError } = runner;
  const [agreed, setAgreed] = useState(false);
  const [agreeError, setAgreeError] = useState("");
  const { honeypot, guard } = useFormGuard();
  const submitEl = submitElementOf(form?.schema);
  const redirect = safeRedirect(form?.successRedirect);

  useEffect(() => { if (submitted && redirect) window.location.assign(redirect); }, [submitted, redirect]);

  const handleSubmit = event => {
    event.preventDefault();
    const nextAgreeError = consent?.required && !agreed ? "Please agree to the Privacy Policy before submitting." : "";
    setAgreeError(nextAgreeError);
    if (nextAgreeError) return;
    runner.run((fields, vals, submissionId) => submitWebsiteForm({
      form, formId, serviceType, formType, source, fields, values: vals, submissionId,
      metadata: { ...metadata, ...(consent ? { agreed_to_privacy_policy: agreed } : {}) },
      guard: guard(),
    }), "Something went wrong submitting your inquiry. Please try again or contact us directly.");
  };

  const [primaryAction, secondaryAction] = form?.successActions || [];

  const footer = (
    <>
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

      {honeypot}
      <button className="green-button svc-submit-btn" type="submit" disabled={submitting}>
        {submitting ? "Submitting..." : submitEl?.text || form?.submitLabel} {!submitting && <ArrowRight size={15} />}
      </button>
      {submitError && <p className="svc-submit-error" role="alert">{submitError}</p>}
      {form?.privacyNote && (
        <p className="svc-privacy-note">
          <ShieldCheck size={12} /> {form.privacyNote}
        </p>
      )}
    </>
  );

  return (
    <div className="svc-form-card">
      {submitted ? (
        <div className="svc-success" role="status">
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
        <form onSubmit={handleSubmit} noValidate aria-busy={submitting || undefined}>
          <div className="svc-form-head">
            <h3>{fillTemplate(form?.title, titleVars)}</h3>
            {form?.description && <p>{form.description}</p>}
          </div>
          {form?.schema && <FormBody schema={form.schema} values={values} errors={errors} onChange={onChange} footer={footer} />}
        </form>
      )}
    </div>
  );
}
