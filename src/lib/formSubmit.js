import { getSupabase } from "./supabaseLazy.js";

// Files go to the PRIVATE form-attachments bucket. The site stores only the
// object path; staff open files through short-lived signed URLs in the
// dashboard. Visitors can upload but never list or read attachments.
async function uploadAttachment(file) {
  const month = new Date().toISOString().slice(0, 7);
  const id = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const safeName = file.name.replace(/[^\w.-]+/g, "_").slice(-80);
  const path = `submissions/${month}/${id}-${safeName}`;
  const supabase = await getSupabase();
  const { error } = await supabase.storage
    .from("form-attachments")
    .upload(path, file, { contentType: file.type || undefined, upsert: false });
  if (error) throw error;
  return path;
}

/**
 * Save a website form submission.
 *
 * form      formView() of the published form document (key/documentId/versionId)
 * formId    unique identifier of this form on this page, e.g. "visa-inquiry-japan"
 *           (see docs/form-identifiers.md)
 * serviceType  general | immigration | visa | travel
 * formType  legacy form_type value the dashboard already understands
 * source    { documentId, versionId } of the service/page the form is on
 * fields    the fields that were visible when submitting
 * values    { [field.name]: value }
 * metadata  extra context stored in raw_data
 */
export async function submitWebsiteForm({ form, formId, serviceType, formType, source = {}, fields, values, metadata = {} }) {
  const payload = {};
  const attachments = [];
  const failedUploads = [];

  for (const field of fields) {
    const value = values[field.name];
    if (field.type === "file") {
      if (!value) continue;
      try {
        const path = await uploadAttachment(value);
        attachments.push({ field: field.name, path, name: value.name, size: value.size, type: value.type });
      } catch {
        failedUploads.push(field.name);
      }
      payload[field.name] = value.name;
      continue;
    }
    if (value !== undefined && value !== "" && value !== null) payload[field.name] = value;
  }

  const sourcePage = typeof window !== "undefined" ? window.location.pathname : "";
  const supabase = await getSupabase();
  const { error } = await supabase.from("form_submissions").insert({
    form_type: formType,
    form_key: form?.key || null,
    document_id: source.documentId || null,
    form_version_id: form?.versionId || null,
    source_page: sourcePage,
    attachments,
    name: payload.fullName || payload.name || "",
    email: payload.email || "",
    phone: payload.phone || "",
    raw_data: {
      ...payload,
      ...metadata,
      ...(failedUploads.length ? { attachment_upload_failed: failedUploads } : {}),
      // Identifiers: copied into the form_id / service_type / source columns by
      // a database trigger (migration 20260927130000_form_identifiers).
      form_id: formId,
      service_type: serviceType,
      source: sourcePage,
      source_page: sourcePage,
      submitted_at: new Date().toISOString(),
    },
  });
  if (error) throw error;
}

export async function subscribeToNewsletter(email) {
  const supabase = await getSupabase();
  const { error } = await supabase.from("newsletter_subscribers").insert({
    email: email.trim(),
    source_page: typeof window !== "undefined" ? window.location.pathname : "",
  });
  // 23505 = already subscribed (unique email): treat as success.
  if (error && error.code !== "23505") throw error;
}
