import React, { useEffect, useState } from "react";
import { Navigate, useParams } from "react-router-dom";
import { TopBars, Footer, ChatWidget, fallbackSettings } from "./Website.jsx";
import { fetchSiteSettings } from "../lib/content.js";
import { getImmigrationService } from "../lib/immigrationServices.js";
import ServiceHero from "../components/immigration/ServiceHero.jsx";
import ServiceAbout from "../components/immigration/ServiceAbout.jsx";
import EligibilityGrid from "../components/immigration/EligibilityGrid.jsx";
import AssistanceGrid from "../components/immigration/AssistanceGrid.jsx";
import WhyChooseSection from "../components/immigration/WhyChooseSection.jsx";
import ServiceAssessmentForm from "../components/immigration/ServiceAssessmentForm.jsx";
import ServiceHelpCTA from "../components/immigration/ServiceHelpCTA.jsx";

// Single reusable template for every Philippine Immigration Services detail
// page. All content, images, eligibility, assistance items, and the form
// schema come from the matched entry in lib/immigrationServices.js — this
// component itself never changes per service.
export default function ImmigrationServicePage() {
  const { serviceSlug } = useParams();
  const service = getImmigrationService(serviceSlug);
  const [settings, setSettings] = useState(fallbackSettings);

  useEffect(() => {
    (async () => {
      const settingsData = await fetchSiteSettings();
      if (settingsData) setSettings({ ...fallbackSettings, ...settingsData });
    })();
  }, []);

  useEffect(() => {
    if (!service) return;
    document.title = service.seo?.title || `${service.title} | ${settings.business_name || fallbackSettings.business_name}`;
  }, [service, settings.business_name]);

  if (!service) {
    return <Navigate to="/philippine-immigration-services" replace />;
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
        <ServiceAssessmentForm service={service} />
      </div>
      {!service.hideHelpCta && <ServiceHelpCTA />}
      <Footer settings={settings} />
      <ChatWidget code={settings.chat_widget_code} />
    </div>
  );
}
