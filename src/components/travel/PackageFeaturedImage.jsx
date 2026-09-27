import React, { useEffect, useRef, useState } from "react";
import { useAutoplay } from "../../lib/useAutoplay.js";

export default function PackageFeaturedImage({ pkg, showThumbnails = false }) {
  const images = pkg.gallery?.length
    ? pkg.gallery
    : [...new Set([pkg.image, ...(pkg.packageHighlights || []).map(item => item.image)].filter(Boolean))];
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const rootRef = useRef(null);
  const canAutoplay = useAutoplay(rootRef);

  useEffect(() => { setActive(0); }, [pkg.slug]);
  useEffect(() => {
    if (paused || !canAutoplay || images.length <= 1) return undefined;
    const timer = setInterval(() => setActive(previous => (previous + 1) % images.length), 4000);
    return () => clearInterval(timer);
  }, [paused, canAutoplay, images.length, pkg.slug]);

  return (
    <div className="tt-pkg-hero-image" ref={rootRef} onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <div className="tt-pkg-hero-slides">
        {images.map((src, index) => (
          <img key={src} src={src} alt={`${pkg.title} photo ${index + 1}`}
            className={`tt-pkg-hero-slide${index === active ? " active" : ""}`}
            loading={index === 0 ? undefined : "lazy"} decoding="async" />
        ))}
      </div>
      {(images.length > 1 || showThumbnails) && (
        <div className="tt-pkg-thumbs">
          {images.map((src, index) => (
            <button key={src} type="button"
              className={`tt-pkg-thumb${index === active ? " active" : ""}`}
              onClick={() => setActive(index)}
              aria-label={`Show photo ${index + 1} of ${images.length}`}
              aria-pressed={index === active}>
              <img src={src} alt="" loading="lazy" decoding="async" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
