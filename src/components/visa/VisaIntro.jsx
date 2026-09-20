import React from "react";

export default function VisaIntro({ country }) {
  return (
    <div className="vcp2-intro">
      <span className="vcp2-country-pill">
        <img src={`https://flagcdn.com/w80/${country.flag}.png`} alt="" />
        {country.country}
      </span>
      <h1>{country.title}</h1>
      {country.subtitle && <p className="vcp2-subtitle">{country.subtitle}</p>}
      {country.description && <p className="vcp2-description">{country.description}</p>}
    </div>
  );
}
