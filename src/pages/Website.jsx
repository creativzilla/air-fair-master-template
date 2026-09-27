import React, { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowRight, Award, CheckCircle2, ChevronLeft, ChevronRight, Compass, Facebook, FileCheck, Globe, Headphones, Heart, Instagram, Landmark, Linkedin, Lock, LogOut, Mail, MapPin, MessageCircle, Phone, Plane, PlayCircle, RefreshCw, Scale, Search, ShieldCheck, Star, Ticket, IdCard, Users, X, Menu, Check, CalendarDays } from "lucide-react";
import { supabase } from "../lib/supabase.js";
import { useParams } from "react-router-dom";
import { dbRowToService, getPriceLabel } from "../lib/catalog.js";
import { fetchPublishedPages, fetchPublishedTestimonials, fetchSiteSettings } from "../lib/content.js";

const colors = {
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

const fallbackSettings = {
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
};

const heroSlides = [
  {
    tag: "Most Requested", icon: Landmark,
    headline: "Special Resident ", highlight: "Retiree's Visa",
    subheading: "Retire where the tropics feel like home.",
    description: "Live in the Philippines permanently — unlimited travel, no annual reporting, and government discounts.",
    features: ["Lifetime Residency", "PRA-Accredited Process", "Trusted by Retirees"],
    cta: "Start Your SRRV Application",
    image: "https://images.unsplash.com/photo-1509233725247-49e657c54213?auto=format&fit=crop&w=1600&q=80",
  },
  {
    tag: "Work Visa", icon: BriefcaseIcon,
    headline: "9G Working ", highlight: "Visa",
    subheading: "Build your career on Philippine soil.",
    description: "Legally work for a Philippine-registered company, with full DOLE and Bureau of Immigration processing handled for you.",
    features: ["Employer Coordination", "DOLE & BI Compliant", "Renewal Assistance"],
    cta: "Start Your 9G Work Visa",
    image: "https://images.unsplash.com/photo-1542744173-8e7e53415bb0?auto=format&fit=crop&w=1600&q=80",
  },
  {
    tag: "Family & Marriage", icon: Users,
    headline: "13A ", highlight: "Spousal Visa",
    subheading: "Build your future together in the Philippines.",
    description: "Permanent residency for foreign spouses of Filipino citizens — from conditional status to permanent, with expert guidance every step of the way.",
    features: ["Expert Guidance", "Hassle-Free Processing", "Trusted by Thousands"],
    cta: "Start Your 13A Visa Process",
    image: "https://images.unsplash.com/photo-1638548725690-af8d0fab0653?auto=format&fit=crop&w=1600&q=80",
  },
  {
    tag: "Short-Term Stay", icon: Ticket,
    headline: "Tourist Visa ", highlight: "Extension",
    subheading: "Stay longer, stress less.",
    description: "Extend your stay in the Philippines without leaving the country — we handle the Bureau of Immigration queue.",
    features: ["No Need to Leave PH", "Fast BI Processing", "Flexible Extensions"],
    cta: "Extend My Tourist Visa",
    image: "https://images.unsplash.com/photo-1663271784319-ecc97ce8d4aa?auto=format&fit=crop&w=1600&q=80",
  },
  {
    tag: "Required for Long-Stay", icon: IdCard,
    headline: "ACR I-Card ", highlight: "Registration",
    subheading: "Your legal stay, officially documented.",
    description: "The biometric ID required for foreign nationals staying more than 59 days — application and renewal, handled.",
    features: ["Biometric ID Handled", "Required Compliance", "Renewal Reminders"],
    cta: "Apply for ACR I-Card",
    image: "https://images.unsplash.com/photo-1581553673739-c4906b5d0de8?auto=format&fit=crop&w=1600&q=80",
  },
];

const heroFeatureIcons = [ShieldCheck, FileCheck, Users];

const heroTrustStrip = [
  { icon: Plane, label: "Travel" },
  { icon: Users, label: "Family" },
  { icon: Compass, label: "Opportunity" },
  { icon: Heart, label: "A Brighter Tomorrow" },
];

const accreditations = [
  { icon: Landmark, label: "Philippine Retirement Authority" },
  { icon: ShieldCheck, label: "Bureau of Immigration" },
  { icon: Award, label: "Dept. of Labor and Employment" },
];

const serviceShowcase = [
  { name: "Special Resident Retiree's Visa", tag: "Most Requested", description: "Permanent residency for retirees, with unlimited travel and no annual reporting.", icon: Landmark, image: "https://images.unsplash.com/photo-1509233725247-49e657c54213?auto=format&fit=crop&w=800&q=80", slug: "srrv" },
  { name: "Pre-Arranged Working Visa (9G)", tag: "Work Visa", description: "Full DOLE and Bureau of Immigration processing for foreign employees.", icon: BriefcaseIcon, image: "https://images.unsplash.com/photo-1542744173-8e7e53415bb0?auto=format&fit=crop&w=800&q=80", slug: "9g-working-visa" },
  { name: "13A Spousal Visa", tag: "Family & Marriage", description: "Permanent residency for foreign spouses of Filipino citizens.", icon: Users, image: "https://images.unsplash.com/photo-1591604466107-ec97de577aff?auto=format&fit=crop&w=800&q=80", slug: "13a-spousal-visa" },
  { name: "Tourist Visa Extension", tag: "Short-Term Stay", description: "Extend your stay in the Philippines without leaving the country.", icon: Ticket, image: "https://images.unsplash.com/photo-1663271784319-ecc97ce8d4aa?auto=format&fit=crop&w=800&q=80", slug: "tourist-visa-extension" },
  { name: "ACR I-Card Registration", tag: "Required for Long-Stay", description: "Biometric ID application and renewal for foreign nationals staying 59+ days.", icon: IdCard, image: "https://images.unsplash.com/photo-1581553673739-c4906b5d0de8?auto=format&fit=crop&w=800&q=80", slug: "acr-i-card" },
  { name: "In-House Legal Counsel", tag: "Expert Guidance", description: "One-on-one consultation with our in-house immigration lawyer on your case.", icon: Scale, image: "https://images.unsplash.com/photo-1780733064275-d1ade9b83a3d?auto=format&fit=crop&w=800&q=80", slug: "legal-consultation" },
];

const additionalServices = [
  { icon: Globe, code: "Dual Citizenship (RA 9225)", text: "Guided re-acquisition of Filipino citizenship for former natural-born citizens.", color: "green", badge: "Popular" },
  { icon: LogOut, code: "Emigration Clearance (ECC)", text: "Fast-tracked ECC processing for foreign nationals who have stayed 6 months or longer.", color: "blue" },
  { icon: AlertTriangle, code: "Overstay Resolution", text: "Fine computation and Motion for Reconsideration filing for visa violations.", color: "amber" },
  { icon: RefreshCw, code: "SRRV ID Renewal", text: "Annual Philippine Retirement Authority renewal handled on your behalf.", color: "green" },
  { icon: MessageCircle, code: "Free Visa Consultation", text: "A one-on-one review of your documents and eligibility before you apply.", color: "green" },
  { icon: ShieldCheck, code: "Immigration Processing", text: "End-to-end assistance for any immigrant visa or permanent residence application.", color: "blue" },
];

function BriefcaseIcon(props) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" {...props}><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18M10 12v2h4v-2" /></svg>;
}

