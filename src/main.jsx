import React, { Suspense, lazy } from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate, matchRoutes } from 'react-router-dom'
import './index.css'
// Page stylesheets stay global (same order as before code splitting): some
// shared components, like the homepage news block, rely on their rules.
import './components/NewsEvents.css'
import './pages/NewsPage.css'
import './pages/NewsArticlePage.css'
import Website, { PackageDetailPage } from './pages/Website.jsx'
import PreviewBanner from './components/PreviewBanner.jsx'
import { whenContentReady } from './lib/cms.js'

// Every route except the homepage is its own chunk, so visitors only download
// the page they open (the dashboard alone is most of the old single bundle).
// If a chunk from an older deploy is gone, reload once to pick up the new build.
const reloadFlag = {
  get: () => { try { return sessionStorage.getItem('af-chunk-reload') } catch { return '1' } },
  set: value => { try { value ? sessionStorage.setItem('af-chunk-reload', value) : sessionStorage.removeItem('af-chunk-reload') } catch { /* storage blocked */ } },
}
const loadChunk = load => () => load().then(
  module => { reloadFlag.set(null); return module },
  error => {
    if (!reloadFlag.get()) {
      reloadFlag.set('1')
      window.location.reload()
      return new Promise(() => {})
    }
    throw error
  },
)

const routes = [
  { path: '/', Component: Website },
  { path: '/news', load: () => import('./pages/NewsPage.jsx') },
  { path: '/news/:slug', load: () => import('./pages/NewsArticlePage.jsx') },
  { path: '/package/:slug', Component: PackageDetailPage },
  { path: '/philippine-immigration-services', load: () => import('./pages/PhilippineImmigrationServices.jsx') },
  { path: '/philippine-immigration-services/:serviceSlug', load: () => import('./pages/ImmigrationServicePage.jsx') },
  { path: '/visa-assistance/international-tourist-visa', load: () => import('./pages/InternationalVisaAssistancePage.jsx') },
  { path: '/visa-assistance/:countrySlug', load: () => import('./pages/VisaCountryPage.jsx') },
  { path: '/travel-tours', load: () => import('./pages/TravelToursPage.jsx') },
  { path: '/travel-tours/:packageSlug', load: () => import('./pages/TravelPackageDetailPage.jsx') },
  { path: '/dashboard', load: () => import('./pages/Dashboard.jsx') },
].map(route => (route.load ? { ...route, load: loadChunk(route.load), Component: lazy(loadChunk(route.load)) } : route))

const container = document.getElementById('root')

function render() {
  ReactDOM.createRoot(container).render(
    <React.StrictMode>
      <BrowserRouter>
        <Suspense fallback={null}>
          <Routes>
            {routes.map(({ path, Component }) => <Route key={path} path={path} element={<Component />} />)}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
        <PreviewBanner />
      </BrowserRouter>
    </React.StrictMode>,
  )
}

// Prerendered pages (see scripts/prerender.mjs) already show their content.
// Keep that HTML on screen until this page's code and the live content are
// ready, then let the app take over in one step, without a blank or
// default-content flash in between.
if (container.hasChildNodes()) {
  const match = matchRoutes(routes, window.location)?.[0]?.route
  const current = match?.load
    ? match.load().then(module => { match.Component = module.default })
    : Promise.resolve()
  Promise.all([current, whenContentReady(2500)]).then(render, render)
} else {
  render()
}
