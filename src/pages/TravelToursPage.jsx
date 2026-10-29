import React, { useEffect, useMemo, useState } from "react";
import VeSection, { sectionRenderer } from "../components/visual/VeSection.jsx";
import CardIntro from "../components/CardIntro.jsx";
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
      <main id="main-content">
      {page.visible("hero") && <VeSection doc="page:travel-hub" k="hero"><TravelToursHeader fields={page.section("hero")} /></VeSection>}
      <CardIntro path="/travel-tours" />
      {page.visible("search") && (
        <VeSection doc="page:travel-hub" k="search"><TravelSearchBar
          fields={searchFields}
          value={search}
          onChange={setSearch}
          travelDate={travelDate}
          onTravelDateChange={setTravelDate}
          travelers={travelers}
          onTravelersChange={setTravelers}
        /></VeSection>
      )}
      {page.visible("destinations") && <VeSection doc="page:travel-hub" k="destinations"><PopularDestinations fields={page.section("destinations")} destinations={filteredDestinations} /></VeSection>}
      {page.visible("featured") && <VeSection doc="page:travel-hub" k="featured"><FeaturedPackages fields={page.section("featured")} packages={travelPackages.filter(pkg => pkg.featured)} /></VeSection>}
      {page.visible("promoBanner") && <VeSection doc="page:travel-hub" k="promoBanner"><TravelCTA fields={page.section("promoBanner")} /></VeSection>}
      </main>
      <Footer settings={settings} />
      <ChatWidget code={settings.chat_widget_code} />
    </div>
  );
}
