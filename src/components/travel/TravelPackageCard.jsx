import React from "react";
import { ArrowUpRight } from "lucide-react";


export default function TravelPackageCard({ pkg }) {
  return (
    <a className="tt-dest-card" href={`/travel-tours/${pkg.slug}`}>
      <img className="tt-dest-photo" src={pkg.image} alt={pkg.title} loading="lazy" />
      <div className="tt-dest-shade" />
      <span className="tt-pkg-duration">{pkg.duration}</span>
      <div className="tt-dest-overlay">
        <div>
          <h3>{pkg.title}</h3>
          <p>
            From <strong>{pkg.price}</strong>
          </p>
        </div>
        <span className="tt-dest-arrow">
          <ArrowUpRight size={16} />
        </span>
      </div>
    </a>
  );
}
