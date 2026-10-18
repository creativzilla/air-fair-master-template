import React from "react";
import DestinationCard from "./DestinationCard.jsx";

export default function PopularDestinations({ fields = {}, destinations }) {
  return (
    <section id="destinations" className="section-shell tt-section">
      <div className="section-heading-row">
        <div className="section-title">
          <h2>{fields.heading}</h2>
          <p>{fields.description}</p>
        </div>
        <a className="view-all" href={fields.viewAll?.href}>
          {fields.viewAll?.label}
        </a>
      </div>

      {destinations.length > 0 ? (
        <div className="tt-dest-grid">
          {destinations.map(destination => (
            <DestinationCard key={destination.slug} destination={destination} />
          ))}
        </div>
      ) : (
        <p className="visa-empty-state">{fields.emptyText}</p>
      )}
    </section>
  );
}
