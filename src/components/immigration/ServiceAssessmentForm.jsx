import React, { useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Briefcase, Lock, ShieldCheck } from "lucide-react";
import { submitWebsiteForm } from "../../lib/formSubmit.js";
import { useFormGuard } from "../forms/FormGuard.jsx";
import { FormBody, submitElementOf, useFormRunner } from "../forms/FormRenderer.jsx";
import { safeRedirect } from "../forms/InquiryForm.jsx";

// Renders the service's form from its published form document
// (service.form = formView(...)): sections, fields, labels and messages.
export default function ServiceAssessmentForm({ service }) {
  const config = service.form;
  const runner = useFormRunner(config.schema);
  const { values, errors, onChange, submitting, submitted, submitError } = runner;
  const { honeypot, guard } = useFormGuard();
  const submitEl = submitElementOf(config.schema);
  const redirect = safeRedirect(config.successRedirect);

  useEffect(() => { if (submitted && redirect) window.location.assign(redirect); }, [submitted, redirect]);

  const handleSubmit = event => {
    event.preventDefault();
    runner.run((fields, vals, submissionId) => submitWebsiteForm({
      form: config,
      formId: `immigration-${service.slug}`,
      serviceType: "immigration",
      formType: `immigration_${service.slug}`,
      source: service._doc,
      fields,
      values: vals,
      submissionId,
      metadata: {
        service_id: service.slug,
        service_slug: service.slug,
        service_name: service.title,
        service_category: service.category || "Philippine Immigration Services",
      },
      guard: guard(),
    }), "Something went wrong submitting your assessment. Please try again or contact us directly.");
  };

  const [primaryAction, secondaryAction] = config.successActions || [];

  const footer = (
    <>
      {honeypot}
      <button className="green-button svc-submit-btn" type="submit" disabled={submitting}>
        {submitting ? "Submitting..." : submitEl?.text || config.submitLabel || "Submit for Assessment"} {!submitting && <ArrowRight size={15} />}
      </button>
      {submitError && <p className="svc-submit-error" role="alert">{submitError}</p>}
      <p className="svc-privacy-note">
        <Lock size={12} /> {config.privacyNote || "Your information is secure and will only be used to assist with your inquiry."}
      </p>
    </>
  );

  return (
    <div className="svc-form-col" id="assessment-form">
      <div className="svc-form-card">
        {submitted ? (
          <div className="svc-success" role="status">
            <ShieldCheck size={40} />
            <h3>{config.successTitle}</h3>
            <p>{config.successMessage}</p>
            <div className="svc-success-actions">
              {primaryAction && (
                <Link className="green-button" to={primaryAction.href}>
                  {primaryAction.label}
                </Link>
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
              <h3>
                <span className="svc-form-icon">
                  <Briefcase size={16} />
                </span>
                {config.title || "Start Your Assessment"}
              </h3>
              {config.description && <p>{config.description}</p>}
            </div>
            <FormBody schema={config.schema} values={values} errors={errors} onChange={onChange} footer={footer} numbered={config.layout === "sections"} />
          </form>
        )}
      </div>
    </div>
  );
}
