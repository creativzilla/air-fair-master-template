import React, { useEffect, useRef, useState } from "react";
import { ArrowRight, ChevronLeft, ChevronRight, Facebook, Instagram, Linkedin, Mail, MapPin, Phone, Plane, Search, ShieldCheck, Star, X, Menu, Check } from "lucide-react";
import { fetchSiteSettings } from "../lib/content.js";
import { useForm, useGlobalContent, useHomepageTravelCards, useImmigrationCards, usePage, useTestimonials, useVisaCountries } from "../lib/cms.js";
import { imageSrc } from "../lib/cmsAdapters.js";
import { FormSubmitError, submitWebsiteForm, subscribeToNewsletter } from "../lib/formSubmit.js";
import { FormElementView, submitElementOf, useFormRunner } from "../components/forms/FormRenderer.jsx";
import { safeRedirect } from "../components/forms/InquiryForm.jsx";
import { elementId, isInput, isRow, visibleIds, walk } from "../../supabase/functions/_shared/forms/schema.ts";
import { toDestinationCard } from "../lib/visaCountries.js";
import { getIcon } from "../components/immigration/icons.js";
import VisaDestinationCard from "../components/visa/VisaDestinationCard.jsx";
import NewsEvents from "../components/NewsEvents.jsx";
import { useAutoplay } from "../lib/useAutoplay.js";
import { useFormGuard } from "../components/forms/FormGuard.jsx";
import { applyOrganizationJsonLd, applySeo, collectSsrJsonLd, collectSsrSeo, organizationJsonLd } from "../lib/seo.js";

export const colors = {
  green: "#4B9B13",
  greenDark: "#2F720E",
  greenSoft: "#EFF9D9",
  yellow: "#FFCB19",
  navy: "#102D68",
  blue: "#1E7A88",
  ink: "#102B57",
  text: "#5B6C80",
  line: "#E3E8ED",
  white: "#FFFFFF",
};

// Code defaults, overlaid with the Settings snapshot that prerendered pages
// embed (<script type="application/json" id="af-settings">; set directly on
// globalThis while prerendering), so the first paint shows the live values.
function embeddedSettings() {
  if (globalThis.__AF_SETTINGS__) return globalThis.__AF_SETTINGS__;
  try {
    const block = typeof document !== "undefined" && document.getElementById("af-settings");
    return block ? JSON.parse(block.textContent) : {};
  } catch {
    return {};
  }
}
export const fallbackSettings = {
  business_name: "Air Fair Travel & Immigration",
  contact_email: "airfairtravelandours@gmail.com",
  contact_phone: "+63 906-331-7785",
  address: "Philippines",
  facebook_url: "",
  instagram_url: "",
  linkedin_url: "",
  seo_title: "Air Fair Travel & Immigration",
  seo_description: "Expert visa, immigration, and travel services for Filipinos heading abroad.",
  currency_symbol: "₱",
  chat_widget_code: "",
  ...embeddedSettings(),
};

// Applies a page's SEO title/description (plus Open Graph/Twitter tags,
// canonical URL and share image) from the CMS; "{businessName}" in a title is
// replaced with the business name from Settings. Pages without their own
// description use the site default from Settings.
export function useSeo({ title, description, image, type, noindex } = {}, settings) {
  const businessName = settings?.business_name || fallbackSettings.business_name;
  const resolvedTitle = title ? title.replace("{businessName}", businessName) : "";
  const resolvedDescription = description || settings?.seo_description || fallbackSettings.seo_description;
  if (import.meta.env.SSR) collectSsrSeo({ title: resolvedTitle, description: resolvedDescription, image, type, noindex });
  useEffect(() => {
    applySeo({ title: resolvedTitle, description: resolvedDescription, image, type, noindex });
  }, [resolvedTitle, resolvedDescription, image, type, noindex]);
}

function ServiceCard({ icon: Icon, title, desc, slug }) {
  return <a className="immigration-card" href={slug ? `/philippine-immigration-services/${slug}` : "#contact"}>
    <div className="immigration-card-icon-tile"><Icon size={42} strokeWidth={1.8} /></div>
    <div className="immigration-card-content">
      <h3>{title}</h3>
      <p>{desc}</p>
    </div>
  </a>;
}

