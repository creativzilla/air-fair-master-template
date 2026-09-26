import React from "react";
import { ArrowRight, Headset } from "lucide-react";
import { useLabels } from "../../lib/cms.js";
import { getIcon } from "../immigration/icons.js";

import TravelPromoSlider from "./TravelPromoSlider.jsx";

export default function TravelToursHeader({ fields }) {
  const labels = useLabels();
  return (
    <section className="pis-hero">
      <div className="section-shell tt-hero-grid">
        <div className="pis-hero-content">
          <nav className="pis-breadcrumb" aria-label="Breadcrumb">
            <a href="/">{labels.breadcrumbHome}</a>
            <span>/</span>
            <span className="pis-breadcrumb-current">{labels.breadcrumbTravel}</span>
          </nav>


          <h1>{fields.heading}</h1>

          <p className="pis-hero-desc">
            {fields.description}
          </p>

          <div className="pis-hero-actions">
            <a className="green-button" href={fields.primaryCta?.href}>
              {fields.primaryCta?.label} <ArrowRight size={15} />
            </a>
            <a className="outline-green-button" href={fields.secondaryCta?.href}>
              <Headset size={16} /> {fields.secondaryCta?.label}
            </a>
          </div>

          <div className="visa-hero-trust-row">
            {(fields.trustPoints || []).map(point => {
              const Icon = getIcon(point.icon);
              return (
                <div key={point.label}>
                  <Icon size={15} />
                  <span>{point.label}</span>
                </div>
              );
            })}
          </div>
        </div>

        <TravelPromoSlider />
      </div>
    </section>
  );
}
