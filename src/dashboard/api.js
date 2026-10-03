// Dashboard data access for the CMS (cms_documents / cms_versions /
// cms_published), media library, submissions and user management.
// Permissions are enforced by RLS and the SECURITY DEFINER RPCs in the
// database; the UI only mirrors them.
import { supabase } from "../lib/supabase.js";

export class ConflictError extends Error {
  constructor() {
    super("Someone else saved this item after you opened it. Reload to see their changes, then re-apply yours.");
    this.name = "ConflictError";
  }
}

const DOC_COLUMNS = "id,kind,slug,title,sort_order,draft,draft_revision,published_revision,published_version_id,published_at,published_by,form_document_id,service_id,is_archived,created_at,updated_at,updated_by";

export function docStatus(doc) {
  if (!doc) return "Draft";
  if (doc.is_archived) return "Archived";
  if (!doc.published_version_id) return "Draft";
  if (doc.draft_revision > (doc.published_revision || 0)) return "Unpublished changes";
  return "Published";
}

// ---------------------------------------------------------------------------
// Profile / role
// ---------------------------------------------------------------------------

export async function fetchMyProfile(userId) {
  const { data, error } = await supabase.from("profiles").select("id,email,full_name,role,is_active").eq("id", userId).maybeSingle();
  if (error) throw error;
  return data;
}

// ---------------------------------------------------------------------------
// Documents
// ---------------------------------------------------------------------------

export async function listDocuments(kinds, { includeArchived = false } = {}) {
  let query = supabase.from("cms_documents").select(DOC_COLUMNS).in("kind", Array.isArray(kinds) ? kinds : [kinds]).order("sort_order").order("slug");
  if (!includeArchived) query = query.eq("is_archived", false);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function getDocument(id) {
  const { data, error } = await supabase.from("cms_documents").select(DOC_COLUMNS).eq("id", id).single();
  if (error) throw error;
  return data;
}

export async function saveDraft(doc, { title, slug, sort_order, draft, form_document_id }) {
  const patch = { draft };
  if (title !== undefined) patch.title = title;
  if (slug !== undefined) patch.slug = slug;
  if (sort_order !== undefined) patch.sort_order = sort_order;
  if (form_document_id !== undefined) patch.form_document_id = form_document_id;
  const { data, error } = await supabase
    .from("cms_documents")
    .update(patch)
    .eq("id", doc.id)
    .eq("draft_revision", doc.draft_revision)
    .select(DOC_COLUMNS);
  if (error) throw error;
  if (!data || data.length === 0) throw new ConflictError();
  return data[0];
}

export async function createDocument({ kind, slug, title, sort_order = 0, draft, form_document_id = null }) {
  const { data, error } = await supabase
    .from("cms_documents")
    .insert({ kind, slug, title, sort_order, draft, form_document_id })
    .select(DOC_COLUMNS)
    .single();
  if (error) throw error;
  return data;
}

export async function publishDocuments(ids, note) {
  const { error } = await supabase.rpc("cms_publish", { p_document_ids: ids, p_note: note || null });
  if (error) throw error;
}

export async function unpublishDocument(id, note) {
  const { error } = await supabase.rpc("cms_unpublish", { p_document_id: id, p_note: note || null });
  if (error) throw error;
}

export async function archiveDocument(doc) {
  if (doc.published_version_id) await unpublishDocument(doc.id, "Archived");
  const fresh = await getDocument(doc.id);
  const { error } = await supabase.from("cms_documents").update({ is_archived: true }).eq("id", fresh.id);
  if (error) throw error;
}

export async function listVersions(documentId) {
  const { data, error } = await supabase
    .from("cms_versions")
    .select("id,version_no,action,title,created_at,created_by,note,draft_revision")
    .eq("document_id", documentId)
    .order("version_no", { ascending: false })
    .limit(100);
  if (error) throw error;
  return data || [];
}

export async function getVersionContent(versionId) {
  const { data, error } = await supabase.from("cms_versions").select("id,version_no,content,title").eq("id", versionId).single();
  if (error) throw error;
  return data;
}

export async function restoreVersion(versionId) {
  const { data, error } = await supabase.rpc("cms_restore_version", { p_version_id: versionId });
  if (error) throw error;
  return data;
}

export async function fetchProfilesMap() {
  const { data } = await supabase.from("profiles").select("id,email,full_name");
  const map = {};
  (data || []).forEach(p => { map[p.id] = p.full_name || p.email; });
  return map;
}

// ---------------------------------------------------------------------------
// Media library (bucket catalog-images, table media)
// ---------------------------------------------------------------------------

const MEDIA_BUCKET = "catalog-images";

function readImageSize(file) {
  return new Promise(resolve => {
    if (!file.type?.startsWith("image/")) return resolve({});
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { resolve({ width: img.naturalWidth, height: img.naturalHeight }); URL.revokeObjectURL(url); };
    img.onerror = () => { resolve({}); URL.revokeObjectURL(url); };
    img.src = url;
  });
}

function mediaPath(fileName) {
  const now = new Date();
  const id = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const safe = fileName.replace(/[^\w.-]+/g, "_").slice(-80);
  return `media/${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, "0")}/${id}-${safe}`;
}

export async function uploadMedia(file, { altText = "", folder = "library" } = {}) {
  if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type)) throw new Error("Choose a JPG, PNG, WebP or GIF image.");
  if (file.size > 5 * 1024 * 1024) throw new Error("Choose an image smaller than 5 MB.");
  const path = mediaPath(file.name);
  const { error: uploadError } = await supabase.storage.from(MEDIA_BUCKET).upload(path, file, { contentType: file.type, upsert: false, cacheControl: "31536000" });
  if (uploadError) throw uploadError;
  const { data: urlData } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path);
  const size = await readImageSize(file);
  const { data, error } = await supabase.from("media").insert({
    url: urlData.publicUrl, alt_text: altText || null, bucket: MEDIA_BUCKET, storage_path: path,
    file_name: file.name, mime_type: file.type, size_bytes: file.size, folder, ...size,
  }).select().single();
  if (error) throw error;
  return data;
}

