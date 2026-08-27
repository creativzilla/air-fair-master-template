import React, { useState, useEffect } from "react";
import {
  Plane, Menu, X, LogIn, ArrowRight, FileCheck2, ShieldCheck,
  MessageCircle, FileStack, Facebook, Instagram, Linkedin, Send, CheckCircle2
} from "lucide-react";

/* ---------------------------------------------------------------
   DESIGN TOKENS — shared brand identity with the dashboard, but
   with its own personality: a serif display face (Fraunces) reads
   "official/trusted" the way a passport or government form does,
   where the dashboard stays all-Inter for a purely functional feel.
----------------------------------------------------------------*/
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

// Fallback only — shown before the dashboard has synced any Catalog data
// yet (or if the shared storage read fails). Once connected, everything
// rendered in the Services section comes from window.storage instead.
const FALLBACK_CATALOG = [
  { id: 1, type: "service", name: "Tourist Visa Assistance", category: "Visa", shortDescription: "Document checklist, application filing, and appointment booking for tourist visas.", pricingType: "starting", price: "3,500", image: "https://picsum.photos/seed/svc1/300/200", status: "Published" },
  { id: 2, type: "service", name: "Flight & Hotel Booking", category: "Flight & Hotel", shortDescription: "End-to-end booking for flights and accommodations, matched to your itinerary and budget.", pricingType: "fixed", price: "800", image: "https://picsum.photos/seed/svc2/300/200", status: "Published" },
  { id: 3, type: "service", name: "Visa Consultation", category: "Visa", shortDescription: "One-on-one review of your documents and eligibility before you apply.", pricingType: "fixed", price: "1,500", image: "https://picsum.photos/seed/svc3/300/200", status: "Published" },
  { id: 4, type: "service", name: "Travel Insurance", category: "Insurance", shortDescription: "Coverage options for medical, trip cancellation, and lost baggage.", pricingType: "starting", price: "950", image: "https://picsum.photos/seed/svc4/300/200", status: "Published" },
  { id: 5, type: "service", name: "Immigration Processing", category: "Immigration Processing", shortDescription: "End-to-end assistance for immigrant visas, permanent residency, and work permits abroad.", pricingType: "starting", price: "15,000", image: "https://picsum.photos/seed/svc5/300/200", status: "Published" },
];

// Mirrors the dashboard's getPriceLabel exactly, so a price set in the
// Catalog editor reads identically here on the live site.
function getPriceLabel(item, currency = "₱") {
  if (item.type === "service") {
    switch (item.pricingType) {
      case "fixed": return `${currency}${item.price || "0"}`;
      case "starting": return `Starting at ${currency}${item.price || "0"}`;
      case "range": return `${currency}${item.priceMin || "0"} – ${currency}${item.priceMax || "0"}`;
      case "quote": return "Custom Quote";
      case "free": return "Free";
      default: return item.price ? `${currency}${item.price}` : "";
    }
  }
  const unit = item.pricingUnit ? ` / ${item.pricingUnit}` : "";
  if (item.salePrice) return `${currency}${item.salePrice}${unit}`;
  return item.regularPrice ? `${currency}${item.regularPrice}${unit}` : "";
}

const PROCESS_STEPS = [
  { num: "01", title: "Consult", desc: "We review your goals and eligibility, free of charge." },
  { num: "02", title: "Prepare", desc: "We give you a document checklist built for your case." },
  { num: "03", title: "File", desc: "We submit and track your application on your behalf." },
  { num: "04", title: "Travel", desc: "Approved and ready — we help you plan the trip itself." },
];

