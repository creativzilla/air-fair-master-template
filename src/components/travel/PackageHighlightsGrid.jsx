import React from "react";
import { useLabels } from "../../lib/cms.js";

export default function PackageHighlightsGrid({ items }) {
  const labels = useLabels();
  if (!items || items.length === 0) return null;

  return (
    <section className="vcp2-section">
      <div className="section-heading-row">
        <div className="section-title">
          <h2>{labels.packageHighlightsHeading}</h2>
        </div>
        <a className="view-all" href="#package-highlights">
          {labels.packageHighlightsViewAll}
        </a>
      </div>
      <div className="tt-pkg-highlight-grid" id="package-highlights">
        {items.map((item, index) => (
          <div className="tt-pkg-highlight-card" key={index}>
            <img src={item.image} alt={item.title} loading="lazy" decoding="async" />
            <div className="tt-pkg-highlight-body">
              <h4>{item.title}</h4>
              <p>{item.description}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