function SectionTitle({ eyebrow, title, description, light = false }) {
  return <div className="section-title" style={{ color: light ? colors.white : colors.ink }}>
    {eyebrow && <span className="eyebrow">{eyebrow}</span>}
    <h2>{title}</h2>
    {description && <p>{description}</p>}
  </div>;
}

function Logo({ light = false }) {
  return <div className="logo-lockup">
    <img src="/airfair_logo_colored.png" alt="Air Fair Travel & Tours" className="logo-img" />
  </div>;
}

function TopBars({ settings }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const businessName = settings.business_name || fallbackSettings.business_name;
  return <>
    <div className="browser-bar"><span className="browser-dot">A</span><span>{businessName} — Website</span><span className="browser-actions">◌　□　<span>Make a copy</span><b>Share</b></span></div>
    <div className="promise-bar"><span>✦ Free Cancellation within 24 hrs</span><span>Best Price Guarantee</span><span>Secure Booking</span><span>24/7 Customer Support</span></div>
    <header className="main-nav">
      <div className="nav-inner">
        <a href="#top"><Logo /></a>
        <nav className={menuOpen ? "nav-links open" : "nav-links"}>
          <a href="#top" onClick={() => setMenuOpen(false)}>Home</a><a href="#our-services" onClick={() => setMenuOpen(false)}>Our Services</a><a href="#assessment" onClick={() => setMenuOpen(false)}>Free Assessment</a><a href="#services" onClick={() => setMenuOpen(false)} className="nav-green">Visa &amp; Immigration</a><a href="#about" onClick={() => setMenuOpen(false)}>About Us</a><a href="#contact" onClick={() => setMenuOpen(false)}>Contact</a>
        </nav>
        <div className="nav-actions"><button aria-label="Search" onClick={() => setSearchOpen(v => !v)}><Search size={15} /></button><a className="book-button" href="#contact">Book Now <ArrowRight size={14} /></a><button className="mobile-menu" aria-label="Menu" onClick={() => setMenuOpen(v => !v)}>{menuOpen ? <X size={20} /> : <Menu size={20} />}</button></div>
      </div>
      {searchOpen && <div className="search-panel"><input autoFocus placeholder="Search visa and immigration services" /><X size={16} onClick={() => setSearchOpen(false)} /></div>}
    </header>
  </>;
}

