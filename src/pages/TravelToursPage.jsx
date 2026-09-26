import React, { useEffect, useMemo, useState } from "react";
import { TopBars, Footer, ChatWidget, fallbackSettings, useSeo } from "./Website.jsx";
import { fetchSiteSettings } from "../lib/content.js";
import { usePage, useTravelDestinations, useTravelPackages } from "../lib/cms.js";
import TravelToursHeader from "../components/travel/TravelToursHeader.jsx";
import TravelSearchBar from "../components/travel/TravelSearchBar.jsx";
import PopularDestinations from "../components/travel/PopularDestinations.jsx";
import FeaturedPackages from "../components/travel/FeaturedPackages.jsx";
import TravelCTA from "../components/travel/TravelCTA.jsx";

// Single reusable Travel & Tours page. Copy, destinations and packages come
// from published CMS content (falling back to lib/travelDestinations.js).
export default function TravelToursPage() {
  const [settings, setSettings] = useState(fallbackSettings);
  const page = usePage("travel-hub");
  const travelDestinations = useTravelDestinations();
  const travelPackages = useTravelPackages();
  const searchFields = page.section("search");
  const [search, setSearch] = useState("");
  const [travelDate, setTravelDate] = useState("");
  const [travelers, setTravelers] = useState((searchFields.travelerOptions || [])[0] || "");

  useEffect(() => {
    (async () => {
      const settingsData = await fetchSiteSettings();
      if (settingsData) setSettings({ ...fallbackSettings, ...settingsData });
    })();
  }, []);

  useSeo(page.seo, settings);

  const filteredDestinations = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return travelDestinations;
    return travelDestinations.filter(
      item => item.name.toLowerCase().includes(term) || item.region.toLowerCase().includes(term)
    );
  }, [search, travelDestinations]);

  return (
    <div className="travel-site pis-page" aria-busy={page.loading || undefined}>
      <TopBars settings={settings} />
      {page.visible("hero") && <TravelToursHeader fields={page.section("hero")} />}
      {page.visible("search") && (
        <TravelSearchBar
          fields={searchFields}
          value={search}
          onChange={setSearch}
          travelDate={travelDate}
          onTravelDateChange={setTravelDate}
          travelers={travelers}
          onTravelersChange={setTravelers}
        />
      )}
      {page.visible("destinations") && <PopularDestinations fields={page.section("destinations")} destinations={filteredDestinations} />}
      {page.visible("featured") && <FeaturedPackages fields={page.section("featured")} packages={travelPackages.filter(pkg => pkg.featured)} />}
      {page.visible("promoBanner") && <TravelCTA fields={page.section("promoBanner")} />}
      <Footer settings={settings} />
      <ChatWidget code={settings.chat_widget_code} />
    </div>
  );
}
