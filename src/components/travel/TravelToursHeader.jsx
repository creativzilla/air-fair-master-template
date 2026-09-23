import React from "react";
import { ArrowRight, Briefcase, Headset, Plane } from "lucide-react";

import TravelPromoSlider from "./TravelPromoSlider.jsx";

const trustPoints = [
  { icon: Plane, label: "Trusted Travel Partner" },
  { icon: Briefcase, label: "Hassle-Free Process" },
  { icon: Headset, label: "Tailored Packages" },
];

export default function TravelToursHeader() {
  return (
    <section className="pis-hero">
      <div className="section-shell tt-hero-grid">
        <div className="pis-hero-content">
          <nav className="pis-breadcrumb" aria-label="Breadcrumb">
            <a href="/">Home</a>
            <span>/</span>
            <span className="pis-breadcrumb-current">Travel and Tours</span>
          </nav>


          <h1>Travel &amp; Tours Packages</h1>

          <p className="pis-hero-desc">
            Explore amazing destinations, customized travel packages, and hassle-free arrangements. We handle the
            details, so you can focus on making unforgettable memories.
          </p>

          <div className="pis-hero-actions">
            <a className="green-button" href="#destinations">
              Explore Destinations <ArrowRight size={15} />
            </a>
            <a className="outline-green-button" href="/#contact">
              <Headset size={16} /> Talk to Our Travel Team
            </a>
          </div>

          <div className="visa-hero-trust-row">
            {trustPoints.map(point => {
              const Icon = point.icon;
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
