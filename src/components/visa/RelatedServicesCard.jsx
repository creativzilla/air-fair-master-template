import React from "react";
import { ArrowRight } from "lucide-react";

export default function RelatedServicesCard({ items }) {
  if (!items || items.length === 0) return null;

  return (
    <>
      {items.map((item, index) => (
        <div className="vcp2-related-card" key={index}>
          {item.image && <img src={item.image} alt="" />}
          <div className="vcp2-related-card-body">
            <h4>{item.title}</h4>
            <p>{item.description}</p>
            <a className="vcp2-related-cta" href={item.ctaHref || "/#contact"}>
              {item.ctaLabel || "Learn More"} <ArrowRight size={13} />
            </a>
          </div>
        </div>
      ))}
    </>
  );
}
