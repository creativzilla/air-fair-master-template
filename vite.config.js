import path from 'node:path'
import fs from 'node:fs'
import { build, defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

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
      return [
        meta('twitter:card', image ? 'summary_large_image' : 'summary', 'name'),
        ...(image ? [meta('og:image', image), meta('twitter:image', image, 'name')] : []),
      ]
    },
  }
}

// After every client build (`vite build`, `npm run build`, Bolt.new publish),
// prerender the public pages into static HTML + sitemap.xml
// (scripts/prerender.mjs). A failure here never fails the build: the site
// then works exactly as a plain single-page app.
function prerenderPages(mode) {
  let config
  return {
    name: 'air-fair-prerender',
    apply: 'build',
    configResolved(resolved) { config = resolved },
    async closeBundle() {
      if (config.build.ssr) return
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
  return {
    plugins: [react(), siteMeta(env), prerenderPages(mode)],
    server: {
      port: 5173,
      host: true,
    },
  }
})
