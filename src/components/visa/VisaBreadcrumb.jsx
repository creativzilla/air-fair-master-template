import React from "react";

export default function VisaBreadcrumb({ country }) {
  return (
    <div className="section-shell vcp2-breadcrumb-wrap">
      <nav className="pis-breadcrumb" aria-label="Breadcrumb">
        <a href="/">Home</a>
        <span>/</span>
        <a href="/visa-assistance/international-tourist-visa">Visa Assistance</a>
        <span>/</span>
        <span className="pis-breadcrumb-current">{country.title}</span>
      </nav>
    </div>
  );
}
