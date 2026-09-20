import React from "react";
import DestinationCard from "./DestinationCard.jsx";

export default function PopularDestinations({ destinations }) {
  return (
    <section id="destinations" className="section-shell tt-section">
      <div className="section-heading-row">
        <div className="section-title">
          <h2>Popular Destinations</h2>
          <p>Explore our most in-demand travel destinations.</p>
        </div>
        <a className="view-all" href="/travel-tours">
          View All Destinations →
        </a>
      </div>

      {destinations.length > 0 ? (
        <div className="tt-dest-grid">
          {destinations.map(destination => (
            <DestinationCard key={destination.slug} destination={destination} />
          ))}
        </div>
      ) : (
        <p className="visa-empty-state">No destinations found. Try another search.</p>
      )}
    </section>
  );
}
