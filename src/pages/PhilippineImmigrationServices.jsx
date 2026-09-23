import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Briefcase,
  Clock,
  FileCheck,
  FileText,
  Gavel,
  Heart,
  IdCard,
  Landmark,
  MessageCircle,
  Plane,
  ShieldCheck,
  Users,
} from "lucide-react";
import { TopBars, Footer, ChatWidget, SectionTitle, colors, fallbackSettings } from "./Website.jsx";
import { fetchSiteSettings } from "../lib/content.js";

const immigrationServices = [
  {
    title: "13A Immigrant Visa by Marriage",
    description: "For foreign spouses of Filipino citizens.",
    icon: Heart,
    slug: "13a-immigrant-visa",
  },
  {
    title: "Pre-Arranged Working Visa (9G)",
    description: "Immigration assistance for foreign nationals working in the Philippines.",
    icon: Briefcase,
    slug: "9g-working-visa",
  },
  {
    title: "Tourist Visa Extension",
    description: "Assistance for extending your authorized stay in the Philippines.",
    icon: Plane,
    slug: "tourist-visa-extension",
  },
  {
    title: "ACR I-Card",
    description: "Assistance with Alien Certificate of Registration requirements.",
    icon: IdCard,
    slug: "acr-i-card",
  },
  {
    title: "Special Non-Immigrant Visa",
    description: "Support for applicable special non-immigrant visa applications.",
    icon: FileCheck,
    slug: "special-non-immigrant-visa",
  },
  {
    title: "Naturalization",
    description: "Guidance for eligible foreign nationals seeking Philippine citizenship.",
    icon: Landmark,
    slug: "naturalization",
  },
  {
    title: "Deportation Assistance",
    description: "Support and guidance for immigration-related deportation matters.",
    icon: ShieldCheck,
    slug: "deportation-assistance",
  },
  {
    title: "Petition / Visa Reconsideration",
    description: "Assistance involving immigration petitions or reconsideration matters.",
    icon: Gavel,
    slug: "visa-reconsideration",
  },
  {
    title: "Immigration-Related Consultation",
    description: "Guidance for other immigration concerns and requirements.",
    icon: MessageCircle,
    slug: "consultation",
  },
];

const whyChooseFeatures = [
  { title: "Clear Guidance", description: "Understand the requirements and next steps before moving forward.", icon: Users },
  { title: "Document Assistance", description: "Get guidance in preparing the documents needed for your application.", icon: FileText },
  { title: "Personalized Support", description: "Every situation is different, so assistance is based on your specific requirements.", icon: Heart },
  { title: "Convenient Process", description: "Our team helps coordinate the process so you can focus on what matters most.", icon: Clock },
];

function ImmigrationServiceCard({ icon: Icon, title, description, slug }) {
  return (
    <Link to={`/philippine-immigration-services/${slug}`} className="pis-service-card">
      <div className="pis-service-icon">
        <Icon size={26} strokeWidth={1.8} />
      </div>
      <h3>{title}</h3>
      <p>{description}</p>
      <span className="pis-service-link">
        Learn More <ArrowRight size={14} />
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

function Hero() {
  return (
    <section className="pis-hero">
      <div className="section-shell pis-hero-inner">
        <div className="pis-hero-content">
          <nav className="pis-breadcrumb" aria-label="Breadcrumb">
            <Link to="/">Home</Link>
            <span>/</span>
            <span>Services</span>
            <span>/</span>
            <span className="pis-breadcrumb-current">Philippine Immigration Services</span>
          </nav>

          <h1>Philippine Immigration Services</h1>
          <p className="pis-hero-sub">Clear guidance and professional assistance for your Philippine immigration needs.</p>
          <p className="pis-hero-desc">
            From visa applications and extensions to ACR I-Card assistance and permanent residency, Airfair helps make the
            immigration process easier to understand and manage.
          </p>
          <div className="pis-hero-actions">
            <a className="green-button" href="#services">
              Explore Immigration Services <ArrowRight size={15} />
            </a>
            <a className="outline-green-button" href="/#contact">
              <MessageCircle size={16} /> Talk to Our Team
            </a>
          </div>
        </div>
        <div className="pis-hero-media">
          <img
            src="https://images.unsplash.com/photo-1563463149242-bd378d9ab05c?auto=format&fit=crop&w=1200&q=80"
            alt="Bureau of Immigration, Republic of the Philippines"
          />
        </div>
      </div>
    </section>
  );
}

function About() {
  return (
    <section className="pis-about section-shell">
      <div className="pis-about-grid">
        <div className="pis-about-media">
          <img
            src="https://images.unsplash.com/photo-1544396821-4dd40b938ad3?auto=format&fit=crop&w=1200&q=80"
            alt="Passport and travel documents"
          />
        </div>
        <div className="pis-about-content">

          <h2>Philippine Immigration Services</h2>
          <p>
            Navigating immigration requirements can involve multiple documents, processes, and government procedures.
            Airfair provides assistance for individuals, families, retirees, travelers, and foreign nationals who need
            support with Philippine visa and immigration-related services.
          </p>
          <p>
            Our team helps guide clients through the required steps, documentation, and application process so they can
            move forward with greater clarity and convenience.
          </p>
        </div>
      </div>
    </section>
  );
}

function Services() {
  return (
    <section id="services" className="pis-services">
      <div className="section-shell">
        <SectionTitle
          eyebrow="OUR SERVICES"
          title="Immigration Services"
          description="Explore our range of Philippine immigration services and find the assistance that matches your needs."
        />
        <div className="pis-services-grid">
          {immigrationServices.map(item => (
            <ImmigrationServiceCard key={item.slug} {...item} />
          ))}
        </div>
      </div>
    </section>
  );
}

function WhyChoose() {
  return (
    <section className="pis-why">
      <div className="section-shell">
        <SectionTitle
          eyebrow="WHY AIRFAIR"
          title="Why Choose Airfair?"
          description="Immigration processes can feel complicated. We help make each step easier to understand and manage."
        />
        <div className="pis-feature-grid">
          {whyChooseFeatures.map(item => (
            <FeatureCard key={item.title} {...item} />
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCTA() {
  return (
    <section className="pis-cta section-shell">
      <div className="pis-cta-banner">
        <div className="pis-cta-content">
          <h2>Need Help With Your Immigration Requirements?</h2>
          <p>Tell us what immigration service you need, and our team will help you understand the next steps.</p>
          <div className="pis-cta-actions">
            <a className="green-button" href="/#contact">
              Get Immigration Assistance <ArrowRight size={15} />
            </a>
            <a className="outline-green-button" href="/#contact">
              <MessageCircle size={16} /> Contact Airfair
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

  useEffect(() => {
    (async () => {
      const settingsData = await fetchSiteSettings();
      if (settingsData) setSettings({ ...fallbackSettings, ...settingsData });
    })();
  }, []);

  useEffect(() => {
    document.title = `Philippine Immigration Services | ${settings.business_name || fallbackSettings.business_name}`;
  }, [settings.business_name]);

  return (
    <div className="travel-site pis-page">
      <TopBars settings={settings} />
      <Hero />
      <About />
      <Services />
      <WhyChoose />
      <FinalCTA />
      <Footer settings={settings} />
      <ChatWidget code={settings.chat_widget_code} />
    </div>
  );
}
