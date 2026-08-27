import React, { useEffect, useMemo, useState } from "react";
import { ArrowRight, ChevronLeft, ChevronRight, Facebook, Instagram, Linkedin, Mail, MapPin, Phone, Plane, Search, ShieldCheck, Star, Ticket, UserRound, WalletCards, X, Menu, Check, CalendarDays } from "lucide-react";
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

const fallbackSlides = [
  { image: "/hero-slide-1.webp", kicker: "THE PHILIPPINES' TRUSTED TRAVEL & VISA AGENCY", title: "YOUR VISA JOURNEY", script: "Made Easy.", description: "Expert visa & immigration consulting — tourist, work, retirement and more. We handle everything for you." },
  { image: "/hero-slide-2.webp", kicker: "IMMIGRATION SUPPORT YOU CAN TRUST", title: "YOUR NEXT CHAPTER", script: "Starts Here.", description: "From your first consultation to the final approval, our team keeps your journey clear and stress-free." },
  { image: "/hero-slide-3.webp", kicker: "TRAVEL SMARTER WITH AIR FAIR", title: "SEE THE WORLD", script: "With Confidence.", description: "Visa filing, flights, hotels, and insurance — everything you need for a smooth trip abroad." },
];

const destinationCards = [
  { name: "Boracay", country: "Aklan, Philippines", price: "8,500", image: "https://picsum.photos/seed/boracay-airfair/480/320", discount: "-20%", slug: "boracay" },
  { name: "El Nido", country: "Palawan, Philippines", price: "12,000", image: "https://picsum.photos/seed/elnido-airfair/480/320", discount: "-20%", slug: "el-nido" },
  { name: "Bohol", country: "Bohol, Philippines", price: "7,800", image: "https://picsum.photos/seed/bohol-airfair/480/320", discount: "-25%", slug: "bohol" },
  { name: "Puerto Princesa", country: "Palawan, Philippines", price: "9,500", image: "https://picsum.photos/seed/puertoprincesa-airfair/480/320", discount: "-20%", slug: "puerto-princesa" },
  { name: "Central Vietnam", country: "Da Nang / Hoi An", price: "689", image: "https://picsum.photos/seed/vietnam-airfair/480/320", discount: "-23%", slug: "central-vietnam" },
];

const dealCards = [
  { name: "Boracay All-In Package", details: "3D2N | Flights + Hotel + Transfers", price: "9,500", image: "https://picsum.photos/seed/boracay-sail/640/420", badge: "Best Seller", badgeColor: colors.green, slug: "boracay-all-in-package" },
  { name: "El Nido Island Escape", details: "4D3N | Flights + Hotel + Tours + Guide", price: "14,500", image: "https://picsum.photos/seed/elnido-lagoon/640/420", badge: "Hot Deal", badgeColor: "#D7443E", slug: "el-nido-island-escape" },
  { name: "Vietnam Discovery", details: "5D4N | Flights + Hotel + Tours", price: "689", image: "https://picsum.photos/seed/vietnam-bridge/640/420", badge: "New Offer", badgeColor: "#2385A3", slug: "vietnam-discovery" },
];

const visaServices = [
  { icon: Ticket, code: "Tourist Visa Assistance", text: "Document checklist, application filing, and appointment booking for tourist visas." },
  { icon: BriefcaseIcon, code: "Flight & Hotel Booking", text: "End-to-end booking for flights and accommodations, matched to your itinerary and budget." },
  { icon: UserRound, code: "Visa Consultation", text: "One-on-one review of your documents and eligibility before you apply." },
  { icon: Plane, code: "Travel Insurance", text: "Coverage options for medical, trip cancellation, and lost baggage." },
  { icon: ShieldCheck, code: "Immigration Processing", text: "End-to-end assistance for immigrant visas, permanent residency, and work permits abroad." },
  { icon: WalletCards, code: "Japan Cherry Blossom 6D5N", text: "6 days, 5 nights through Tokyo, Osaka, and Kyoto at peak sakura season." },
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
          <a href="#top" onClick={() => setMenuOpen(false)}>Home</a><a href="#destinations" onClick={() => setMenuOpen(false)}>Destinations</a><a href="#deals" onClick={() => setMenuOpen(false)}>Packages</a><a href="#services" onClick={() => setMenuOpen(false)} className="nav-green">Visa &amp; Immigration</a><a href="#srri" onClick={() => setMenuOpen(false)}>SRRV</a><a href="#about" onClick={() => setMenuOpen(false)}>About Us</a><a href="#contact" onClick={() => setMenuOpen(false)}>Contact</a>
        </nav>
        <div className="nav-actions"><button aria-label="Search" onClick={() => setSearchOpen(v => !v)}><Search size={15} /></button><a className="book-button" href="#contact">Book Now <ArrowRight size={14} /></a><button className="mobile-menu" aria-label="Menu" onClick={() => setMenuOpen(v => !v)}>{menuOpen ? <X size={20} /> : <Menu size={20} />}</button></div>
      </div>
      {searchOpen && <div className="search-panel"><input autoFocus placeholder="Search destinations, services, or packages" /><X size={16} onClick={() => setSearchOpen(false)} /></div>}
    </header>
  </>;
}

