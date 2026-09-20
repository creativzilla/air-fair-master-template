import React from "react";

export default function PackageAbout({ pkg }) {
  const paragraphs = pkg.aboutParagraphs || [];
  const place = pkg.title.split(",")[0];

  return (
    <section className="vcp2-about vcp2-section">
      <div>
      <h2>About {place}</h2>
      {paragraphs.map((paragraph, index) => (
        <p key={index}>{paragraph}</p>
      ))}
      {pkg.aboutDetails?.length > 0 && (
        <ul className="tt-about-details">
          {pkg.aboutDetails.map(detail => (
            <li key={detail.label}><strong>{detail.label}:</strong> {detail.value}</li>
          ))}
        </ul>
      )}
      </div>
    </section>
  );
}
