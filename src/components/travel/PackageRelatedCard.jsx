import React from "react";
import { ArrowRight } from "lucide-react";
import { useLabels } from "../../lib/cms.js";

export default function PackageRelatedCard({ related }) {
  const labels = useLabels();
  if (!related) return null;

  return (
    <a className="tt-related-card" href={related.ctaHref || "/travel-tours"}>
      <img src={related.image} alt="" />
      <div className="tt-related-shade" />
      <div className="tt-related-body">
        <h4>{related.title}</h4>
        <p>{related.description}</p>
        <span className="tt-related-cta">
          {related.ctaLabel || labels.relatedCtaFallback} <ArrowRight size={13} />
        </span>
      </div>
    </a>
  );
}
