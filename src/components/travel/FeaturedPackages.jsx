import React from "react";
import TravelPackageCard from "./TravelPackageCard.jsx";

export default function FeaturedPackages({ fields = {}, packages }) {
  return (
    <section className="section-shell tt-section">
      <div className="section-heading-row">
        <div className="section-title">
          <h2>{fields.heading}</h2>
          <p>{fields.description}</p>
        </div>
        <a className="view-all" href={fields.viewAll?.href}>
          {fields.viewAll?.label}
        </a>
      </div>
      <div className="tt-dest-grid">
        {packages.map(pkg => (
          <TravelPackageCard key={pkg.slug} pkg={pkg} />
        ))}
      </div>
    </section>
  );
}
