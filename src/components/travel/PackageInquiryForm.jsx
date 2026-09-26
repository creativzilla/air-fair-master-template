import React from "react";
import InquiryForm from "../forms/InquiryForm.jsx";

// Inquiry form for every travel package page. Fields and texts come from the
// package's published form document (shared "travel-inquiry" by default).
export default function PackageInquiryForm({ pkg, formConfig }) {
  return (
    <InquiryForm
      form={formConfig}
      formType={`travel_package_${pkg.slug}`}
      source={pkg._doc}
      titleVars={{ title: pkg.title }}
      metadata={{
        package_name: pkg.title,
        package_slug: pkg.slug,
        service_category: "Travel & Tours",
      }}
    />
  );
}
