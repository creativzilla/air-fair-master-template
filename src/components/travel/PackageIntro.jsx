import React from "react";

export default function PackageIntro({ pkg }) {
  return (
    <div className="vcp2-intro">
      <h1>{pkg.title}</h1>
      {pkg.subtitle && <p className="vcp2-subtitle">{pkg.subtitle}</p>}
      {pkg.description && <p className="vcp2-description">{pkg.description}</p>}
    </div>
  );
}
