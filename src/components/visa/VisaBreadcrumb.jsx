import React from "react";
import { useLabels } from "../../lib/cms.js";

export default function VisaBreadcrumb({ country }) {
  const labels = useLabels();
  return (
    <div className="section-shell vcp2-breadcrumb-wrap">
      <nav className="pis-breadcrumb" aria-label="Breadcrumb">
        <a href="/">{labels.breadcrumbHome}</a>
        <span>/</span>
        <a href="/visa-assistance/international-tourist-visa">{labels.breadcrumbVisa}</a>
        <span>/</span>
        <span className="pis-breadcrumb-current">{country.title}</span>
      </nav>
    </div>
  );
}
