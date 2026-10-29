# Security remediation — Phase 6

Status: upload broker, storage lockdown and download hardening implemented and
tested locally. No live migration, deployment, commit or push was performed.
Antivirus scanning and abandoned-upload cleanup are still outstanding; this is
not a claim that every stored file is safe.

## Changes

- `supabase/functions/form-upload/index.ts`: public binary upload endpoint with
  allowlisted CORS, safe errors, service-only Storage writes and database quotas.
- `supabase/functions/_shared/forms/uploads.ts`: checks the published form and
  file field, allowed extension/MIME pairing, field-specific size limit and
  actual streamed byte count before Storage. The hard cap remains 10 MiB.
  Signature checks reject ordinary executable/HTML/SVG substitutions. DOCX ZIP
  directory checks require Word document entries and reject encrypted directory
  entries, known VBA project filenames and malformed directory boundaries.
  These checks do not decompress or fully validate file contents.
- `src/lib/formSubmit.js`: sends the raw File through the new endpoint and uses
  server-returned size/type/path. No direct-upload fallback is available.
  Original filenames remain display metadata; object names are server-generated
  UUIDs with a fixed basename and validated extension.
- `20261004130000_protect_public_uploads.sql`: restrictive INSERT/UPDATE Storage
  policies deny direct form-attachment uploads for both anon and authenticated
  roles, including admins. This closes bypasses through permissive legacy rules
  and prevents overwriting accepted files. The service role used by the broker
  retains access. Bucket privacy, MIME restrictions and 10 MiB cap are reapplied.
- `src/dashboard/api.js`: form attachments use 60-second signed download URLs
  with attachment disposition instead of 10-minute inline preview URLs.
- `supabase/config.toml`: registers the public upload function with gateway JWT
  verification disabled. Public access is intentional; validation and quotas run
  inside the handler.

Existing authenticated client-document/team-resource uploads retain their
section permissions, private buckets and existing size/type limits. No existing
object is deleted, renamed, or scanned by this migration. Existing submissions
and attachments remain readable by authorized staff.

## Upload budgets

The existing service-only `rate_limit_hit` RPC uses a transaction advisory lock
to count attempts atomically. The broker consumes limits before reading file
bodies, including rejected attempts:

| Scope | Default |
| --- | --- |
| IP-derived hash | 10 attempts / rolling 10 minutes |
| IP-derived hash | 30 attempts / rolling 24 hours |
| All callers combined | 300 attempts / rolling 24 hours |

`FORM_UPLOADS_PER_DAY` optionally changes the global ceiling (positive integer,
maximum 10,000). It is a server environment setting, not a VITE variable.
`RATE_LIMIT_SALT` is reused; the server service key is the existing fallback.
Raw IPs are not stored. Missing IP headers share a conservative unknown bucket.
Verify the hosted gateway's forwarding-header behavior during release. The
global budget does not depend on trusting a client IP header.

At defaults the broker can accept at most 300 files / 3,000 MiB in a rolling day;
field limits and failed attempts reduce that maximum. This bounds daily intake,
not total retained storage or bandwidth. A distributed attacker could exhaust
the shared budget and temporarily deny legitimate uploads. Tune it to actual
traffic and monitor rejected requests; challenge-based protection can be added
without reopening direct Storage writes.

## Checks

- 104 unit tests passed: 4 auth, 43 inbox/campaign/export, 57 forms/upload.
- Isolated PostgreSQL suite passed, including direct anon/staff/admin upload and
  overwrite denial despite an allow-all legacy policy; broker service writes;
  Forms read access; unrelated section denial; retained Documents uploads;
  private bucket settings; and service-only quota enforcement.
- 33 new upload endpoint checks passed using the actual Deno function and
  Supabase SDK raw File transport against local fake services. Tests verify exact
  stored bytes, canonical metadata, safe error responses, per-connection/global
  quotas and successful form submission using the uploaded attachment.
- Existing 28 form/email and 38 security endpoint checks passed (99 combined).
- New function Deno type check and production frontend build passed. The build
  used a temporary directory; existing working-tree build artifacts were kept.
  The prior large-dashboard-chunk warning remains.

All endpoint tests used local fake Storage/database/email services. No customer
data or real email was sent. These checks do not prove hosted gateway or Storage
configuration, and do not replace a release smoke test.

## Coordinated release

1. Apply prior security phases and ensure the service-only quota RPC exists.
2. Deploy `form-upload` with its shared modules and configuration, then publish
   the frontend containing the broker integration.
3. Apply `20261004130000_protect_public_uploads.sql` immediately in the same
   release window. Protection against direct uploads is not active until then.
4. Verify uploads from a published form, normal submission, authorized dashboard
   download, forbidden direct Storage INSERT/overwrite/list/read, and quota
   responses. An older already-open browser tab must reload after rollout.

Do not restore the anonymous upload policy as a rollback workaround. If the
broker is unavailable, uploads fail with a retry message; other form requests
continue normally. Published fields still need to allow one of the bucket's
existing types: PDF, JPEG, PNG, WebP, HEIC, DOC or DOCX.

## Remaining limits

- File signatures and MIME checks cannot detect malware, active PDF content,
  Office exploits or all embedded macros. Legacy DOC files remain supported.
  No scanner or quarantine/release service has been configured. Do not send
  customer documents to an external scanning provider without selecting and
  authorizing that service. Dashboard and inbound-email uploads have not gained
  a malware scanner either.
- Already-stored files are not retroactively validated. Existing random paths
  remain references; the broker does not introduce per-submitter ownership or
  one-time attachment receipts.
- Abandoned files remain private but occupy storage. No automatic deletion was
  added because reliable reference tracking/retention rules need a separate
  cleanup implementation. Do not delete Storage metadata directly in SQL.
- Broader email quotas and abuse controls remain Phase 7; dependency and hosted
  configuration hardening remain Phase 8.

References: [Supabase bucket limits](https://supabase.com/docs/guides/storage/uploads/file-limits),
[private Storage buckets](https://supabase.com/docs/guides/storage/buckets/fundamentals),
and [OWASP upload guidance](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html).
