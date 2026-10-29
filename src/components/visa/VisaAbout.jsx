import React from "react";
import { useLabels } from "../../lib/cms.js";

export default function VisaAbout({ country }) {
  const labels = useLabels();
  const paragraphs = country.aboutParagraphs || [];
  return (
    <section className="vcp2-about visa-about-section">
      <h2>{labels.visaAboutPrefix} {country.title}</h2>
      {paragraphs.map((paragraph, index) => (
        <p key={index}>{paragraph}</p>
      ))}
    </section>
  );
}
