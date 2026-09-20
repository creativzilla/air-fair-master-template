import React from "react";

export default function VisaAbout({ country }) {
  const paragraphs = country.aboutParagraphs || [];
  return (
    <section className="vcp2-about visa-about-section">
      <h2>About the {country.title}</h2>
      {paragraphs.map((paragraph, index) => (
        <p key={index}>{paragraph}</p>
      ))}
    </section>
  );
}