function Hero() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused) return undefined;
    const timer = setInterval(() => setActive(v => (v + 1) % heroSlides.length), 6500);
    return () => clearInterval(timer);
  }, [paused]);
  const next = () => setActive(v => (v + 1) % heroSlides.length);
  const prev = () => setActive(v => (v - 1 + heroSlides.length) % heroSlides.length);
  const slide = heroSlides[active];
  const Icon = slide.icon;
  return <section id="top" className="hero" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
    <div className="hero-bg">
      {heroSlides.map((s, i) => <div key={s.headline + s.highlight} className={i === active ? "hero-bg-img active" : "hero-bg-img"} style={{ backgroundImage: `url(${s.image})` }} />)}
      <div className="hero-bg-overlay" />
    </div>
    <button className="hero-edge-arrow left" onClick={prev} aria-label="Previous service"><ChevronLeft size={20} /></button>
    <button className="hero-edge-arrow right" onClick={next} aria-label="Next service"><ChevronRight size={20} /></button>

    <div className="hero-inner">
      <div className="hero-card" key={active} aria-live="polite">
        <div className="hero-card-top">
          <div className="hero-card-badge"><div className="hero-card-icon"><Icon size={22} /></div><span className="hero-card-tag">{slide.tag}</span></div>
          <span className="hero-card-flag">PHILIPPINES 🇵🇭</span>
        </div>
        <h1>{slide.headline}<span className="hero-card-highlight">{slide.highlight}</span></h1>
        <p className="hero-card-subheading">{slide.subheading}</p>
        <p className="hero-card-desc">{slide.description}</p>
        <div className="hero-trust-row">
          {slide.features.map((f, i) => { const FIcon = heroFeatureIcons[i]; return <div className="hero-trust-item" key={f}><FIcon size={15} /><span>{f}</span></div>; })}
        </div>
        <div className="hero-cta-row">
          <a href="#contact" className="hero-cta">{slide.cta} <ArrowRight size={15} /></a>
          <a href="#about" className="hero-story-btn">
            <span className="hero-story-icon"><PlayCircle size={16} /></span>
            <span className="hero-story-text"><strong>Watch Our Story</strong><small>Real people. Real journeys.</small></span>
          </a>
        </div>
      </div>
      <div className="hero-progress-track">
        {heroSlides.map((s, i) => (
          <button key={s.headline + s.highlight} onClick={() => setActive(i)} className={i === active ? "hero-progress-dot active" : "hero-progress-dot"} aria-label={`Show ${s.headline}${s.highlight}`}>
            {i === active && <span className="hero-progress-fill" style={{ animationPlayState: paused ? "paused" : "running" }} />}
          </button>
        ))}
      </div>
      <div className="hero-trust-strip">
        <span className="hero-trust-strip-label">Your Trusted Visa &amp; Immigration Partner</span>
        <div className="hero-trust-strip-items">
          {heroTrustStrip.map(t => { const TIcon = t.icon; return <div key={t.label}><TIcon size={15} /><span>{t.label}</span></div>; })}
        </div>
      </div>
    </div>
  </section>;
}

