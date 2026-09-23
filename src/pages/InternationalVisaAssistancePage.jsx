import React, { useEffect, useMemo, useState } from "react";
import { ArrowRight, CheckCircle2, Globe, MessageCircle, Search } from "lucide-react";
import { TopBars, Footer, ChatWidget, SectionTitle, fallbackSettings } from "./Website.jsx";
import { fetchSiteSettings } from "../lib/content.js";
import { VISA_REGIONS, visaDestinations } from "../lib/visaDestinations.js";
import VisaDestinationCard from "../components/visa/VisaDestinationCard.jsx";

const heroTrustPoints = ["Trusted Guidance", "Hassle-Free Process", "More Travel Possibilities"];

function Hero() {
  return (
    <section className="pis-hero">
      <div className="section-shell pis-hero-inner">
        <div className="pis-hero-content">
          <nav className="pis-breadcrumb" aria-label="Breadcrumb">
            <a href="/">Home</a>
            <span>/</span>
            <a href="/#visa-assistance">Visa Assistance</a>
            <span>/</span>
            <span className="pis-breadcrumb-current">International Tourist Visa</span>
          </nav>

          <h1>International Tourist Visa Assistance</h1>
          <p className="pis-hero-desc">
            Explore the world with confidence. We'll help you with the application process, requirements, and guidance for your chosen destination.
          </p>
          <div className="pis-hero-actions">
            <a className="green-button" href="#destinations">
              Explore Destinations <ArrowRight size={15} />
            </a>
            <a className="outline-green-button" href="/#contact">
              <MessageCircle size={16} /> Talk to Our Visa Team
            </a>
          </div>
          <div className="visa-hero-trust-row">
            {heroTrustPoints.map(point => (
              <div key={point}>
                <CheckCircle2 size={15} /> <span>{point}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="pis-hero-media">
          <img
            src="https://images.unsplash.com/photo-1765707886539-6d57024ddc2f?auto=format&fit=crop&w=1200&q=80"
            alt="Traveler with passport and luggage at the airport"
          />
        </div>
      </div>
    </section>
  );
}

function DestinationSearch() {
  const [search, setSearch] = useState("");
  const [activeRegion, setActiveRegion] = useState("All Destinations");

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return visaDestinations.filter(item => {
      const matchesRegion = activeRegion === "All Destinations" || item.region === activeRegion;
      const matchesSearch = !term || item.name.toLowerCase().includes(term) || item.region.toLowerCase().includes(term);
      return matchesRegion && matchesSearch;
    });
  }, [search, activeRegion]);

  return (
    <section id="destinations" className="visa-search-section section-shell">
      <div className="section-heading-row">
        <SectionTitle title="Where Are You Planning to Travel?" description="Browse popular destinations and get visa assistance for your next journey." />
        <div className="visa-search-bar">
          <Search size={16} />
          <input
            placeholder="Search destination (e.g. Japan, Canada, Schengen)..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="visa-region-chips">
        {VISA_REGIONS.map(region => (
          <button
            key={region}
            type="button"
            className={`visa-region-chip${activeRegion === region ? " active" : ""}`}
            onClick={() => setActiveRegion(region)}
          >
            {region}
          </button>
        ))}
      </div>

      {filtered.length > 0 ? (
        <div className="visa-assist-grid">
          {filtered.map(item => (
            <VisaDestinationCard key={item.slug} destination={item} />
          ))}
        </div>
      ) : (
        <p className="visa-empty-state">No destinations found. Try another search or check back soon.</p>
      )}
    </section>
  );
}

function CantFindStrip() {
  return (
    <section className="visa-strip section-shell">
      <div className="visa-strip-inner">
        <div className="visa-strip-left">
          <span className="visa-strip-icon">
            <Globe size={20} />
          </span>
          <div>
            <h3>Can't find your destination?</h3>
            <p>We assist with tourist visas to many other countries. Get in touch and we'll guide you.</p>
          </div>
        </div>
        <a className="green-button" href="/#contact">
          Contact Us <ArrowRight size={15} />
        </a>
      </div>
    </section>
  );
}

export default function InternationalVisaAssistancePage() {
  const [settings, setSettings] = useState(fallbackSettings);

  useEffect(() => {
    (async () => {
      const settingsData = await fetchSiteSettings();
      if (settingsData) setSettings({ ...fallbackSettings, ...settingsData });
    })();
  }, []);

  useEffect(() => {
    document.title = `International Tourist Visa Assistance | ${settings.business_name || fallbackSettings.business_name}`;
  }, [settings.business_name]);

  return (
    <div className="travel-site pis-page">
      <TopBars settings={settings} />
      <Hero />
      <DestinationSearch />
      <CantFindStrip />
      <Footer settings={settings} />
      <ChatWidget code={settings.chat_widget_code} />
    </div>
  );
}