function Hero({ content }) {
  const [active, setActive] = useState(0);
  useEffect(() => { const timer = setInterval(() => setActive(v => (v + 1) % fallbackSlides.length), 6000); return () => clearInterval(timer); }, []);
  const managedHeading = content?.blocks?.heading;
  const managedSubheading = content?.blocks?.subheading;
  const managedButton = content?.blocks?.cta_text || "Apply for Visa";
  const slide = fallbackSlides[active];
  return <section id="top" className="hero">
    {fallbackSlides.map((item, index) => <img key={item.image} className={index === active ? "hero-image active" : "hero-image"} src={item.image} alt="" />)}
    <div className="hero-overlay" />
    <button className="hero-arrow left" onClick={() => setActive(v => (v - 1 + fallbackSlides.length) % fallbackSlides.length)} aria-label="Previous slide"><ChevronLeft size={19} /></button>
    <button className="hero-arrow right" onClick={() => setActive(v => (v + 1) % fallbackSlides.length)} aria-label="Next slide"><ChevronRight size={19} /></button>
    <div className="hero-inner">
      <div className="hero-copy" key={active}>
        <span className="hero-kicker">✦ {slide.kicker}</span>
        <h1>{managedHeading || slide.title}<em>{slide.script}</em></h1>
        <p>{managedSubheading || slide.description}</p>
        <div className="hero-buttons"><a href="#contact" className="yellow-button">{managedButton} <ArrowRight size={14} /></a><a href="#services" className="outline-button">Our Services</a></div>
        <div className="trust-row"><div className="mini-avatars"><span>MC</span><span>JR</span><span>GL</span><span>+1k</span></div><small>Trusted by 10,000+ happy travelers &amp; visa applicants</small></div>
      </div>
    </div>
    <div className="hero-dots">{fallbackSlides.map((_, i) => <button key={i} onClick={() => setActive(i)} className={i === active ? "active" : ""} aria-label={`Slide ${i + 1}`} />)}</div>
  </section>;
}

function DestinationCard({ item }) {
  return <a className="destination-card" href={`/package/${item.slug}`}><div className="card-image"><img src={item.image} alt={item.name} /><span className="discount">{item.discount}</span></div><div className="destination-body"><div><h3>{item.name}</h3><p>{item.country}</p></div><div className="rating"><Star size={11} fill={colors.yellow} color={colors.yellow} /> <span>4.9</span></div><strong>{item.priceLabel || `₱${item.price}`}</strong><small>per person</small></div></a>;
}

function Destinations({ products }) {
  const items = products.length ? products.slice(0, 5).map((item, index) => ({ ...item, country: item.category || "Travel Package", priceLabel: getPriceLabel(item), discount: index % 2 ? "-20%" : "Featured" })) : destinationCards;
  return <section id="destinations" className="destinations section-shell"><div className="section-heading-row"><SectionTitle title="Popular Destinations ✈" description="Discover the best of the Philippines and top international destinations" /><a className="view-all" href="#deals">View All →</a></div><div className="destination-grid">{items.map(item => <DestinationCard key={item.id || item.name} item={item} />)}</div></section>;
}

