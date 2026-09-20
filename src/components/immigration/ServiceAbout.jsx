import React from "react";

export default function ServiceAbout({ service }) {
  const paragraphs = service.aboutParagraphs || [];
  const hasImage = !!service.aboutImage;

  const content = (
    <div className={hasImage ? "svc-about-content" : "svc-about-content svc-about-content-full"}>
      <h2>{service.aboutTitle || service.title}</h2>
      {paragraphs.map((paragraph, index) => (
        <p key={index}>{paragraph}</p>
      ))}
    </div>
  );

  return (
    <section className="svc-about">
      <span className="eyebrow">{service.aboutEyebrow || "ABOUT THIS SERVICE"}</span>
      {hasImage ? (
        <div className="svc-about-grid">
          <div className="svc-about-media">
            <img src={service.aboutImage} alt={service.aboutTitle || service.title} />
          </div>
          {content}
        </div>
      ) : (
        content
      )}
    </section>
  );
}
