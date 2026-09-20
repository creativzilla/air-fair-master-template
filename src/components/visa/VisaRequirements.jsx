import React from "react";
import RequirementItem from "./RequirementItem.jsx";

export default function VisaRequirements({ country }) {
  const items = country.requirements || [];
  if (items.length === 0) return null;

  return (
    <section className="vcp2-section">
      <div className="svc-section-heading">
        <h2>Requirements</h2>
        <p>
          Prepare the following documents to apply for a {country.title}. Requirements may vary depending on your
          situation. Our team will guide you with the latest embassy guidelines.
        </p>
      </div>
      <div className="vcp2-req-list">
        {items.map((item, index) => (
          <RequirementItem key={index} requirement={item} />
        ))}
      </div>
    </section>
  );
}
