import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, MessageCircle, Plane } from "lucide-react";
import { TopBars, Footer, ChatWidget, SectionTitle, fallbackSettings, useSeo } from "./Website.jsx";
import { fetchSiteSettings } from "../lib/content.js";
import { useImmigrationCards, useLabels, usePage } from "../lib/cms.js";
import { imageSrc } from "../lib/cmsAdapters.js";
import { getIcon } from "../components/immigration/icons.js";

function ImmigrationServiceCard({ icon: Icon, title, description, slug, linkLabel }) {
  return (
    <Link to={`/philippine-immigration-services/${slug}`} className="pis-service-card">
      <div className="pis-service-icon">
        <Icon size={26} strokeWidth={1.8} />
      </div>
      <h3>{title}</h3>
      <p>{description}</p>
      <span className="pis-service-link">
        {linkLabel} <ArrowRight size={14} />
      </span>
    </Link>
  );
}

function FeatureCard({ icon: Icon, title, description }) {
  return (
    <div className="pis-feature-card">
      <div className="pis-feature-icon">
        <Icon size={20} strokeWidth={1.8} />
      </div>
      <h4>{title}</h4>
      <p>{description}</p>
    </div>
  );
}

function Hero({ fields }) {
  const labels = useLabels();
  return (
    <section className="pis-hero">
      <div className="section-shell pis-hero-inner">
        <div className="pis-hero-content">
          <nav className="pis-breadcrumb" aria-label="Breadcrumb">
            <Link to="/">{labels.breadcrumbHome}</Link>
            <span>/</span>
            <span>{labels.breadcrumbServices}</span>
            <span>/</span>
            <span className="pis-breadcrumb-current">{labels.breadcrumbImmigration}</span>
          </nav>

          <h1>{fields.heading}</h1>
          <p className="pis-hero-sub">{fields.subheading}</p>
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

function About({ fields }) {
  return (
    <section className="pis-about section-shell">
      <div className="pis-about-grid">
        <div className="pis-about-media">
          <img
            src={imageSrc(fields.image)}
            alt={fields.image?.alt}
          />
        </div>
        <div className="pis-about-content">

          <h2>{fields.heading}</h2>
          {(fields.paragraphs || []).map((paragraph, index) => (
            <p key={index}>
              {paragraph}
            </p>
          ))}
        </div>
      </div>
    </section>
  );
}

function Services({ fields }) {
  const cards = useImmigrationCards("hub");
  return (
    <section id="services" className="pis-services">
      <div className="section-shell">
        <SectionTitle
          eyebrow="OUR SERVICES"
          title={fields.heading}
          description={fields.description}
        />
        <div className="pis-services-grid">
          {cards.map(item => (
            <ImmigrationServiceCard key={item.slug} {...item} icon={getIcon(item.icon)} linkLabel={fields.cardLinkLabel} />
          ))}
        </div>
      </div>
    </section>
  );
}

function WhyChoose({ fields }) {
  return (
    <section className="pis-why">
      <div className="section-shell">
        <SectionTitle
          eyebrow="WHY AIRFAIR"
          title={fields.heading}
          description={fields.description}
        />
        <div className="pis-feature-grid">
          {(fields.items || []).map(item => (
            <FeatureCard key={item.title} {...item} icon={getIcon(item.icon)} />
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCTA({ fields }) {
  return (
    <section className="pis-cta section-shell">
      <div className="pis-cta-banner">
        <div className="pis-cta-content">
          <h2>{fields.heading}</h2>
          <p>{fields.body}</p>
          <div className="pis-cta-actions">
            <a className="green-button" href={fields.primaryCta?.href}>
              {fields.primaryCta?.label} <ArrowRight size={15} />
            </a>
            <a className="outline-green-button" href={fields.secondaryCta?.href}>
              <MessageCircle size={16} /> {fields.secondaryCta?.label}
            </a>
          </div>
        </div>
        <Plane className="pis-cta-decor" size={44} aria-hidden="true" />
      </div>
    </section>
  );
}

export default function PhilippineImmigrationServices() {
  const [settings, setSettings] = useState(fallbackSettings);
  const page = usePage("immigration-hub");

  useEffect(() => {
    (async () => {
      const settingsData = await fetchSiteSettings();
      if (settingsData) setSettings({ ...fallbackSettings, ...settingsData });
    })();
  }, []);

  useSeo(page.seo, settings);

  const show = (key, Section) => page.visible(key) && <Section fields={page.section(key)} />;
  return (
    <div className="travel-site pis-page" aria-busy={page.loading || undefined}>
      <TopBars settings={settings} />
      {show("hero", Hero)}
      {show("about", About)}
      {show("services", Services)}
      {show("why", WhyChoose)}
      {show("cta", FinalCTA)}
      <Footer settings={settings} />
      <ChatWidget code={settings.chat_widget_code} />
    </div>
  );
}
