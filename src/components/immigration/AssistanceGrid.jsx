import React from "react";
import { getIcon } from "./icons.js";

function AssistanceCard({ icon, title, description }) {
  const Icon = getIcon(icon);
  return (
    <div className="svc-assistance-card">
      <span className="svc-assistance-icon">
        <Icon size={20} strokeWidth={1.8} />
      </span>
      <h4>{title}</h4>
      <p>{description}</p>
    </div>
  );
}

export default function AssistanceGrid({ service }) {
  const items = service.assistanceItems || [];
  if (items.length === 0) return null;
  return (
    <section className="svc-assistance">
      <div className="svc-section-heading">
        <h2>How Airfair Can Help</h2>
        <p>{service.assistanceSubtext || "We provide end-to-end assistance to make the process smoother for you."}</p>
      </div>
      <div className="svc-assistance-grid">
        {items.map((item, index) => (
          <AssistanceCard key={index} icon={item.icon} title={item.title} description={item.description} />
        ))}
      </div>
    </section>
  );
}
