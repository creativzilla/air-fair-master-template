import path from 'node:path'
import fs from 'node:fs'
import { build, defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { validatePublicEnv, securityHeaders } from './scripts/security-config.mjs'

// Share-preview tags that need the production address. Social scrapers don't
// run JavaScript, so these go into index.html at build time; nothing is
// written until VITE_SITE_URL / VITE_OG_IMAGE are set.
function siteMeta(env) {
  const site = (env.VITE_SITE_URL || '').replace(/\/+$/, '')
  const rawImage = env.VITE_OG_IMAGE || ''
  const image = /^https?:\/\//i.test(rawImage) ? rawImage : site && rawImage ? `${site}/${rawImage.replace(/^\/+/, '')}` : ''
  return {
    name: 'air-fair-site-meta',
    transformIndexHtml() {
      const meta = (key, content, attr = 'property') => ({ tag: 'meta', attrs: { [attr]: key, content }, injectTo: 'head' })
      // Google Analytics 4 (only when VITE_GA_ID is set). Loads async at the end
      // of the page so it never delays rendering; the dashboard isn't tracked.
      const gaId = /^G-[A-Z0-9]+$/.test(env.VITE_GA_ID || '') ? env.VITE_GA_ID : ''
      const analytics = gaId ? [
        { tag: 'script', attrs: { async: true, src: `https://www.googletagmanager.com/gtag/js?id=${gaId}` }, injectTo: 'body' },
        { tag: 'script', children: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());if(!location.pathname.startsWith('/dashboard'))gtag('config','${gaId}');`, injectTo: 'body' },
      ] : []
      return [
        meta('twitter:card', image ? 'summary_large_image' : 'summary', 'name'),
        ...(image ? [meta('og:image', image), meta('twitter:image', image, 'name')] : []),
        ...analytics,
      ]
    },
  }
}

// Preload the self-hosted Poppins files most text uses (Latin 400/600/700),
// so the browser fetches them with the CSS instead of after it.
function preloadFonts() {
  return {
    name: 'air-fair-preload-fonts',
    apply: 'build',
    transformIndexHtml(html, ctx) {
      if (!ctx.bundle) return html
      return Object.keys(ctx.bundle)
        .filter(file => /poppins-latin-(400|600|700)-normal[^/]*\.woff2$/.test(file))
        .map(file => ({ tag: 'link', attrs: { rel: 'preload', href: `/${file}`, as: 'font', type: 'font/woff2', crossorigin: '' }, injectTo: 'head-prepend' }))
    },
  }
}

// After every client build (`vite build`, `npm run build`, Bolt.new publish),
// prerender the public pages into static HTML + sitemap.xml
// (scripts/prerender.mjs). A failure here never fails the build: the site
// then works exactly as a plain single-page app.
function prerenderPages(mode) {
  let config
  let buildFailed = false
  return {
    name: 'air-fair-prerender',
    apply: 'build',
    configResolved(resolved) { config = resolved },
    buildEnd(error) { buildFailed = Boolean(error) },
    async closeBundle() {
      if (buildFailed || config.build.ssr) return
      const root = config.root
      const ssrDir = path.join(root, 'dist-ssr')
      const { writeAppShell, prerender } = await import('./scripts/prerender.mjs')
      writeAppShell(root)
      if (process.env.AF_NO_PRERENDER) return
      try {
        await build({
          configFile: false, root, mode, logLevel: 'warn',
          plugins: [react()],
          build: { ssr: 'src/entry-server.jsx', outDir: ssrDir, emptyOutDir: true },
        })
        await prerender({ root, mode, ssrDir })
      } catch (error) {
        console.warn(`prerender skipped: ${error.message}`)
      } finally {
        fs.rmSync(ssrDir, { recursive: true, force: true })
      }
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  validatePublicEnv(env)
  return {
    plugins: [react(), siteMeta(env), preloadFonts(), prerenderPages(mode)],
    server: {
      port: 5173,
      host: 'localhost',
      headers: securityHeaders,
      cors: { origin: /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/ },
      fs: { strict: true, deny: ['.env', '.env.*', '**/.env*', '**/.git/**', '**/.codex/**', '**/.agents/**', '**/*.pem', '**/*.crt', '**/*.key', '**/*.p12'] },
    },
    preview: { host: 'localhost', headers: securityHeaders },
    build: { sourcemap: false },
  }
})
