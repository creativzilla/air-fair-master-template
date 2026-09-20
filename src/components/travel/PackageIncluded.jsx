import React from "react";
import { Check } from "lucide-react";

export default function PackageIncluded({ items }) {
  if (!items || items.length === 0) return null;

  return (
    <section className="vcp2-section">
      <div className="svc-section-heading">
        <h2>What's Included</h2>
      </div>
      <div className="vcp2-req-list">
        {items.map((item, index) => (
          <div className="vcp2-req-item" key={index}>
            <span className="vcp2-req-check">
              <Check size={14} strokeWidth={3} />
            </span>
            <span className="vcp2-req-title">{item}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
