import React from "react";
import { ArrowRight, Headset } from "lucide-react";

export default function VisaSupportCard({ description = "Talk to our travel specialists for faster assistance." }) {
  return (
    <div className="vcp-help-box">
      <span className="vcp-help-icon">
        <Headset size={20} strokeWidth={1.8} />
      </span>
      <div>
        <h4>Need Help?</h4>
        <p>{description}</p>
        <a className="outline-green-button" href="/#contact">
          Contact Us <ArrowRight size={14} />
        </a>
      </div>
    </div>
  );
}
