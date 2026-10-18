import React from "react";
import RequirementItem from "./RequirementItem.jsx";
import { useLabels } from "../../lib/cms.js";
import { fillTemplate } from "../../lib/cmsAdapters.js";

export default function VisaRequirements({ country }) {
  const labels = useLabels();
  const items = country.requirements || [];
  if (items.length === 0) return null;

  return (
    <section className="vcp2-section">
      <div className="svc-section-heading">
        <h2>{labels.requirementsHeading}</h2>
        <p>
          {fillTemplate(labels.requirementsIntro, { title: country.title })}
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
