import React from "react";
import { Check } from "lucide-react";

export default function RequirementItem({ requirement }) {
  return (
    <div className="vcp2-req-item">
      <span className="vcp2-req-check">
        <Check size={14} strokeWidth={3} />
      </span>
      <span className="vcp2-req-title">{requirement.title}</span>
    </div>
  );
}
