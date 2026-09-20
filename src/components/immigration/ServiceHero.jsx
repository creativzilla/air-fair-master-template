import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, MessageCircle } from "lucide-react";

function renderTitle(title, highlight) {
  if (!highlight || !title.includes(highlight)) return title;
  const [before, after] = title.split(highlight);
  return (
    <>
      {before}
      <span className="svc-hero-highlight">{highlight}</span>
      {after}
    </>
  );
}

export default function ServiceHero({ service }) {
  return (
    <section className="pis-hero">
      <div className="section-shell pis-hero-inner">
        <div className="pis-hero-content">
          <nav className="pis-breadcrumb" aria-label="Breadcrumb">
            <Link to="/">Home</Link>
            <span>/</span>
            <Link to="/#our-services">Services</Link>
            <span>/</span>
            <Link to="/philippine-immigration-services">Philippine Immigration Services</Link>
            <span>/</span>
            <span className="pis-breadcrumb-current">{service.title}</span>
          </nav>
          <span className="eyebrow">{service.eyebrow || "PHILIPPINE IMMIGRATION SERVICES"}</span>
          <h1>{renderTitle(service.title, service.titleHighlight)}</h1>
          {service.shortDescription && <p className="pis-hero-sub">{service.shortDescription}</p>}
          {service.heroDescription && <p className="pis-hero-desc">{service.heroDescription}</p>}
          <div className="pis-hero-actions">
            <a className="green-button" href="#assessment-form">
              {service.heroPrimaryCta || "Start Your Assessment"} <ArrowRight size={15} />
            </a>
            <a className="outline-green-button" href="/#contact">
              <MessageCircle size={16} /> {service.heroSecondaryCta || "Talk to Our Team"}
            </a>
          </div>
        </div>
        <div className="pis-hero-media">
          <img src={service.heroImage} alt={service.title} />
        </div>
      </div>
    </section>
  );
}
