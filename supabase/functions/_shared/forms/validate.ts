// Server-side validation of public requests. Only the fields listed here are
// ever written; anything else in the request (e.g. "to", "from", "template")
// is ignored.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL = /^[^@\s<>()[\]\\,;:"]{1,64}@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/;
const ATTACHMENT_PATH = /^submissions\/\d{4}-\d{2}\/[0-9A-Za-z-]{8,40}-[\w.-]{1,80}$/;
// Identifiers the server sets itself; stripped from what the browser sends.
const SERVER_KEYS = new Set(["form_id", "service_type", "source"]);

export const LIMITS = {
  rawDataBytes: 200_000,
  rawDataKeys: 120,
  textValue: 10_000,
  listItems: 50,
  attachments: 5,
  attachmentBytes: 25 * 1024 * 1024,
  minFillMs: 1200,
};

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}

export function isValidEmail(value: unknown): value is string {
  return typeof value === "string" && value.length <= 254 && !/[\r\n]/.test(value) && EMAIL.test(value.trim());
}

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export interface Guard {
  company_website?: unknown; // honeypot: hidden from people, filled by bots
  elapsed_ms?: unknown;      // time between the form appearing and submit
}

// True for obvious bots: the hidden field was filled, or the form was sent
// faster than a person could fill it.
export function isBot(guard: Guard | undefined): boolean {
  if (!guard || typeof guard !== "object") return false;
  if (typeof guard.company_website === "string" && guard.company_website.trim() !== "") return true;
  if (typeof guard.elapsed_ms === "number" && guard.elapsed_ms >= 0 && guard.elapsed_ms < LIMITS.minFillMs) return true;
  return false;
}

export interface SubmissionInput {
  id: string;
  form_type: string;
  form_key: string;
  document_id: string | null;
  form_version_id: string | null;
  source_page: string;
  name: string;
  email: string;
  phone: string;
  raw_data: Record<string, unknown>;
  attachments: Array<{ field: string; path: string; name: string; size: number; type: string }>;
}

type Result<T> = { ok: true; value: T } | { ok: false; error: string };

const str = (value: unknown, max: number) => (typeof value === "string" ? value.trim().slice(0, max) : "");

function cleanRawData(input: unknown): Result<Record<string, unknown>> {
  if (!input || typeof input !== "object" || Array.isArray(input)) return { ok: false, error: "Invalid form data." };
  const entries = Object.entries(input as Record<string, unknown>);
  if (entries.length > LIMITS.rawDataKeys) return { ok: false, error: "Too many fields." };
  const out: Record<string, unknown> = {};
  for (const [key, value] of entries) {
    if (!/^[A-Za-z0-9_]{1,64}$/.test(key)) return { ok: false, error: "Invalid field name." };
    if (SERVER_KEYS.has(key)) continue;
    if (value === null || typeof value === "boolean" || (typeof value === "number" && Number.isFinite(value))) out[key] = value;
    else if (typeof value === "string") {
      if (value.length > LIMITS.textValue) return { ok: false, error: `"${key}" is too long.` };
      out[key] = value;
    } else if (Array.isArray(value) && value.length <= LIMITS.listItems && value.every(item => typeof item === "string" && item.length <= 500)) out[key] = value;
    else return { ok: false, error: `"${key}" has an unsupported value.` };
  }
  if (JSON.stringify(out).length > LIMITS.rawDataBytes) return { ok: false, error: "The form is too large." };
  return { ok: true, value: out };
}

export function validateSubmission(input: unknown): Result<SubmissionInput> {
  if (!input || typeof input !== "object") return { ok: false, error: "Invalid request." };
  const s = input as Record<string, unknown>;
  if (!isUuid(s.id)) return { ok: false, error: "Invalid submission id." };
  const formType = str(s.form_type, 120);
  const formKey = str(s.form_key, 120);
  if (!/^[a-z0-9][a-z0-9_-]{0,119}$/.test(formType)) return { ok: false, error: "Invalid form." };
  if (!/^[a-z0-9][a-z0-9-]{0,119}$/.test(formKey)) return { ok: false, error: "Invalid form." };
  for (const key of ["document_id", "form_version_id"]) {
    if (s[key] != null && !isUuid(s[key])) return { ok: false, error: "Invalid form reference." };
  }
  const email = str(s.email, 254);
  if (!isValidEmail(email)) return { ok: false, error: "Please enter a valid email address." };
  const sourcePage = str(s.source_page, 300);
  const rawData = cleanRawData(s.raw_data);
  if (!rawData.ok) return rawData;

  const attachmentsIn = s.attachments ?? [];
  if (!Array.isArray(attachmentsIn) || attachmentsIn.length > LIMITS.attachments) return { ok: false, error: "Too many attachments." };
  const attachments: SubmissionInput["attachments"] = [];
  for (const item of attachmentsIn) {
    const a = (item ?? {}) as Record<string, unknown>;
    if (typeof a.path !== "string" || !ATTACHMENT_PATH.test(a.path)) return { ok: false, error: "Invalid attachment." };
    if (typeof a.field !== "string" || !/^[A-Za-z0-9_]{1,64}$/.test(a.field)) return { ok: false, error: "Invalid attachment." };
    const size = typeof a.size === "number" && a.size >= 0 && a.size <= LIMITS.attachmentBytes ? a.size : -1;
    if (size < 0) return { ok: false, error: "Invalid attachment." };
    attachments.push({ field: a.field, path: a.path, name: str(a.name, 255), size, type: str(a.type, 100) });
  }

  return {
    ok: true,
    value: {
      id: (s.id as string).toLowerCase(),
      form_type: formType,
      form_key: formKey,
      document_id: (s.document_id as string | null) ?? null,
      form_version_id: (s.form_version_id as string | null) ?? null,
      source_page: /^\/[\w\-./~%]*$/.test(sourcePage) ? sourcePage : "/",
      name: str(s.name, 200),
      email,
      phone: str(s.phone, 60),
      raw_data: rawData.value,
      attachments,
    },
  };
}