function DealCard({ deal }) {
  return <a className="deal-card" href={`/package/${deal.slug}`}><div className="deal-image"><img src={deal.image} alt={deal.name} /><span className="deal-badge" style={{ backgroundColor: deal.badgeColor }}>{deal.badge}</span></div><div className="deal-content"><h3>{deal.name}</h3><p>{deal.details}</p><div className="deal-bottom"><strong>{deal.priceLabel || `₱${deal.price}`}</strong><span>View Details →</span></div></div></a>;
}

function Deals({ products }) {
  const items = products.length ? products.slice(0, 3).map((item, index) => ({ ...item, details: item.shortDescription || item.availability || "Travel package details available", priceLabel: getPriceLabel(item), badge: index === 0 ? "Featured" : "Package", badgeColor: index === 1 ? "#D7443E" : colors.green })) : dealCards;
  return <section id="deals" className="deals-section"><div className="section-shell"><div className="deal-layout"><div className="deal-intro"><span className="eyebrow yellow">LIMITED TIME</span><h2>Top Deals<br /><span>This Week</span></h2><p>Exclusive packages at unbeatable prices — don't miss out!</p><a className="yellow-button" href="#contact">Grab Deals →</a></div>{items.map(deal => <DealCard key={deal.id || deal.name} deal={deal} />)}</div></div></section>;
}

function Services({ content, settings }) {
  const [items, setItems] = useState([]);
  useEffect(() => { (async () => { const { data } = await supabase.from("services").select("*").eq("status", "Published").order("sort_order", { ascending: true }); if (data) setItems(data.map(dbRowToService)); })(); }, []);
  const cards = items.slice(0, 6);
  const heading = content?.blocks?.heading || "Every step of your journey, covered.";
  return <section id="services" className="services services-redesign section-shell"><div className="services-copy"><span className="eyebrow">EXPERT VISA CONSULTANTS</span><h2>{heading}</h2><p>Planning to study, work, retire, or settle in the Philippines — or heading abroad? Our certified immigration consultants guide you through every step of the process.</p><p><strong>At Air Fair, we are driven to pursue your VISA success.</strong> We handle everything from document preparation to submission and follow-up.</p><div className="service-buttons"><a className="green-button" href="#contact">Apply Now →</a><a className="phone-button" href={`tel:${settings.contact_phone || fallbackSettings.contact_phone}`}><Phone size={14} /> {settings.contact_phone || fallbackSettings.contact_phone}</a></div></div><div className="service-grid">{(cards.length ? cards : visaServices).map((item, index) => { const Icon = item.icon || visaServices[index % visaServices.length].icon; return <div className="service-tile" key={item.id || item.code || item.name}><Icon size={17} /><h3>{item.name || item.code}</h3><p>{item.shortDescription || item.text}</p></div>; })}</div></section>;
}

