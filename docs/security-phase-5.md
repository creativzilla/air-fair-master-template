# Security remediation — Phase 5

Status: implemented and tested locally. No production migration, deployment or
repository push was performed for this phase.

## Changes

- `src/dashboard/clientExport.js`: CSV string cells beginning with a formula
  marker, including leading whitespace and numeric-looking phone numbers, are
  escaped as text. Actual numeric amounts remain numeric. XLSX continues using
  inline strings for user text and never emits formula cells.
- `supabase/functions/_shared/campaigns/render.ts`: replaces the regex HTML
  sanitizer with pinned `sanitize-html@2.18.0`. Only the existing text formatting
  tags and explicit HTTP, HTTPS and mailto links survive. Event handlers, styles,
  embedded content, scripts, unsafe URLs and protocol-relative URLs are removed.
  Stored campaign HTML is sanitized again when rendered by the server; escaped
  personalization remains in place.
- `src/dashboard/campaigns/BulkEmailComposer.jsx`: sanitizes initial editor HTML,
  pasted/dropped HTML before insertion, and HTML saved from editor input. Plain
  text paste is escaped. Paragraphs, headings, lists and safe links are retained.
- `supabase/migrations/20261004120000_validate_client_fields.sql`: validates client
  names, email, phone, amounts, categories, stage names and text lengths in a
  database trigger, including direct API writes and upserts. Existing unchanged
  legacy values are not rewritten or rejected. Invalid fields must be corrected
  when changed. Pipeline renames remain supported.
- `src/dashboard/LeadEditor.jsx`: matching input checks give immediate feedback.
  Zero amounts now survive both save and loading a client record.

Client categories retain the existing four database values and dashboard labels.
This phase does not change form schemas or remove the existing trusted-admin
script setting. Stored legacy campaign drafts do not require a bulk rewrite.

## Validation

- 97 unit tests passed: 4 authorization, 43 inbox/campaign/export and 50 forms.
- Isolated PostgreSQL checks passed for existing permissions, inbox behavior and
  client validation. New cases cover invalid direct writes and upserts, Unicode
  names, formatted phone numbers, zero amounts, unchanged legacy data and stage
  renames through the Settings RPC.
- 38 security endpoint checks and 28 public form/email endpoint checks passed
  against local fake services. No real emails were sent.
- Campaign worker Deno type check passed using its explicit import configuration.
- Production dashboard bundle passed, written to a temporary directory rather
  than replacing the existing working-tree build artifacts.
- Browser-target sanitizer bundle executed successfully without Node globals.
  This is a bundle/runtime check, not a full browser interaction test of the editor.
- Production dependency audit found two existing moderate React Router findings;
  no finding was reported for the sanitizer dependency. Router upgrades remain
  part of the later dependency-hardening phase.

## Release requirements and limits

Apply the preceding security migrations, then the Phase 5 migration. Deploy the
dashboard and redeploy `campaign-worker` with its shared modules and per-function
`deno.json`, which maps the same pinned sanitizer version. No new secret is needed.

Use Node 22.12 or newer for installation/builds (tested with Node 24.18).
The sanitizer requires this minimum version. Its PostCSS dependency also updates
the shared locked PostCSS patch version to 8.5.28. The dashboard build reports a
chunk larger than 500 kB after adding the parser; this is a build warning, not a
failed check. Review editor paste, preview and test-email behavior during the
release smoke test, along with normal form-to-client creation.

Invalid new client values now fail database validation. The existing public form
trigger still preserves a submission if automatic client creation fails; an
invalid custom category mapping should be corrected before release. Existing
invalid client records are not cleaned automatically.

Upload abuse controls are Phase 6, email quota controls are Phase 7, and remaining
dependency/configuration hardening is Phase 8. Local results do not establish that
these protections are active in production.
