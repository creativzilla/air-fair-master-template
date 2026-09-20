import React from "react";

export default function TravelPromoPoster({ pkg, eager = false }) {
  return <img className="tt-promo-poster" src={pkg.promoPoster || `/travel-posters/${pkg.slug}.jpg`}
    alt={`${pkg.title} travel promotion: ${pkg.duration}, from ${pkg.price}. ${pkg.inclusions.map(item => item.label).join(", ")}. Air Fair Travel & Immigration.`}
    width={1080} height={1080} loading={eager ? "eager" : "lazy"} />;
}
