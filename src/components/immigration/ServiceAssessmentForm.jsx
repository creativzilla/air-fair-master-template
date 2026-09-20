import React, { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Briefcase, Lock, ShieldCheck } from "lucide-react";
import { supabase, uploadFormAttachment } from "../../lib/supabase.js";
import { isFieldVisible, validateFieldValue } from "./DynamicFormField.jsx";
import FormSection from "./FormSection.jsx";

function getAllFields(sections) {
  return sections.flatMap(section => section.fields);
}

export default function ServiceAssessmentForm({ service }) {
  const config = service.form;
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

    const allFields = getAllFields(config.sections);
    const visibleFields = allFields.filter(field => isFieldVisible(field, values));
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
      const visibleNames = new Set(visibleFields.map(field => field.name));
      const fileFields = visibleFields.filter(field => field.type === "file");
      const payload = {};

      for (const field of allFields) {
        if (!visibleNames.has(field.name)) continue;
        const value = values[field.name];
        if (field.type === "file") continue;
        if (value !== undefined && value !== "" && value !== null) payload[field.name] = value;
      }

      for (const field of fileFields) {
        const file = values[field.name];
        if (!file) continue;
        try {
          payload[field.name] = await uploadFormAttachment(file);
        } catch {
          payload[field.name] = file.name;
        }
      }

      const metadata = {
        service_id: service.slug,
        service_slug: service.slug,
        service_name: service.title,
        service_category: service.category || "Philippine Immigration Services",
        source_page: typeof window !== "undefined" ? window.location.pathname : "",
        submitted_at: new Date().toISOString(),
      };

      const { error } = await supabase.from("form_submissions").insert({
        form_type: `immigration_${service.slug}`,
        name: payload.fullName || "",
        email: payload.email || "",
        phone: payload.phone || "",
        raw_data: { ...payload, ...metadata },
      });

      if (error) throw error;
      setSubmitted(true);
    } catch {
      setSubmitError("Something went wrong submitting your assessment. Please try again or contact us directly.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="svc-form-col" id="assessment-form">
      <div className="svc-form-card">
        {submitted ? (
          <div className="svc-success">
            <ShieldCheck size={40} />
            <h3>Assessment Submitted</h3>
            <p>Thank you for providing your information. Our team will review your inquiry and contact you regarding the next steps.</p>
            <div className="svc-success-actions">
              <Link className="green-button" to="/philippine-immigration-services">
                Return to Immigration Services
              </Link>
              <a className="outline-green-button" href="/#contact">
                Contact Airfair
              </a>
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

            {config.sections.map((section, index) => (
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