function AccreditationBar() {
  return <div className="accreditation-bar">
    <div className="section-shell accreditation-inner">
      <span className="accreditation-label">Officially Accredited By</span>
      <div className="accreditation-items">
        {accreditations.map(a => { const Icon = a.icon; return <div className="accreditation-item" key={a.label}><Icon size={18} /><span>{a.label}</span></div>; })}
      </div>
    </div>
  </div>;
}

function ServiceShowcaseCard({ item }) {
  const Icon = item.icon;
  return <a className="showcase-card" href="#contact">
    <img src={item.image} alt={item.name} />
    <div className="showcase-shade" />
    <div className="showcase-icon"><Icon size={18} /></div>
    <div className="showcase-overlay">
      <span className="showcase-tag">{item.tag}</span>
      <h3>{item.name}</h3>
      <p>{item.description}</p>
      <span className="showcase-link">Learn More <ArrowRight size={13} /></span>
    </div>
  </a>;
}

function OurServices() {
  return <section id="our-services" className="showcase section-shell"><div className="section-heading-row"><SectionTitle title="Our Visa & Immigration Services" description="Government-accredited processing, handled by certified immigration consultants" /><a className="view-all" href="#services">View All →</a></div><div className="showcase-grid">{serviceShowcase.map(item => <ServiceShowcaseCard key={item.slug} item={item} />)}</div></section>;
}

function FreeAssessment({ settings }) {
  const steps = [
    { icon: MessageCircle, title: "Tell Us Your Situation", text: "A quick chat about your goals, by phone, email, or in person." },
    { icon: FileCheck, title: "Get Your Document Checklist", text: "A clear, personalized list of exactly what you need." },
    { icon: CheckCircle2, title: "We Handle the Rest", text: "Preparation, filing, and follow-up until it's approved." },
  ];
  return <section id="assessment" className="assessment-section">
    <div className="assessment-decor">
      <div className="assessment-map" />
    </div>
    <div className="section-shell assessment-layout">
      <div className="assessment-intro">
        <span className="assessment-badge"><Users size={14} /> FREE CONSULTATION</span>
        <h2>Not Sure Which Visa<br /><span className="assessment-accent">You Need?<svg className="assessment-underline" viewBox="0 0 210 14" fill="none" preserveAspectRatio="none"><path d="M2 10 Q 52 2 105 8 T 208 6" stroke="#FFCB19" strokeWidth="3" strokeLinecap="round" /></svg></span></h2>
        <p>Tell us your situation and our certified consultants will recommend the right visa pathway for you — no obligation.</p>
        <div className="assessment-actions"><a className="assessment-cta" href="#contact">Get a Free Assessment →</a><a className="phone-button-dark" href={`tel:${settings.contact_phone || fallbackSettings.contact_phone}`}><Phone size={14} /> {settings.contact_phone || fallbackSettings.contact_phone}</a></div>
        <div className="assessment-trust-row">
          <div><ShieldCheck size={18} /><span>Trusted<br />Consultants</span></div>
          <span className="assessment-trust-divider" />
          <div><Users size={18} /><span>Personalized<br />Guidance</span></div>
          <span className="assessment-trust-divider" />
          <div><Lock size={18} /><span>No Obligation<br />100% Free</span></div>
        </div>
      </div>
      <div className="assessment-steps">{steps.map((s, i) => { const Icon = s.icon; return <div className="assessment-step" key={s.title}><span className="assessment-step-num">{i + 1}</span><div className="assessment-step-icon"><Icon size={22} /></div><h4>{s.title}</h4><p>{s.text}</p></div>; })}</div>
    </div>
  </section>;
}

