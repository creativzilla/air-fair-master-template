import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, MessageCircle, Plane } from "lucide-react";

export default function ServiceHelpCTA() {
  return (
    <section className="pis-cta section-shell">
      <div className="pis-cta-banner">
        <div className="pis-cta-content">
          <h2>Need More Help?</h2>
          <p>Not sure if this is the right immigration service for you? Our team is here to help.</p>
          <div className="pis-cta-actions">
            <a className="green-button" href="/#contact">
              Talk to Our Immigration Team <MessageCircle size={15} />
            </a>
            <Link className="outline-green-button" to="/philippine-immigration-services">
              View All Immigration Services <ArrowRight size={15} />
            </Link>
          </div>
        </div>
        <Plane className="pis-cta-decor" size={44} aria-hidden="true" />
      </div>
    </section>
  );
}
