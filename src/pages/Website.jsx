import React, { useState, useEffect, useCallback } from "react";
import { Plane, Menu, X, LogIn, ArrowRight, FileCheck2, ShieldCheck, MessageCircle, FileStack, Facebook, Instagram, Linkedin, Send, CircleCheck as CheckCircle2, ChevronLeft, ChevronRight } from "lucide-react";
import { supabase } from "../lib/supabase.js";
import { dbRowToService, getPriceLabel } from "../lib/catalog.js";
import { fetchPublishedPages, fetchPublishedTestimonials, fetchSiteSettings } from "../lib/content.js";

const T = {
  navy: "#13293F",
  navyDeep: "#0D1E2E",
  green: "#6EBE3D",
  greenDeep: "#549A2C",
  paper: "#F5F7F2",
  ink: "#151A22",
  muted: "#5C6670",
  gold: "#C8922A",
  border: "#E4E8DF",
};

const fontDisplay = { fontFamily: "'Fraunces', serif", fontWeight: 600 };
const fontBody = { fontFamily: "'Inter', sans-serif" };
const fontMono = { fontFamily: "'IBM Plex Mono', monospace" };

const FALLBACK_CATALOG = [
  { id: 1, type: "service", name: "Tourist Visa Assistance", category: "Visa", shortDescription: "Document checklist, application filing, and appointment booking for tourist visas.", pricingType: "starting", price: "3,500", image: "https://picsum.photos/seed/svc1/300/200", status: "Published" },
  { id: 2, type: "service", name: "Flight & Hotel Booking", category: "Flight & Hotel", shortDescription: "End-to-end booking for flights and accommodations, matched to your itinerary and budget.", pricingType: "fixed", price: "800", image: "https://picsum.photos/seed/svc2/300/200", status: "Published" },
  { id: 3, type: "service", name: "Visa Consultation", category: "Visa", shortDescription: "One-on-one review of your documents and eligibility before you apply.", pricingType: "fixed", price: "1,500", image: "https://picsum.photos/seed/svc3/300/200", status: "Published" },
  { id: 4, type: "service", name: "Travel Insurance", category: "Insurance", shortDescription: "Coverage options for medical, trip cancellation, and lost baggage.", pricingType: "starting", price: "950", image: "https://picsum.photos/seed/svc4/300/200", status: "Published" },
  { id: 5, type: "service", name: "Immigration Processing", category: "Immigration Processing", shortDescription: "End-to-end assistance for immigrant visas, permanent residency, and work permits abroad.", pricingType: "starting", price: "15,000", image: "https://picsum.photos/seed/svc5/300/200", status: "Published" },
];

const FALLBACK_TESTIMONIALS = [
  { id: 1, client_name: "Marisol C.", quote: "Air Fair walked me through every requirement for my tourist visa. No surprises at the embassy.", service_category: "Visa" },
  { id: 2, client_name: "Jonas R.", quote: "They handled my work permit application while I focused on my job offer. Smooth from start to finish.", service_category: "Immigration Processing" },
  { id: 3, client_name: "Grace L.", quote: "Booked our whole family's flights and hotel in one call. Saved us so much time.", service_category: "Flight & Hotel" },
];

const FALLBACK_SETTINGS = {
  business_name: "Air Fair Travel & Immigration",
  contact_email: "hello@airfairtravel.ph",
  contact_phone: "+63 917 000 0000",
  address: "Marikina City, Metro Manila",
  facebook_url: "",
  instagram_url: "",
  linkedin_url: "",
  seo_title: "Air Fair Travel & Immigration | Marikina",
  seo_description: "Visa filing, flight bookings, and travel planning for Filipinos heading abroad.",
  currency_symbol: "\u20B1",
  chat_widget_code: "",
};