function Services({ content, settings }) {
  const heading = content?.blocks?.heading || "Every step of your journey, covered.";
  const commaIndex = heading.lastIndexOf(",");
  return <section id="services" className="services services-redesign section-shell">
    <div className="services-copy">
      <span className="services-eyebrow">EXPERT VISA CONSULTANTS</span>
      <h2>{commaIndex > -1 ? <>{heading.slice(0, commaIndex + 1)} <span className="services-heading-accent">{heading.slice(commaIndex + 1).trim()}</span></> : heading}</h2>
      <p>Planning to study, work, retire, or settle in the Philippines — or heading abroad? Our certified immigration consultants guide you through every step of the process.</p>
      <div className="services-callout"><ShieldCheck size={18} /><span>At Air Fair, we are driven to pursue your VISA success.</span></div>
      <div className="service-buttons"><a className="green-button" href="#contact">Apply Now →</a><a className="phone-button" href={`tel:${settings.contact_phone || fallbackSettings.contact_phone}`}><Phone size={14} /> {settings.contact_phone || fallbackSettings.contact_phone}</a></div>
    </div>
    <div className="service-grid">{additionalServices.map(item => { const Icon = item.icon; return <div className="service-tile" key={item.code}>{item.badge && <span className="service-tile-badge">{item.badge}</span>}<div className={`service-tile-icon ${item.color}`}><Icon size={20} /></div><h3>{item.code}</h3><p>{item.text}</p></div>; })}</div>
  </section>;
}


function Benefits() {
  const benefits = [
    { icon: ShieldCheck, title: "Government Accredited", text: "PRA, BI & DOLE accredited" },
    { icon: Award, title: "Certified Consultants", text: "Experienced immigration specialists" },
    { icon: Lock, title: "Confidential & Secure", text: "Your case handled discreetly" },
    { icon: Headphones, title: "24/7 Support", text: "We're here whenever you need us" },
    { icon: FileCheck, title: "Transparent Process", text: "Simple steps, no hidden fees" },
  ];
  return <section className="benefits"><div className="section-shell benefits-grid">{benefits.map(b => { const Icon = b.icon; return <div key={b.title}><div className="benefit-icon"><Icon size={20} /></div><h3>{b.title}</h3><p>{b.text}</p></div>; })}</div></section>;
}

function Testimonials({ content, testimonials }) {
  const fallback = [{ client_name: "Maria Santos", quote: "Air Fair helped me get my Japan visa in just 2 weeks! Their preparation and support were professional and honest.", service_category: "Tourist Visa" }, { client_name: "James Reyes", quote: "They handled my 9G work visa from the employer paperwork to the BI interview. Smooth from start to finish.", service_category: "9G Work Visa" }, { client_name: "Ana Cruz", quote: "They processed my 13A marriage visa without any hassle. The team is knowledgeable, patient, and kept me updated throughout.", service_category: "13A Visa" }];
  const rows = testimonials.length ? testimonials : fallback;
  const heading = content?.blocks?.heading || "Trusted by travelers and families alike.";
  return <section id="about" className="testimonials section-shell">
    <div className="testimonials-decor">
      <div className="testimonials-map" />
      <svg className="testimonials-flight-path" viewBox="0 0 220 90" fill="none"><path d="M6 78 Q 90 6 214 24" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 6" strokeLinecap="round" /></svg>
      <Plane className="testimonials-flight-icon" size={20} />
    </div>
    <div className="testimonials-eyebrow"><span /> CLIENT STORIES <span /></div>
    <div className="section-title" style={{ textAlign: "center" }}>
      <h2>{heading.replace(/\.$/, "")}<span className="testimonials-dot">.</span></h2>
      <p>Real stories from clients we've guided through their visa and immigration journey.</p>
    </div>
    <div className="testimonials-grid">{rows.slice(0, 3).map((item, index) => <article className="testimonial-card" key={item.id || index}><span className="quote">“</span><p>{item.quote}</p><div className="client"><div className="client-avatar">{item.client_name.split(" ").map(part => part[0]).join("").slice(0, 2)}</div><div><strong>{item.client_name}</strong><small>{item.service_category || "Air Fair Client"}</small></div><span className="stars">★★★★★</span></div></article>)}</div>
    <div className="testimonials-pagination"><span className="active" /><span /><span /></div>
    <div className="testimonials-stats">
      <div className="testimonials-stat"><div className="testimonials-avatar-stack"><span>MC</span><span>JR</span><span>AC</span><span>+</span></div><strong>+2,500</strong><span>Happy Clients</span></div>
      <span className="testimonials-stat-divider" />
      <div className="testimonials-stat"><Star size={15} fill="#FFCB19" color="#FFCB19" /><Star size={15} fill="#FFCB19" color="#FFCB19" /><Star size={15} fill="#FFCB19" color="#FFCB19" /><Star size={15} fill="#FFCB19" color="#FFCB19" /><Star size={15} fill="#FFCB19" color="#FFCB19" /><strong>4.9/5</strong><span>Average Rating</span></div>
      <span className="testimonials-tagline">JOURNEYS TO A BRIGHTER TOMORROW</span>
    </div>
  </section>;
}

