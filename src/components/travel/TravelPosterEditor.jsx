import React, { useEffect, useState } from "react";
import { homepageTravelPackages, travelPackages } from "../../lib/travelDestinations.js";
import { visaCountries } from "../../lib/visaCountries.js";
import { fetchTravelPoster, saveTravelPoster, removeTravelPoster } from "../../lib/travelPosters.js";

const packages = [
  ...homepageTravelPackages.map(pkg => ({ ...pkg, title: pkg.name, href: `/travel-tours/${pkg.slug}` })),
  ...travelPackages.map(pkg => ({ ...pkg, href: `/travel-tours/${pkg.slug}` })),
  ...Object.values(visaCountries).map(country => ({ slug: `visa-${country.slug}`, title: country.title, href: `/visa-assistance/${country.slug}` })),
];

export default function TravelPosterEditor() {
  const [slug, setSlug] = useState(packages[0].slug);
  const [poster, setPoster] = useState(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true); setPoster(null); setMessage(""); setError("");
    fetchTravelPoster(slug).then(url => { if (!cancelled) setPoster(url); })
      .catch(() => { if (!cancelled) setError("Could not load the saved poster. Please try again."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [slug]);

  const upload = async event => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setBusy(true); setError(""); setMessage("");
    try {
      setPoster(await saveTravelPoster(slug, file));
      setMessage("Poster saved. It now appears above this package's inquiry form.");
    } catch (err) { setError(err.message || "Upload failed. Please try again."); }
    finally { setBusy(false); }
  };

  const remove = async () => {
    setBusy(true); setError(""); setMessage("");
    try { await removeTravelPoster(slug); setPoster(null); setMessage("Poster removed."); }
    catch (err) { setError(err.message || "Could not remove poster."); }
    finally { setBusy(false); }
  };

  return (
    <section className="rounded-xl border bg-white p-5" style={{ borderColor: "#E8ECE4", color: "#151A22" }}>
      <h2 className="text-base font-semibold mb-2">Travel &amp; Visa Posters</h2>
      <p className="text-sm mb-4">Attach a promotional poster above a travel package or visa assistance inquiry form. JPG, PNG, or WebP, up to 5 MB. Removing an upload restores the default poster when one is available.</p>
      <label className="text-sm block mb-2" htmlFor="poster-package">Travel package or visa assistance</label>
      <select id="poster-package" className="border rounded-lg p-2 w-full mb-4" value={slug} disabled={busy} onChange={event => setSlug(event.target.value)}>
        {packages.map(pkg => <option key={pkg.slug} value={pkg.slug}>{pkg.title}</option>)}
      </select>
      <div className="flex flex-wrap items-center gap-4">
        {poster && <img src={poster} alt="Current package poster" className="w-32 rounded-lg" style={{ maxHeight: 180, objectFit: "contain" }} />}
        <div>
          <label className="text-sm block mb-2" htmlFor="travel-poster-file">{poster ? "Replace poster" : "Upload poster"}</label>
          <input id="travel-poster-file" type="file" accept="image/jpeg,image/png,image/webp" disabled={busy || loading} onChange={upload} className="text-sm max-w-full" />
          {poster && <button type="button" onClick={remove} disabled={busy || loading} className="block text-sm mt-3 text-red-700 underline">Remove poster</button>}
        </div>
        <a className="text-sm underline" href={packages.find(pkg => pkg.slug === slug)?.href} target="_blank" rel="noreferrer">View page</a>
      </div>
      <p role="status" className="text-sm mt-3">{busy ? "Saving…" : loading ? "Loading…" : message}</p>
      {error && <p role="alert" className="text-sm text-red-700 mt-2">{error}</p>}
    </section>
  );
}