const HERO_SLIDES = [
  { image: "/hero-slide-1.webp", eyebrow: "Tourist Visa Assistance", heading: "Your visa,\nhandled right.", subheading: "From tourist visas to permanent residency, Air Fair takes the paperwork off your plate — so you can focus on the trip, not the process." },
  { image: "/hero-slide-2.webp", eyebrow: "Immigration Processing", heading: "Your family's future,\nsimplified.", subheading: "We handle immigrant visas, permanent residency, and work permits with care and precision. Every document, every deadline, covered." },
  { image: "/hero-slide-3.webp", eyebrow: "Flight & Hotel Booking", heading: "Book the trip,\nnot just the visa.", subheading: "Flights, hotels, and travel insurance — all arranged to match your itinerary and budget. One team for the entire journey." },
];

const PROCESS_STEPS = [
  { num: "01", title: "Consult", desc: "We review your goals and eligibility, free of charge." },
  { num: "02", title: "Prepare", desc: "We give you a document checklist built for your case." },
  { num: "03", title: "File", desc: "We submit and track your application on your behalf." },
  { num: "04", title: "Travel", desc: "Approved and ready — we help you plan the trip itself." },
];

const NAV_LINKS = [
  { href: "#services", label: "Services" },
  { href: "#process", label: "How It Works" },
  { href: "#testimonials", label: "Testimonials" },
  { href: "#contact", label: "Contact" },
];

function LogoMark({ size = 34 }) {
  return (
    <div className="rounded-lg flex items-center justify-center shrink-0" style={{ width: size, height: size, backgroundColor: T.navy }}>
      <svg viewBox="0 0 24 24" width={size * 0.5} height={size * 0.5} fill="none">
        <path d="M13 3 L13 21 L9 21 L9 11 L2 19 Z" fill={T.green} />
      </svg>
    </div>
  );
}

function StampBadge() {
  return (
    <div
      className="hidden md:flex absolute items-center justify-center text-center rounded-full"
      style={{
        top: 64, right: 64, width: 128, height: 128,
        border: `2px dashed ${T.gold}`, color: T.gold,
        transform: "rotate(-9deg)", ...fontMono,
      }}
    >
      <div className="text-[10px] leading-relaxed uppercase" style={{ letterSpacing: "0.06em" }}>
        <span className="block text-[22px] font-semibold" style={{ letterSpacing: 0 }}>1,200+</span>
        Visas<br />Approved
      </div>
    </div>
  );
}

function Nav({ settings }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const goToDashboard = () => { window.location.href = "/dashboard"; };
  return (
    <header className="sticky top-0 z-20" style={{ backgroundColor: T.paper, borderBottom: `1px solid ${T.border}` }}>
      <nav className="max-w-6xl mx-auto px-6 h-[76px] flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <LogoMark />
          <div className="leading-tight">
            <div className="text-base" style={{ ...fontDisplay, color: T.navy }}>Air Fair</div>
            <div className="text-[9px] uppercase" style={{ color: T.muted, letterSpacing: "0.1em", ...fontBody }}>Travel & Immigration</div>
          </div>
        </div>
        <div className="hidden md:flex items-center gap-8 text-sm font-medium" style={{ color: T.navy, ...fontBody }}>
          {NAV_LINKS.map(l => (<a key={l.href} href={l.href} className="opacity-75 hover:opacity-100 transition-opacity">{l.label}</a>))}
        </div>
        <div className="hidden md:flex items-center gap-2.5">
          <button onClick={goToDashboard} className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm" style={{ color: T.navy, border: `1px solid ${T.border}`, ...fontBody }}>
            <LogIn size={14} /> Client Login
          </button>
          <a href="#contact" className="px-5 py-2.5 rounded-lg text-sm font-semibold" style={{ backgroundColor: T.green, color: "#fff", ...fontBody }}>Free Consultation</a>
        </div>
        <button className="md:hidden p-2" onClick={() => setMobileOpen(v => !v)} aria-label="Menu">
          {mobileOpen ? <X size={20} color={T.navy} /> : <Menu size={20} color={T.navy} />}
        </button>
      </nav>
      {mobileOpen && (
        <div className="md:hidden flex flex-col gap-4 px-6 py-5" style={{ backgroundColor: T.paper, borderTop: `1px solid ${T.border}`, ...fontBody }}>
          {NAV_LINKS.map(l => (<a key={l.href} href={l.href} onClick={() => setMobileOpen(false)} className="text-sm" style={{ color: T.navy }}>{l.label}</a>))}
          <button onClick={goToDashboard} className="flex items-center gap-1.5 text-sm" style={{ color: T.navy }}><LogIn size={14} /> Client Login</button>
          <a href="#contact" className="px-5 py-2.5 rounded-lg text-sm font-semibold text-center" style={{ backgroundColor: T.green, color: "#fff" }}>Free Consultation</a>
        </div>
      )}
    </header>
  );
}

