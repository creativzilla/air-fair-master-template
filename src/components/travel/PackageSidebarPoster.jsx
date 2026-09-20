import React, { useEffect, useState } from "react";
import { fetchTravelPoster } from "../../lib/travelPosters.js";

export default function PackageSidebarPoster({ pkg, posterFolder = "travel-posters", storageSlug = pkg.slug }) {
  const [attachment, setAttachment] = useState(null);
  const [failed, setFailed] = useState(null);
  const defaultPoster = pkg.promoPoster || `/${posterFolder}/${pkg.slug}.jpg`;
  const uploaded = attachment?.slug === pkg.slug ? attachment.url : null;
  const poster = uploaded && uploaded !== failed ? uploaded : defaultPoster;

  useEffect(() => {
    let cancelled = false;
    fetchTravelPoster(storageSlug).then(url => {
      if (!cancelled) setAttachment({ slug: pkg.slug, url });
    }).catch(() => { if (!cancelled) setAttachment(null); });
    return () => { cancelled = true; };
  }, [pkg.slug, storageSlug]);

  if (!poster || poster === failed) return null;
  return (
    <a className="tt-sidebar-poster" href={poster} target="_blank" rel="noreferrer"
      aria-label={`Open ${pkg.title} promotional poster full size`}>
      <img src={poster} alt={`${pkg.title} promotional poster`} width={1080} height={1080}
        onError={() => setFailed(poster)} />
    </a>
  );
}
