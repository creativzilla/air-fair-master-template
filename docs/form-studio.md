# Form Studio

Visual form builder in the dashboard (admins only). Opened from
**Services → item → Form → Edit form**, or **Forms → Form builder → a form**.

```
Library (drag / click)  |  Canvas (the real form, editable)  |  Settings (selected item or whole form)
Toolbar: name · status · undo/redo · Saving/Saved/Failed · desktop/tablet/mobile · Preview · Publish
```

## How it fits the existing system

Forms were already CMS documents (`cms_documents`, kind `form`): the draft is
the form, `cms_publish` snapshots it into `cms_versions` and `cms_published`,
and the website renders the published content. The Studio keeps that model:

| Concern | Where |
|---|---|
| Form identity, settings, draft | `cms_documents` (kind `form`); `draft` holds the schema |
| Published versions | `cms_versions` (one row per publish) + `cms_published` (live) |
| Field definitions | inside the schema, and mirrored to `form_fields` by a trigger (stable `element_id`, key, type, label, settings, section/row, position, `is_archived`) |
| Submissions | `form_submissions` (+ `form_version_id` = the version that was live, set by the server) |
| Answers | `form_submissions.answers` keyed by field id; `raw_data` keyed by field key (kept for emails/CRM compatibility) |

No database column is ever created per field. Design elements are part of the
schema and the registry (kind `design`/`layout`) but never produce answers.

### Schema (shared code: `supabase/functions/_shared/forms/schema.ts`)

Used by the Studio, the website renderer and the Edge Function, so all three
apply the same rules.

- Sections → elements; a **row** element has 1 or 2 columns of elements
  (columns stack on phones). Rows can't be nested.
- Inputs: single-line, multiline, email, phone, number, date, dropdown, radio,
  checkbox group, yes/no, country, single checkbox/consent, file upload,
  address, hidden. Design: heading, paragraph (plain text, `[text](url)`
  links only: http(s), mailto, tel, site paths), divider, spacer, image,
  submit button (places the button).
- Every element has a stable `id`. Older forms had none: their id is
  `k_<key>` until the Studio first saves them. Renaming the label or key,
  moving, or reordering never changes the id. Duplicates get a fresh id and a
  fresh unique key.
- Settings per field: label, internal key (unique; checked live), placeholder,
  help text, required, default, width, hide label, choices (label + stored
  value), validation (lengths, min/max, pattern), file types and size (≤ 10
  MB, the bucket limit), conditional visibility (rules by field id), "Save to
  contact" (full name, email, phone, service requested, inquiry message), and
  "leave out of notification emails" (sensitive).
- Publishing is refused when: keys are missing/duplicated/reserved, a choice
  field has no or duplicate choices, a rule points at a removed field, an
  invalid pattern, no fillable field, or no required, always-visible contact
  Email field.

### Drafts, autosave, publishing

`src/dashboard/formStudio/useFormDraft.js`

- Edits autosave ~1 s after the last change; one save at a time, each
  checked against the draft revision, so a slow response can't overwrite newer
  edits and another tab's save is never silently overwritten ("Keep my
  version" / "Load the other version").
- Failed saves keep the edits, show **Failed to save · Retry**, retry
  automatically (3 s, 10 s, 30 s), and keep a copy in the browser
  (`localStorage`); reopening the form offers to restore it.
- Undo/redo (Ctrl+Z / Ctrl+Shift+Z), Delete, Ctrl+D duplicate.
- Leaving with unsaved edits warns first.
- The website keeps showing the published version until **Publish**, which
  validates the schema, waits for the last save, then publishes the version.
  Only admins can save or publish form drafts (database policy + function).

## Website rendering and submissions

`src/components/forms/FormRenderer.jsx` renders the published schema for the
visa/travel sidebar form, the immigration assessment and the homepage contact
form, and the Studio canvas/preview uses the same components. Existing forms
look exactly as before (pixel comparison of all four public forms, desktop and
phone).

The Edge Function (`handleSubmitForm`) validates every submission against the
**published** schema: unknown fields are refused ("the form was updated,
reload"), required rules respect conditional visibility, choices must be from
the list, files must belong to a file field and match its type/size **as
stored** in Storage, hidden fields take their configured value. Only allowed
values are stored. Retries reuse the submission id (saved once); the submit
button can't be double-clicked.

CRM: name/email/phone come from the fields mapped to them (falling back to the
usual keys); "service requested" and "inquiry message" go into the lead's
notes. Staff emails list answers with their labels, leave out sensitive fields
and never include file links (only "N attachments").

## Submissions view (Forms → Submissions)

Server-side search (name/email/phone) and pagination, filter by form, detail
with answers labelled from the version that was submitted (fields removed
later are labelled from the registry), private files via short-lived signed
links, CSV export (one column per field for a single form, removed fields
included; formula-safe escaping; UTF-8 BOM).

## Security

- `form_fields`: team read only; written only by the trigger.
- Form drafts: update limited to admins (`cms_documents_editor_update`).
- Submissions: public can't read; direct inserts can't set `answers`.
- Uploads: anonymous uploads only under `submissions/` in the private
  `form-attachments` bucket; team reads via signed URLs.
- Rate limits, honeypot and minimum fill time unchanged.
- Direct-save lockdown (applied 2026-10-01 as migration 20261001130000) every
  submission goes through the function's checks.

## Deployment

1. `npx supabase@2.118.0 db push --dry-run` → only `20261001120000_form_builder.sql`; then `db push`.
2. Deploy the function: `npx supabase@2.118.0 functions deploy form-submit --project-ref ddhqkzjtlburzkipnoew --use-api`
   (or push `feature/cms`, which redeploys it automatically).
3. Push and publish the website in Bolt.
4. Optional, recommended: apply the direct-save lockdown (see form-emails-deploy.md, step 10).

Order matters only loosely: the new function accepts submissions from the old
website (verified against all 13 live forms), and the new website works with
the old function.

## Rollback

| Undo | How |
|---|---|
| Website | Publish the previous version in Bolt. |
| Function | Redeploy the previous commit's `form-submit`. |
| Database | Safe to leave. To remove: `drop trigger trg_form_fields_sync on public.cms_documents; drop function public.form_fields_after_write(); drop function public.form_fields_sync_doc(uuid); drop table public.form_fields;` (keep `form_submissions.answers`: it holds answers). Restore the editor update policy to `using (public.is_editor()) with check (public.is_editor())`. |

## Tests

- `npm run test:email`: schema rules, server validation, handlers (50 tests).
- `npm run test:email:e2e`: the real function under Deno with a fake
  Supabase, including Studio forms, uploads and version ids (25 checks).
- Browser checks (Puppeteer, mocked backend) used during development: Studio
  (26), public renderer (14), submissions view (12).