function HeroSlider({ content }) {
  const [slide, setSlide] = useState(0);
  const slideCount = HERO_SLIDES.length;

  useEffect(() => {
    const timer = setInterval(() => {
      setSlide(s => (s + 1) % slideCount);
    }, 5500);
    return () => clearInterval(timer);
  }, [slideCount]);

  const goToSlide = (idx) => setSlide((idx + slideCount) % slideCount);

  const heading = content?.blocks?.heading || HERO_SLIDES[0].heading;
  const subheading = content?.blocks?.subheading || HERO_SLIDES[0].subheading;
  const ctaText = content?.blocks?.cta_text || "Book a Free Consultation";
  const ctaUrl = content?.blocks?.cta_url || "#contact";

  return (
    <section className="relative overflow-hidden" style={{ backgroundColor: T.navy, color: "#fff" }}>
      {HERO_SLIDES.map((s, i) => (
        <div
          key={i}
          className="absolute inset-0 transition-opacity duration-1000"
          style={{ opacity: i === slide ? 1 : 0, zIndex: i === slide ? 1 : 0 }}
        >
          <img src={s.image} alt="" className="w-full h-full object-cover" style={{ filter: "brightness(0.35)" }} />
        </div>
      ))}
      <div className="absolute inset-0" style={{ background: "linear-gradient(135deg, rgba(19,41,63,0.85) 0%, rgba(13,30,46,0.6) 100%)", zIndex: 2 }} />
      <StampBadge />
      <div className="max-w-6xl mx-auto px-6 pt-24 pb-20 relative" style={{ zIndex: 3 }}>
        <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase mb-5 transition-all duration-500" style={{ color: T.green, letterSpacing: "0.08em", ...fontBody, opacity: slide === 0 ? 1 : 0, transform: slide === 0 ? "translateY(0)" : "translateY(10px)" }}>
          <span className="w-4 h-px" style={{ backgroundColor: T.green }} />
          {HERO_SLIDES[slide].eyebrow}
        </div>
        <h1 className="max-w-xl mb-5 transition-all duration-700" style={{ ...fontDisplay, fontSize: "clamp(36px, 5.5vw, 58px)", lineHeight: 1.08, whiteSpace: "pre-line" }}>
          {heading}
        </h1>
        <p className="max-w-md text-[17px] mb-9 transition-all duration-700" style={{ color: "#C4CFD8", ...fontBody }}>
          {subheading}
        </p>
        <div className="flex flex-wrap gap-3.5">
          <a href={ctaUrl} className="inline-flex items-center gap-2 px-6 py-3.5 rounded-lg text-sm font-semibold transition-transform hover:scale-105" style={{ backgroundColor: T.green, color: "#fff", ...fontBody }}>
            {ctaText} <ArrowRight size={15} />
          </a>
          <a href="#services" className="inline-flex items-center gap-2 px-6 py-3.5 rounded-lg text-sm font-semibold" style={{ border: "1px solid rgba(255,255,255,.3)", color: "#fff", ...fontBody }}>
            View Our Services
          </a>
        </div>
      </div>
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-2.5" style={{ zIndex: 4 }}>
        {HERO_SLIDES.map((_, i) => (
          <button
            key={i}
            onClick={() => goToSlide(i)}
            className="transition-all rounded-full"
            style={{
              width: i === slide ? 24 : 8,
              height: 8,
              backgroundColor: i === slide ? T.green : "rgba(255,255,255,0.4)",
            }}
            aria-label={`Go to slide ${i + 1}`}
          />
        ))}
      </div>
      <button
        onClick={() => goToSlide(slide - 1)}
        className="absolute left-4 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full flex items-center justify-center transition-opacity hover:opacity-100"
        style={{ backgroundColor: "rgba(255,255,255,0.1)", color: "#fff", opacity: 0.6 }}
        aria-label="Previous slide"
      >
        <ChevronLeft size={20} />
      </button>
      <button
        onClick={() => goToSlide(slide + 1)}
        className="absolute right-4 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full flex items-center justify-center transition-opacity hover:opacity-100"
        style={{ backgroundColor: "rgba(255,255,255,0.1)", color: "#fff", opacity: 0.6 }}
        aria-label="Next slide"
      >
        <ChevronRight size={20} />
      </button>
    </section>
  );
}

