import React from "react";

export default function PackageHighlightsGrid({ items }) {
  if (!items || items.length === 0) return null;

  return (
    <section className="vcp2-section">
      <div className="section-heading-row">
        <div className="section-title">
          <h2>Package Highlights</h2>
        </div>
        <a className="view-all" href="#package-highlights">
          View All Highlights →
        </a>
      </div>
      <div className="tt-pkg-highlight-grid" id="package-highlights">
        {items.map((item, index) => (
          <div className="tt-pkg-highlight-card" key={index}>
            <img src={item.image} alt={item.title} />
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
