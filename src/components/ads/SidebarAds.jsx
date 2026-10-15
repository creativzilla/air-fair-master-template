// Ad images above a service's inquiry form (set per service in the dashboard).
// One image: shown as is. Several: an automatic slider (5 s per ad) with dots;
// it pauses on hover/focus, when off screen or in a background tab, and for
// visitors who prefer reduced motion.
import React, { useEffect, useRef, useState } from "react";
import { optimizedSrc } from "../../lib/optimizedImages.js";
import { useAutoplay } from "../../lib/useAutoplay.js";

const INTERVAL_MS = 5000;
// Same rule as the dashboard: https links or paths on this site.
const safeHref = href => (typeof href === "string" && /^(https:\/\/|\/(?!\/))/i.test(href.trim()) ? href.trim() : "");

function Ad({ ad, title, index, total, eager }) {
  const href = safeHref(ad.href);
  const img = (
    <img src={optimizedSrc(ad.src)} alt={ad.alt || (total > 1 ? `${title} advertisement ${index + 1} of ${total}` : `${title} advertisement`)}
      width={1080} height={1080} loading={eager ? "eager" : "lazy"} decoding="async" />
  );
  if (href) {
    const external = /^https:/i.test(href);
    return <a href={href} target={external ? "_blank" : undefined} rel={external ? "noopener noreferrer" : undefined} className="tt-ad-link">{img}</a>;
  }
  return img;
}

export default function SidebarAds({ ads = [], title = "", className = "" }) {
  const list = ads.filter(ad => ad?.src);
  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);
  const ref = useRef(null);
  const canPlay = useAutoplay(ref);
  const many = list.length > 1;

  useEffect(() => { if (current >= list.length) setCurrent(0); }, [list.length, current]);
  useEffect(() => {
    if (!many || paused || !canPlay) return undefined;
    const timer = setTimeout(() => setCurrent(i => (i + 1) % list.length), INTERVAL_MS);
    return () => clearTimeout(timer);
  }, [many, paused, canPlay, current, list.length]);

  if (!list.length) return null;
  if (!many) return <div className={`tt-sidebar-poster ${className}`}><Ad ad={list[0]} title={title} index={0} total={1} eager /></div>;

  return (
    <div ref={ref} className={`tt-sidebar-poster tt-ads-slider ${className}`} role="region" aria-roledescription="carousel" aria-label={`${title} advertisements`}
      onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}>
      <div className="tt-ads-track" aria-live={paused ? "polite" : "off"}>
        {list.map((ad, i) => (
          <div key={`${ad.src}-${i}`} className={`tt-ads-slide${i === current ? " is-active" : ""}`} role="group" aria-roledescription="slide"
            aria-label={`${i + 1} of ${list.length}`} aria-hidden={i === current ? undefined : true} inert={i === current ? undefined : ""}>
            <Ad ad={ad} title={title} index={i} total={list.length} eager={i === 0} />
          </div>
        ))}
      </div>
      <div className="tt-ads-dots">
        {list.map((_ad, i) => (
          <button key={i} type="button" className={i === current ? "is-active" : ""} aria-label={`Show advertisement ${i + 1}`} aria-current={i === current || undefined} onClick={() => setCurrent(i)} />
        ))}
      </div>
    </div>
  );
}
