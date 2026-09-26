import React from "react";
import { imageSrc } from "../../lib/cmsAdapters.js";

export default function TravelCTA({ fields = {} }) {
  return (
    <section className="section-shell tt-cta">
      <a className="tt-promo-banner" href={fields.href}>
        <img src={imageSrc(fields.image)} alt={fields.image?.alt} />
      </a>
    </section>
  );
}
