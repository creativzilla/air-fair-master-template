import { getSupabase } from "./supabaseLazy.js";

// Website forms are sent to the form-submit Edge Function, which checks spam
// and rate limits, saves the submission (the CRM lead is still created by the
// database) and sends the staff notification + client confirmation.
//
// If the function isn't reachable (not deployed yet, or down), the form is
// saved directly as before, with the same id, so nothing is saved twice. Once
// migration 20260928110000 closes direct saves, that fallback is refused and
// the visitor sees a "please try again" message instead.

// Files go to the PRIVATE form-attachments bucket. The site stores only the
// object path; staff open files through short-lived signed URLs in the
// dashboard. Visitors can upload but never list or read attachments.
async function uploadAttachment(file) {
  const month = new Date().toISOString().slice(0, 7);
  const id = newId();
  const safeName = file.name.replace(/[^\w.-]+/g, "_").slice(-80);
  const path = `submissions/${month}/${id}-${safeName}`;
  const supabase = await getSupabase();
  const { error } = await supabase.storage
    .from("form-attachments")
    .upload(path, file, { contentType: file.type || undefined, upsert: false });
  if (error) throw error;
  return path;
}

function newId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map(b => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

// A problem the visitor can fix or should know about (invalid input, too many
// submissions, service unavailable); its message is safe to show.
export class FormSubmitError extends Error {}

const UNAVAILABLE = "We couldn't send this right now. Please try again in a few minutes, or contact us by phone or email.";

// After the direct-save lockdown (migration 20260928110000) the fallback is
// refused with 42501; tell the visitor instead of failing silently.
function fallbackError() {
  return new FormSubmitError(UNAVAILABLE);
}

// Returns the function's response, "unavailable" when it can't be reached
// (the caller falls back to a direct save), or throws FormSubmitError.
async function callFormFunction(supabase, body) {
  const { data, error } = await supabase.functions.invoke("form-submit", { body });
  if (!error) return data;
  const status = error.context?.status;
  if (error.name === "FunctionsHttpError" && status && status !== 404 && status < 500) {
    let message = "";
    try { message = (await error.context.json())?.error || ""; } catch { /* no body */ }
    throw new FormSubmitError(message || "Please check the form and try again.");
  }
  return "unavailable";
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
 * guard     from useFormGuard(): hidden spam field + time to fill
 */
export async function submitWebsiteForm({ form, formId, serviceType, formType, source = {}, fields, values, metadata = {}, guard = {} }) {
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
  const row = {
    id: newId(),
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
      // Identifiers: the Edge Function derives these itself; they're kept here
      // for the direct-save fallback (copied into columns by a DB trigger).
      form_id: formId,
      service_type: serviceType,
      source: sourcePage,
      source_page: sourcePage,
      submitted_at: new Date().toISOString(),
    },
  };

  const supabase = await getSupabase();
  const result = await callFormFunction(supabase, { action: "submit_form", submission: row, guard });
  if (result !== "unavailable") return;

  // Fallback: save directly, as before (no emails). 23505 = the function did
  // save it after all (same id), which is fine.
  const { error } = await supabase.from("form_submissions").insert(row);
  if (error && error.code !== "23505") throw fallbackError();
}

// Newsletter signup (separate from inquiries), with double opt-in. Returns
// "check_email" when a confirmation email is on its way, or "saved" when the
// function wasn't reachable and the address was stored directly (unconfirmed).
export async function subscribeToNewsletter(email, guard = {}) {
  const supabase = await getSupabase();
  const sourcePage = typeof window !== "undefined" ? window.location.pathname : "";
  const result = await callFormFunction(supabase, { action: "newsletter_subscribe", email: email.trim(), source_page: sourcePage, guard });
  if (result !== "unavailable") return "check_email";
  const { error } = await supabase.from("newsletter_subscribers").insert({ email: email.trim(), source_page: sourcePage });
  // 23505 = already subscribed (unique email): treat as success.
  if (error && error.code !== "23505") throw fallbackError();
  return "saved";
}

// Confirmation / unsubscribe links from the newsletter email.
export async function newsletterLinkAction(action, token) {
  const supabase = await getSupabase();
  const { data, error } = await supabase.functions.invoke("form-submit", { body: { action, token } });
  if (!error) return { ok: true, status: data?.status };
  let message = "";
  try { message = (await error.context?.json?.())?.error || ""; } catch { /* no body */ }
  return { ok: false, error: message || "Something went wrong. Please try again later." };
}
