# Phase 4: Edge Function request and authorization hardening

Implemented locally; deployment remains pending.

## Changes

- `admin-users` uses the shared origin allowlist instead of wildcard CORS.
  Missing/invalid credentials still fail independently of CORS. Requests without
  an Origin header do not bypass authentication.
- Form Emails test/retry actions now require the Form Emails section, including
  for administrators/editors with custom section restrictions. Role membership
  alone no longer substitutes for that permission.
- A shared streaming reader counts actual UTF-8 bytes, rather than trusting
  Content-Length or reading an unlimited body before checking its length.
- JSON endpoints reject null, arrays, primitives and malformed JSON. User and
  mailbox identifiers receive strict UUID validation before downstream queries.
- Unexpected user-management, inbox-send and mailbox-verification exceptions
  return fixed public error messages. Campaign test-send provider failures are
  similarly mapped. Deliberate request-validation errors remain actionable.
- User-management authentication/network failures are inside its safe response
  handler. Unknown account targets fail before a service-role Auth mutation.
- Form/campaign catch logging records the operation stage, not raw exception
  text or request/customer content. Existing structured provider delivery/status
  records are retained; this is not a rewrite of the email diagnostics feature.
- Inbound webhooks use the bounded reader before signature verification. Raw
  JSON text is not parsed/reserialized before HMAC verification. Replay and
  timestamp checks remain unchanged.

| Endpoint | Body limit |
| --- | --- |
| admin-users | 16,000 bytes |
| mailbox-verify | 16,000 bytes |
| inbox-send | 60,000 bytes |
| form-submit | 300,000 bytes |
| campaign-worker JSON actions | 200,000 bytes |
| resend-inbound | 300,000 bytes |

Campaign RFC 8058 one-click unsubscribe remains a separate POST token path, not a
JSON action. Public form submissions and newsletter confirmation/unsubscribe
remain public by design. Scheduled jobs retain their existing authentication and
throttling rules. Application-wide email quotas remain Phase 7 work.

## Deployment and checks

Apply earlier authorization migrations first. Redeploy `admin-users`,
`inbox-send`, `mailbox-verify`, `form-submit`, `campaign-worker`, and
`resend-inbound`, including their shared modules. No new secret is required.
Review `EXTRA_ALLOWED_ORIGINS` for the intended deployment. The existing shared
allowlist includes production website origins and localhost development origins;
CORS is not treated as an authorization mechanism.

Checks:

- `npm run test:auth`: streaming body limits, UTF-8 accounting, object validation,
  safe exceptions, UUIDs and invitation redirects.
- `npm run test:security:e2e`: four actual Deno handlers against local fake
  services; CORS, methods, invalid credentials/IDs, request limits, safe provider
  failure handling and worker authentication. No emails leave the machine.
- `npm run test:email:e2e`: normal public forms/newsletters/email actions plus
  disabled-section and unconfirmed-account denials.
- Existing inbox/webhook unit tests and Deno type checks for all six handlers.

Hosted authentication, RLS deployment and live provider behavior still require a
release smoke test. These local checks do not establish production configuration.
