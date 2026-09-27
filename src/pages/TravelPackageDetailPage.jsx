import React, { useEffect, useState } from "react";
import { Navigate, useParams } from "react-router-dom";
import { TopBars, Footer, ChatWidget, PageLoading, fallbackSettings, useSeo } from "./Website.jsx";
import { fetchSiteSettings } from "../lib/content.js";
import { useTravelPackage } from "../lib/cms.js";
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

// Single reusable template for every travel package detail page. All content
// comes from the package's published CMS document (falling back to
// lib/travelDestinations.js); this component itself never changes per package.
export default function TravelPackageDetailPage() {
  const { packageSlug } = useParams();
  const { pkg, loading, notFound } = useTravelPackage(packageSlug);
  const [settings, setSettings] = useState(fallbackSettings);

  useEffect(() => {
    (async () => {
      const settingsData = await fetchSiteSettings();
      if (settingsData) setSettings({ ...fallbackSettings, ...settingsData });
    })();
  }, []);

  useSeo({ title: pkg ? pkg.seo?.title || `${pkg.title} | {businessName}` : "", description: pkg?.seo?.description, image: pkg?.image }, settings);

  if (notFound) {
    return <Navigate to="/travel-tours" replace />;
  }

  if (!pkg) {
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
          <VisaSupportCard variant="travel" />
          <PackageRelatedCard related={pkg.relatedCard} />
        </aside>
      </div>

      </main>
      <Footer settings={settings} />
      <ChatWidget code={settings.chat_widget_code} />
    </div>
  );
}
