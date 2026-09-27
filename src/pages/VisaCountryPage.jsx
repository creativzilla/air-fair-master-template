import React, { useEffect, useState } from "react";
import { Navigate, useParams } from "react-router-dom";
import { TopBars, Footer, ChatWidget, PageLoading, fallbackSettings, useSeo } from "./Website.jsx";
import { fetchSiteSettings } from "../lib/content.js";
import { useVisaCountry } from "../lib/cms.js";
import VisaBreadcrumb from "../components/visa/VisaBreadcrumb.jsx";
import VisaIntro from "../components/visa/VisaIntro.jsx";
import VisaFeaturedImage from "../components/visa/VisaFeaturedImage.jsx";
import VisaAbout from "../components/visa/VisaAbout.jsx";
import VisaHighlights from "../components/visa/VisaHighlights.jsx";
import VisaRequirements from "../components/visa/VisaRequirements.jsx";
import VisaFAQ from "../components/visa/VisaFAQ.jsx";
import VisaInquiryForm from "../components/visa/VisaInquiryForm.jsx";
import VisaSupportCard from "../components/visa/VisaSupportCard.jsx";
import RelatedServicesCard from "../components/visa/RelatedServicesCard.jsx";
import PackageSidebarPoster from "../components/travel/PackageSidebarPoster.jsx";

// Single reusable template for every visa country detail page. All content
// comes from the destination's published CMS document (falling back to
// lib/visaCountries.js); this component itself never changes per country.
export default function VisaCountryPage() {
  const { countrySlug } = useParams();
  const { country, loading, notFound } = useVisaCountry(countrySlug);
  const [settings, setSettings] = useState(fallbackSettings);

  useEffect(() => {
    (async () => {
      const settingsData = await fetchSiteSettings();
      if (settingsData) setSettings({ ...fallbackSettings, ...settingsData });
    })();
  }, []);

  useSeo({ title: country ? country.seo?.title || `${country.title} | {businessName}` : "", description: country?.seo?.description, image: country?.featuredImage || country?.promoPoster }, settings);

  if (notFound) {
    return <Navigate to="/visa-assistance/international-tourist-visa" replace />;
  }

  if (!country) {
    return (
      <div className="travel-site pis-page" aria-busy={loading || undefined}>
        <TopBars settings={settings} />
        <main id="main-content">
        <PageLoading />
        </main>
        <Footer settings={settings} />
      </div>
    );
  }

  return (
    <div className="travel-site pis-page">
      <TopBars settings={settings} />
      <main id="main-content">
      <VisaBreadcrumb country={country} />

      <div className="section-shell vcp2-body">
        <div className="vcp2-main">
          <VisaFeaturedImage country={country} />
          <VisaIntro country={country} />

          <VisaAbout country={country} />
          <VisaHighlights items={country.highlights} />
          <VisaRequirements country={country} />
          <VisaFAQ faqs={country.faqs} />
        </div>

        <aside className="vcp2-sidebar tt-package-sidebar">
          <PackageSidebarPoster pkg={country} posterFolder="visa-posters" storageSlug={`visa-${country.slug}`} />
          <VisaInquiryForm country={country} formConfig={country.inquiryForm} />
          <VisaSupportCard />
          <RelatedServicesCard items={country.relatedServices} />
        </aside>
      </div>

      </main>
      <Footer settings={settings} />
      <ChatWidget code={settings.chat_widget_code} />
    </div>
  );
}
