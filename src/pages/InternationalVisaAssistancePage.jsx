import React, { useEffect, useMemo, useState } from "react";
import { ArrowRight, CheckCircle2, Globe, MessageCircle, Search } from "lucide-react";
import { TopBars, Footer, ChatWidget, SectionTitle, fallbackSettings, useSeo } from "./Website.jsx";
import { fetchSiteSettings } from "../lib/content.js";
import { useLabels, usePage, useVisaCountries } from "../lib/cms.js";
import { imageSrc } from "../lib/cmsAdapters.js";
import { toDestinationCard } from "../lib/visaCountries.js";
import VisaDestinationCard from "../components/visa/VisaDestinationCard.jsx";

function Hero({ fields }) {
  const labels = useLabels();
  return (
    <section className="pis-hero">
      <div className="section-shell pis-hero-inner">
        <div className="pis-hero-content">
          <nav className="pis-breadcrumb" aria-label="Breadcrumb">
            <a href="/">{labels.breadcrumbHome}</a>
            <span>/</span>
            <a href={fields.breadcrumbParent?.href}>{fields.breadcrumbParent?.label}</a>
            <span>/</span>
            <span className="pis-breadcrumb-current">{fields.breadcrumbCurrent}</span>
          </nav>

          <h1>{fields.heading}</h1>
          <p className="pis-hero-desc">
            {fields.description}
          </p>
          <div className="pis-hero-actions">
            <a className="green-button" href={fields.primaryCta?.href}>
              {fields.primaryCta?.label} <ArrowRight size={15} />
            </a>
            <a className="outline-green-button" href={fields.secondaryCta?.href}>
              <MessageCircle size={16} /> {fields.secondaryCta?.label}
            </a>
          </div>
          <div className="visa-hero-trust-row">
            {(fields.trustPoints || []).map(point => (
              <div key={point}>
                <CheckCircle2 size={15} /> <span>{point}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="pis-hero-media">
          <img
            src={imageSrc(fields.image)}
            alt={fields.image?.alt}
          />
        </div>
      </div>
    </section>
  );
}

function DestinationSearch({ fields }) {
  const regions = fields.regions || [];
  const allLabel = regions[0] || "All Destinations";
  const [search, setSearch] = useState("");
  const [activeRegion, setActiveRegion] = useState(allLabel);
  const countries = useVisaCountries();
  const visaDestinations = useMemo(() => countries.map(toDestinationCard), [countries]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return visaDestinations.filter(item => {
      const matchesRegion = activeRegion === allLabel || item.region === activeRegion;
      const matchesSearch = !term || item.name.toLowerCase().includes(term) || item.region.toLowerCase().includes(term);
      return matchesRegion && matchesSearch;
    });
  }, [search, activeRegion, allLabel, visaDestinations]);

  return (
    <section id="destinations" className="visa-search-section section-shell">
      <div className="section-heading-row">
        <SectionTitle title={fields.heading} description={fields.description} />
        <div className="visa-search-bar">
          <Search size={16} />
          <input
            placeholder={fields.searchPlaceholder}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="visa-region-chips">
        {regions.map(region => (
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
        <p className="visa-empty-state">{fields.emptyText}</p>
      )}
    </section>
  );
}

function CantFindStrip({ fields }) {
  return (
    <section className="visa-strip section-shell">
      <div className="visa-strip-inner">
        <div className="visa-strip-left">
          <span className="visa-strip-icon">
            <Globe size={20} />
          </span>
          <div>
            <h3>{fields.heading}</h3>
            <p>{fields.body}</p>
          </div>
        </div>
        <a className="green-button" href={fields.cta?.href}>
          {fields.cta?.label} <ArrowRight size={15} />
        </a>
      </div>
    </section>
  );
}

export default function InternationalVisaAssistancePage() {
  const [settings, setSettings] = useState(fallbackSettings);
  const page = usePage("visa-hub");

  useEffect(() => {
    (async () => {
      const settingsData = await fetchSiteSettings();
      if (settingsData) setSettings({ ...fallbackSettings, ...settingsData });
    })();
  }, []);

  useSeo({ title: page.seo.title || "International Tourist Visa Assistance | {businessName}", description: page.seo.description }, settings);

  const show = (key, Section) => page.visible(key) && <Section fields={page.section(key)} />;
  return (
    <div className="travel-site pis-page" aria-busy={page.loading || undefined}>
      <TopBars settings={settings} />
      {show("hero", Hero)}
      {show("destinations", DestinationSearch)}
      {show("cantFind", CantFindStrip)}
      <Footer settings={settings} />
      <ChatWidget code={settings.chat_widget_code} />
    </div>
  );
}
