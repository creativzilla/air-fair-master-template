// "Ads" on a service's Content tab: images shown above the service's inquiry
// form. One image shows as is; two or more rotate automatically on the page.
// Saved with the page draft (Save draft / Publish).
import React, { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";
import { T, fontBody, FieldLabel, ImagePickerButton, Notice, Panel, ToggleRow, inputStyle } from "./ui.jsx";
import { imageSrc } from "../lib/cmsAdapters.js";
import { fetchTravelPoster } from "../lib/travelPosters.js";

const safeHref = href => !href || /^(https:\/\/|\/(?!\/))/i.test(href.trim());

// The poster visa/travel pages show when there are no ads (unchanged behaviour).
function useStandardPoster(kind, slug, draft) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    if (kind !== "visa_destination" && kind !== "travel_package") { setUrl(null); return undefined; }
    let cancelled = false;
    const storageSlug = kind === "visa_destination" ? `visa-${slug}` : slug;
    const fallback = imageSrc(draft?.poster) || `/${kind === "visa_destination" ? "visa-posters" : "travel-posters"}/${slug}.jpg`;
    fetchTravelPoster(storageSlug).then(u => !cancelled && setUrl(u || fallback)).catch(() => !cancelled && setUrl(fallback));
    return () => { cancelled = true; };
  }, [kind, slug, draft?.poster]);
  return url;
}

export default function AdsEditor({ kind, slug, draft, onChange }) {
  const ads = Array.isArray(draft?.ads) ? draft.ads : [];
  const hidden = !!draft?.adsHidden;
  const standard = useStandardPoster(kind, slug, draft);
  const [standardBroken, setStandardBroken] = useState(false);
  const set = (next, extra = {}) => onChange({ ...draft, ads: next, ...extra });
  const update = (i, patch) => set(ads.map((ad, j) => (j === i ? { ...ad, ...patch } : ad)));
  const move = (i, d) => { const next = [...ads]; [next[i], next[i + d]] = [next[i + d], next[i]]; set(next); };

  return (
    <Panel className="p-6 flex flex-col gap-4">
      <div>
        <h3 className="text-base font-semibold" style={{ color: T.ink, ...fontBody }}>Ads</h3>
        <p className="text-xs mt-1" style={{ color: T.muted, ...fontBody }}>
          Images shown above this page's inquiry form. One image shows on its own; two or more rotate automatically every 5 seconds (with dots to switch).
          Square images (1080 × 1080) look best. Changes go live when you publish this page.
        </p>
      </div>
      <ToggleRow label="Show ads on this page" checked={!hidden} onChange={on => set(ads, { adsHidden: on ? undefined : true })} />
      {!hidden && <>
        {ads.map((ad, i) => {
          const src = imageSrc(ad.image);
          return (
            <div key={i} className="flex gap-3 rounded-lg p-3 flex-wrap sm:flex-nowrap" style={{ border: `1px solid ${T.border}`, backgroundColor: T.bg }}>
              {src ? <img src={src} alt="" className="w-24 h-24 rounded-md object-contain shrink-0" style={{ backgroundColor: "#fff", border: `1px solid ${T.border}` }} />
                : <div className="w-24 h-24 rounded-md shrink-0" style={{ border: `1px dashed ${T.border}` }} />}
              <div className="flex-1 min-w-0 flex flex-col gap-2">
                <div className="flex items-center gap-1">
                  <span className="text-xs font-semibold flex-1" style={{ color: T.ink, ...fontBody }}>Ad {i + 1}{ads.length > 1 ? ` of ${ads.length}` : ""}</span>
                  <button type="button" aria-label="Move up" title="Move up" disabled={i === 0} onClick={() => move(i, -1)} className="p-1" style={{ color: i === 0 ? T.border : T.muted }}><ArrowUp size={14} /></button>
                  <button type="button" aria-label="Move down" title="Move down" disabled={i === ads.length - 1} onClick={() => move(i, 1)} className="p-1" style={{ color: i === ads.length - 1 ? T.border : T.muted }}><ArrowDown size={14} /></button>
                  <button type="button" aria-label="Remove ad" title="Remove ad" onClick={() => set(ads.filter((_, j) => j !== i))} className="p-1" style={{ color: T.danger }}><Trash2 size={14} /></button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div><FieldLabel>Alt text</FieldLabel><input value={ad.alt || ""} onChange={e => update(i, { alt: e.target.value })} placeholder="Describe the ad for screen readers" className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={inputStyle} /></div>
                  <div><FieldLabel>Link (optional)</FieldLabel><input value={ad.href || ""} onChange={e => update(i, { href: e.target.value })} placeholder="/#contact or https://…" className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={{ ...inputStyle, ...(safeHref(ad.href) ? {} : { borderColor: T.danger }) }} />
                    {!safeHref(ad.href) && <p className="text-[11px] mt-1" style={{ color: T.danger, ...fontBody }}>Use a path on this site (/…) or an https:// link.</p>}</div>
                </div>
                <div><ImagePickerButton label="Replace image" onPicked={(url, media) => update(i, { image: url, alt: ad.alt || media?.alt_text || "" })} /></div>
              </div>
            </div>
          );
        })}
        <div className="flex items-center gap-3 flex-wrap">
          <ImagePickerButton label={ads.length ? "Add another ad" : "Upload or choose an ad"} onPicked={(url, media) => set([...ads, { image: url, alt: media?.alt_text || "" }])} />
          {ads.length === 1 && <span className="text-xs" style={{ color: T.muted, ...fontBody }}>Add a second ad to turn this into a slider.</span>}
        </div>
        {!ads.length && standard && !standardBroken && (
          <div className="flex items-center gap-3 rounded-lg p-3" style={{ border: `1px dashed ${T.border}` }}>
            <img src={standard} alt="" onError={() => setStandardBroken(true)} className="w-16 h-16 rounded-md object-contain shrink-0" style={{ backgroundColor: "#fff" }} />
            <p className="text-xs flex-1" style={{ color: T.muted, ...fontBody }}>No ads yet, so the page shows its standard poster (left). Add ads to replace it, or switch “Show ads” off to show nothing.</p>
            <button type="button" className="text-xs underline shrink-0" style={{ color: T.accent, ...fontBody }} onClick={() => set([{ image: standard.split("?")[0], alt: "" }])}>Use it as the first ad</button>
          </div>
        )}
        {ads.some(ad => !imageSrc(ad.image)) && <Notice tone="warn">An ad has no image; it won't be shown.</Notice>}
      </>}
    </Panel>
  );
}
