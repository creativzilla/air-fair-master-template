import React from "react";
import { ArrowRight, Headset } from "lucide-react";

import { useGlobalContent } from "../../lib/cms.js";

export default function VisaSupportCard({ variant = "visa" }) {
  const card = useGlobalContent().shared?.supportCard || {};
  const description = variant === "travel" ? card.travelDescription : card.visaDescription;
  return (
    <div className="vcp-help-box">
      <span className="vcp-help-icon">
        <Headset size={20} strokeWidth={1.8} />
      </span>
      <div>
        <h4>{card.heading}</h4>
        <p>{description}</p>
        <a className="outline-green-button" href={card.cta?.href}>
          {card.cta?.label} <ArrowRight size={14} />
        </a>
      </div>
    </div>
  );
}
