import React, { useEffect, useState } from "react";
import { Navigate, useParams } from "react-router-dom";
import { TopBars, Footer, ChatWidget, PageLoading, fallbackSettings, useSeo } from "./Website.jsx";
import { fetchSiteSettings } from "../lib/content.js";
import { useImmigrationService } from "../lib/cms.js";
import ServiceHero from "../components/immigration/ServiceHero.jsx";
import ServiceAbout from "../components/immigration/ServiceAbout.jsx";
import EligibilityGrid from "../components/immigration/EligibilityGrid.jsx";
import AssistanceGrid from "../components/immigration/AssistanceGrid.jsx";
import WhyChooseSection from "../components/immigration/WhyChooseSection.jsx";
import ServiceAssessmentForm from "../components/immigration/ServiceAssessmentForm.jsx";
import ServiceHelpCTA from "../components/immigration/ServiceHelpCTA.jsx";

// Single reusable template for every Philippine Immigration Services detail
// page. Content, images and the form come from the service's published CMS
// document (falling back to lib/immigrationServices.js); this component
// itself never changes per service.
export default function ImmigrationServicePage() {
  const { serviceSlug } = useParams();
  const { service, loading, notFound } = useImmigrationService(serviceSlug);
  const [settings, setSettings] = useState(fallbackSettings);

  useEffect(() => {
    (async () => {
      const settingsData = await fetchSiteSettings();
      if (settingsData) setSettings({ ...fallbackSettings, ...settingsData });
    })();
  }, []);

  useSeo({ title: service ? service.seo?.title || `${service.title} | {businessName}` : "", description: service?.seo?.description }, settings);

  if (notFound) {
    return <Navigate to="/philippine-immigration-services" replace />;
  }

  if (!service) {
    return (
      <div className="travel-site pis-page" aria-busy={loading || undefined}>
        <TopBars settings={settings} />
        <PageLoading />
        <Footer settings={settings} />
      </div>
    );
  }

  return (
    <div className="travel-site pis-page">
      <TopBars settings={settings} />
      <ServiceHero service={service} />
      <div className="section-shell svc-body">
        <div className="svc-main">
          <ServiceAbout service={service} />
          <EligibilityGrid service={service} />
          <AssistanceGrid service={service} />
          <WhyChooseSection service={service} />
        </div>
        {service.form && <ServiceAssessmentForm service={service} />}
      </div>
      {!service.hideHelpCta && <ServiceHelpCTA />}
      <Footer settings={settings} />
      <ChatWidget code={settings.chat_widget_code} />
    </div>
  );
}
