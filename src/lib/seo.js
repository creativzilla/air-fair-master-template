// <head> management for the public site: title, description, Open Graph /
// Twitter tags, canonical URL, robots and structured data.
//
// The same tags are written two ways: into the DOM at runtime (applySeo) and
// into the prerendered HTML at build time (scripts/prerender.mjs reads what
// pages report through collectSsrSeo while rendering on the server).
//
// Canonical/og:url and absolute image URLs always use the production
// address (never localhost or a preview host). VITE_SITE_URL overrides it.
export const PRODUCTION_URL = "https://airfairtravel.com";
export const SITE_URL = (import.meta.env.VITE_SITE_URL || PRODUCTION_URL).replace(/\/+$/, "");
// Branded share image (no street address, so it never goes out of date).
const DEFAULT_IMAGE = import.meta.env.VITE_OG_IMAGE || "/og-image.jpg";

// The office address used in structured data (matches Site Settings).
export const BUSINESS_ADDRESS = {
  "@type": "PostalAddress",
  streetAddress: "Unit 5 Psalm 23 Commercial Building, BF Drive, BF Resort Village",
  addressLocality: "Las Piñas City",
  addressRegion: "Metro Manila",
  addressCountry: "PH",
};

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

// schema.org data for the business: name, site, logo, office address and the
// public phone numbers and email from Site Settings.
export function organizationJsonLd(settings) {
  if (!SITE_URL) return null;
  const sameAs = [settings.facebook_url, settings.instagram_url, settings.linkedin_url].filter(Boolean);
  const phones = String(settings.contact_phone || "").split(/[;,/]/).map(s => s.trim()).filter(s => /^\+\d[\d\s-]{6,}$/.test(s));
  const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(settings.contact_email || "") ? settings.contact_email : null;
  return {
    "@context": "https://schema.org",
    "@type": "TravelAgency",
    name: settings.business_name,
    url: `${SITE_URL}/`,
    logo: absoluteUrl("/airfair-logo.png"),
    image: absoluteUrl(DEFAULT_IMAGE),
    address: BUSINESS_ADDRESS,
    ...(phones.length && { telephone: phones[0] }),
    ...(email && { email }),
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