export async function listMedia() {
  const { data, error } = await supabase.from("media").select("*").order("created_at", { ascending: false }).limit(1000);
  if (error) throw error;
  return data || [];
}

export async function updateMedia(id, patch) {
  const { data, error } = await supabase.from("media").update(patch).eq("id", id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteMedia(item) {
  if (item.storage_path) {
    const { error } = await supabase.storage.from(item.bucket || MEDIA_BUCKET).remove([item.storage_path]);
    if (error) throw error;
  }
  const { error } = await supabase.from("media").delete().eq("id", item.id);
  if (error) throw error;
}

// Where an image URL is used: drafts (editors can read) + published content.
export async function findMediaUsage(url) {
  const docs = await listDocuments(["global", "page", "immigration_service", "visa_destination", "travel_package", "travel_destination", "news_article", "testimonial"], { includeArchived: true });
  return docs.filter(doc => JSON.stringify(doc.draft).includes(url)).map(doc => ({ id: doc.id, kind: doc.kind, title: doc.title }));
}

// Copies an image that still lives at its original URL (site /public file or
// Unsplash) into Storage, then points every draft that used the old URL to
// the new one. The drafts must be published for the site to switch over.
export async function importPendingMedia(item) {
  const res = await fetch(item.source_url || item.url, { mode: "cors" });
  if (!res.ok) throw new Error(`Could not download ${item.url} (${res.status})`);
  const blob = await res.blob();
  const type = blob.type && blob.type.startsWith("image/") ? blob.type : "image/jpeg";
  const ext = { "image/png": "png", "image/webp": "webp", "image/gif": "gif" }[type] || "jpg";
  const baseName = (item.source_url || item.url).split("?")[0].split("/").pop() || "image";
  const file = new File([blob], /\.\w{3,4}$/.test(baseName) ? baseName : `${baseName}.${ext}`, { type });
  const path = mediaPath(file.name);
  const { error: uploadError } = await supabase.storage.from(MEDIA_BUCKET).upload(path, file, { contentType: type, upsert: false, cacheControl: "31536000" });
  if (uploadError) throw uploadError;
  const { data: urlData } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path);
  const size = await readImageSize(file);
  const updated = await updateMedia(item.id, {
    url: urlData.publicUrl, storage_path: path, bucket: MEDIA_BUCKET, file_name: file.name,
    mime_type: type, size_bytes: file.size, folder: "imported", ...size,
  });
  const changedDocs = await replaceUrlInDrafts(item.url, urlData.publicUrl, item.id);
  return { media: updated, changedDocs };
}

async function replaceUrlInDrafts(oldUrl, newUrl, mediaId) {
  const docs = await listDocuments(["global", "page", "immigration_service", "visa_destination", "travel_package", "travel_destination", "news_article", "testimonial"], { includeArchived: true });
  const changed = [];
  for (const doc of docs) {
    const text = JSON.stringify(doc.draft);
    if (!text.includes(JSON.stringify(oldUrl))) continue;
    const draft = replaceImage(doc.draft, oldUrl, newUrl, mediaId);
    const saved = await saveDraft(doc, { draft });
    changed.push(saved);
  }
  return changed;
}

function replaceImage(value, oldUrl, newUrl, mediaId) {
  if (Array.isArray(value)) return value.map(item => replaceImage(item, oldUrl, newUrl, mediaId));
  if (value && typeof value === "object") {
    if (value.src === oldUrl) return { ...value, src: newUrl, mediaId };
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, replaceImage(v, oldUrl, newUrl, mediaId)]));
  }
  return value === oldUrl ? newUrl : value;
}

// ---------------------------------------------------------------------------
// Submissions
// ---------------------------------------------------------------------------

export async function signedAttachmentUrl(path) {
  const { data, error } = await supabase.storage.from("form-attachments").createSignedUrl(path, 60 * 10);
  if (error) throw error;
  return data.signedUrl;
}

// ---------------------------------------------------------------------------
// Users (Edge Function admin-users; role changes go straight to profiles)
// ---------------------------------------------------------------------------

export async function callAdminUsers(action, payload = {}) {
  const { data, error } = await supabase.functions.invoke("admin-users", { body: { action, ...payload } });
  if (error) {
    let message = error.message;
    try { const body = await error.context?.json?.(); if (body?.error) message = body.error; } catch { /* keep default */ }
    throw new Error(message);
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

export async function listProfiles() {
  const { data, error } = await supabase.from("profiles").select("id,email,full_name,role,is_active,created_at").order("email");
  if (error) throw error;
  return data || [];
}

export async function updateProfile(id, patch) {
  const { data, error } = await supabase.from("profiles").update(patch).eq("id", id).select().single();
  if (error) throw error;
  return data;
}
