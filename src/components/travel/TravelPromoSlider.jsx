import React, { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { travelPackages } from "../../lib/travelDestinations.js";
import TravelPromoPoster from "./TravelPromoPoster.jsx";

export default function TravelPromoSlider() {
  const [active, setActive] = useState(() => Math.max(0, travelPackages.findIndex(pkg => pkg.slug === "tokyo-japan")));
  const [playing, setPlaying] = useState(true);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(preference.matches);
    update();
    preference.addEventListener("change", update);
    return () => preference.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (!playing || hovered || focused || reducedMotion || travelPackages.length < 2) return undefined;
    const timer = setTimeout(() => setActive(index => (index + 1) % travelPackages.length), 5000);
    return () => clearTimeout(timer);
  }, [active, playing, hovered, focused, reducedMotion]);

  if (!travelPackages.length) return null;
  const current = travelPackages[active];
  const move = direction => setActive(index => (index + direction + travelPackages.length) % travelPackages.length);

  return (
    <div className="tt-promo-slider" role="region" aria-roledescription="carousel" aria-label="Travel package promotions"
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false); }}>
      <div className="tt-promo-thumbnails" aria-label="Choose a package">
        {travelPackages.map((pkg, index) => (
          <button key={pkg.slug} type="button" className={`tt-promo-thumbnail${active === index ? " active" : ""}`}
            onClick={() => setActive(index)} aria-label={`Show ${pkg.title}`} aria-pressed={active === index} title={pkg.title}>
            <img src={pkg.promoPoster || `/travel-posters/${pkg.slug}.jpg`} alt="" width={1080} height={1080} />
          </button>
        ))}
      </div>
      <div className="tt-promo-stage">
        <a className="tt-poster-link" href={`/travel-tours/${current.slug}`} aria-label={`View ${current.title} package`}>
          <TravelPromoPoster pkg={current} eager />
        </a>
        <div className="tt-promo-controls">
          <button type="button" onClick={() => move(-1)} aria-label="Previous package"><ChevronLeft size={18} /></button>
          <span>{active + 1} / {travelPackages.length} · {current.title}</span>
          {!reducedMotion && <button type="button" onClick={() => setPlaying(value => !value)} aria-label={playing ? "Pause slideshow" : "Play slideshow"}>
            {playing ? <Pause size={16} /> : <Play size={16} />}
          </button>}
          <button type="button" onClick={() => move(1)} aria-label="Next package"><ChevronRight size={18} /></button>
        </div>
      </div>
    </div>
  );
}
