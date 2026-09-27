// Server entry used only at build time (scripts/prerender.mjs) to turn each
// public page into static HTML, so search engines and link previews see the
// real content, headings and meta tags without running JavaScript.
// The browser app (main.jsx) is unchanged and takes over after loading.
import React from "react";
import { renderToString } from "react-dom/server";
import { StaticRouter } from "react-router-dom/server";
import { Routes, Route } from "react-router-dom";
import Website from "./pages/Website.jsx";
import PhilippineImmigrationServices from "./pages/PhilippineImmigrationServices.jsx";
import ImmigrationServicePage from "./pages/ImmigrationServicePage.jsx";
import InternationalVisaAssistancePage from "./pages/InternationalVisaAssistancePage.jsx";
import VisaCountryPage from "./pages/VisaCountryPage.jsx";
import TravelToursPage from "./pages/TravelToursPage.jsx";
import TravelPackageDetailPage from "./pages/TravelPackageDetailPage.jsx";
import NewsArticlePage from "./pages/NewsArticlePage.jsx";
import NewsPage from "./pages/NewsPage.jsx";
import NotFoundPage from "./pages/NotFoundPage.jsx";

export { takeSsrHead, seoTags } from "./lib/seo.js";

export function render(url) {
  return renderToString(
    <StaticRouter location={url}>
      <Routes>
        <Route path="/" element={<Website />} />
        <Route path="/news" element={<NewsPage />} />
        <Route path="/news/:slug" element={<NewsArticlePage />} />
        <Route path="/philippine-immigration-services" element={<PhilippineImmigrationServices />} />
        <Route path="/philippine-immigration-services/:serviceSlug" element={<ImmigrationServicePage />} />
        <Route path="/visa-assistance/international-tourist-visa" element={<InternationalVisaAssistancePage />} />
        <Route path="/visa-assistance/:countrySlug" element={<VisaCountryPage />} />
        <Route path="/travel-tours" element={<TravelToursPage />} />
        <Route path="/travel-tours/:packageSlug" element={<TravelPackageDetailPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </StaticRouter>
  );
}
