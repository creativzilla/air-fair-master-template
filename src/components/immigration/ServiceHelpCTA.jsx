import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, MessageCircle, Plane } from "lucide-react";
import { useGlobalContent } from "../../lib/cms.js";

export default function ServiceHelpCTA() {
  const cta = useGlobalContent().shared?.immigrationHelpCta || {};
  return (
    <section className="pis-cta section-shell">
      <div className="pis-cta-banner">
        <div className="pis-cta-content">
          <h2>{cta.heading}</h2>
          <p>{cta.body}</p>
          <div className="pis-cta-actions">
            <a className="green-button" href={cta.primaryCta?.href}>
              {cta.primaryCta?.label} <MessageCircle size={15} />
            </a>
            <Link className="outline-green-button" to={cta.secondaryCta?.href || "/philippine-immigration-services"}>
              {cta.secondaryCta?.label} <ArrowRight size={15} />
            </Link>
          </div>
        </div>
        <Plane className="pis-cta-decor" size={44} aria-hidden="true" />
      </div>
    </section>
  );
}