function Retirement() {
  return <section id="srri" className="retirement"><div className="section-shell retirement-inner"><div><span>PHILIPPINE RETIREMENT AUTHORITY PARTNER</span><h2>Your Dream Retirement <em>Starts Here!</em></h2><p>The SRRV (Special Resident Retiree's Visa) grants permanent residency in the Philippines with unlimited travel, no annual reporting, and government discounts.</p></div><div className="retirement-actions"><a href="#about" className="outline-button">Learn About SRRV →</a><a href="#contact" className="yellow-button">Apply Now</a></div></div></section>;
}

function Benefits() {
  const benefits = [["✦", "Best Price Guarantee", "We match any lower price you find"], ["▥", "Visa Experts", "Certified immigration consultants"], ["▣", "Secure Booking", "100% safe and encrypted process"], ["☎", "24/7 Support", "We're here whenever you need us"], ["✓", "Easy Process", "Simple steps, no hidden fees"]];
  return <section className="benefits"><div className="section-shell benefits-grid">{benefits.map(([icon, title, text]) => <div key={title}><b>{icon}</b><h3>{title}</h3><p>{text}</p></div>)}</div></section>;
}

function Testimonials({ content, testimonials }) {
  const fallback = [{ client_name: "Maria Santos", quote: "Air Fair helped me get my Japan visa in just 2 weeks! Their preparation and support were professional and honest.", service_category: "Tourist Visa" }, { client_name: "James Reyes", quote: "Booked an El Nido package for our family of 5. Hotel, transfers, island tours — everything was seamless.", service_category: "Travel Package" }, { client_name: "Ana Cruz", quote: "They processed my 13A marriage visa without any hassle. The team is knowledgeable, patient, and kept me updated throughout.", service_category: "13A Visa" }];
  const rows = testimonials.length ? testimonials : fallback;
  return <section id="about" className="testimonials section-shell"><SectionTitle title={content?.blocks?.heading || "What Our Clients Say ✈"} description="Thousands of happy travelers and successful visa applicants trust Air Fair" /><div className="testimonials-grid">{rows.slice(0, 3).map((item, index) => <article className="testimonial-card" key={item.id || index}><span className="quote">“</span><p>{item.quote}</p><div className="client"><div className="client-avatar">{item.client_name.split(" ").map(part => part[0]).join("").slice(0, 2)}</div><div><strong>{item.client_name}</strong><small>{item.service_category || "Air Fair Client"}</small></div><span className="stars">★★★★★</span></div></article>)}<div className="newsletter-card"><Mail size={18} /><h3>Get Exclusive Travel Deals</h3><p>Subscribe for the latest packages, visa tips, and special promotions.</p><input placeholder="Your email address" /><button>Subscribe Now</button></div></div></section>;
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
  return <footer><div className="section-shell footer-grid"><div className="footer-brand"><Logo light /><p>Your trusted travel partner and visa consultant for unforgettable journeys and hassle-free immigration services.</p><div className="socials">{socials.map(([Icon, url], index) => <a key={index} href={url || "#"} aria-label="Social link"><Icon size={13} /></a>)}</div></div><div><h4>COMPANY</h4><a href="#about">About Us</a><a href="#about">Our Team</a><a href="#services">Careers</a><a href="#about">Blog</a><a href="#contact">Contact Us</a></div><div><h4>VISA SERVICES</h4><a href="#services">Tourist Visa</a><a href="#services">9G Work Visa</a><a href="#services">13A Marriage Visa</a><a href="#srri">SRRV / Retirement</a><a href="#services">ACR-I Card</a><a href="#services">Other Services</a></div><div><h4>CONTACT US</h4><a href={`tel:${settings.contact_phone}`}>☎ {settings.contact_phone || fallbackSettings.contact_phone}</a><a href={`mailto:${settings.contact_email}`}>✉ {settings.contact_email || fallbackSettings.contact_email}</a><a href="#contact">▣ {settings.address || fallbackSettings.address}</a></div></div><div className="footer-bottom section-shell"><span>© 2025 Air Fair Travel and Tours OPC. All rights reserved.</span><span>Privacy Policy　 Terms &amp; Conditions</span></div></footer>;
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
  const [products, setProducts] = useState([]);
  useEffect(() => { (async () => { const [pageData, testimonialData, settingsData] = await Promise.all([fetchPublishedPages(), fetchPublishedTestimonials(), fetchSiteSettings()]); setPages(pageData); setTestimonials(testimonialData); if (settingsData) setSettings({ ...fallbackSettings, ...settingsData }); })(); }, []);
  useEffect(() => { (async () => { const { data } = await supabase.from("services").select("*").eq("status", "Published").eq("type", "product").order("sort_order", { ascending: true }); if (data) setProducts(data.map(dbRowToService)); })(); }, []);
  useEffect(() => { document.title = settings.seo_title || fallbackSettings.seo_title; }, [settings.seo_title]);
  const homePage = pages.find(page => page.slug === "home");
  const section = type => homePage?.sections.find(item => item.template_type === type);
  const heroContent = section("hero");
  const servicesContent = section("services_preview");
  const testimonialsContent = section("testimonials");
  return <div className="travel-site"><TopBars settings={settings} /><Hero content={heroContent} /><Destinations products={products} /><Deals products={products} /><Services content={servicesContent} settings={settings} /><Retirement /><Benefits /><Testimonials content={testimonialsContent} testimonials={testimonials} /><Contact settings={settings} /><Footer settings={settings} /><ChatWidget code={settings.chat_widget_code} /></div>;
}
