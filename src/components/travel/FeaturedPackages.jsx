import React from "react";
import TravelPackageCard from "./TravelPackageCard.jsx";

export default function FeaturedPackages({ packages }) {
  return (
    <section className="section-shell tt-section">
      <div className="section-heading-row">
        <div className="section-title">
          <h2>Featured Travel Packages</h2>
          <p>Handpicked packages for your next adventure.</p>
        </div>
        <a className="view-all" href="/travel-tours">
          View All Packages →
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
