// Resend adapter. The API key is read from the Edge Function environment by
// the caller and passed in; it is never logged or returned.

export interface OutgoingEmail {
  from: string;
  to: string;
  replyTo: string | null;
  subject: string;
  html: string;
  text: string;
  tags: Record<string, string>;
}

export type SendResult = { ok: true; id: string } | { ok: false; retryable: boolean; error: string };

export interface Mailer {
  // idempotencyKey = email_outbox row id: Resend returns the original result
  // for a repeated key (24 h), so a retry after a crash never sends twice.
  send(message: OutgoingEmail, idempotencyKey: string): Promise<SendResult>;
}

type FetchLike = (url: string, init: { method: string; headers: Record<string, string>; body: string }) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

export function createResendMailer(apiKey: string | undefined, fetchImpl: FetchLike): Mailer {
  return {
    async send(message, idempotencyKey) {
      if (!apiKey) return { ok: false, retryable: true, error: "RESEND_API_KEY is not set for the Edge Function." };
      let response;
      try {
        response = await fetchImpl("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
          body: JSON.stringify({
            from: message.from,
            to: [message.to],
            ...(message.replyTo ? { reply_to: [message.replyTo] } : {}),
            subject: message.subject,
            html: message.html,
            text: message.text,
            tags: Object.entries(message.tags).map(([name, value]) => ({ name, value: value.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 256) })),
          }),
        });
      } catch (err) {
        return { ok: false, retryable: true, error: `Network error: ${err instanceof Error ? err.message : String(err)}`.slice(0, 500) };
      }
      let data: Record<string, unknown> = {};
      try { data = (await response.json()) as Record<string, unknown>; } catch { /* empty body */ }
      if (response.ok && typeof data.id === "string") return { ok: true, id: data.id };
      const detail = `Resend ${response.status}: ${String(data.message ?? data.name ?? "error")}`.slice(0, 500);
      // 429 / 5xx and "request with this key is still in progress" are temporary.
      const retryable = response.status === 429 || response.status >= 500 || data.name === "concurrent_idempotent_requests";
      return { ok: false, retryable, error: detail };
    },
  };
}
