# Website form emails

One flow for every website inquiry, plus a separate newsletter double opt-in.

## How it works

```
Browser form ──> form-submit Edge Function ──> form_submissions (+ CRM lead via existing trigger)
                   │  spam + rate-limit + validation
                   └─> email_outbox (1 staff + 1 client row per submission) ──> Resend
```

- **Forms covered**: contact (`general`), immigration assessments, visa
  inquiries, travel package inquiries. Routing and the template are chosen by
  `service_type`; `form_id` is used to look up the current name of the
  service / country / package in the CMS (e.g. "Bali, Indonesia"). There is one
  template per service type, not one per package.
- **Staff notification**: to the monitored inbox for that service type
  (Settings > Email); Reply-To is the client, so staff can answer directly.
- **Client confirmation**: only to the address typed in the form; Reply-To is
  the monitored inbox. It never repeats the visitor's free text.
- **Sender** (fixed in code): `Air Fair Travel & Immigration <no-reply@airfairtravel.com>`.
- **Newsletter** (separate): signup sends a "confirm your subscription" email;
  the address is only on the marketing list after the link is clicked. Marketing
  sends must use the `newsletter_marketing_audience` view (confirmed and not
  unsubscribed). Signups never create inquiries or CRM leads.

### Why a queue (`email_outbox`)

- One row per email with a unique `dedupe_key` (`form:<submission id>:staff` /
  `:client`), so a retried request can't queue a second email.
- The row id is sent to Resend as the `Idempotency-Key`, so a retry after a
  crash can't deliver twice.
- `status`, `attempts`, `next_attempt_at` and `last_error` give retries
  (1, 5, 15, 60, 360 min; 5 attempts) and a visible log in the dashboard.
- The rendered email is stored, so a retry sends exactly the same content.

Retries: the function sends right after saving; a pg_cron job (every 5 min, via
pg_net) calls the function's `process_due` action, which only sends queued
emails that are due. Admins can also press **Retry failed now** (which also
retries emails that gave up). No database triggers are added.

### Protection

- Recipients come only from `email_settings` (admins) and the submitter's own
  validated address; the sender is a constant. Request fields such as `to`,
  `from`, `template` or `service_type` are ignored.
- Hidden honeypot field + minimum fill time: bots get a normal "thank you" and
  nothing is saved or sent.
- Rate limits (hashed IPs): 5 form submissions per 10 min and 30 per day per
  connection; 5 newsletter signups per hour. Max 3 client confirmations and 3
  newsletter emails per address per day. Same person + same form within 10 min:
  staff get one "[Possible duplicate]" notification, the client isn't re-emailed.
- Until the lockdown step, if the function is unreachable the site saves the
  form directly as before (same id, so no duplicate) and no email is sent.
  After `supabase/pending/lock_direct_form_inserts.sql` is applied, direct saves
  are refused, so every submission passes the checks above; if the function is
  down, visitors see a "please try again" message.

## Settings (dashboard > Settings > Email, admins only)

| Setting | Purpose |
|---|---|
| Monitored staff inbox | Required before sending can be switched on. Receives all notifications and client replies. |
| Separate inbox per service | Optional overrides for contact / immigration / visa / travel. |
| Test mode: send everything to | While set, every email goes only to this address, marked `[TEST]`. |
| Send emails | Master switch. Off by default. |

## Edge Function secrets

| Secret | Required | Notes |
|---|---|---|
| `RESEND_API_KEY` | yes | Must be the **rotated** key (the old one appeared in a screenshot). |
| `RATE_LIMIT_SALT` | recommended | Any long random string; keys the IP hashes. Defaults to a server-only value. |
| `SITE_URL` | no | Defaults to `https://airfairtravel.com` (links in emails). |
| `EXTRA_ALLOWED_ORIGINS` | no | Comma-separated extra origins allowed to call the function (e.g. a preview URL). |

## Deployment

See [form-emails-deploy.md](form-emails-deploy.md) for the ordered steps and rollback.

## Tests

- `npm run test:email`: 29 unit tests with an in-memory database and a fake
  mailer (routing, recipient restrictions, spam guards, rate limits, retries,
  scheduled runs, idempotency, duplicates, newsletter double opt-in).
- `npm run typecheck:functions`: Deno type-check of the Edge Function.
- `npm run test:email:e2e`: runs the real Edge Function under Deno against a
  local fake Supabase and a Resend sink, with network access limited to
  localhost. Sends nothing.
