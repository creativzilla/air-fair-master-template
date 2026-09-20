import React from "react";
import { getIcon } from "../immigration/icons.js";

const PALETTE = ["blue", "green", "orange", "purple"];

export default function VisaHighlights({ items }) {
  if (!items || items.length === 0) return null;

  return (
    <div className="vcp2-highlights-grid vcp2-section">
      {items.map((item, index) => {
        const Icon = getIcon(item.icon);
        const tone = PALETTE[index % PALETTE.length];
        return (
          <div className={`vcp2-highlight-card vcp2-highlight-card--${tone}`} key={index}>
            <span className="vcp2-highlight-icon">
              <Icon size={20} strokeWidth={1.8} />
            </span>
            <h4>{item.title}</h4>
            <p>{item.description}</p>
          </div>
        );
      })}
    </div>
  );
}
