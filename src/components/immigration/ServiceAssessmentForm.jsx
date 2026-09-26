import React, { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Briefcase, Lock, ShieldCheck } from "lucide-react";
import { submitWebsiteForm } from "../../lib/formSubmit.js";
import { isFieldVisible, validateFieldValue } from "./DynamicFormField.jsx";
import FormSection from "./FormSection.jsx";

// Renders the service's form from its published form document
// (service.form = formView(...)): sections, fields, labels and messages.
export default function ServiceAssessmentForm({ service }) {
  const config = service.form;
  const sections = config.sections || [];
  const [values, setValues] = useState({});
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const handleFieldChange = (name, value) => {
    setValues(prev => ({ ...prev, [name]: value }));
    setErrors(prev => (prev[name] ? { ...prev, [name]: null } : prev));
  };

  const handleSubmit = async event => {
    event.preventDefault();
    setSubmitError("");

    const visibleFields = sections.flatMap(section => section.fields).filter(field => isFieldVisible(field, values));
    const nextErrors = {};
    visibleFields.forEach(field => {
      const message = validateFieldValue(field, values[field.name]);
      if (message) nextErrors[field.name] = message;
    });

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setSubmitting(true);
    try {
      await submitWebsiteForm({
        form: config,
        formType: `immigration_${service.slug}`,
        source: service._doc,
        fields: visibleFields,
        values,
        metadata: {
          service_id: service.slug,
          service_slug: service.slug,
          service_name: service.title,
          service_category: service.category || "Philippine Immigration Services",
        },
      });
      setSubmitted(true);
    } catch {
      setSubmitError("Something went wrong submitting your assessment. Please try again or contact us directly.");
    } finally {
      setSubmitting(false);
    }
  };

  const [primaryAction, secondaryAction] = config.successActions || [];

  return (
    <div className="svc-form-col" id="assessment-form">
      <div className="svc-form-card">
        {submitted ? (
          <div className="svc-success">
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
          <form onSubmit={handleSubmit} noValidate>
            <div className="svc-form-head">
              <h3>
                <span className="svc-form-icon">
                  <Briefcase size={16} />
                </span>
                {config.title || "Start Your Assessment"}
              </h3>
              {config.description && <p>{config.description}</p>}
            </div>

            {sections.map((section, index) => (
              <FormSection
                key={section.id}
                section={section}
                index={index}
                values={values}
                errors={errors}
                onFieldChange={handleFieldChange}
              />
            ))}

            <button className="green-button svc-submit-btn" type="submit" disabled={submitting}>
              {submitting ? "Submitting..." : config.submitLabel || "Submit for Assessment"} {!submitting && <ArrowRight size={15} />}
            </button>
            {submitError && <p className="svc-submit-error">{submitError}</p>}
            <p className="svc-privacy-note">
              <Lock size={12} /> {config.privacyNote || "Your information is secure and will only be used to assist with your inquiry."}
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
