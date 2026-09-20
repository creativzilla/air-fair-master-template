import React from "react";
import { getIcon } from "./icons.js";

export default function WhyChooseSection({ service }) {
  const data = service.whyChooseAirfair;
  if (!data) return null;
  const points = data.points || [];

  return (
    <section className="svc-why">
      <div className="svc-section-heading">
        <h2>{data.title || "Why Choose Airfair?"}</h2>
      </div>
      <p className="svc-why-paragraph">{data.paragraph}</p>
      {points.length > 0 && (
        <div className="svc-why-points">
          {points.map((point, index) => {
            const Icon = getIcon(point.icon);
            return (
              <div className="svc-why-point" key={index}>
                <span className="svc-why-point-icon">
                  <Icon size={16} strokeWidth={1.8} />
                </span>
                <div>
                  <strong>{point.title}</strong>
                  {point.text && <span>{point.text}</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
