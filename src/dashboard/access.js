// Dashboard sections and who can open them. Must match the database
// (public.role_sections / role_default_sections / section_allowed).
//
// role_sections:   what can be granted to a role (everything, except for "none").
// role defaults:   what a person gets unless an admin customizes them; admins
//                  edit them in Team → Role defaults (role_access_defaults).
//                  ROLE_DEFAULTS are the built-in starting values.
// custom access:   an explicit list of sections.
export const SECTIONS = [
  { key: "clients", note: "Includes shared client records and meetings", label: "Clients", group: "Clients" },
  { key: "email-inbox", label: "Email Inbox", group: "Clients", note: "Also needs Clients" },
  { key: "pipeline", note: "Includes shared client records, meetings and tasks", label: "Pipeline", group: "Clients" },
  { key: "forms", note: "Includes shared client records and submitted attachments", label: "Forms", group: "Clients" },
  { key: "documents", note: "Includes shared client records, submitted attachments and team resources", label: "Documents", group: "Clients" },
  { key: "bookings", note: "Includes shared client records and meetings", label: "Calendar", group: "Clients" },
  { key: "edit-website", label: "Pages", group: "Website" },
  { key: "cms-services", label: "Services", group: "Website" },
  { key: "news", label: "News", group: "Website" },
  { key: "testimonials", label: "Testimonials", group: "Website" },
  { key: "media", label: "Media", group: "Website" },
  { key: "form-emails", label: "Form Emails", group: "Business" },
  { key: "team", label: "Team", group: "Business" },
  { key: "settings", label: "Settings", group: "Business" },
];
const ALL = SECTIONS.map(s => s.key);
const LEADS = ["clients", "email-inbox", "pipeline", "forms", "documents", "bookings"];
const CONTENT = ["edit-website", "cms-services", "news", "testimonials", "media"];
// Any section can be granted to any role; granting it also grants the server
// permissions it needs. Publishing/deleting content and admin-level team
// changes stay admin-only.
export const ROLE_SECTIONS = { admin: ALL, editor: ALL, staff: ALL, none: [] };
export const ROLE_DEFAULTS = { admin: ALL, editor: [...LEADS, ...CONTENT], staff: ["clients", "pipeline", "forms", "documents", "bookings"], none: [] };

// Sections this person can open: role defaults, or their custom list, never beyond the role.
export function effectiveSections(role, member, defaults = ROLE_DEFAULTS) {
  const permitted = ROLE_SECTIONS[role] || [];
  const chosen = member?.customAccess ? permitted.filter(k => member.allowedModules?.[k] === true) : (defaults[role] || ROLE_DEFAULTS[role] || []);
  return new Set(chosen.filter(k => permitted.includes(k) && (k !== "email-inbox" || chosen.includes("clients"))));
}

// Full on/off map for a custom list, starting from the role defaults.
export const defaultsMap = (role, defaults = ROLE_DEFAULTS) => Object.fromEntries(ALL.map(k => [k, (defaults[role] || ROLE_DEFAULTS[role] || []).includes(k)]));

// Rows of role_access_defaults → { admin: [...], editor: [...], staff: [...] }; missing roles keep built-ins.
export const defaultsFromRows = rows => ({ ...ROLE_DEFAULTS, ...Object.fromEntries((rows || []).map(r => [r.role, r.sections || []])) });
