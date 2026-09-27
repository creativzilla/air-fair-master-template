/* eslint-env node */
// Turns every public page into static HTML. Runs automatically at the end of
// every `vite build` (see the air-fair-prerender plugin in vite.config.js), so
// Bolt.new publishes and local builds produce the same output.
//
// - Content comes from the published CMS rows and Settings at build time; if
//   Supabase can't be reached the built-in defaults are used, never a failure.
// - Writes dist/<route>.html with the page's markup, title, description,
//   canonical and share tags, plus sitemap.xml and the robots.txt Sitemap line.
// - dist/app.html keeps the empty app shell for routes that aren't
//   prerendered (the dashboard, items published after this build).
// Content published later appears on the live site immediately (the app
// loads it in the browser); the static HTML refreshes on the next publish.
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { loadEnv } from "vite";

// JSON safe inside <script>: escapes "<" and every non-ASCII character (incl. line separators).
const inlineJson = value => JSON.stringify(value).replace(/[^ -~]|</g, c => "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0"));
const attr = value => String(value).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
const text = value => String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;");
const MANAGED = /\s*<meta (?:name|property)="(?:description|robots|og:(?:title|description|type|url|image)|twitter:(?:title|description|image|card))"[^>]*>|\s*<link rel="canonical"[^>]*>/g;

// The app shell for non-prerendered routes; written before anything else so
// the host's fallback rewrite (/app.html) always has a target.
export function writeAppShell(root = process.cwd()) {
  const dist = path.join(root, "dist");
  fs.copyFileSync(path.join(dist, "index.html"), path.join(dist, "app.html"));
}

export async function prerender({ root = process.cwd(), mode = "production", ssrDir = path.join(root, "dist-ssr") } = {}) {
  const DIST = path.join(root, "dist");
  const env = { ...loadEnv(mode, root, "VITE_"), ...process.env };
  const SITE_URL = (env.VITE_SITE_URL || "").replace(/\/+$/, "");

  async function rest(table, query) {
    const url = env.VITE_SUPABASE_URL, key = env.VITE_SUPABASE_ANON_KEY;
    if (!url || !key) throw new Error("Supabase URL/key not set");
    const response = await fetch(`${url}/rest/v1/${table}?${query}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error(`${table}: HTTP ${response.status}`);
    return response.json();
  }

  let docs = null, settings = null;
  try {
    docs = await rest("cms_published", "select=document_id,kind,slug,title,sort_order,content,version_id");
    [settings] = await rest("site_settings", "select=*&order=updated_at.desc&limit=1");
    console.log(`prerender: ${docs.length} published documents, settings ${settings ? "loaded" : "not found"}`);
  } catch (error) {
    console.warn(`prerender: live content unavailable (${error.message}); using built-in defaults`);
  }
  // Read by src/lib/cms.js and Website.jsx when the server bundle loads.
  if (Array.isArray(docs) && docs.length) globalThis.__AF_CMS_DOCS__ = docs;
  if (settings) globalThis.__AF_SETTINGS__ = settings;

  const serverEntry = fs.readdirSync(ssrDir).find(f => /^entry-server\.m?js$/.test(f));
  const { render, takeSsrHead, seoTags } = await import(`${pathToFileURL(path.join(ssrDir, serverEntry)).href}?t=${Date.now()}`);

  // Every public route: hubs plus one page per published item.
  const slugs = kind => (docs || []).filter(d => d.kind === kind).map(d => d.slug);
  const fallbackSlugs = {
    immigration_service: ["13a-immigrant-visa", "9g-working-visa", "acr-i-card", "consultation", "deportation-assistance", "naturalization", "special-non-immigrant-visa", "special-resident-retirees-visa", "tourist-visa-extension", "visa-reconsideration"],
    visa_destination: ["australia", "canada", "japan", "schengen", "singapore", "south-korea", "uk", "us"],
    travel_package: [],
    news_article: [],
  };
  const list = kind => (slugs(kind).length ? slugs(kind) : fallbackSlugs[kind]);
  const routes = [
    "/", "/philippine-immigration-services", "/visa-assistance/international-tourist-visa", "/travel-tours", "/news",
    ...list("immigration_service").map(s => `/philippine-immigration-services/${s}`),
    ...list("visa_destination").map(s => `/visa-assistance/${s}`),
    ...list("travel_package").map(s => `/travel-tours/${s}`),
    ...list("news_article").map(s => `/news/${s}`),
  ];

  const shell = fs.readFileSync(path.join(DIST, "app.html"), "utf8");

  function page(route, markup, head) {
    const tags = seoTags({ ...(head.meta || {}), path: route === "/" ? "/" : route });
    const headTags = [
      ...tags.metas.filter(([, , content]) => content).map(([a, k, content]) => `<meta ${a}="${k}" content="${attr(content)}" />`),
      ...tags.links.filter(([, href]) => href).map(([rel, href]) => `<link rel="${rel}" href="${attr(href)}" />`),
      ...head.jsonLd.map(data => `<script type="application/ld+json">${inlineJson(data)}</script>`),
      // A JSON data block, not a script: it never blocks parsing or rendering.
      ...(settings ? [`<script type="application/json" id="af-settings">${inlineJson(settings)}</script>`] : []),
    ].map(tag => `    ${tag}`).join("\n");
    let html = shell.replace(MANAGED, "");
    if (tags.title) html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${text(tags.title)}</title>`);
    html = html.replace(/(\s*)<script type="module"/, `\n${headTags}$1<script type="module"`);
    return html.replace('<div id="root"></div>', `<div id="root">${markup}</div>`);
  }

  const written = [];
  for (const route of routes) {
    const markup = render(route);
    const head = takeSsrHead();
    // Skip anything that didn't render real content (missing item, loading state).
    if (!head.meta || /news-article-missing|aria-busy="true"/.test(markup) || !/<h1[\s>]/.test(markup)) {
      console.warn(`prerender: skipped ${route} (no content)`);
      continue;
    }
    // Flat files (/news -> news.html): Netlify and Vercel (cleanUrls) serve them
    // at the extensionless URL without a trailing-slash redirect.
    const file = route === "/" ? path.join(DIST, "index.html") : path.join(DIST, `${route.slice(1)}.html`);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, page(route, markup, head));
    written.push(route);
  }

  if (SITE_URL) {
    const urls = written.map(route => `  <url><loc>${SITE_URL}${route === "/" ? "/" : route}</loc></url>`).join("\n");
    fs.writeFileSync(path.join(DIST, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`);
    const robotsFile = path.join(DIST, "robots.txt");
    const robots = fs.readFileSync(robotsFile, "utf8").replace(/\n?Sitemap:.*$/gm, "").trimEnd();
    fs.writeFileSync(robotsFile, `${robots}\n\nSitemap: ${SITE_URL}/sitemap.xml\n`);
  } else {
    console.warn("prerender: VITE_SITE_URL not set; no sitemap.xml, canonical or og:url written");
  }

  console.log(`prerender: wrote ${written.length} pages${SITE_URL ? " + sitemap.xml" : ""}`);
  return written;
}