function Contact({ settings }) {
  const [form, setForm] = useState({ name: "", email: "", phone: "", message: "" });
  const [sent, setSent] = useState(false);
  const update = (key, value) => setForm(prev => ({ ...prev, [key]: value }));
  const submit = async event => { event.preventDefault(); const { error } = await supabase.from("form_submissions").insert({ form_type: "website_inquiry", name: form.name, email: form.email, phone: form.phone, raw_data: { message: form.message } }); if (!error) setSent(true); };
  return <section id="contact" className="contact-section"><div className="section-shell contact-layout"><div><span className="eyebrow yellow">LET'S PLAN YOUR JOURNEY</span><h2>Ready to make your travel dreams a reality?</h2><p>Tell us what you need and our travel experts will get back to you with the best next step.</p><div className="contact-detail"><Phone size={16} /> {settings.contact_phone || fallbackSettings.contact_phone}</div><div className="contact-detail"><Mail size={16} /> {settings.contact_email || fallbackSettings.contact_email}</div><div className="contact-detail"><MapPin size={16} /> {settings.address || fallbackSettings.address}</div></div>{sent ? <div className="sent-card"><ShieldCheck size={38} /><h3>Thank you for reaching out.</h3><p>We've received your inquiry and will contact you soon.</p></div> : <form className="contact-form" onSubmit={submit}><input required placeholder="Full name" value={form.name} onChange={e => update("name", e.target.value)} /><input required type="email" placeholder="Email address" value={form.email} onChange={e => update("email", e.target.value)} /><input placeholder="Phone number" value={form.phone} onChange={e => update("phone", e.target.value)} /><textarea rows="4" placeholder="How can we help?" value={form.message} onChange={e => update("message", e.target.value)} /><button className="yellow-button" type="submit">Send Inquiry <ArrowRight size={14} /></button></form>}</div></section>;
}

function Footer({ settings }) {
  const socials = [[Facebook, settings.facebook_url], [Instagram, settings.instagram_url], [Linkedin, settings.linkedin_url]];
  return <footer><div className="section-shell footer-grid"><div className="footer-brand"><Logo light /><p>Your trusted travel partner and visa consultant for unforgettable journeys and hassle-free immigration services.</p><div className="socials">{socials.map(([Icon, url], index) => <a key={index} href={url || "#"} aria-label="Social link"><Icon size={13} /></a>)}</div></div><div><h4>COMPANY</h4><a href="#about">About Us</a><a href="#about">Our Team</a><a href="#services">Careers</a><a href="#about">Blog</a><a href="#contact">Contact Us</a></div><div><h4>VISA SERVICES</h4><a href="#services">Tourist Visa</a><a href="#services">9G Work Visa</a><a href="#services">13A Marriage Visa</a><a href="#our-services">SRRV / Retirement</a><a href="#services">ACR-I Card</a><a href="#services">Other Services</a></div><div><h4>CONTACT US</h4><a href={`tel:${settings.contact_phone}`}>☎ {settings.contact_phone || fallbackSettings.contact_phone}</a><a href={`mailto:${settings.contact_email}`}>✉ {settings.contact_email || fallbackSettings.contact_email}</a><a href="#contact">▣ {settings.address || fallbackSettings.address}</a></div></div><div className="footer-bottom section-shell"><span>© 2025 Air Fair Travel and Tours OPC. All rights reserved.</span><span>Privacy Policy　 Terms &amp; Conditions</span></div></footer>;
}

