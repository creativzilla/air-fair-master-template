// Pure helpers that turn CMS documents (rows shaped like public.cms_published)
// into the exact props the existing website components already use. Keeping
// the component-facing shapes unchanged is what lets the site switch to
// Supabase content without any markup or styling changes.

import { optimizedSrc } from "./optimizedImages.js";
import { inputFields, normalizeSchema } from "../../supabase/functions/_shared/forms/schema.ts";

const isPlainObject = value => value !== null && typeof value === "object" && !Array.isArray(value);

// Objects merge key by key; arrays and scalars from `over` replace `base`.
// An explicit "" or null in `over` wins, so editors can intentionally clear
// a field, while keys the CMS has never had fall back to the code defaults.
export function deepMerge(base, over) {
  if (over === undefined) return base;
  if (!isPlainObject(base) || !isPlainObject(over)) return over;
  const merged = { ...base };
  for (const [key, value] of Object.entries(over)) merged[key] = deepMerge(base[key], value);
  return merged;
}

// Resolves a CMS image ({ src, alt } or a plain path) to the URL to load,
// preferring the lighter .webp copy of known local images.
export const imageSrc = image => optimizedSrc((image && typeof image === "object" ? image.src : image) || "");

export function fillTemplate(text, vars) {
  if (typeof text !== "string") return text;
  return text.replace(/\{(\w+)\}/g, (match, key) => (vars[key] !== undefined ? vars[key] : match));
}

function mergePageContent(base = {}, over = {}) {
  const baseSections = base.sections || [];
  const overSections = over.sections || [];
  const overByKey = new Map(overSections.map(section => [section.key, section]));
  const sections = baseSections.map(section => {
    const cms = overByKey.get(section.key);
    return cms ? { ...section, ...cms, fields: deepMerge(section.fields, cms.fields) } : section;
  });
  overSections.forEach(section => {
    if (!baseSections.some(item => item.key === section.key)) sections.push(section);
  });
  const { sections: _a, ...baseRest } = base;
  const { sections: _b, ...overRest } = over;
  return { ...deepMerge(baseRest, overRest), sections };
}

