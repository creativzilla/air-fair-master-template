import React, { useEffect, useMemo, useState } from "react";
import { TopBars, Footer, ChatWidget, fallbackSettings } from "./Website.jsx";
import { fetchSiteSettings } from "../lib/content.js";
import { travelDestinations, travelPackages } from "../lib/travelDestinations.js";
import TravelToursHeader from "../components/travel/TravelToursHeader.jsx";
import TravelSearchBar from "../components/travel/TravelSearchBar.jsx";
import PopularDestinations from "../components/travel/PopularDestinations.jsx";
import FeaturedPackages from "../components/travel/FeaturedPackages.jsx";
import TravelCTA from "../components/travel/TravelCTA.jsx";

// Single reusable Travel & Tours page. Destinations and packages all come
// from lib/travelDestinations.js — add a new entry there to expand the page
// without touching any component.
export default function TravelToursPage() {
  const [settings, setSettings] = useState(fallbackSettings);
  const [search, setSearch] = useState("");
  const [travelDate, setTravelDate] = useState("");
  const [travelers, setTravelers] = useState("1 Traveler");

  useEffect(() => {
    (async () => {
      const settingsData = await fetchSiteSettings();
      if (settingsData) setSettings({ ...fallbackSettings, ...settingsData });
    })();
  }, []);

  useEffect(() => {
    document.title = `Travel & Tours Packages | ${settings.business_name || fallbackSettings.business_name}`;
  }, [settings.business_name]);

  const filteredDestinations = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return travelDestinations;
    return travelDestinations.filter(
      item => item.name.toLowerCase().includes(term) || item.region.toLowerCase().includes(term)
    );
  }, [search]);

  return (
    <div className="travel-site pis-page">
      <TopBars settings={settings} />
      <TravelToursHeader />
      <TravelSearchBar
        value={search}
        onChange={setSearch}
        travelDate={travelDate}
        onTravelDateChange={setTravelDate}
        travelers={travelers}
        onTravelersChange={setTravelers}
      />
      <PopularDestinations destinations={filteredDestinations} />
      <FeaturedPackages packages={travelPackages.filter(pkg => pkg.featured)} />
      <TravelCTA />
      <Footer settings={settings} />
      <ChatWidget code={settings.chat_widget_code} />
    </div>
  );
}
