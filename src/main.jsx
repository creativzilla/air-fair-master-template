import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import './index.css'
import Website, { PackageDetailPage } from './pages/Website.jsx'
import PhilippineImmigrationServices from './pages/PhilippineImmigrationServices.jsx'
import ImmigrationServicePage from './pages/ImmigrationServicePage.jsx'
import InternationalVisaAssistancePage from './pages/InternationalVisaAssistancePage.jsx'
import VisaCountryPage from './pages/VisaCountryPage.jsx'
import TravelToursPage from './pages/TravelToursPage.jsx'
import TravelPackageDetailPage from './pages/TravelPackageDetailPage.jsx'
import NewsArticlePage from './pages/NewsArticlePage.jsx'
import NewsPage from './pages/NewsPage.jsx'
import Dashboard from './pages/Dashboard.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Website />} />
        <Route path="/news" element={<NewsPage />} />
        <Route path="/news/:slug" element={<NewsArticlePage />} />
        <Route path="/package/:slug" element={<PackageDetailPage />} />
        <Route path="/philippine-immigration-services" element={<PhilippineImmigrationServices />} />
        <Route path="/philippine-immigration-services/:serviceSlug" element={<ImmigrationServicePage />} />
        <Route path="/visa-assistance/international-tourist-visa" element={<InternationalVisaAssistancePage />} />
        <Route path="/visa-assistance/:countrySlug" element={<VisaCountryPage />} />
        <Route path="/travel-tours" element={<TravelToursPage />} />
        <Route path="/travel-tours/:packageSlug" element={<TravelPackageDetailPage />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
)