export function SectionTitle({ eyebrow, title, description, light = false }) {
  return <div className="section-title" style={{ color: light ? colors.white : colors.ink }}>

    <h2>{title}</h2>
    {description && <p>{description}</p>}
  </div>;
}

// Shown only while a page's content is still loading for the first time and
// no fallback exists (e.g. an item created in the dashboard). Same markup as
// the package page's existing loading state.
export function PageLoading() {
  return <div className="section-shell" style={{ padding: "120px 0", textAlign: "center", color: colors.text }} role="status"><p>Loading...</p></div>;
}

// light: the white version for dark backgrounds (footer).
function Logo({ light = false }) {
  const site = useGlobalContent();
  const logo = (light && site.logoLight) || site.logo || {};
  return <div className="logo-lockup">
    <img src={imageSrc(logo)} alt={logo.alt} className="logo-img" width="1254" height="521" />
  </div>;
}

export function TopBars({ settings }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const site = useGlobalContent();
  const nav = site.nav || {};
  return <>
    <a className="skip-link" href="#main-content">Skip to main content</a>
    <header className="main-nav">
      <div className="nav-inner">
        <a href="/#top"><Logo /></a>
        <nav className={menuOpen ? "nav-links open" : "nav-links"}>
          {(nav.items || []).map(item => <a key={item.label + item.href} href={item.href} onClick={() => setMenuOpen(false)} className={item.highlight ? "nav-green" : undefined}>{item.label}</a>)}
        </nav>
        <div className="nav-actions"><button aria-label="Search" aria-expanded={searchOpen} onClick={() => setSearchOpen(v => !v)}><Search size={15} /></button><a className="book-button" href={nav.ctaHref}>{nav.ctaLabel} <ArrowRight size={14} /></a><button className="mobile-menu" aria-label={menuOpen ? "Close menu" : "Open menu"} aria-expanded={menuOpen} onClick={() => setMenuOpen(v => !v)}>{menuOpen ? <X size={20} /> : <Menu size={20} />}</button></div>
      </div>
      {searchOpen && <div className="search-panel"><input autoFocus type="search" aria-label={nav.searchPlaceholder || "Search"} placeholder={nav.searchPlaceholder} /><X size={16} role="button" tabIndex={0} aria-label="Close search" onClick={() => setSearchOpen(false)} onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSearchOpen(false); } }} /></div>}
    </header>
  </>;
}

const HERO_IMAGE_MS = 2000;

