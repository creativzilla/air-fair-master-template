import { defineConfig, loadEnv } from 'vite'
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

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  return {
    plugins: [react(), siteMeta(env)],
    server: {
      port: 5173,
      host: true,
    },
  }
})
