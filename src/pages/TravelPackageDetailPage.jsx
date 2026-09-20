import React, { useEffect, useState } from "react";
import { Navigate, useParams } from "react-router-dom";
import { TopBars, Footer, ChatWidget, fallbackSettings } from "./Website.jsx";
import { fetchSiteSettings } from "../lib/content.js";
import { getTravelPackage } from "../lib/travelDestinations.js";
import PackageBreadcrumb from "../components/travel/PackageBreadcrumb.jsx";
import PackageIntro from "../components/travel/PackageIntro.jsx";
import PackageFeaturedImage from "../components/travel/PackageFeaturedImage.jsx";
import PackageAbout from "../components/travel/PackageAbout.jsx";
import PackageHighlightsGrid from "../components/travel/PackageHighlightsGrid.jsx";
import PackageIncluded from "../components/travel/PackageIncluded.jsx";
import VisaFAQ from "../components/visa/VisaFAQ.jsx";
import PackageInquiryForm from "../components/travel/PackageInquiryForm.jsx";
import VisaSupportCard from "../components/visa/VisaSupportCard.jsx";
import PackageRelatedCard from "../components/travel/PackageRelatedCard.jsx";
import PackageSidebarPoster from "../components/travel/PackageSidebarPoster.jsx";

// Single reusable template for every travel package detail page. All
// content — intro copy, the featured image, highlights, inclusions, FAQs,
// the related-destinations card, and the inquiry form schema — comes from
// the matched entry in lib/travelDestinations.js. This component itself
// never changes per package.
export default function TravelPackageDetailPage() {
  const { packageSlug } = useParams();
  const pkg = getTravelPackage(packageSlug);
  const [settings, setSettings] = useState(fallbackSettings);

  useEffect(() => {
    (async () => {
      const settingsData = await fetchSiteSettings();
      if (settingsData) setSettings({ ...fallbackSettings, ...settingsData });
    })();
  }, []);

  useEffect(() => {
    if (!pkg) return;
    document.title = pkg.seo?.title || `${pkg.title} | ${settings.business_name || fallbackSettings.business_name}`;
  }, [pkg, settings.business_name]);

  if (!pkg) {
    return <Navigate to="/travel-tours" replace />;
  }

  return (
    <div className="travel-site pis-page">
      <TopBars settings={settings} />
      <PackageBreadcrumb pkg={pkg} />

      <div className="section-shell vcp2-body">
        <div className="vcp2-main">
          <PackageFeaturedImage pkg={pkg} />
          <PackageIntro pkg={pkg} />

          <PackageAbout pkg={pkg} />
          <PackageHighlightsGrid items={pkg.packageHighlights} />
          <PackageIncluded items={pkg.whatsIncluded} />
          <VisaFAQ faqs={pkg.faqs} />
        </div>

        <aside className="vcp2-sidebar tt-package-sidebar">
          <PackageSidebarPoster pkg={pkg} />
          <PackageInquiryForm pkg={pkg} formConfig={pkg.inquiryForm} />
          <VisaSupportCard description="Talk to our travel specialists for personalized assistance." />
          <PackageRelatedCard related={pkg.relatedCard} />
        </aside>
      </div>

      <Footer settings={settings} />
      <ChatWidget code={settings.chat_widget_code} />
    </div>
  );
}
