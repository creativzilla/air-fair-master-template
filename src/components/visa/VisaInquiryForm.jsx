import React from "react";
import InquiryForm from "../forms/InquiryForm.jsx";

// Inquiry form for every visa country page. Fields and texts come from the
// country's published form document (shared "visa-inquiry" by default).
export default function VisaInquiryForm({ country, formConfig }) {
  return (
    <InquiryForm
      form={formConfig}
      formId={`visa-inquiry-${country.slug}`}
      serviceType="visa"
      formType={`visa_${country.slug}`}
      source={country._doc}
      titleVars={{ title: country.title }}
      metadata={{
        country_name: country.country,
        country_slug: country.slug,
        visa_type: country.visaType,
        service_category: "Visa Assistance",
      }}
    />
  );
}