function Hero({ fields }) {
  const slides = fields.slides || [];
  const featureIcons = fields.featureIcons || [];
  const [active, setActive] = useState(0);
  const [imageIndex, setImageIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const sectionRef = useRef(null);
  const canAutoplay = useAutoplay(sectionRef);
  const running = !paused && canAutoplay;
  const imagesInSlide = slides[active]?.images?.length || 1;
  // Background photos are only requested once they are showing or up next,
  // instead of every slide's photos on first load. Once requested they stay
  // set so the cross-fade out still works.
  const nextKey = imageIndex + 1 < imagesInSlide ? `${active}-${imageIndex + 1}` : `${(active + 1) % Math.max(slides.length, 1)}-0`;
  const [requested, setRequested] = useState(() => new Set());
  useEffect(() => {
    setRequested(prev => (prev.has(`${active}-${imageIndex}`) && prev.has(nextKey) ? prev : new Set([...prev, `${active}-${imageIndex}`, nextKey])));
  }, [active, imageIndex, nextKey]);
  const shouldLoad = key => key === `${active}-${imageIndex}` || key === nextKey || requested.has(key);
  useEffect(() => {
    if (!running || slides.length === 0) return undefined;
    const timer = setInterval(() => {
      setImageIndex(prev => {
        const nextIndex = prev + 1;
        if (nextIndex >= imagesInSlide) {
          setActive(a => (a + 1) % slides.length);
          return 0;
        }
        return nextIndex;
      });
    }, HERO_IMAGE_MS);
    return () => clearInterval(timer);
  }, [running, imagesInSlide, slides.length]);
  if (slides.length === 0) return null;
  const goToSlide = i => { setActive(i); setImageIndex(0); };
  const next = () => goToSlide((active + 1) % slides.length);
  const prev = () => goToSlide((active - 1 + slides.length) % slides.length);
  const slide = slides[active % slides.length];
  return <section id="top" ref={sectionRef} className="hero" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
    <div className="hero-bg">
      {slides.map((s, i) => (
        <div key={s.headline + s.highlight} className={i === active ? "hero-bg-slide active" : "hero-bg-slide"}>
          {(s.images || []).map((img, imgI) => <div key={imageSrc(img)} className={i === active && imgI === imageIndex ? "hero-bg-img active" : "hero-bg-img"} style={shouldLoad(`${i}-${imgI}`) ? { backgroundImage: `url(${imageSrc(img)})` } : undefined} />)}
        </div>
      ))}
      <div className="hero-bg-overlay" />
    </div>
    <button className="hero-edge-arrow left" onClick={prev} aria-label="Previous service"><ChevronLeft size={20} /></button>
    <button className="hero-edge-arrow right" onClick={next} aria-label="Next service"><ChevronRight size={20} /></button>

    <div className="hero-inner">
      <div className="hero-card" key={active} aria-live="polite">
        <div className="hero-card-top">

          <span className="hero-card-flag">{fields.flagLabel}</span>
        </div>
        <h2>{slide.headline}<span className="hero-card-highlight">{slide.highlight}</span></h2>
        <p className="hero-card-subheading">{slide.subheading}</p>
        <p className="hero-card-desc">{slide.description}</p>
        <div className="hero-trust-row">
          {(slide.features || []).map((f, i) => { const FIcon = getIcon(featureIcons[i]); return <div className="hero-trust-item" key={f}><FIcon size={15} /><span>{f}</span></div>; })}
        </div>
        <div className="hero-cta-row">
          <a href={slide.cta?.href || "#contact"} className="hero-cta">{slide.cta?.label} <ArrowRight size={15} /></a>
        </div>
      </div>
      <div className="hero-progress-track">
        {slides.map((s, i) => (
          <button key={s.headline + s.highlight} onClick={() => goToSlide(i)} className={i === active ? "hero-progress-dot active" : "hero-progress-dot"} aria-label={`Show ${s.headline}${s.highlight}`}>
            {i === active && <span className="hero-progress-fill" style={{ animationPlayState: running ? "running" : "paused" }} />}
          </button>
        ))}
      </div>
      <div className="hero-trust-strip">
        <span className="hero-trust-strip-label">{fields.trustLabel}</span>
        <div className="hero-trust-strip-items">
          {(fields.trustItems || []).map(t => { const TIcon = getIcon(t.icon); return <div key={t.label}><TIcon size={15} /><span>{t.label}</span></div>; })}
        </div>
      </div>
    </div>
  </section>;
}

function AccreditationBar({ fields }) {
  return <div className="accreditation-bar">
    <div className="section-shell accreditation-inner">
      <span className="accreditation-label">{fields.label}</span>
      <div className="accreditation-items">
        {(fields.items || []).map(a => <div className="accreditation-item" key={a.label}><img className="accreditation-logo" src={imageSrc(a.logo)} alt={a.logo?.alt || a.label} loading="lazy" decoding="async" /><div className="accreditation-item-text"><span className="accreditation-item-sub">{fields.itemSubLabel}</span><span className="accreditation-item-label">{a.label}</span></div></div>)}
      </div>
    </div>
  </div>;
}

function ServiceCategories({ fields }) {
  return <section className="category-cards section-shell" aria-labelledby="category-cards-title">
    <h2 id="category-cards-title" className="sr-only">{fields.heading || "Our services"}</h2>
    <div className="category-grid">
      {(fields.items || []).map(item => {
        const Icon = getIcon(item.icon);
        return <a className={`category-card category-card--${item.theme}`} href={item.href} key={item.title}>
          <div className="category-card-icon"><Icon size={26} strokeWidth={1.8} /></div>
          <h3>{item.title}</h3>
          <p>{item.description}</p>
          <span className="category-card-link">{fields.linkLabel} <ArrowRight size={14} /></span>
        </a>;
      })}
    </div>
  </section>;
}

function ImmigrationServices({ fields }) {
  const cards = useImmigrationCards("home");
  return <section id="our-services" className="immigration-v2">
    <div className="immigration-banner">
      <div className="section-shell immigration-header">
        <div className="immigration-header-copy">
          <h2>{fields.heading}</h2>
          <p>{fields.body}</p>
        </div>
      </div>
    </div>
    <div className="section-shell">
      <div className="immigration-grid">
        {cards.map(item => <ServiceCard key={item.title} icon={getIcon(item.icon)} title={item.title} desc={item.description} slug={item.slug} />)}
      </div>
    </div>
  </section>;
}

function SRRVBanner({ fields }) {
  return <section id="srrv" className="srrv-banner-wrap">
    <div className="section-shell">
      <div className="srrv-card">
        <div className="srrv-card-image">
          <img src={imageSrc(fields.image)} alt={fields.image?.alt} width="1122" height="1186" loading="lazy" decoding="async" />
        </div>
        <div className="srrv-card-content">
          <h2>{fields.heading}</h2>
          <p className="srrv-card-subhead">{fields.subheading}</p>
          <p className="srrv-card-desc">{fields.description}</p>
          <ul className="srrv-card-benefits">
            {(fields.benefits || []).map(b => { const Icon = getIcon(b.icon); return <li key={b.text}><span className="srrv-card-benefit-icon"><Icon size={16} /></span>{b.text}</li>; })}
          </ul>
          <div className="srrv-card-actions">
            <a className="green-button" href={fields.primaryCta?.href}>{fields.primaryCta?.label} <ArrowRight size={15} /></a>
            <a className="outline-green-button" href={fields.secondaryCta?.href}>{fields.secondaryCta?.label}<span className="sr-only"> about {fields.heading}</span></a>
          </div>
        </div>
      </div>
    </div>
  </section>;
}

function InternationalVisaAssistance({ fields }) {
  const featured = useVisaCountries().filter(country => country.featured).map(toDestinationCard);
  return <section id="visa-assistance" className="visa-assist section-shell">
    <div className="section-heading-row">
      <SectionTitle title={fields.heading} description={fields.description} />
      <a className="view-all" href={fields.viewAll?.href}>{fields.viewAll?.label}</a>
    </div>
    <div className="visa-assist-grid">
      {featured.map(item => <VisaDestinationCard key={item.slug} destination={item} />)}
    </div>
  </section>;
}

function TravelTours({ fields }) {
  const travelPackages = useHomepageTravelCards();
  return <section id="travel-tours" className="travel-tours section-shell">
    <div className="section-heading-row">
      <SectionTitle title={fields.heading} description={fields.description} />
      <a className="view-all" href={fields.viewAll?.href}>{fields.viewAll?.label}</a>
    </div>
    <div className="tours-grid">
      {travelPackages.map(item => <a className="tour-card" href={`/travel-tours/${item.slug}`} key={item.slug}>
        <img className="tour-card-photo" src={item.image} alt={item.name} loading="lazy" decoding="async" />
        <div className="tour-card-shade" />
        <img className="tour-card-icon" src={imageSrc(fields.cardIcon)} alt="" loading="lazy" decoding="async" />
        <span className="card-flag-badge"><img src={`https://flagcdn.com/w80/${item.flagCode}.webp`} alt="" loading="lazy" decoding="async" /></span>
        <div className="tour-card-overlay">
          <span className="tour-card-tag">{item.place}</span>
          <h3>{item.name}</h3>
          <p>{item.price}</p>
          <span className="tour-card-cta">{fields.cardCtaLabel} <ArrowRight size={13} /></span>
        </div>
      </a>)}
    </div>
  </section>;
}

function TrustBar({ fields }) {
  return <section className="trust-bar">
    <div className="section-shell trust-bar-inner">
      {(fields.items || []).map((item, i) => {
        const Icon = getIcon(item.icon);
        return <React.Fragment key={item.title}>
          {i > 0 && <span className="trust-bar-divider" />}
          <div className="trust-bar-item"><Icon size={18} /><div><strong>{item.title}</strong><span>{item.text}</span></div></div>
        </React.Fragment>;
      })}
    </div>
  </section>;
}

function FreeAssessment({ fields }) {
  const steps = fields.steps || [];
  return <section id="assessment" className="assessment-section assessment-process">
    <div className="section-shell assessment-layout">
      <div className="assessment-intro">
        <h2>{fields.headingLine1}<br /><span className="assessment-accent">{fields.headingAccent}</span></h2>
        <p>{fields.body}</p>
        <div className="assessment-actions"><a className="assessment-cta" href={fields.primaryCta?.href}>{fields.primaryCta?.label} <ArrowRight size={18} /></a><a className="assessment-explore" href={fields.secondaryCta?.href}>{fields.secondaryCta?.label} <ArrowRight size={17} /></a></div>
        <div className="assessment-trust-row">
          {(fields.trustItems || []).map(item => { const Icon = getIcon(item.icon); return <div key={item.label}><Icon size={18} /><span>{item.label}</span></div>; })}
        </div>
      </div>
      <ol className="assessment-steps">{steps.map((step, index) => { const Icon = getIcon(step.icon); return <li className="assessment-step" key={step.title}><span className="assessment-step-num">{String(index + 1).padStart(2, "0")}</span><h3>{step.title}</h3><p>{step.text}</p><Icon className="assessment-process-icon" size={44} strokeWidth={1.7} aria-hidden="true" /></li>; })}</ol>
    </div>
  </section>;
}


function Testimonials({ fields }) {
  const rows = useTestimonials();
  const heading = fields.heading || "";
  const stats = fields.stats || {};
  return <section id="about" className="testimonials section-shell">
    <div className="testimonials-decor">
      <div className="testimonials-map" />
      <svg className="testimonials-flight-path" viewBox="0 0 220 90" fill="none"><path d="M6 78 Q 90 6 214 24" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 6" strokeLinecap="round" /></svg>
      <Plane className="testimonials-flight-icon" size={20} />
    </div>

    <div className="section-title" style={{ textAlign: "center" }}>
      <h2>{heading.replace(/\.$/, "")}<span className="testimonials-dot">.</span></h2>
      <p>{fields.subheading}</p>
    </div>
    <div className="testimonials-grid">{rows.slice(0, 3).map((item, index) => <article className="testimonial-card" key={item.id || index}><span className="quote">“</span><p>{item.quote}</p><div className="client"><div className="client-avatar">{item.client_name.split(" ").map(part => part[0]).join("").slice(0, 2)}</div><div><strong>{item.client_name}</strong><small>{item.service_category || fields.fallbackCategory}</small></div><span className="stars">★★★★★</span></div></article>)}</div>
    <div className="testimonials-pagination"><span className="active" /><span /><span /></div>
    <div className="testimonials-stats">
      <div className="testimonials-stat"><div className="testimonials-avatar-stack">{(stats.avatarInitials || []).map(initials => <span key={initials}>{initials}</span>)}<span>+</span></div><strong>{stats.clientsValue}</strong><span>{stats.clientsLabel}</span></div>
      <span className="testimonials-stat-divider" />
      <div className="testimonials-stat"><Star size={15} fill="#FFCB19" color="#FFCB19" /><Star size={15} fill="#FFCB19" color="#FFCB19" /><Star size={15} fill="#FFCB19" color="#FFCB19" /><Star size={15} fill="#FFCB19" color="#FFCB19" /><Star size={15} fill="#FFCB19" color="#FFCB19" /><strong>{stats.ratingValue}</strong><span>{stats.ratingLabel}</span></div>
      <span className="testimonials-tagline">{fields.tagline}</span>
    </div>
  </section>;
}

function Contact({ fields, settings }) {
  const form = useForm(fields.formKey || "website-contact");
  const runner = useFormRunner(form?.schema);
  const { values, errors, onChange, submitted: sent, submitError: sendError } = runner;
  const { honeypot, guard } = useFormGuard();
  const submitEl = submitElementOf(form?.schema);
  const redirect = safeRedirect(form?.successRedirect);
  useEffect(() => { if (sent && redirect) window.location.assign(redirect); }, [sent, redirect]);
  const submit = event => {
    event.preventDefault();
    runner.run((formFields, vals, submissionId) => submitWebsiteForm({
      form, formId: "contact-home", serviceType: "general", formType: "website_inquiry", fields: formFields, values: vals, submissionId, guard: guard(),
    }), "We couldn't send your message. Please try again.");
  };
  return <section id="contact" className="contact-section"><div className="section-shell contact-layout"><div><h2>{fields.heading}</h2><p>{fields.body}</p><div className="contact-detail"><Phone size={16} /> {settings.contact_phone || fallbackSettings.contact_phone}</div><div className="contact-detail"><Mail size={16} /> {settings.contact_email || fallbackSettings.contact_email}</div><div className="contact-detail"><MapPin size={16} /> {settings.address || fallbackSettings.address}</div></div>{sent ? <div className="sent-card"><ShieldCheck size={38} /><h3>{form?.successTitle}</h3><p>{form?.successMessage}</p></div> : <form className="contact-form" onSubmit={submit}>{form?.schema && <ContactFields schema={form.schema} values={values} errors={errors} onChange={onChange} />}{honeypot}<button className="yellow-button" type="submit" disabled={runner.submitting}>{submitEl?.text || form?.submitLabel} <ArrowRight size={14} /></button>{sendError && <p className="form-send-error" role="alert">{sendError}</p>}</form>}</div></section>;
}

// Homepage contact form: text-style fields keep their compact look (no visible
// label, placeholder only); other field types and design elements use the
// standard form markup.
const COMPACT_TYPES = new Set(["text", "email", "tel", "number", "date", "textarea"]);
function ContactFields({ schema, values, errors, onChange }) {
  const visible = visibleIds(schema, values);
  const els = walk(schema).filter(l => !isRow(l.el) && visible.has(l.id) && (!l.parentId || visible.has(l.parentId))).map(l => l.el).filter(el => el.type !== "submit");
  return els.map(field => {
    const id = elementId(field);
    if (!isInput(field) || !COMPACT_TYPES.has(field.type)) return <FormElementView key={id} el={field} values={values} errors={errors} onChange={onChange} />;
    const common = {
      id: `field-${id}`, "aria-label": field.label || field.placeholder, required: field.required || undefined, placeholder: field.placeholder,
      value: values[field.name] ?? "", onChange: e => onChange(field.name, e.target.value), "aria-invalid": errors[field.name] ? true : undefined,
    };
    const input = field.type === "textarea"
      ? <textarea {...common} rows="4" />
      : <input {...common} type={field.type === "email" ? "email" : field.type === "tel" ? "tel" : field.type === "number" ? "number" : field.type === "date" ? "date" : undefined} />;
    return errors[field.name] ? <React.Fragment key={id}>{input}<p className="form-send-error" role="alert">{field.label}: {errors[field.name]}</p></React.Fragment> : <React.Fragment key={id}>{input}</React.Fragment>;
  });
}

export function Footer({ settings }) {
  const footer = useGlobalContent().footer || {};
  const businessName = settings.business_name || fallbackSettings.business_name;
  const socials = [[Facebook, settings.facebook_url, "Facebook"], [Instagram, settings.instagram_url, "Instagram"], [Linkedin, settings.linkedin_url, "LinkedIn"]];
  // null | "check_email" (confirmation sent) | "saved" (email service unavailable)
  const [subscribed, setSubscribed] = useState(null);
  const { honeypot: newsletterHoneypot, guard: newsletterGuard } = useFormGuard();
  const [subscribeError, setSubscribeError] = useState("");
  const subscribe = async event => {
    event.preventDefault();
    const email = event.currentTarget.querySelector('input[type="email"]')?.value || "";
    setSubscribeError("");
    try {
      setSubscribed(await subscribeToNewsletter(email, newsletterGuard()));
    } catch (err) {
      // Keep the form visible so the visitor can try again.
      setSubscribeError(err instanceof FormSubmitError ? err.message : "We couldn't subscribe you. Please try again.");
    }
  };
  return <footer><div className="section-shell footer-grid"><div className="footer-brand"><Logo light /><p>{footer.blurb}</p><div className="socials">{socials.map(([Icon, url, name]) => <a key={name} href={url || "#"} aria-label={`${businessName} on ${name}`}><Icon size={13} aria-hidden="true" /></a>)}</div></div>{(footer.columns || []).map(column => <div key={column.heading}><h2>{column.heading}</h2>{(column.links || []).map(item => <a key={item.label + item.href} href={item.href}>{item.label}</a>)}</div>)}<div><h2>{footer.contactHeading}</h2><a href={`tel:${settings.contact_phone}`}>☎ {settings.contact_phone || fallbackSettings.contact_phone}</a><a href={`mailto:${settings.contact_email}`}>✉ {settings.contact_email || fallbackSettings.contact_email}</a><a href="#contact">▣ {settings.address || fallbackSettings.address}</a></div><div className="footer-newsletter"><h2>{footer.newsletter?.heading}</h2><p>{footer.newsletter?.body}</p>{subscribed ? <span className="newsletter-thanks"><Check size={14} /> {subscribed === "check_email" ? (footer.newsletter?.checkEmail || "Almost done! Check your inbox to confirm.") : footer.newsletter?.thanks}</span> : <form className="newsletter-form" onSubmit={subscribe}><input required type="email" aria-label={footer.newsletter?.placeholder || "Email address"} placeholder={footer.newsletter?.placeholder} />{newsletterHoneypot}<button type="submit" aria-label="Subscribe"><ArrowRight size={14} /></button></form>}{subscribeError && <p className="form-send-error" role="alert">{subscribeError}</p>}</div></div><div className="footer-bottom section-shell"><span>{footer.copyright}</span><span>{footer.legalText}</span></div></footer>;
}

export function ChatWidget({ code }) {
  const label = useGlobalContent().shared?.chatBubbleLabel;
  useEffect(() => { if (!code?.trim()) return undefined; const script = document.createElement("script"); script.innerHTML = code; document.body.appendChild(script); return () => document.body.removeChild(script); }, [code]);
  if (code?.trim()) return null;
  return <a className="chat-bubble" href="#contact" aria-label={label}><Mail size={21} /></a>;
}

export default function Website() {
  const [settings, setSettings] = useState(fallbackSettings);
  const page = usePage("home");
  useEffect(() => { (async () => { const settingsData = await fetchSiteSettings(); if (settingsData) setSettings({ ...fallbackSettings, ...settingsData }); })(); }, []);
  useSeo({ title: settings.seo_title || fallbackSettings.seo_title, description: settings.seo_description }, settings);
  if (import.meta.env.SSR) collectSsrJsonLd(organizationJsonLd(settings));
  useEffect(() => applyOrganizationJsonLd(settings), [settings]);
  const show = (key, Section, extra = {}) => page.visible(key) && <Section fields={page.section(key)} {...extra} />;
  return <div className="travel-site" aria-busy={page.loading || undefined}><TopBars settings={settings} /><main id="main-content"><h1 className="sr-only">{`${settings.business_name || fallbackSettings.business_name}: visa, immigration and travel services`}</h1>{show("hero", Hero)}{show("accreditations", AccreditationBar)}{show("categories", ServiceCategories)}{show("immigration", ImmigrationServices)}{show("srrv", SRRVBanner)}{show("visa", InternationalVisaAssistance)}{show("travel", TravelTours)}{show("trustBar", TrustBar)}{show("assessment", FreeAssessment)}{show("testimonials", Testimonials)}{show("news", NewsEvents)}{show("contact", Contact, { settings })}</main><Footer settings={settings} /><ChatWidget code={settings.chat_widget_code} /></div>;
}
