// Runtime <head> management for the public site: title, description, Open
// Graph / Twitter tags, canonical URL, robots and structured data.
//
// Canonical/og:url and absolute image URLs need the production address, so
// they are only written when VITE_SITE_URL is set (see .env.example).

export const SITE_URL = (import.meta.env.VITE_SITE_URL || "").replace(/\/+$/, "");
const DEFAULT_IMAGE = import.meta.env.VITE_OG_IMAGE || "";

export function absoluteUrl(path) {
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) return path;
  return SITE_URL ? `${SITE_URL}/${String(path).replace(/^\/+/, "")}` : "";
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

export function applySeo({ title, description, image, type = "website", noindex = false }) {
  if (title) {
    document.title = title;
    setMeta("property", "og:title", title);
    setMeta("name", "twitter:title", title);
  }
  if (description) {
    setMeta("name", "description", description);
    setMeta("property", "og:description", description);
    setMeta("name", "twitter:description", description);
  }
  setMeta("property", "og:type", type);
  const pageUrl = SITE_URL ? SITE_URL + window.location.pathname : "";
  setLink("canonical", noindex ? "" : pageUrl);
  setMeta("property", "og:url", pageUrl);
  const imageUrl = absoluteUrl(image) || absoluteUrl(DEFAULT_IMAGE);
  setMeta("property", "og:image", imageUrl);
  setMeta("name", "twitter:image", imageUrl);
  setMeta("name", "twitter:card", imageUrl ? "summary_large_image" : "summary");
  setMeta("name", "robots", noindex ? "noindex, nofollow" : "");
}

// schema.org data for the business, built only from what Settings holds.
// Written only for the production site (VITE_SITE_URL set), so test data in
// Settings never reaches search engines from a preview deploy.
export function applyOrganizationJsonLd(settings) {
  if (!SITE_URL) return undefined;
  const id = "af-org-jsonld";
  const sameAs = [settings.facebook_url, settings.instagram_url, settings.linkedin_url].filter(Boolean);
  const data = {
    "@context": "https://schema.org",
    "@type": "TravelAgency",
    name: settings.business_name,
    url: `${SITE_URL}/`,
    logo: absoluteUrl("/airfair_logo_colored.png"),
    ...(settings.contact_phone && { telephone: settings.contact_phone }),
    ...(settings.contact_email && { email: settings.contact_email }),
    address: { "@type": "PostalAddress", addressCountry: "PH" },
    ...(sameAs.length && { sameAs }),
  };
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