const docKey = (kind, slug) => `${kind}/${slug}`;
const bySortOrder = (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || String(a.slug).localeCompare(String(b.slug));

// Index over the active document set, with every document deep-merged over
// its code fallback (same kind + slug) when one exists.
export function buildIndex(docs, fallbackDocs = []) {
  const fallback = new Map(fallbackDocs.map(doc => [docKey(doc.kind, doc.slug), doc]));
  const merged = new Map();
  const withFallback = doc => {
    const key = docKey(doc.kind, doc.slug);
    if (!merged.has(key)) {
      const base = fallback.get(key)?.content;
      const content = doc.kind === "page" ? mergePageContent(base, doc.content) : deepMerge(base, doc.content || {});
      merged.set(key, { ...doc, content });
    }
    return merged.get(key);
  };

  const byKind = {};
  const bySlug = new Map();
  const byId = new Map();
  for (const doc of docs) {
    (byKind[doc.kind] ||= []).push(doc);
    bySlug.set(docKey(doc.kind, doc.slug), doc);
    if (doc.document_id) byId.set(doc.document_id, doc);
  }
  Object.values(byKind).forEach(list => list.sort(bySortOrder));

  return {
    list: kind => (byKind[kind] || []).map(withFallback),
    get: (kind, slug) => {
      const doc = bySlug.get(docKey(kind, slug));
      return doc ? withFallback(doc) : null;
    },
    getById: id => {
      const doc = id ? byId.get(id) : null;
      return doc ? withFallback(doc) : null;
    },
  };
}

// ---------------------------------------------------------------------------
// Global content, pages, forms
// ---------------------------------------------------------------------------

export function globalContent(index) {
  return index.get("global", "site")?.content || {};
}

export function pageView(index, slug) {
  const doc = index.get("page", slug);
  const sections = doc?.content?.sections || [];
  const byKey = new Map(sections.map(section => [section.key, section]));
  return {
    exists: !!doc,
    seo: doc?.content?.seo || {},
    section: key => byKey.get(key)?.fields || {},
    visible: key => byKey.get(key)?.visible !== false,
  };
}

// The published form: its schema (normalized: every element has a stable id)
// plus the texts the website shows around it.
export function formView(formDoc) {
  if (!formDoc) return null;
  const c = formDoc.content || {};
  const schema = normalizeSchema(c);
  const sections = schema.sections;
  return {
    schema,
    key: formDoc.slug,
    documentId: formDoc.document_id,
    versionId: formDoc.version_id,
    title: c.title,
    description: c.description,
    layout: c.layout,
    submitLabel: c.submitLabel,
    privacyNote: c.privacyNote,
    consent: c.consent || null,
    successTitle: c.successTitle,
    successMessage: c.successMessage,
    successActions: c.successActions || [],
    successRedirect: c.successRedirect || "",
    sections,
    // Every input field in order (including those inside two-column rows).
    fields: inputFields(schema),
  };
}

const DEFAULT_FORM_KEY = {
  immigration_service: slug => `immigration-${slug}`,
  visa_destination: () => "visa-inquiry",
  travel_package: () => "travel-inquiry",
};

export function linkedForm(index, doc) {
  const byId = index.getById(doc.form_document_id);
  if (byId) return formView(byId);
  const key = doc.content?.formKey || DEFAULT_FORM_KEY[doc.kind]?.(doc.slug);
  return key ? formView(index.get("form", key)) : null;
}

const docMeta = doc => ({ documentId: doc.document_id, versionId: doc.version_id, kind: doc.kind, slug: doc.slug });

// ---------------------------------------------------------------------------
// Entities → the shapes of src/lib/immigrationServices.js, visaCountries.js,
// travelDestinations.js, news.js
// ---------------------------------------------------------------------------

export function immigrationService(index, doc) {
  const c = doc.content || {};
  return {
    ...c,
    slug: doc.slug,
    title: c.title ?? doc.title,
    heroImage: imageSrc(c.heroImage),
    aboutImage: c.aboutImage ? imageSrc(c.aboutImage) : undefined,
    form: linkedForm(index, doc),
    _doc: docMeta(doc),
  };
}

export function immigrationCards(index, placement) {
  const flag = placement === "home" ? "showOnHome" : "showOnHub";
  return index
    .list("immigration_service")
    .filter(doc => doc.content?.card?.[flag])
    .map(doc => {
      const c = doc.content;
      return {
        slug: doc.slug,
        title: c.card.title || c.title || doc.title,
        description: c.card.description,
        icon: placement === "home" ? c.card.homeIcon : c.card.hubIcon,
      };
    });
}

export function visaCountry(index, doc) {
  const c = doc.content || {};
  const gallery = (c.gallery || []).map(imageSrc).filter(Boolean);
  const form = linkedForm(index, doc);
  return {
    ...c,
    slug: doc.slug,
    title: c.title ?? doc.title,
    gallery,
    featuredImage: gallery[0],
    relatedServices: (c.relatedServices || []).map(item => ({ ...item, image: imageSrc(item.image) || undefined })),
    promoPoster: imageSrc(c.poster) || undefined,
    inquiryForm: { ...form, fields: form?.fields || [] },
    _doc: docMeta(doc),
  };
}

export function travelPackage(index, doc) {
  const c = doc.content || {};
  const form = linkedForm(index, doc);
  return {
    ...c,
    slug: doc.slug,
    title: c.title ?? doc.title,
    image: imageSrc(c.image),
    gallery: Array.isArray(c.gallery) ? c.gallery.map(imageSrc).filter(Boolean) : undefined,
    packageHighlights: (c.packageHighlights || []).map(item => ({ ...item, image: imageSrc(item.image) })),
    relatedCard: c.relatedCard ? { ...c.relatedCard, image: imageSrc(c.relatedCard.image) } : null,
    promoPoster: imageSrc(c.poster) || undefined,
    inquiryForm: { ...form, fields: form?.fields || [] },
    _doc: docMeta(doc),
  };
}

export function homepageTravelCards(index) {
  return index
    .list("travel_package")
    .filter(doc => doc.content?.showOnHome)
    .map(doc => {
      const c = doc.content;
      return { slug: doc.slug, name: c.name || c.title || doc.title, place: c.place, flagCode: c.flagCode, price: c.price, image: imageSrc(c.image) };
    });
}

export function travelDestination(doc) {
  const c = doc.content || {};
  return { ...c, slug: doc.slug, name: c.name ?? doc.title, image: imageSrc(c.image) };
}

export function newsCollections(index) {
  const articles = index.list("news_article").map(doc => {
    const c = doc.content || {};
    const { article, type, featured: _featured, ...rest } = c;
    return {
      type,
      article,
      item: { ...rest, slug: doc.slug, title: c.title ?? doc.title, image: imageSrc(c.image), logo: c.logo ? imageSrc(c.logo) : undefined },
    };
  });
  const articleContent = {};
  articles.forEach(({ item, article }) => {
    if (article) articleContent[item.slug] = article;
  });
  const stories = articles.filter(a => a.type !== "guide").map(a => a.item);
  const guides = articles.filter(a => a.type === "guide").map(a => a.item);
  return { stories, guides, allArticles: [...stories, ...guides], articleContent };
}

export function testimonials(index) {
  return index.list("testimonial").map(doc => {
    const c = doc.content || {};
    return {
      id: doc.document_id || doc.slug,
      client_name: c.clientName || doc.title,
      quote: c.quote,
      service_category: c.serviceCategory,
      photo_url: imageSrc(c.photo) || null,
    };
  });
}
