import React, { useEffect, useMemo, useState } from "react";
import { ArrowRight, ChevronLeft, ChevronRight, Facebook, Instagram, Linkedin, Mail, MapPin, Phone, Plane, Search, ShieldCheck, Star, Ticket, UserRound, WalletCards, X, Menu } from "lucide-react";
import { supabase } from "../lib/supabase.js";
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
  { name: "Boracay", country: "Aklan, Philippines", price: "8,500", image: "https://picsum.photos/seed/boracay-airfair/480/320", discount: "-20%" },
  { name: "El Nido", country: "Palawan, Philippines", price: "12,000", image: "https://picsum.photos/seed/elnido-airfair/480/320", discount: "-20%" },
  { name: "Bohol", country: "Bohol, Philippines", price: "7,800", image: "https://picsum.photos/seed/bohol-airfair/480/320", discount: "-25%" },
  { name: "Puerto Princesa", country: "Palawan, Philippines", price: "9,500", image: "https://picsum.photos/seed/puertoprincesa-airfair/480/320", discount: "-20%" },
  { name: "Central Vietnam", country: "Da Nang / Hoi An", price: "689", image: "https://picsum.photos/seed/vietnam-airfair/480/320", discount: "-23%" },
];

const dealCards = [
  { name: "Boracay All-In Package", details: "3D2N | Flights + Hotel + Transfers", price: "9,500", image: "https://picsum.photos/seed/boracay-sail/640/420", badge: "Best Seller", badgeColor: colors.green },
  { name: "El Nido Island Escape", details: "4D3N | Flights + Hotel + Tours + Guide", price: "14,500", image: "https://picsum.photos/seed/elnido-lagoon/640/420", badge: "Hot Deal", badgeColor: "#D7443E" },
  { name: "Vietnam Discovery", details: "5D4N | Flights + Hotel + Tours", price: "689", image: "https://picsum.photos/seed/vietnam-bridge/640/420", badge: "New Offer", badgeColor: "#2385A3" },
];

const visaServices = [
  { icon: Ticket, code: "Tourist Visa", text: "Temporary visitor visa for leisure, business, or family visits." },
  { icon: BriefcaseIcon, code: "9G Work Visa", text: "Pre-arranged employment visa with legal work authorization." },
  { icon: UserRound, code: "13A Marriage Visa", text: "Immigrant visa by marriage for Filipino spouses." },
  { icon: Plane, code: "SRRV / Retirement", text: "Special Resident Retiree's Visa for permanent residency." },
  { icon: ShieldCheck, code: "ACR-I Card", text: "Alien Certificate of Registration — issuance, renewal, and cancellation." },
  { icon: WalletCards, code: "Bureau Clearance", text: "Immigration clearance, blacklist lifting, and records verification." },
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
    <span className="logo-mark"><Plane size={22} strokeWidth={2.5} /></span>
    <span><strong style={{ color: light ? colors.white : colors.navy }}>AIR FAIR</strong><small style={{ color: light ? "#B7C9E4" : colors.text }}>TRAVEL &amp; TOURS OPC</small></span>
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
  return <article className="destination-card"><div className="card-image"><img src={item.image} alt={item.name} /><span className="discount">{item.discount}</span></div><div className="destination-body"><div><h3>{item.name}</h3><p>{item.country}</p></div><div className="rating"><Star size={11} fill={colors.yellow} color={colors.yellow} /> <span>4.9</span></div><strong>₱{item.price}</strong><small>per person</small></div></article>;
}

function Destinations() {
  return <section id="destinations" className="destinations section-shell"><div className="section-heading-row"><SectionTitle title="Popular Destinations ✈" description="Discover the best of the Philippines and top international destinations" /><a className="view-all" href="#deals">View All →</a></div><div className="destination-grid">{destinationCards.map(item => <DestinationCard key={item.name} item={item} />)}</div></section>;
}

function DealCard({ deal }) {
  return <article className="deal-card"><div className="deal-image"><img src={deal.image} alt={deal.name} /><span className="deal-badge" style={{ backgroundColor: deal.badgeColor }}>{deal.badge}</span></div><div className="deal-content"><h3>{deal.name}</h3><p>{deal.details}</p><div className="deal-bottom"><strong>₱{deal.price}</strong><a href="#contact">View Details →</a></div></div></article>;
}

