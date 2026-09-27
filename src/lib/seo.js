// <head> management for the public site: title, description, Open Graph /
// Twitter tags, canonical URL, robots and structured data.
//
// The same tags are written two ways: into the DOM at runtime (applySeo) and
// into the prerendered HTML at build time (scripts/prerender.mjs reads what
// pages report through collectSsrSeo while rendering on the server).
//
// Canonical/og:url and absolute image URLs need the production address, so
// they are only written when VITE_SITE_URL is set (see .env.production).

export const SITE_URL = (import.meta.env.VITE_SITE_URL || "").replace(/\/+$/, "");
const DEFAULT_IMAGE = import.meta.env.VITE_OG_IMAGE || "";

export function absoluteUrl(path) {
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) return path;
  return SITE_URL ? `${SITE_URL}/${String(path).replace(/^\/+/, "")}` : "";
}

// The full set of head tags for one page. An empty content/href means the
// tag should be absent.
export function seoTags({ title, description, image, type = "website", noindex = false, path = "/" }) {
  const pageUrl = SITE_URL ? SITE_URL + path : "";
  const imageUrl = absoluteUrl(image) || absoluteUrl(DEFAULT_IMAGE);
  return {
    title,
    metas: [
      ...(title ? [["property", "og:title", title], ["name", "twitter:title", title]] : []),
      ...(description ? [["name", "description", description], ["property", "og:description", description], ["name", "twitter:description", description]] : []),
      ["property", "og:type", type],
      ["property", "og:url", pageUrl],
      ["property", "og:image", imageUrl],
      ["name", "twitter:image", imageUrl],
      ["name", "twitter:card", imageUrl ? "summary_large_image" : "summary"],
      ["name", "robots", noindex ? "noindex, nofollow" : ""],
    ],
    links: [["canonical", noindex ? "" : pageUrl]],
  };
}

function setMeta(attr, key, content) {
  let tag = document.head.querySelector(`meta[${attr}="${key}"]`);
  if (!content) { tag?.remove(); return; }
  if (!tag) {
    tag = document.createElement("meta");
    tag.setAttribute(attr, key);
    document.head.appendChild(tag);
  }
  tag.setAttribute("content", content);
}

function setLink(rel, href) {
  let tag = document.head.querySelector(`link[rel="${rel}"]`);
  if (!href) { tag?.remove(); return; }
  if (!tag) {
    tag = document.createElement("link");
    tag.setAttribute("rel", rel);
    document.head.appendChild(tag);
  }
  tag.setAttribute("href", href);
}

export function applySeo(meta) {
  const tags = seoTags({ ...meta, path: window.location.pathname });
  if (tags.title) document.title = tags.title;
  tags.metas.forEach(([attr, key, content]) => setMeta(attr, key, content));
  tags.links.forEach(([rel, href]) => setLink(rel, href));
}

// schema.org data for the business. Only facts that are certain are included:
// name, site, logo and country. Phone and email are left out until Settings
// holds the confirmed public contact details.
export function organizationJsonLd(settings) {
  if (!SITE_URL) return null;
  const sameAs = [settings.facebook_url, settings.instagram_url, settings.linkedin_url].filter(Boolean);
  return {
    "@context": "https://schema.org",
    "@type": "TravelAgency",
    name: settings.business_name,
    url: `${SITE_URL}/`,
    logo: absoluteUrl("/airfair_logo_colored.png"),
    address: { "@type": "PostalAddress", addressCountry: "PH" },
    ...(sameAs.length && { sameAs }),
  };
}

export function applyOrganizationJsonLd(settings) {
  const data = organizationJsonLd(settings);
  if (!data) return undefined;
  const id = "af-org-jsonld";
  let tag = document.getElementById(id);
  if (!tag) {
    tag = document.createElement("script");
    tag.type = "application/ld+json";
    tag.id = id;
    document.head.appendChild(tag);
  }
  tag.textContent = JSON.stringify(data);
  return () => tag.remove();
}

// ---- Build-time prerendering -------------------------------------------
// While a page renders on the server, its useSeo / structured data calls are
// recorded here; the prerender script reads and resets them per route.
let ssrHead = { meta: null, jsonLd: [] };
export function collectSsrSeo(meta) { ssrHead.meta = meta; }
export function collectSsrJsonLd(data) { if (data) ssrHead.jsonLd.push(data); }
export function takeSsrHead() {
  const head = ssrHead;
  ssrHead = { meta: null, jsonLd: [] };
  return head;
}