function ChatWidget({ code }) {
  useEffect(() => { if (!code?.trim()) return undefined; const script = document.createElement("script"); script.innerHTML = code; document.body.appendChild(script); return () => document.body.removeChild(script); }, [code]);
  if (code?.trim()) return null;
  return <a className="chat-bubble" href="#contact" aria-label="Contact Air Fair"><Mail size={21} /></a>;
}

export function PackageDetailPage() {
  const { slug } = useParams();
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState(fallbackSettings);
  const [galleryIndex, setGalleryIndex] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        const [settingsData] = await Promise.all([fetchSiteSettings()]);
        if (settingsData) setSettings({ ...fallbackSettings, ...settingsData });
        const { data } = await supabase.from("services").select("*").eq("status", "Published").eq("slug", slug).maybeSingle();
        if (data) setItem(dbRowToService(data));
      } catch (err) {
      } finally {
        setLoading(false);
      }
    })();
  }, [slug]);

  useEffect(() => {
    if (item) document.title = `${item.name} | ${settings.business_name || fallbackSettings.business_name}`;
  }, [item, settings.business_name]);

  if (loading) {
    return <div className="travel-site"><TopBars settings={settings} /><div className="section-shell" style={{ padding: "120px 0", textAlign: "center", color: colors.text }}><p>Loading package details...</p></div><Footer settings={settings} /></div>;
  }

  if (!item) {
    return <div className="travel-site"><TopBars settings={settings} /><div className="section-shell" style={{ padding: "120px 0", textAlign: "center" }}><h2 style={{ color: colors.ink, fontSize: 28, marginBottom: 12 }}>Package not found</h2><p style={{ color: colors.text, marginBottom: 24 }}>We couldn't find this package. It may have been removed or unpublished.</p><a href="/" className="yellow-button">← Back to Home</a></div><Footer settings={settings} /></div>;
  }

  const currency = settings.currency_symbol || "₱";
  const galleryImages = item.gallery && item.gallery.length > 0 ? item.gallery : [item.image];
  const inclusions = item.inclusions ? item.inclusions.split("\n").filter(Boolean) : [];
  const exclusions = item.exclusions ? item.exclusions.split("\n").filter(Boolean) : [];
  const priceLabel = getPriceLabel(item, currency);

  return <div className="travel-site">
    <TopBars settings={settings} />
    <section className="section-shell" style={{ paddingTop: 40, paddingBottom: 60 }}>
      <a href="/" style={{ display: "inline-flex", alignItems: "center", gap: 6, color: colors.text, fontSize: 14, marginBottom: 20, textDecoration: "none" }}><ChevronLeft size={16} /> Back to Home</a>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 48, alignItems: "start" }} className="package-detail-grid">
        <div>
          <div style={{ borderRadius: 16, overflow: "hidden", marginBottom: 12, aspectRatio: "4/3" }}>
            <img src={galleryImages[galleryIndex]} alt={item.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </div>
          {galleryImages.length > 1 && (
            <div style={{ display: "flex", gap: 8, overflowX: "auto" }}>
              {galleryImages.map((img, i) => (
                <button key={i} onClick={() => setGalleryIndex(i)} style={{ borderRadius: 8, overflow: "hidden", border: `2px solid ${i === galleryIndex ? colors.green : colors.line}`, cursor: "pointer", flexShrink: 0 }}>
                  <img src={img} alt="" style={{ width: 72, height: 54, objectFit: "cover" }} />
                </button>
              ))}
            </div>
          )}
        </div>
        <div>
          {item.category && <span style={{ display: "inline-block", padding: "4px 12px", borderRadius: 20, fontSize: 12, fontWeight: 600, backgroundColor: colors.greenSoft, color: colors.greenDark, marginBottom: 12 }}>{item.category}</span>}
          <h1 style={{ fontSize: 30, color: colors.ink, marginBottom: 8, lineHeight: 1.2 }}>{item.name}</h1>
          {item.shortDescription && <p style={{ fontSize: 16, color: colors.text, lineHeight: 1.6, marginBottom: 20 }}>{item.shortDescription}</p>}
          {priceLabel && <div style={{ marginBottom: 20 }}><span style={{ fontSize: 28, fontWeight: 700, color: colors.green }}>{priceLabel}</span></div>}
          {item.availability && <div style={{ display: "flex", alignItems: "center", gap: 8, color: colors.text, fontSize: 14, marginBottom: 16 }}><CalendarDays size={16} /> {item.availability}</div>}
          {item.startDate && item.endDate && <div style={{ display: "flex", alignItems: "center", gap: 8, color: colors.text, fontSize: 14, marginBottom: 16 }}><CalendarDays size={16} /> {item.startDate} — {item.endDate}</div>}
          <div style={{ display: "flex", gap: 12, marginBottom: 28 }}>
            <a href="#contact" className="yellow-button" style={{ textDecoration: "none" }}>{item.ctaLabel || "Book Now"} <ArrowRight size={14} /></a>
            <a href={`tel:${settings.contact_phone || fallbackSettings.contact_phone}`} className="phone-button" style={{ textDecoration: "none" }}><Phone size={14} /> Call Us</a>
          </div>
          {inclusions.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <h3 style={{ fontSize: 16, color: colors.ink, marginBottom: 12 }}>Inclusions</h3>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
                {inclusions.map((inc, i) => <li key={i} style={{ display: "flex", alignItems: "start", gap: 8, fontSize: 14, color: colors.text }}><Check size={16} style={{ color: colors.green, flexShrink: 0, marginTop: 2 }} /> {inc}</li>)}
              </ul>
            </div>
          )}
          {exclusions.length > 0 && (
            <div>
              <h3 style={{ fontSize: 16, color: colors.ink, marginBottom: 12 }}>Exclusions</h3>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
                {exclusions.map((exc, i) => <li key={i} style={{ display: "flex", alignItems: "start", gap: 8, fontSize: 14, color: colors.text }}><X size={16} style={{ color: "#D7443E", flexShrink: 0, marginTop: 2 }} /> {exc}</li>)}
              </ul>
            </div>
          )}
        </div>
      </div>
      {item.fullDescription && (
        <div style={{ marginTop: 48, maxWidth: 760 }}>
          <h2 style={{ fontSize: 22, color: colors.ink, marginBottom: 16 }}>About this package</h2>
          <p style={{ fontSize: 15, color: colors.text, lineHeight: 1.8, whiteSpace: "pre-wrap" }}>{item.fullDescription}</p>
        </div>
      )}
    </section>
    <Footer settings={settings} />
    <ChatWidget code={settings.chat_widget_code} />
  </div>;
}

export default function Website() {
  const [pages, setPages] = useState([]);
  const [testimonials, setTestimonials] = useState([]);
  const [settings, setSettings] = useState(fallbackSettings);
  useEffect(() => { (async () => { const [pageData, testimonialData, settingsData] = await Promise.all([fetchPublishedPages(), fetchPublishedTestimonials(), fetchSiteSettings()]); setPages(pageData); setTestimonials(testimonialData); if (settingsData) setSettings({ ...fallbackSettings, ...settingsData }); })(); }, []);
  useEffect(() => { document.title = settings.seo_title || fallbackSettings.seo_title; }, [settings.seo_title]);
  const homePage = pages.find(page => page.slug === "home");
  const section = type => homePage?.sections.find(item => item.template_type === type);
  const servicesContent = section("services_preview");
  const testimonialsContent = section("testimonials");
  return <div className="travel-site"><TopBars settings={settings} /><Hero /><AccreditationBar /><OurServices /><FreeAssessment settings={settings} /><Services content={servicesContent} settings={settings} /><Benefits /><Testimonials content={testimonialsContent} testimonials={testimonials} /><Contact settings={settings} /><Footer settings={settings} /><ChatWidget code={settings.chat_widget_code} /></div>;
}
