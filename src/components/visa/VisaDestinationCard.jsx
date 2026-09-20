import React from "react";
import { ArrowRight } from "lucide-react";

// The single source-of-truth destination card — same markup/classes used on
// the homepage teaser grid and the full destination hub page. Do not fork
// this into a second card style; add fields to the data instead.
export default function VisaDestinationCard({ destination }) {
  const { name, slug, description, flagCode, image, cta } = destination;
  return (
    <a className="visa-assist-card" href={`/visa-assistance/${slug}`}>
      <img className="visa-assist-photo" src={image} alt={name} />
      <div className="visa-assist-shade" />
      <img className="visa-assist-icon" src="/visa-icon.png" alt="" />
      <span className="card-flag-badge">
        <img src={`https://flagcdn.com/w80/${flagCode}.png`} alt="" />
      </span>
      <div className="visa-assist-overlay">
        <h3>{name}</h3>
        <p>{description}</p>
        <span className="visa-assist-link">
          {cta || "View Requirements"} <ArrowRight size={13} />
        </span>
      </div>
    </a>
  );
}
