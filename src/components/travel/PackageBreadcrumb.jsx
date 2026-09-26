import React from "react";
import { useLabels } from "../../lib/cms.js";

export default function PackageBreadcrumb({ pkg }) {
  const labels = useLabels();
  return (
    <div className="section-shell vcp2-breadcrumb-wrap">
      <nav className="pis-breadcrumb" aria-label="Breadcrumb">
        <a href="/">{labels.breadcrumbHome}</a>
        <span>/</span>
        <a href="/travel-tours">{labels.breadcrumbTravel}</a>
        <span>/</span>
        <span className="pis-breadcrumb-current">{pkg.title}</span>
      </nav>
    </div>
  );
}
