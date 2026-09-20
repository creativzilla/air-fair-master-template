import React from "react";
import { Check } from "lucide-react";
import { getIcon } from "./icons.js";

function EligibilityCard({ icon, text }) {
  const Icon = getIcon(icon);
  return (
    <div className="svc-eligibility-card">
      <span className="svc-eligibility-icon">
        <Icon size={20} strokeWidth={1.8} aria-hidden="true" />
      </span>
      <p>{text}</p>
    </div>
  );
}

export default function EligibilityGrid({ service }) {
  const items = service.eligibility || [];
  if (items.length === 0) return null;
  const isChecklist = service.eligibilityStyle === "checklist";

  return (
    <section className="svc-eligibility">
      <div className="svc-section-heading">
        <h2>{service.eligibilityHeading || "Who Is This For?"}</h2>
        <p>{service.eligibilitySubtext || "This service is for foreign nationals who:"}</p>
      </div>
      {isChecklist ? (
        <ul className="svc-eligibility-checklist">
          {items.map((item, index) => (
            <li key={index}>
              <span className="svc-check-bullet">
                <Check size={12} strokeWidth={3} />
              </span>
              <span>{item.text}</span>
            </li>
          ))}
        </ul>
      ) : (
        <div className="svc-eligibility-grid">
          {items.map((item, index) => (
            <EligibilityCard key={index} icon={item.icon} text={item.text} />
          ))}
        </div>
      )}
    </section>
  );
}