function Deals() {
  return <section id="deals" className="deals-section"><div className="section-shell"><div className="deal-layout"><div className="deal-intro"><span className="eyebrow yellow">LIMITED TIME</span><h2>Top Deals<br /><span>This Week</span></h2><p>Exclusive packages at unbeatable prices — don't miss out!</p><a className="yellow-button" href="#contact">Grab Deals →</a></div>{dealCards.map(deal => <DealCard key={deal.name} deal={deal} />)}</div></div></section>;
}

function Services({ content, settings }) {
  const [items, setItems] = useState([]);
  useEffect(() => { (async () => { const { data } = await supabase.from("services").select("*").eq("status", "Published").order("sort_order", { ascending: true }); if (data) setItems(data.map(dbRowToService)); })(); }, []);
  const cards = items.slice(0, 6);
  const heading = content?.blocks?.heading || "Visa & Immigration Services";
  return <section id="services" className="services section-shell"><div className="services-copy"><span className="eyebrow">EXPERT VISA CONSULTANTS</span><h2>{heading}</h2><p>Planning to study, work, retire, or settle in the Philippines — or heading abroad? Our certified immigration consultants guide you through every step of the process.</p><p><strong>At Air Fair, we are driven to pursue your VISA success.</strong> We handle everything from document preparation to submission and follow-up.</p><div className="service-buttons"><a className="green-button" href="#contact">Apply Now →</a><a className="phone-button" href={`tel:${settings.contact_phone || fallbackSettings.contact_phone}`}><Phone size={14} /> {settings.contact_phone || fallbackSettings.contact_phone}</a></div></div><div className="service-grid">{(cards.length ? cards : visaServices).map((item, index) => { const Icon = item.icon || visaServices[index % visaServices.length].icon; return <div className="service-tile" key={item.id || item.code || item.name}><Icon size={17} /><h3>{item.name || item.code}</h3><p>{item.shortDescription || item.text}</p></div>; })}</div></section>;
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

export default function Website() {
  const [pages, setPages] = useState([]);
  const [testimonials, setTestimonials] = useState([]);
  const [settings, setSettings] = useState(fallbackSettings);
  useEffect(() => { (async () => { const [pageData, testimonialData, settingsData] = await Promise.all([fetchPublishedPages(), fetchPublishedTestimonials(), fetchSiteSettings()]); setPages(pageData); setTestimonials(testimonialData); if (settingsData) setSettings({ ...fallbackSettings, ...settingsData }); })(); }, []);
  useEffect(() => { document.title = settings.seo_title || fallbackSettings.seo_title; }, [settings.seo_title]);
  const homePage = pages.find(page => page.slug === "home");
  const section = type => homePage?.sections.find(item => item.template_type === type);
  const heroContent = section("hero");
  const servicesContent = section("services_preview");
  const testimonialsContent = section("testimonials");
  return <div className="travel-site"><style>{`
    @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Pacifico&display=swap');
    *{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;font-family:'DM Sans',sans-serif;color:${colors.text};background:#fff}.travel-site{overflow:hidden}.section-shell{max-width:1080px;margin:0 auto;padding-left:24px;padding-right:24px}.browser-bar{height:20px;background:#fafafa;border-bottom:1px solid #e9e9e9;padding:0 12px;display:flex;align-items:center;gap:5px;font-size:7px;color:#777}.browser-dot{font-size:7px;background:#ddd;border-radius:50%;padding:1px 3px}.browser-actions{margin-left:auto;display:flex;align-items:center;gap:5px}.browser-actions span{border:1px solid #ddd;border-radius:3px;padding:2px 5px}.browser-actions b{background:#4c63ef;color:white;border-radius:3px;padding:2px 7px}.promise-bar{height:18px;background:${colors.greenDark};color:#f8fbdc;display:flex;align-items:center;justify-content:center;gap:48px;font-size:7px}.main-nav{background:white;border-bottom:1px solid #e4e8ec;position:sticky;top:0;z-index:20}.nav-inner{height:58px;max-width:1080px;margin:auto;padding:0 24px;display:flex;align-items:center;justify-content:space-between}.logo-lockup{display:flex;align-items:center;gap:7px}.logo-mark{width:31px;height:31px;background:${colors.navy};color:${colors.yellow};display:flex;align-items:center;justify-content:center;clip-path:polygon(50% 0,100% 100%,0 100%)}.logo-lockup strong{display:block;font-size:12px;line-height:1;color:${colors.navy};letter-spacing:.06em}.logo-lockup small{display:block;font-size:5px;letter-spacing:.09em;margin-top:3px}.nav-links{display:flex;align-items:center;gap:20px;margin-left:auto;margin-right:25px}.nav-links a{font-size:9px;color:#42546b;text-decoration:none;font-weight:600}.nav-links a:hover,.nav-links .nav-green{color:${colors.green}}.nav-actions{display:flex;align-items:center;gap:12px}.nav-actions button{border:0;background:none;color:#687a8d;cursor:pointer;padding:4px}.book-button,.green-button,.yellow-button,.outline-button,.phone-button{display:inline-flex;align-items:center;gap:6px;text-decoration:none;cursor:pointer;font-size:10px;font-weight:700;border-radius:18px;padding:9px 18px;transition:transform .2s,opacity .2s}.book-button:hover,.green-button:hover,.yellow-button:hover{transform:translateY(-2px)}.book-button{background:${colors.green};color:white}.mobile-menu{display:none!important}.search-panel{position:absolute;right:24px;top:58px;background:white;border:1px solid ${colors.line};padding:10px;display:flex;align-items:center;gap:8px;box-shadow:0 10px 24px #102d6818}.search-panel input{border:0;outline:0;width:280px;font-size:12px}.hero{height:390px;position:relative;color:white;overflow:hidden}.hero-image{position:absolute;width:100%;height:100%;object-fit:cover;object-position:center;opacity:0;transition:opacity 1s}.hero-image.active{opacity:1}.hero-overlay{position:absolute;inset:0;background:linear-gradient(90deg,rgba(11,62,25,.9),rgba(10,49,87,.58) 56%,rgba(7,27,58,.37)),linear-gradient(0deg,rgba(0,0,0,.18),transparent)}.hero-inner{position:relative;z-index:2;max-width:1080px;margin:auto;padding:55px 24px}.hero-copy{animation:heroIn .7s ease both}.hero-kicker{display:inline-block;background:${colors.green};color:#fff;border-radius:12px;font-size:8px;font-weight:700;padding:5px 10px;margin-bottom:13px}.hero h1{font-size:40px;line-height:.98;letter-spacing:.01em;margin:0 0 13px;font-weight:700;color:#fff}.hero h1 em{display:block;font-family:Pacifico,cursive;font-size:42px;line-height:1.1;color:${colors.yellow};font-weight:400;letter-spacing:0}.hero p{max-width:400px;font-size:11px;line-height:1.7;color:#edf3f7;margin:0 0 18px}.hero-buttons{display:flex;gap:8px}.yellow-button{background:${colors.yellow};color:#263b19}.outline-button{border:1px solid ${colors.yellow};color:${colors.yellow};background:transparent}.hero .outline-button{border-color:${colors.yellow}}.trust-row{display:flex;align-items:center;gap:8px;margin-top:19px}.trust-row small{font-size:8px;color:#e1ebef}.mini-avatars{display:flex}.mini-avatars span{width:19px;height:19px;border-radius:50%;background:${colors.green};border:2px solid white;margin-right:-4px;font-size:5px;display:flex;align-items:center;justify-content:center;color:white;font-weight:700}.mini-avatars span:nth-child(2){background:#c28364}.mini-avatars span:nth-child(3){background:#ba9c62}.mini-avatars span:nth-child(4){background:${colors.navy};font-size:5px}.hero-arrow{position:absolute;z-index:4;top:50%;transform:translateY(-50%);border:0;color:#fff;background:#ffffff2e;width:29px;height:29px;border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer}.hero-arrow.left{left:13px}.hero-arrow.right{right:13px}.hero-dots{position:absolute;z-index:4;bottom:12px;left:50%;transform:translateX(-50%);display:flex;gap:6px}.hero-dots button{width:7px;height:7px;border:0;border-radius:50%;background:#d8e1dd;cursor:pointer;padding:0}.hero-dots button.active{width:18px;border-radius:5px;background:${colors.green}}@keyframes heroIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}.destinations{padding-top:32px;padding-bottom:35px}.section-heading-row{display:flex;align-items:flex-end;justify-content:space-between}.section-title{margin-bottom:18px}.section-title h2{font-size:21px;line-height:1.15;color:${colors.ink};margin:0 0 6px;font-weight:700}.section-title p{font-size:9px;color:#718093;margin:0}.view-all{font-size:9px;color:${colors.green};text-decoration:none;font-weight:700;margin-bottom:21px}.destination-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:8px}.destination-card{border:1px solid ${colors.line};border-radius:8px;overflow:hidden;background:white;box-shadow:0 2px 5px #102d6807}.card-image{height:103px;position:relative}.card-image img{width:100%;height:100%;object-fit:cover}.discount{position:absolute;left:5px;top:5px;border-radius:4px;background:#ed443b;color:#fff;padding:3px 5px;font-size:7px;font-weight:700}.destination-body{padding:8px 8px 9px;display:grid;grid-template-columns:1fr auto;gap:3px}.destination-body h3{font-size:10px;margin:0;color:${colors.ink}}.destination-body p{font-size:7px;margin:3px 0 0;color:#8090a0}.destination-body strong{font-size:11px;color:${colors.navy};grid-column:1}.destination-body small{font-size:7px;color:#8b9aa8;grid-column:2;grid-row:2;align-self:end}.rating{font-size:7px;color:#8190a1;display:flex;align-items:center;gap:2px}.deals-section{background:${colors.greenSoft};padding:34px 0}.deal-layout{display:grid;grid-template-columns:1.05fr 1fr 1fr 1fr;gap:9px}.deal-intro{background:${colors.green};border-radius:8px;padding:21px 16px;color:#fff;display:flex;flex-direction:column;align-items:flex-start;justify-content:center}.eyebrow{display:inline-block;font-size:8px;letter-spacing:.05em;color:${colors.green};font-weight:700;background:#eaf5d6;border-radius:10px;padding:4px 8px;margin-bottom:9px}.eyebrow.yellow{color:${colors.yellow};background:transparent;padding:0}.deal-intro h2{font-size:19px;line-height:1.12;margin:0 0 10px;color:#fff}.deal-intro h2 span{color:${colors.yellow}}.deal-intro p{font-size:9px;line-height:1.5;margin:0 0 15px;color:#e7f6d0}.deal-intro .yellow-button{font-size:8px;padding:8px 12px}.deal-card{background:white;border-radius:8px;overflow:hidden;border:1px solid #dfe7d3;box-shadow:0 2px 5px #102d6808}.deal-image{height:100px;position:relative}.deal-image img{width:100%;height:100%;object-fit:cover}.deal-badge{position:absolute;left:6px;top:6px;border-radius:4px;padding:3px 5px;color:#fff;font-size:7px;font-weight:700}.deal-content{padding:9px}.deal-content h3{font-size:10px;color:${colors.ink};margin:0 0 4px}.deal-content p{font-size:7px;margin:0 0 9px;color:#7e8d9a}.deal-bottom{display:flex;align-items:center;justify-content:space-between}.deal-bottom strong{font-size:12px;color:${colors.green}}.deal-bottom a{font-size:7px;color:${colors.green};text-decoration:none}.services{display:grid;grid-template-columns:1fr 1fr;gap:65px;padding-top:55px;padding-bottom:52px;align-items:center}.services-copy h2{font-size:23px;line-height:1.2;color:${colors.ink};margin:0 0 12px}.services-copy h2::first-line{color:${colors.ink}}.services-copy>p{font-size:10px;line-height:1.65;color:#66778a;max-width:410px}.services-copy>p strong{color:${colors.ink}}.service-buttons{display:flex;align-items:center;gap:8px;margin-top:16px}.green-button{background:${colors.green};color:#fff}.phone-button{border:1px solid ${colors.navy};color:${colors.navy};padding:8px 12px}.service-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.service-tile{background:${colors.greenSoft};border-radius:7px;padding:14px 11px;min-height:93px;color:${colors.green}.service-tile:nth-child(2n){background:#edf7dd}.service-tile h3{font-size:9px;color:${colors.ink};margin:7px 0 4px}.service-tile p{font-size:7px;line-height:1.5;margin:0;color:#738396}.retirement{background:linear-gradient(100deg,${colors.greenDark},${colors.green} 50%,${colors.blue});color:#fff}.retirement-inner{display:flex;align-items:center;justify-content:space-between;padding-top:26px;padding-bottom:26px}.retirement-inner>div:first-child{max-width:570px}.retirement-inner span{font-size:7px;color:${colors.yellow};font-weight:700;letter-spacing:.06em}.retirement h2{font-size:18px;margin:7px 0 5px;color:#fff}.retirement h2 em{font-family:Pacifico,cursive;color:${colors.yellow};font-size:20px;font-weight:400}.retirement p{font-size:8px;line-height:1.6;margin:0;color:#e2f1dc}.retirement-actions{display:flex;gap:9px}.retirement-actions .outline-button{font-size:8px;padding:8px 13px;border-color:#fff;color:#fff}.retirement-actions .yellow-button{font-size:8px;padding:8px 13px}.benefits{background:${colors.greenSoft};border-bottom:1px solid #cfe4a8}.benefits-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:15px;text-align:center;padding-top:24px;padding-bottom:24px}.benefits-grid b{display:block;color:${colors.green};font-size:19px;height:22px}.benefits-grid h3{font-size:8px;color:${colors.ink};margin:8px 0 4px}.benefits-grid p{font-size:7px;color:#849291;margin:0}.testimonials{padding-top:48px;padding-bottom:52px}.testimonials>.section-title{text-align:center}.testimonials-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:9px}.testimonial-card{border:1px solid ${colors.line};border-radius:8px;padding:14px 13px;min-height:148px}.quote{font-size:24px;line-height:.6;color:${colors.green};font-weight:700}.testimonial-card>p{font-size:8px;line-height:1.65;color:#6c7b8c;min-height:65px}.client{border-top:1px solid ${colors.line};padding-top:9px;display:flex;align-items:center;gap:6px}.client-avatar{width:23px;height:23px;border-radius:50%;background:${colors.navy};color:#fff;display:flex;align-items:center;justify-content:center;font-size:7px}.client strong{display:block;color:${colors.ink};font-size:8px}.client small{display:block;color:#8b98a4;font-size:7px;margin-top:2px}.stars{margin-left:auto;color:${colors.yellow};font-size:8px;letter-spacing:-1px}.newsletter-card{border-radius:8px;background:${colors.green};color:#fff;padding:15px;display:flex;flex-direction:column;justify-content:center}.newsletter-card>svg{color:${colors.yellow};margin-bottom:8px}.newsletter-card h3{font-size:11px;margin:0 0 6px}.newsletter-card p{font-size:8px;line-height:1.5;color:#e5f3d5;margin:0 0 10px}.newsletter-card input{border:0;border-radius:5px;background:#ffffff22;color:#fff;padding:8px;font-size:8px;outline:0;margin-bottom:6px}.newsletter-card input::placeholder{color:#d9f0c8}.newsletter-card button{border:0;border-radius:5px;background:#66ad1c;color:#fff;padding:8px;font-size:8px;font-weight:700}.contact-section{background:${colors.navy};color:#fff;padding:48px 0}.contact-layout{display:grid;grid-template-columns:1fr 1fr;gap:60px;align-items:center}.contact-layout h2{font-size:26px;line-height:1.2;color:#fff;margin:10px 0}.contact-layout>div>p{font-size:10px;line-height:1.7;color:#c4d3e7;max-width:400px}.contact-detail{font-size:10px;color:#d8e3f2;display:flex;align-items:center;gap:8px;margin-top:10px}.contact-detail svg{color:${colors.yellow}}.contact-form{background:#fff;border-radius:9px;padding:18px;display:grid;gap:9px}.contact-form input,.contact-form textarea{font-family:inherit;border:1px solid ${colors.line};border-radius:5px;padding:10px;font-size:10px;outline:0;resize:vertical}.contact-form button{border:0;justify-content:center}.sent-card{background:#fff;color:${colors.ink};border-radius:9px;padding:36px;text-align:center}.sent-card svg{color:${colors.green}}.sent-card h3{font-size:17px}.sent-card p{color:${colors.text};font-size:10px}footer{background:${colors.navy};color:#9fb2cc;border-top:1px solid #284477}.footer-grid{display:grid;grid-template-columns:1.5fr 1fr 1fr 1fr;gap:50px;padding-top:35px;padding-bottom:30px}.footer-brand p{font-size:9px;line-height:1.7;max-width:225px}.footer-grid h4{font-size:8px;color:${colors.green};letter-spacing:.07em;margin:3px 0 13px}.footer-grid>div:not(.footer-brand){display:flex;flex-direction:column;gap:8px}.footer-grid a{font-size:8px;color:#afc0d6;text-decoration:none}.socials{display:flex;gap:6px;margin-top:12px}.socials a{width:22px;height:22px;border-radius:50%;background:#26447a;color:#fff;display:flex;align-items:center;justify-content:center}.footer-bottom{border-top:1px solid #294477;display:flex;justify-content:space-between;padding-top:12px;padding-bottom:12px;font-size:7px}.chat-bubble{position:fixed;right:19px;bottom:19px;width:42px;height:42px;border-radius:50%;background:${colors.green};color:white;display:flex;align-items:center;justify-content:center;z-index:30;box-shadow:0 5px 15px #0003}@media(max-width:800px){.promise-bar{gap:12px;font-size:6px}.nav-links{display:none}.nav-links.open{display:flex;position:absolute;top:58px;left:0;right:0;margin:0;padding:18px 24px;background:#fff;border-top:1px solid ${colors.line};align-items:flex-start;flex-direction:column;gap:16px;box-shadow:0 8px 20px #0001}.mobile-menu{display:block!important}.destination-grid{grid-template-columns:repeat(2,1fr)}.destination-card:last-child{display:none}.deal-layout{grid-template-columns:repeat(2,1fr)}.deal-intro{grid-row:span 2}.services{grid-template-columns:1fr;gap:28px}.retirement-inner{align-items:flex-start;gap:20px;flex-direction:column}.benefits-grid{grid-template-columns:repeat(3,1fr)}.benefits-grid>div:nth-child(n+4){display:none}.testimonials-grid{grid-template-columns:repeat(2,1fr)}.newsletter-card{grid-column:span 2}.footer-grid{grid-template-columns:repeat(2,1fr);gap:25px}.footer-brand{grid-column:span 2}.contact-layout{grid-template-columns:1fr;gap:25px}.hero h1{font-size:34px}.hero h1 em{font-size:36px}}@media(max-width:480px){.browser-actions{display:none}.browser-bar{justify-content:center}.promise-bar span:nth-child(n+3){display:none}.nav-inner{padding:0 16px}.book-button{display:none}.hero{height:430px}.hero-inner{padding:70px 24px}.hero p{max-width:300px}.section-shell{padding-left:16px;padding-right:16px}.destination-grid{gap:7px}.deal-layout{grid-template-columns:1fr}.deal-intro{grid-row:auto}.deal-card{display:grid;grid-template-columns:42% 58%}.deal-image{height:100%}.deal-content{display:flex;flex-direction:column;justify-content:center}.service-grid{grid-template-columns:repeat(2,1fr)}.benefits-grid{gap:4px}.benefits-grid h3{font-size:7px}.testimonials-grid{grid-template-columns:1fr}.newsletter-card{grid-column:auto}.footer-bottom{gap:8px;flex-direction:column}.footer-bottom span:last-child{display:none}}
  `}</style><TopBars settings={settings} /><Hero content={heroContent} /><Destinations /><Deals /><Services content={servicesContent} settings={settings} /><Retirement /><Benefits /><Testimonials content={testimonialsContent} testimonials={testimonials} /><Contact settings={settings} /><Footer settings={settings} /><ChatWidget code={settings.chat_widget_code} /></div>;
}
