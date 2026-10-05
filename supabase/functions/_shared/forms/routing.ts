// Who receives what. Recipients come ONLY from email_settings (admin-edited in
// the dashboard) and the submitter's own validated address; the sender is a
// fixed constant. Nothing in a public request can change them.
import type { ServiceType } from "./identifiers.ts";
import { isValidEmail, normalizeEmail } from "./validate.ts";

export const SENDER = "Air Fair Travel & Immigration <no-reply@airfairtravel.com>";

export interface EmailSettings {
  sending_enabled: boolean;
  staff_inbox: string | null;
  inbox_general: string | null;
  inbox_immigration: string | null;
  inbox_visa: string | null;
  inbox_travel: string | null;
  test_redirect_to: string | null;
}

export const DEFAULT_SETTINGS: EmailSettings = {
  sending_enabled: false, staff_inbox: null, inbox_general: null, inbox_immigration: null, inbox_visa: null, inbox_travel: null, test_redirect_to: null,
};

// The monitored inbox for a service type: its own inbox if set, otherwise the
// main staff inbox. Also used as Reply-To on client emails.
export function staffInboxFor(settings: EmailSettings, serviceType: ServiceType | "newsletter"): string | null {
  const specific = serviceType === "newsletter" ? null : settings[`inbox_${serviceType}` as keyof EmailSettings];
  const candidate = (typeof specific === "string" && specific) || settings.staff_inbox;
  return isValidEmail(candidate) ? normalizeEmail(candidate) : null;
}

export interface Envelope {
  to: string;
  replyTo: string | null;
  subjectPrefix: string;
  redirectedFrom: string | null;
}

// Test mode: every email (staff and client) goes to the test address instead,
// marked [TEST], so real customers are never emailed while testing.
export function envelope(settings: EmailSettings, to: string, replyTo: string | null): Envelope {
  const test = isValidEmail(settings.test_redirect_to) ? normalizeEmail(settings.test_redirect_to) : null;
  if (test) return { to: test, replyTo, subjectPrefix: "[TEST] ", redirectedFrom: to };
  return { to, replyTo, subjectPrefix: "", redirectedFrom: null };
}
