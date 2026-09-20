import React, { useEffect, useState } from "react";
import { Navigate, useParams } from "react-router-dom";
import { TopBars, Footer, ChatWidget, fallbackSettings } from "./Website.jsx";
import { fetchSiteSettings } from "../lib/content.js";
import { getVisaCountry } from "../lib/visaCountries.js";
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

// Single reusable template for every visa country detail page. All content —
// intro copy, the featured image, the about text, highlight cards,
// requirements, FAQs, related services, and the inquiry form schema — comes
// from the matched entry in lib/visaCountries.js. This component itself
// never changes per country/visa type.
export default function VisaCountryPage() {
  const { countrySlug } = useParams();
  const country = getVisaCountry(countrySlug);
  const [settings, setSettings] = useState(fallbackSettings);

  useEffect(() => {
    (async () => {
      const settingsData = await fetchSiteSettings();
      if (settingsData) setSettings({ ...fallbackSettings, ...settingsData });
    })();
  }, []);

  useEffect(() => {
    if (!country) return;
    document.title = country.seo?.title || `${country.title} | ${settings.business_name || fallbackSettings.business_name}`;
  }, [country, settings.business_name]);

  if (!country) {
    return <Navigate to="/visa-assistance/international-tourist-visa" replace />;
  }

  return (
    <div className="travel-site pis-page">
      <TopBars settings={settings} />
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

      <Footer settings={settings} />
      <ChatWidget code={settings.chat_widget_code} />
    </div>
  );
}