const TESTIMONIALS = [
  { name: "Marisol C.", role: "Tourist Visa client", quote: "Sample testimonial — Air Fair walked me through every requirement for my tourist visa. No surprises at the embassy." },
  { name: "Jonas R.", role: "Immigration Processing client", quote: "Sample testimonial — they handled my work permit application while I focused on my job offer. Smooth from start to finish." },
  { name: "Grace L.", role: "Flight & Hotel client", quote: "Sample testimonial — booked our whole family's flights and hotel in one call. Saved us so much time." },
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

/* ---------------------------------------------------------------
   NAV — includes the Client Login button. No credential form yet;
   clicking it just sends the visitor to the dashboard route. Swap
   for a real auth check once accounts exist.
----------------------------------------------------------------*/
function Nav() {
  const [mobileOpen, setMobileOpen] = useState(false);

  const goToDashboard = () => {
    window.location.href = "/dashboard";
  };

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
          {NAV_LINKS.map(l => (
            <a key={l.href} href={l.href} className="opacity-75 hover:opacity-100 transition-opacity">{l.label}</a>
          ))}
        </div>

        <div className="hidden md:flex items-center gap-2.5">
          <button
            onClick={goToDashboard}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm"
            style={{ color: T.navy, border: `1px solid ${T.border}`, ...fontBody }}
          >
            <LogIn size={14} /> Client Login
          </button>
          <a href="#contact" className="px-5 py-2.5 rounded-lg text-sm font-semibold" style={{ backgroundColor: T.green, color: "#fff", ...fontBody }}>
            Free Consultation
          </a>
        </div>

        <button className="md:hidden p-2" onClick={() => setMobileOpen(v => !v)} aria-label="Menu">
          {mobileOpen ? <X size={20} color={T.navy} /> : <Menu size={20} color={T.navy} />}
        </button>
      </nav>

      {mobileOpen && (
        <div className="md:hidden flex flex-col gap-4 px-6 py-5" style={{ backgroundColor: T.paper, borderTop: `1px solid ${T.border}`, ...fontBody }}>
          {NAV_LINKS.map(l => (
            <a key={l.href} href={l.href} onClick={() => setMobileOpen(false)} className="text-sm" style={{ color: T.navy }}>{l.label}</a>
          ))}
          <button onClick={goToDashboard} className="flex items-center gap-1.5 text-sm" style={{ color: T.navy }}>
            <LogIn size={14} /> Client Login
          </button>
          <a href="#contact" className="px-5 py-2.5 rounded-lg text-sm font-semibold text-center" style={{ backgroundColor: T.green, color: "#fff" }}>
            Free Consultation
          </a>
        </div>
      )}
    </header>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden" style={{ backgroundColor: T.navy, color: "#fff" }}>
      <svg className="absolute inset-0 opacity-50" viewBox="0 0 1120 420" preserveAspectRatio="none">
        <path d="M -20 340 C 260 260, 480 400, 760 240 S 1140 120, 1180 60" stroke="#2A4258" strokeWidth="1.5" strokeDasharray="2 10" fill="none" />
      </svg>
      <StampBadge />
      <div className="max-w-6xl mx-auto px-6 pt-24 pb-20 relative z-[2]">
        <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase mb-5" style={{ color: T.green, letterSpacing: "0.08em", ...fontBody }}>
          <span className="w-4 h-px" style={{ backgroundColor: T.green }} />
          Trusted Travel & Immigration Partner
        </div>
        <h1 className="max-w-xl mb-5" style={{ ...fontDisplay, fontSize: "clamp(36px, 5.5vw, 58px)", lineHeight: 1.08 }}>
          Your visa,<br /><span style={{ color: T.green }}>handled right.</span>
        </h1>
        <p className="max-w-md text-[17px] mb-9" style={{ color: "#C4CFD8", ...fontBody }}>
          From tourist visas to permanent residency, Air Fair takes the paperwork off your plate — so you can focus on the trip, not the process.
        </p>
        <div className="flex flex-wrap gap-3.5">
          <a href="#contact" className="inline-flex items-center gap-2 px-6 py-3.5 rounded-lg text-sm font-semibold" style={{ backgroundColor: T.green, color: "#fff", ...fontBody }}>
            Book a Free Consultation <ArrowRight size={15} />
          </a>
          <a href="#services" className="inline-flex items-center gap-2 px-6 py-3.5 rounded-lg text-sm font-semibold" style={{ border: "1px solid rgba(255,255,255,.3)", color: "#fff", ...fontBody }}>
            View Our Services
          </a>
        </div>
      </div>
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

function Services() {
  const [items, setItems] = useState(FALLBACK_CATALOG);

  useEffect(() => {
    (async () => {
      try {
        const result = await window.storage.get("airfair-catalog-items");
        if (result?.value) {
          const parsed = JSON.parse(result.value);
          if (Array.isArray(parsed) && parsed.length > 0) setItems(parsed);
        }
      } catch (err) {
        // Dashboard hasn't published a catalog yet — keep the fallback.
      }
    })();
  }, []);

  const published = items.filter(it => it.status === "Published");

  return (
    <section id="services" className="py-22" style={{ padding: "88px 0" }}>
      <div className="max-w-6xl mx-auto px-6">
        <SectionHead
          eyebrow="What We Offer"
          title="Every step of your journey, covered."
          sub="Pick a service on its own, or let us manage the full process from consultation to approval."
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {published.map(it => (
            <div key={it.id} className="rounded-2xl overflow-hidden transition-transform hover:-translate-y-1" style={{ backgroundColor: "#fff", border: `1px solid ${T.border}` }}>
              <img src={it.image} alt="" className="w-full h-36 object-cover" />
              <div className="p-6">
                <div
                  className="inline-block px-2 py-0.5 rounded-full text-[10px] font-medium mb-2.5"
                  style={{ backgroundColor: it.type === "product" ? "rgba(29,138,138,0.12)" : "rgba(110,190,61,0.12)", color: it.type === "product" ? T.teal ?? "#1D8A8A" : T.greenDeep }}
                >
                  {it.type === "product" ? "Package" : "Service"}
                </div>
                <h3 className="text-[17px] mb-2" style={{ ...fontDisplay, color: T.navy }}>{it.name}</h3>
                <p className="text-[13.5px] mb-3.5" style={{ color: T.muted, ...fontBody }}>{it.shortDescription}</p>
                <div className="text-xs font-medium" style={{ ...fontMono, color: T.greenDeep }}>{getPriceLabel(it)}</div>
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

function Testimonials() {
  return (
    <section id="testimonials" style={{ padding: "88px 0" }}>
      <div className="max-w-6xl mx-auto px-6">
        <SectionHead eyebrow="Client Stories" title="Trusted by travelers and families alike." />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {TESTIMONIALS.map(t => (
            <div key={t.name} className="rounded-2xl p-6" style={{ backgroundColor: "#fff", border: `1px solid ${T.border}` }}>
              <span className="block text-4xl mb-2 leading-none" style={{ ...fontDisplay, color: T.gold }}>"</span>
              <p className="text-sm mb-4" style={{ color: T.ink, ...fontBody }}>{t.quote}</p>
              <div className="text-xs" style={{ color: T.muted, ...fontBody }}>
                <strong style={{ color: T.navy }}>{t.name}</strong> — {t.role}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CtaBand() {
  return (
    <section style={{ backgroundColor: T.green, color: "#fff", textAlign: "center", padding: "88px 0" }}>
      <div className="max-w-6xl mx-auto px-6">
        <h2 className="mb-3.5" style={{ ...fontDisplay, fontSize: "clamp(26px, 4vw, 36px)", color: "#fff" }}>Ready to start your journey?</h2>
        <p className="mb-7 text-[15px]" style={{ color: "rgba(255,255,255,.9)", ...fontBody }}>Book a free consultation and we'll map out what your case needs.</p>
        <a href="#contact" className="inline-flex items-center gap-2 px-6 py-3.5 rounded-lg text-sm font-semibold" style={{ backgroundColor: T.navy, color: "#fff", ...fontBody }}>
          Get a Free Consultation <ArrowRight size={15} />
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

/* ---------------------------------------------------------------
   INQUIRY FORM — the real entry point into form_submissions.
   This is a static form for now (per form_type "website_inquiry").
   The Form Builder planned for later will let non-technical staff
   create more of these without touching code — this one just needs
   to exist and work today.
----------------------------------------------------------------*/
function InquiryForm() {
  const [values, setValues] = useState({ name: "", email: "", phone: "", service: SERVICE_OPTIONS[0], message: "" });
  const [status, setStatus] = useState("idle"); // idle | submitting | done
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

    // --- In Bolt/Supabase, replace this block with a real insert: -----
    // const { error } = await supabase.from('form_submissions').insert({
    //   form_type: 'website_inquiry',
    //   name: values.name,
    //   email: values.email,
    //   phone: values.phone,
    //   raw_data: { service: values.service, message: values.message },
    // });
    // The trigger we wrote (fn_auto_create_contact_from_submission) picks
    // it up automatically from there — no extra wiring needed here.
    await new Promise(res => setTimeout(res, 700));
    // -------------------------------------------------------------------

    setStatus("done");
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
              <input
                value={values.name}
                onChange={e => update("name", e.target.value)}
                className="w-full rounded-lg px-3 py-2.5 text-sm outline-none"
                style={{ border: `1px solid ${T.border}`, ...fontBody }}
              />
            </div>
            <div>
              <label className="text-xs block mb-1.5" style={{ color: T.muted, ...fontBody }}>Email *</label>
              <input
                type="email"
                value={values.email}
                onChange={e => update("email", e.target.value)}
                className="w-full rounded-lg px-3 py-2.5 text-sm outline-none"
                style={{ border: `1px solid ${T.border}`, ...fontBody }}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs block mb-1.5" style={{ color: T.muted, ...fontBody }}>Phone</label>
              <input
                value={values.phone}
                onChange={e => update("phone", e.target.value)}
                placeholder="+63 9XX XXX XXXX"
                className="w-full rounded-lg px-3 py-2.5 text-sm outline-none"
                style={{ border: `1px solid ${T.border}`, ...fontBody }}
              />
            </div>
            <div>
              <label className="text-xs block mb-1.5" style={{ color: T.muted, ...fontBody }}>Interested In</label>
              <select
                value={values.service}
                onChange={e => update("service", e.target.value)}
                className="w-full rounded-lg px-3 py-2.5 text-sm outline-none"
                style={{ border: `1px solid ${T.border}`, ...fontBody, backgroundColor: "#fff" }}
              >
                {SERVICE_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs block mb-1.5" style={{ color: T.muted, ...fontBody }}>Message</label>
            <textarea
              rows={4}
              value={values.message}
              onChange={e => update("message", e.target.value)}
              placeholder="Tell us a bit about your situation..."
              className="w-full rounded-lg px-3 py-2.5 text-sm outline-none"
              style={{ border: `1px solid ${T.border}`, ...fontBody }}
            />
          </div>

          {error && <div className="text-xs" style={{ color: "#D64545", ...fontBody }}>{error}</div>}

          <button
            type="submit"
            disabled={status === "submitting"}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg text-sm font-semibold"
            style={{ backgroundColor: T.green, color: "#fff", ...fontBody, opacity: status === "submitting" ? 0.7 : 1 }}
          >
            {status === "submitting" ? "Sending..." : <>Send Inquiry <Send size={14} /></>}
          </button>
        </form>
      </div>
    </section>
  );
}

function Footer() {
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
              <Facebook size={16} /> <Instagram size={16} /> <Linkedin size={16} />
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
              <li>hello@airfairtravel.ph</li>
              <li>+63 917 000 0000</li>
              <li>Marikina City, Metro Manila</li>
            </ul>
          </div>
        </div>
        <div className="flex flex-wrap justify-between gap-2.5 pt-5 text-xs" style={{ borderTop: "1px solid rgba(255,255,255,.1)", ...fontBody }}>
          <span>© 2026 Air Fair Travel & Immigration. All rights reserved.</span>
          <span>Draft preview — content and pricing are placeholders</span>
        </div>
      </div>
    </footer>
  );
}

/* ---------------------------------------------------------------
   CHAT WIDGET PLACEHOLDER
   In production, this whole component goes away — instead, the real
   embed script from site_settings.chat_widget_code (Messenger Chat
   Plugin, Tawk.to, Crisp, WhatsApp click-to-chat, etc.) gets injected
   directly into <body>, e.g.:

     useEffect(() => {
       if (!chatWidgetCode) return;
       const container = document.createElement('div');
       container.innerHTML = chatWidgetCode;
       document.body.appendChild(container);
     }, [chatWidgetCode]);

   Until a real provider is configured in Settings → Integrations, this
   placeholder just shows where the bubble will sit.
----------------------------------------------------------------*/
function ChatWidgetPlaceholder() {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: "fixed", bottom: 20, right: 20, zIndex: 50 }}>
      {open && (
        <div
          className="rounded-2xl p-4 mb-3"
          style={{ width: 260, backgroundColor: "#fff", border: `1px solid ${T.border}`, boxShadow: "0 12px 32px -12px rgba(19,41,63,.25)" }}
        >
          <div className="text-sm font-medium mb-1" style={{ color: T.navy, ...fontBody }}>Chat widget placeholder</div>
          <p className="text-xs" style={{ color: T.muted, ...fontBody }}>
            Once a chat provider is configured in Settings → Integrations, the real widget (Messenger, Tawk.to, WhatsApp, etc.) renders here automatically.
          </p>
        </div>
      )}
      <button
        onClick={() => setOpen(v => !v)}
        aria-label="Chat"
        style={{
          width: 52, height: 52, borderRadius: "9999px", backgroundColor: T.green, color: "#fff",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 8px 20px -6px rgba(110,190,61,.55)", border: "none", cursor: "pointer",
        }}
      >
        <MessageCircle size={22} />
      </button>
    </div>
  );
}

export default function App() {
  return (
    <div style={{ backgroundColor: T.paper, color: T.ink, ...fontBody }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@500&display=swap');
      `}</style>
      <div className="text-center text-xs py-2" style={{ backgroundColor: T.navyDeep, color: "#fff", letterSpacing: "0.03em" }}>
        🧭 <strong style={{ color: T.green }}>Draft Preview</strong> — basic website design for Air Fair Travel & Immigration, not yet live
      </div>
      <Nav />
      <Hero />
      <StatStrip />
      <Services />
      <Process />
      <Testimonials />
      <CtaBand />
      <InquiryForm />
      <Footer />
      <ChatWidgetPlaceholder />
    </div>
  );
}
