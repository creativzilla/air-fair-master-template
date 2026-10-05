// Form identifiers, derived exactly like the database does
// (public.form_id_from_type / service_type_from_type, migration
// 20260927130000_form_identifiers). The server always derives them itself:
// values sent by the browser are never trusted for routing or templates.

export type ServiceType = "general" | "immigration" | "visa" | "travel";

export interface FormIdentifiers {
  formId: string;
  serviceType: ServiceType;
}

const slugify = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

export function deriveIdentifiers(formType: string, formKey: string | null): FormIdentifiers {
  const type = formType || "";
  if (type.startsWith("immigration_")) return { formId: `immigration-${type.slice(12).replace(/_/g, "-")}`, serviceType: "immigration" };
  if (type.startsWith("visa_")) return { formId: `visa-inquiry-${type.slice(5).replace(/_/g, "-")}`, serviceType: "visa" };
  if (type.startsWith("travel_package_")) return { formId: `travel-inquiry-${type.slice(15).replace(/_/g, "-")}`, serviceType: "travel" };
  if (type === "website_inquiry") return { formId: "contact-home", serviceType: "general" };
  return { formId: slugify(formKey || type || "unknown") || "unknown", serviceType: "general" };
}

// Which published CMS item a form_id belongs to, so emails can show its
// current name (e.g. "Bali, Indonesia"). One lookup rule for every package,
// service and country: no per-item code or template.
export function itemRefFromFormId(formId: string): { kind: string; slug: string } | null {
  if (formId.startsWith("immigration-")) return { kind: "immigration_service", slug: formId.slice(12) };
  if (formId.startsWith("visa-inquiry-")) return { kind: "visa_destination", slug: formId.slice(13) };
  if (formId.startsWith("travel-inquiry-")) return { kind: "travel_package", slug: formId.slice(15) };
  return null;
}

export function humanizeSlug(slug: string): string {
  return slug.split("-").filter(Boolean).map(part => (part.length <= 3 && /\d/.test(part) ? part.toUpperCase() : part[0].toUpperCase() + part.slice(1))).join(" ");
}
