import React from "react";
import { ArrowUpRight } from "lucide-react";

export default function DestinationCard({ destination }) {
  return (
    <a className="tt-dest-card" href={`/travel-tours/${destination.packageSlug || destination.slug}`}>
      <img className="tt-dest-photo" src={destination.image} alt={destination.name} />
      <div className="tt-dest-shade" />
      <div className="tt-dest-overlay">
        <div>
          <h3>{destination.name}</h3>
          <p>{destination.shortDescription}</p>
        </div>
        <span className="tt-dest-arrow">
          <ArrowUpRight size={16} />
        </span>
      </div>
    </a>
  );
}
