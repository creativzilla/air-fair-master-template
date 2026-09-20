import React from "react";

export default function PackageBreadcrumb({ pkg }) {
  return (
    <div className="section-shell vcp2-breadcrumb-wrap">
      <nav className="pis-breadcrumb" aria-label="Breadcrumb">
        <a href="/">Home</a>
        <span>/</span>
        <a href="/travel-tours">Travel and Tours</a>
        <span>/</span>
        <span className="pis-breadcrumb-current">{pkg.title}</span>
      </nav>
    </div>
  );
}
