import React, { Suspense, lazy } from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import './index.css'
// Page stylesheets stay global (same order as before code splitting): some
// shared components, like the homepage news block, rely on their rules.
import './components/NewsEvents.css'
import './pages/NewsPage.css'
import './pages/NewsArticlePage.css'
import Website, { PackageDetailPage } from './pages/Website.jsx'
import PreviewBanner from './components/PreviewBanner.jsx'

// Every route except the homepage is its own chunk, so visitors only download
// the page they open (the dashboard alone is most of the old single bundle).
// If a chunk from an older deploy is gone, reload once to pick up the new build.
const reloadFlag = {
  get: () => { try { return sessionStorage.getItem('af-chunk-reload') } catch { return '1' } },
  set: value => { try { value ? sessionStorage.setItem('af-chunk-reload', value) : sessionStorage.removeItem('af-chunk-reload') } catch { /* storage blocked */ } },
}
const page = load => lazy(() => load().then(
  module => { reloadFlag.set(null); return module },
  error => {
    if (!reloadFlag.get()) {
      reloadFlag.set('1')
      window.location.reload()
      return new Promise(() => {})
    }
    throw error
  },
))

const PhilippineImmigrationServices = page(() => import('./pages/PhilippineImmigrationServices.jsx'))
const ImmigrationServicePage = page(() => import('./pages/ImmigrationServicePage.jsx'))
const InternationalVisaAssistancePage = page(() => import('./pages/InternationalVisaAssistancePage.jsx'))
const VisaCountryPage = page(() => import('./pages/VisaCountryPage.jsx'))
const TravelToursPage = page(() => import('./pages/TravelToursPage.jsx'))
const TravelPackageDetailPage = page(() => import('./pages/TravelPackageDetailPage.jsx'))
const NewsArticlePage = page(() => import('./pages/NewsArticlePage.jsx'))
const NewsPage = page(() => import('./pages/NewsPage.jsx'))
const Dashboard = page(() => import('./pages/Dashboard.jsx'))

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Suspense fallback={null}>
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
      </Suspense>
      <PreviewBanner />
    </BrowserRouter>
  </React.StrictMode>,
)
