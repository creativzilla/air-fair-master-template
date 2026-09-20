import React, { useState } from "react";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { supabase, uploadFormAttachment } from "../../lib/supabase.js";
import DynamicFormField, { isFieldVisible, validateFieldValue } from "../immigration/DynamicFormField.jsx";

// Single reusable inquiry form for every visa country page — driven entirely
// by country.inquiryForm.fields. Add or change fields per country in
// lib/visaCountries.js; this component never needs to change.
export default function VisaInquiryForm({ country, formConfig }) {
  const fields = formConfig.fields || [];
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

    const nextAgreeError = agreed ? "" : "Please agree to the Privacy Policy before submitting.";

    if (Object.keys(nextErrors).length > 0 || nextAgreeError) {
      setErrors(nextErrors);
      setAgreeError(nextAgreeError);
      return;
    }

    setSubmitting(true);
    try {
      const visibleNames = new Set(visibleFields.map(field => field.name));
      const fileFields = visibleFields.filter(field => field.type === "file");
      const payload = {};

      for (const field of fields) {
        if (!visibleNames.has(field.name) || field.type === "file") continue;
        const value = values[field.name];
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
        country_name: country.country,
        country_slug: country.slug,
        visa_type: country.visaType,
        service_category: "Visa Assistance",
        source_page: typeof window !== "undefined" ? window.location.pathname : "",
        submitted_at: new Date().toISOString(),
        agreed_to_privacy_policy: true,
      };

      const { error } = await supabase.from("form_submissions").insert({
        form_type: `visa_${country.slug}`,
        name: payload.fullName || "",
        email: payload.email || "",
        phone: payload.phone || "",
        raw_data: { ...payload, ...metadata },
      });

      if (error) throw error;
      setSubmitted(true);
    } catch {
      setSubmitError("Something went wrong submitting your inquiry. Please try again or contact us directly.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="svc-form-card">
      {submitted ? (
        <div className="svc-success">
          <ShieldCheck size={40} />
          <h3>Inquiry Submitted</h3>
          <p>Thank you for your interest in the {country.title}. Our team will review your inquiry and reach out with the next steps.</p>
          <div className="svc-success-actions">
            <a className="green-button" href="/visa-assistance/international-tourist-visa">
              Explore More Destinations
            </a>
            <a className="outline-green-button" href="/#contact">
              Contact Airfair
            </a>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} noValidate>
          <div className="svc-form-head">
            <h3>Apply for {country.title}</h3>
            <p>Let our team assist you. Fill out the form below and we'll get in touch with you shortly.</p>
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
              I agree to the processing of my personal data in accordance with the <a href="/#contact">Privacy Policy</a>.
              <span className="required-mark">*</span>
            </span>
          </label>
          {agreeError && <p className="svc-field-error">{agreeError}</p>}

          <button className="green-button svc-submit-btn" type="submit" disabled={submitting}>
            {submitting ? "Submitting..." : "Submit Inquiry"} {!submitting && <ArrowRight size={15} />}
          </button>
          {submitError && <p className="svc-submit-error">{submitError}</p>}
          <p className="svc-privacy-note">
            <ShieldCheck size={12} /> Your information is safe with us.
          </p>
        </form>
      )}
    </div>
  );
}
