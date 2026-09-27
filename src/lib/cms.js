// Published-content store for the public website.
//
// - One request loads every row of public.cms_published (published content
//   only; drafts live in cms_documents, which anonymous visitors cannot read).
// - The last successful response is cached in localStorage so returning
//   visitors see current content immediately; first-time visitors see the
//   hardcoded fallback (src/lib/cmsFallback.js) until the request finishes.
// - If Supabase cannot be reached, the cache or the fallback stays on screen,
//   so no section is ever blank.
// - Preview: /any-page?preview=1 shows DRAFTS, but only when a signed-in
//   editor/admin session exists (RLS returns nothing to anyone else).
//   ?preview=0 leaves preview mode.
import { useMemo, useSyncExternalStore } from "react";
import { getSupabase, restSelect } from "./supabaseLazy.js";
import { FALLBACK_DOCS } from "./cmsFallback.js";
import {
  buildIndex, globalContent, pageView, formView, immigrationService, immigrationCards,
  visaCountry, travelPackage, homepageTravelCards, travelDestination, newsCollections, testimonials,
} from "./cmsAdapters.js";

const CACHE_KEY = "af-cms-published:v1";
const PREVIEW_KEY = "af-cms-preview";
const PUBLISHED_COLUMNS = "document_id,kind,slug,title,sort_order,content,version_id";

function readCache() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(CACHE_KEY) || "null");
    return Array.isArray(parsed?.docs) ? parsed.docs : null;
  } catch {
    return null;
  }
}

function writeCache(docs) {
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify({ savedAt: Date.now(), docs }));
  } catch {
    // Storage full or blocked: the site still works, just without the cache.
  }
}

function makeState(docs, status, source) {
  return { docs, status, source, index: buildIndex(docs || FALLBACK_DOCS, FALLBACK_DOCS) };
}

const isBrowser = typeof window !== "undefined";
const bootstrapDocs = Array.isArray(globalThis.__AF_CMS_DOCS__) ? globalThis.__AF_CMS_DOCS__ : null;
const cachedDocs = !bootstrapDocs && isBrowser ? readCache() : null;

// status: "loading" | "ready" | "error"
// source: "live" | "cache" | "fallback" | "preview" | "bootstrap"
let state = bootstrapDocs
  ? makeState(bootstrapDocs, "ready", "bootstrap")
  : makeState(cachedDocs, "loading", cachedDocs ? "cache" : "fallback");

const listeners = new Set();
let started = !!bootstrapDocs;

function setState(next) {
  state = next;
  listeners.forEach(listener => listener());
}

function wantsPreview() {
  try {
    const flag = new URLSearchParams(window.location.search).get("preview");
    if (flag === "1") window.sessionStorage.setItem(PREVIEW_KEY, "1");
    if (flag === "0") window.sessionStorage.removeItem(PREVIEW_KEY);
    return window.sessionStorage.getItem(PREVIEW_KEY) === "1";
  } catch {
    return false;
  }
}

async function loadDrafts() {
  const supabase = await getSupabase();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;
  const { data, error } = await supabase
    .from("cms_documents")
    .select("id,kind,slug,title,sort_order,draft,form_document_id")
    .eq("is_archived", false);
  if (error || !data?.length) return null;
  return data.map(doc => ({
    document_id: doc.id,
    version_id: null,
    kind: doc.kind,
    slug: doc.slug,
    title: doc.title,
    sort_order: doc.sort_order,
    content: doc.draft,
    form_document_id: doc.form_document_id,
  }));
}

async function load() {
  try {
    if (wantsPreview()) {
      const drafts = await loadDrafts();
      if (drafts) {
        setState(makeState(drafts, "ready", "preview"));
        return;
      }
    }
    const data = await restSelect("cms_published", `select=${PUBLISHED_COLUMNS}`);
    if (!Array.isArray(data)) throw new Error("No data");
    writeCache(data);
    setState(makeState(data, "ready", "live"));
  } catch {
    setState({ ...state, status: "error" });
  }
}

function subscribe(listener) {
  listeners.add(listener);
  if (!started && isBrowser) {
    started = true;
    load();
  }
  return () => listeners.delete(listener);
}

export function useCms() {
  return useSyncExternalStore(subscribe, () => state, () => state);
}

export function isPreviewMode() {
  return state.source === "preview";
}

// True only on a first visit while the request is in flight (fallback shown).
const isFirstLoad = s => s.status === "loading" && s.source === "fallback";

// Resolve a single item: found → item; missing while any request is still in
// flight → loading (a newer cache/live set may contain it); otherwise not found.
function resolveItem(s, doc, adapt) {
  if (doc) return { item: adapt(doc), loading: false, notFound: false };
  if (s.status === "loading") return { item: null, loading: true, notFound: false };
  return { item: null, loading: false, notFound: true };
}

// ---------------------------------------------------------------------------
// Hooks used by the website components
// ---------------------------------------------------------------------------

export function useGlobalContent() {
  const s = useCms();
  return useMemo(() => globalContent(s.index), [s.index]);
}

export function useLabels() {
  return useGlobalContent().shared?.labels || {};
}

export function usePage(slug) {
  const s = useCms();
  return useMemo(() => ({ ...pageView(s.index, slug), loading: isFirstLoad(s) }), [s, slug]);
}

export function useForm(key) {
  const s = useCms();
  return useMemo(() => formView(s.index.get("form", key)), [s.index, key]);
}

export function useImmigrationCards(placement) {
  const s = useCms();
  return useMemo(() => immigrationCards(s.index, placement), [s.index, placement]);
}

export function useImmigrationService(slug) {
  const s = useCms();
  return useMemo(() => {
    const { item, loading, notFound } = resolveItem(s, s.index.get("immigration_service", slug), doc => immigrationService(s.index, doc));
    return { service: item, loading, notFound };
  }, [s, slug]);
}

export function useVisaCountries() {
  const s = useCms();
  return useMemo(() => s.index.list("visa_destination").map(doc => visaCountry(s.index, doc)), [s.index]);
}

export function useVisaCountry(slug) {
  const s = useCms();
  return useMemo(() => {
    const { item, loading, notFound } = resolveItem(s, s.index.get("visa_destination", slug), doc => visaCountry(s.index, doc));
    return { country: item, loading, notFound };
  }, [s, slug]);
}

export function useTravelPackages() {
  const s = useCms();
  return useMemo(() => s.index.list("travel_package").map(doc => travelPackage(s.index, doc)), [s.index]);
}

export function useTravelPackage(slug) {
  const s = useCms();
  return useMemo(() => {
    const { item, loading, notFound } = resolveItem(s, s.index.get("travel_package", slug), doc => travelPackage(s.index, doc));
    return { pkg: item, loading, notFound };
  }, [s, slug]);
}

export function useHomepageTravelCards() {
  const s = useCms();
  return useMemo(() => homepageTravelCards(s.index), [s.index]);
}

export function useTravelDestinations() {
  const s = useCms();
  return useMemo(() => s.index.list("travel_destination").map(travelDestination), [s.index]);
}

export function useNews() {
  const s = useCms();
  return useMemo(() => ({ ...newsCollections(s.index), loading: isFirstLoad(s), ready: s.status !== "loading" }), [s]);
}

export function useTestimonials() {
  const s = useCms();
  return useMemo(() => testimonials(s.index), [s.index]);
}