function StatStrip() {
  const stats = [
    { num: "1,200+", label: "Visas Processed" },
    { num: "98%", label: "Approval Rate" },
    { num: "15 yrs", label: "In Business" },
    { num: "24/7", label: "Client Support" },
  ];
  return (
    <div style={{ backgroundColor: T.paper, borderBottom: `1px solid ${T.border}` }}>
      <div className="max-w-6xl mx-auto px-6 py-9 grid grid-cols-2 md:grid-cols-4 gap-6">
        {stats.map(s => (
          <div key={s.label}>
            <div className="text-[28px] font-medium" style={{ ...fontMono, color: T.navy }}>{s.num}</div>
            <div className="text-xs mt-1" style={{ color: T.muted, ...fontBody }}>{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SectionHead({ eyebrow, title, sub, dark }) {
  return (
    <div className="max-w-xl mx-auto mb-12 text-center">
      <div className="text-xs font-semibold uppercase mb-3" style={{ color: dark ? T.green : T.greenDeep, letterSpacing: "0.08em", ...fontBody }}>{eyebrow}</div>
      <h2 className="mb-3" style={{ ...fontDisplay, fontSize: "clamp(28px, 4vw, 38px)", color: dark ? "#fff" : T.navy }}>{title}</h2>
      {sub && <p className="text-[15px]" style={{ color: dark ? "#9FB0BD" : T.muted, ...fontBody }}>{sub}</p>}
    </div>
  );
}

function Services({ sectionContent, settings }) {
  const [items, setItems] = useState(FALLBACK_CATALOG);
  const [loading, setLoading] = useState(true);
  const currency = settings?.currency_symbol || "\u20B1";

  useEffect(() => {
    (async () => {
      try {
        const { data, error } = await supabase
          .from("services")
          .select("*")
          .eq("status", "Published")
          .order("sort_order", { ascending: true });
        if (!error && data && data.length > 0) {
          setItems(data.map(dbRowToService));
        }
      } catch (err) {
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const published = items.filter(it => it.status === "Published");
  const heading = sectionContent?.blocks?.heading || "Every step of your journey, covered.";
  const subheading = sectionContent?.blocks?.subheading || "Pick a service on its own, or let us manage the full process from consultation to approval.";

  return (
    <section id="services" style={{ padding: "88px 0" }}>
      <div className="max-w-6xl mx-auto px-6">
        <SectionHead eyebrow="What We Offer" title={heading} sub={subheading} />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {published.map(it => (
            <div key={it.id} className="rounded-2xl overflow-hidden transition-transform hover:-translate-y-1" style={{ backgroundColor: "#fff", border: `1px solid ${T.border}` }}>
              <img src={it.image} alt="" className="w-full h-36 object-cover" />
              <div className="p-6">
                <div className="inline-block px-2 py-0.5 rounded-full text-[10px] font-medium mb-2.5" style={{ backgroundColor: it.type === "product" ? "rgba(29,138,138,0.12)" : "rgba(110,190,61,0.12)", color: it.type === "product" ? "#1D8A8A" : T.greenDeep }}>
                  {it.type === "product" ? "Package" : "Service"}
                </div>
                <h3 className="text-[17px] mb-2" style={{ ...fontDisplay, color: T.navy }}>{it.name}</h3>
                <p className="text-[13.5px] mb-3.5" style={{ color: T.muted, ...fontBody }}>{it.shortDescription}</p>
                <div className="text-xs font-medium" style={{ ...fontMono, color: T.greenDeep }}>{getPriceLabel(it, currency)}</div>
              </div>
            </div>
          ))}
          <div className="rounded-2xl p-7" style={{ backgroundColor: T.navy, border: `1px solid ${T.navy}` }}>
            <h3 className="text-[17px] mb-2" style={{ ...fontDisplay, color: "#fff" }}>Not sure where to start?</h3>
            <p className="text-[13.5px] mb-4" style={{ color: "#9FB0BD", ...fontBody }}>Tell us about your trip or move, and we'll recommend the right service for your situation.</p>
            <a href="#contact" className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-lg text-sm font-semibold" style={{ backgroundColor: T.green, color: "#fff", ...fontBody }}>
              Talk to Us <ArrowRight size={14} />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

function Process() {
  return (
    <section id="process" style={{ backgroundColor: T.navy, padding: "88px 0" }}>
      <div className="max-w-6xl mx-auto px-6">
        <SectionHead dark eyebrow="How It Works" title="A clear process, start to finish." sub="No guesswork — you'll know exactly what stage your case is in." />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-y-9 gap-x-4">
          {PROCESS_STEPS.map((s, i) => (
            <div key={s.num} className="text-center px-4 relative">
              <div className="text-[13px] mb-2.5" style={{ ...fontMono, color: T.green }}>{s.num}</div>
              <h3 className="text-base mb-2" style={{ color: "#fff", ...fontBody, fontWeight: 600 }}>{s.title}</h3>
              <p className="text-[13px]" style={{ color: "#9FB0BD", ...fontBody }}>{s.desc}</p>
              {i < PROCESS_STEPS.length - 1 && (
                <div className="hidden lg:block absolute top-2 right-[-8px] w-4 h-px" style={{ backgroundColor: "rgba(255,255,255,.25)" }} />
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Testimonials({ sectionContent, testimonials }) {
  const items = testimonials.length > 0 ? testimonials : FALLBACK_TESTIMONIALS;
  const heading = sectionContent?.blocks?.heading || "Trusted by travelers and families alike.";
  return (
    <section id="testimonials" style={{ padding: "88px 0" }}>
      <div className="max-w-6xl mx-auto px-6">
        <SectionHead eyebrow="Client Stories" title={heading} />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {items.map(t => (
            <div key={t.id} className="rounded-2xl p-6" style={{ backgroundColor: "#fff", border: `1px solid ${T.border}` }}>
              <span className="block text-4xl mb-2 leading-none" style={{ ...fontDisplay, color: T.gold }}>"</span>
              <p className="text-sm mb-4" style={{ color: T.ink, ...fontBody }}>{t.quote}</p>
              <div className="text-xs" style={{ color: T.muted, ...fontBody }}>
                <strong style={{ color: T.navy }}>{t.client_name}</strong>{t.service_category ? ` — ${t.service_category}` : ""}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CtaBand({ sectionContent }) {
  const heading = sectionContent?.blocks?.heading || "Ready to start your journey?";
  const subheading = sectionContent?.blocks?.subheading || "Book a free consultation and we'll map out what your case needs.";
  const ctaText = sectionContent?.blocks?.cta_text || "Get a Free Consultation";
  const ctaUrl = sectionContent?.blocks?.cta_url || "#contact";
  return (
    <section style={{ backgroundColor: T.green, color: "#fff", textAlign: "center", padding: "88px 0" }}>
      <div className="max-w-6xl mx-auto px-6">
        <h2 className="mb-3.5" style={{ ...fontDisplay, fontSize: "clamp(26px, 4vw, 36px)", color: "#fff" }}>{heading}</h2>
        <p className="mb-7 text-[15px]" style={{ color: "rgba(255,255,255,.9)", ...fontBody }}>{subheading}</p>
        <a href={ctaUrl} className="inline-flex items-center gap-2 px-6 py-3.5 rounded-lg text-sm font-semibold" style={{ backgroundColor: T.navy, color: "#fff", ...fontBody }}>
          {ctaText} <ArrowRight size={15} />
        </a>
      </div>
    </section>
  );
}

const SERVICE_OPTIONS = [
  "Tourist Visa Assistance",
  "Flight & Hotel Booking",
  "Visa Consultation",
  "Travel Insurance",
  "Immigration Processing",
  "Not sure yet",
];

function InquiryForm() {
  const [values, setValues] = useState({ name: "", email: "", phone: "", service: SERVICE_OPTIONS[0], message: "" });
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const update = (key, val) => setValues(prev => ({ ...prev, [key]: val }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!values.name.trim() || !values.email.trim()) {
      setError("Name and email are required.");
      return;
    }
    setError("");
    setStatus("submitting");
    try {
      const { error: insertError } = await supabase.from("form_submissions").insert({
        form_type: "website_inquiry",
        name: values.name,
        email: values.email,
        phone: values.phone,
        raw_data: { service: values.service, message: values.message },
      });
      if (insertError) throw insertError;
      setStatus("done");
    } catch (err) {
      setError("Something went wrong. Please try again or call us directly.");
      setStatus("idle");
    }
  };

  if (status === "done") {
    return (
      <section id="contact" style={{ padding: "88px 0" }}>
        <div className="max-w-xl mx-auto px-6 text-center">
          <CheckCircle2 size={40} color={T.green} className="mx-auto mb-4" />
          <h2 className="mb-2" style={{ ...fontDisplay, fontSize: 28, color: T.navy }}>Thanks, {values.name.split(" ")[0]}!</h2>
          <p className="text-sm" style={{ color: T.muted, ...fontBody }}>We've received your inquiry and will reach out within one business day.</p>
        </div>
      </section>
    );
  }

  return (
    <section id="contact" style={{ padding: "88px 0" }}>
      <div className="max-w-xl mx-auto px-6">
        <SectionHead eyebrow="Get In Touch" title="Tell us about your trip or move." sub="Fill this out and we'll follow up with next steps." />
        <form onSubmit={handleSubmit} className="rounded-2xl p-7 flex flex-col gap-4" style={{ backgroundColor: "#fff", border: `1px solid ${T.border}` }}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs block mb-1.5" style={{ color: T.muted, ...fontBody }}>Full Name *</label>
              <input value={values.name} onChange={e => update("name", e.target.value)} className="w-full rounded-lg px-3 py-2.5 text-sm outline-none" style={{ border: `1px solid ${T.border}`, ...fontBody }} />
            </div>
            <div>
              <label className="text-xs block mb-1.5" style={{ color: T.muted, ...fontBody }}>Email *</label>
              <input type="email" value={values.email} onChange={e => update("email", e.target.value)} className="w-full rounded-lg px-3 py-2.5 text-sm outline-none" style={{ border: `1px solid ${T.border}`, ...fontBody }} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs block mb-1.5" style={{ color: T.muted, ...fontBody }}>Phone</label>
              <input value={values.phone} onChange={e => update("phone", e.target.value)} placeholder="+63 9XX XXX XXXX" className="w-full rounded-lg px-3 py-2.5 text-sm outline-none" style={{ border: `1px solid ${T.border}`, ...fontBody }} />
            </div>
            <div>
              <label className="text-xs block mb-1.5" style={{ color: T.muted, ...fontBody }}>Interested In</label>
              <select value={values.service} onChange={e => update("service", e.target.value)} className="w-full rounded-lg px-3 py-2.5 text-sm outline-none" style={{ border: `1px solid ${T.border}`, ...fontBody, backgroundColor: "#fff" }}>
                {SERVICE_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs block mb-1.5" style={{ color: T.muted, ...fontBody }}>Message</label>
            <textarea rows={4} value={values.message} onChange={e => update("message", e.target.value)} placeholder="Tell us a bit about your situation..." className="w-full rounded-lg px-3 py-2.5 text-sm outline-none" style={{ border: `1px solid ${T.border}`, ...fontBody }} />
          </div>
          {error && <div className="text-xs" style={{ color: "#D64545", ...fontBody }}>{error}</div>}
          <button type="submit" disabled={status === "submitting"} className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg text-sm font-semibold" style={{ backgroundColor: T.green, color: "#fff", ...fontBody, opacity: status === "submitting" ? 0.7 : 1 }}>
            {status === "submitting" ? "Sending..." : <>Send Inquiry <Send size={14} /></>}
          </button>
        </form>
      </div>
    </section>
  );
}

function Footer({ settings }) {
  const businessName = settings?.business_name || FALLBACK_SETTINGS.business_name;
  const email = settings?.contact_email || FALLBACK_SETTINGS.contact_email;
  const phone = settings?.contact_phone || FALLBACK_SETTINGS.contact_phone;
  const address = settings?.address || FALLBACK_SETTINGS.address;
  const fb = settings?.facebook_url;
  const ig = settings?.instagram_url;
  const li = settings?.linkedin_url;
  return (
    <footer style={{ backgroundColor: T.navyDeep, color: "#9FB0BD", padding: "56px 0 28px", fontSize: 13.5 }}>
      <div className="max-w-6xl mx-auto px-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2.5 mb-3">
              <LogoMark size={30} />
              <div style={{ ...fontDisplay, color: "#fff", fontSize: 15 }}>Air Fair</div>
            </div>
            <p className="max-w-[220px]" style={{ ...fontBody }}>Delivering journeys, simplifying visas — for Filipinos heading abroad.</p>
            <div className="flex gap-3 mt-4">
              {fb && <a href={fb} target="_blank" rel="noopener noreferrer"><Facebook size={16} /></a>}
              {ig && <a href={ig} target="_blank" rel="noopener noreferrer"><Instagram size={16} /></a>}
              {li && <a href={li} target="_blank" rel="noopener noreferrer"><Linkedin size={16} /></a>}
            </div>
          </div>
          <div>
            <h4 className="text-xs uppercase mb-3.5 font-semibold" style={{ color: "#fff", letterSpacing: "0.06em", ...fontBody }}>Company</h4>
            <ul className="flex flex-col gap-2.5" style={fontBody}>
              <li><a href="#services">Services</a></li>
              <li><a href="#process">How It Works</a></li>
              <li><a href="#testimonials">Testimonials</a></li>
            </ul>
          </div>
          <div>
            <h4 className="text-xs uppercase mb-3.5 font-semibold" style={{ color: "#fff", letterSpacing: "0.06em", ...fontBody }}>Services</h4>
            <ul className="flex flex-col gap-2.5" style={fontBody}>
              <li>Visa Assistance</li>
              <li>Flight & Hotel</li>
              <li>Immigration</li>
            </ul>
          </div>
          <div>
            <h4 className="text-xs uppercase mb-3.5 font-semibold" style={{ color: "#fff", letterSpacing: "0.06em", ...fontBody }}>Contact</h4>
            <ul className="flex flex-col gap-2.5" style={fontBody}>
              <li>{email}</li>
              <li>{phone}</li>
              <li>{address}</li>
            </ul>
          </div>
        </div>
        <div className="flex flex-wrap justify-between gap-2.5 pt-5 text-xs" style={{ borderTop: "1px solid rgba(255,255,255,.1)", ...fontBody }}>
          <span>© 2026 {businessName}. All rights reserved.</span>
          <span>Draft preview — content and pricing are placeholders</span>
        </div>
      </div>
    </footer>
  );
}

function ChatWidget({ code }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!code || !code.trim()) return;
    const script = document.createElement("script");
    script.innerHTML = code;
    document.body.appendChild(script);
    return () => { document.body.removeChild(script); };
  }, [code]);

  if (!code || !code.trim()) {
    return (
      <div style={{ position: "fixed", bottom: 20, right: 20, zIndex: 50 }}>
        {open && (
          <div className="rounded-2xl p-4 mb-3" style={{ width: 260, backgroundColor: "#fff", border: `1px solid ${T.border}`, boxShadow: "0 12px 32px -12px rgba(19,41,63,.25)" }}>
            <div className="text-sm font-medium mb-1" style={{ color: T.navy, ...fontBody }}>Chat widget placeholder</div>
            <p className="text-xs" style={{ color: T.muted, ...fontBody }}>
              Once a chat provider is configured in Settings → Integrations, the real widget renders here automatically.
            </p>
          </div>
        )}
        <button onClick={() => setOpen(v => !v)} aria-label="Chat" style={{ width: 52, height: 52, borderRadius: "9999px", backgroundColor: T.green, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 8px 20px -6px rgba(110,190,61,.55)", border: "none", cursor: "pointer" }}>
          <MessageCircle size={22} />
        </button>
      </div>
    );
  }
  return null;
}

export default function Website() {
  const [pages, setPages] = useState([]);
  const [testimonials, setTestimonials] = useState([]);
  const [settings, setSettings] = useState(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      const [pageData, testData, settingsData] = await Promise.all([
        fetchPublishedPages(),
        fetchPublishedTestimonials(),
        fetchSiteSettings(),
      ]);
      setPages(pageData);
      setTestimonials(testData);
      setSettings(settingsData);
      setLoaded(true);

      if (settingsData?.seo_title) {
        document.title = settingsData.seo_title;
      }
      if (settingsData?.seo_description) {
        let meta = document.querySelector('meta[name="description"]');
        if (!meta) {
          meta = document.createElement("meta");
          meta.setAttribute("name", "description");
          document.head.appendChild(meta);
        }
        meta.setAttribute("content", settingsData.seo_description);
      }
    })();
  }, []);

  const homePage = pages.find(p => p.slug === "home");
  const heroSection = homePage?.sections.find(s => s.template_type === "hero");
  const servicesSection = homePage?.sections.find(s => s.template_type === "services_preview");
  const testimonialsSection = homePage?.sections.find(s => s.template_type === "testimonials");
  const ctaSection = homePage?.sections.find(s => s.template_type === "cta");
  const effectiveSettings = settings || FALLBACK_SETTINGS;

  return (
    <div style={{ backgroundColor: T.paper, color: T.ink, ...fontBody }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@500&display=swap');
      `}</style>
      <div className="text-center text-xs py-2" style={{ backgroundColor: T.navyDeep, color: "#fff", letterSpacing: "0.03em" }}>
        Draft Preview — basic website design for {effectiveSettings.business_name}, not yet live
      </div>
      <Nav settings={effectiveSettings} />
      <HeroSlider content={heroSection} />
      <StatStrip />
      <Services sectionContent={servicesSection} settings={effectiveSettings} />
      <Process />
      <Testimonials sectionContent={testimonialsSection} testimonials={testimonials} />
      <CtaBand sectionContent={ctaSection} />
      <InquiryForm />
      <Footer settings={effectiveSettings} />
      <ChatWidget code={effectiveSettings.chat_widget_code} />
    </div>
  );
}
