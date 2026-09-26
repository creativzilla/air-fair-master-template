# CMS Database Plan — Phase 2

> Status: **plan + migration files only. Nothing has been applied to the database.** Awaiting approval.
> Branch: `feature/cms`. Builds on [cms-inventory.md](cms-inventory.md).
> Migrations:
> - [`20260926120000_cms_roles_and_security.sql`](../supabase/migrations/20260926120000_cms_roles_and_security.sql)
> - [`20260926120100_cms_content_versioning.sql`](../supabase/migrations/20260926120100_cms_content_versioning.sql)
> - [`20260926120200_cms_media_forms_submissions.sql`](../supabase/migrations/20260926120200_cms_media_forms_submissions.sql)
>
> All three were checked with the real Postgres parser (every statement and every PL/pgSQL body). They have **not** been executed against a database yet.

---

## 0. Urgent: live database is exposed (found during this phase)

I probed the live project read-only, using the **public anon key that ships in the website bundle**:

| Table | Rows readable by anyone | Should be |
|---|---|---|
| `form_submissions` | 6 (personal data in `raw_data`) | admin/team only |
| `contacts` | 12 | team only |
| `employees` | 5 | team only |
| `bookings` | 12 | team only |
| `pipeline_stages` | 6 | team only |

So `20260913150000_lock_down_rls_policies.sql` is in the repo but **not in effect** on the live project. The seed migrations *were* applied, which means the `migrations/` folder is not a reliable record of live state. Anon **write** access is probably open too; I did not test writes against production.

**Recommendation:** apply migration **1/3** (`…120000_cms_roles_and_security.sql`) as soon as you approve it, even before the rest of the CMS work. It is self-contained. Then:
1. `update public.profiles set role = 'admin' where email = '<your login email>';`
2. Supabase Dashboard → Authentication → Providers → Email → turn off **Allow new users to sign up**.
3. Review Authentication → Users and delete any accounts you don't recognise.

Until step 1 is done, the current dashboard will show no data. That's expected: the new rules give every existing account **no access** by default.

---

## 1. Decisions I made (change any of them before approving)

Your Phase 1 open questions were not answered, so I've applied these defaults:

| # | Decision | Why |
|---|---|---|
| D1 | **Roles:** `admin`, `editor`, `staff`, `none` on the existing `profiles.role`. Old `super_admin` becomes `admin`. Old `client` (the default for *every* sign-up) becomes `none`. | Your test plan needs Admin and Editor. `staff` keeps the existing Employees/CRM concept. Mapping `client`→admin would have promoted unknown self-registered accounts |
| D2 | **Editors** can create and edit drafts, upload media, restore old versions into a draft, and work leads (read/update submissions, contacts, bookings, tasks). They **cannot publish, unpublish, archive, delete, change settings, or manage users**. | Matches "Editors cannot publish or delete" |
| D3 | **Staff** see CRM modules only (pipeline, clients, calendar, submissions), filtered by `employees.allowed_modules`. No CMS access. | Keeps the existing Employees feature meaningful |
| D4 | **One versioned content model (`cms_documents`)** for pages, global chrome, services, visa destinations, travel packages and destinations, news, testimonials and forms. This is a change from Phase 1's suggestion to extend `pages`/`sections`/`content_blocks` (see §3.4). | Draft/publish/history then works identically everywhere with one set of RPCs and policies |
| D5 | **Forms are documents** (`kind='form'`). A service links to its form via `form_document_id`, so "Publish" publishes the service and its form together. Visa destinations share `visa-inquiry`; travel packages share `travel-inquiry`. | Versioning comes for free, and the form is edited on the service's own screen |
| D6 | Every submission **auto-creates a CRM lead**, routed by `form_field_mappings` (existing table). The newsletter never creates leads. | Your test: "reaches the dashboard **and CRM**" |
| D7 | Catalog (`services` table, 16 live rows) stays as the **price list / CRM categories**. A website service can link to a Catalog row via `cms_documents.service_id`. `/package/:slug` keeps working unchanged. | Nothing deleted; retiring it is your call later |
| D8 | All images, local `public/` files **and the ~60 Unsplash URLs**, are uploaded to Storage in Phase 3 at the exact sizes currently used, and registered in `media`. | "Move ALL images into Supabase", with an identical look |
| D9 | Layout, section order and colours stay locked in code. Editors change text, images, links, list items, and section visibility. | "Do not modify the public site's design" |

---

## 2. Roles & permissions

| Capability | admin | editor | staff | anon (public site) |
|---|---|---|---|---|
| Read published content (`cms_published`, `site_settings`) | ✓ | ✓ | ✓ | ✓ |
| Read/edit drafts, create documents | ✓ | ✓ | — | — |
| Preview drafts on the site | ✓ | ✓ | — | — |
| Restore a version into the draft | ✓ | ✓ | — | — |
| **Publish / unpublish** | ✓ | ✗ | — | — |
| **Archive / delete documents** | ✓ | ✗ | — | — |
| Upload media | ✓ | ✓ | — | — |
| Delete media | ✓ | ✗ | — | — |
| Submit forms, upload attachments, subscribe | ✓ | ✓ | ✓ | ✓ |
| Read/update submissions, contacts, bookings, tasks | ✓ | ✓ | ✓ | — |
| Delete submissions / contacts / bookings / tasks | ✓ | ✗ | ✗ | — |
| Site settings, pipeline stages, task templates, employees, CRM routing | ✓ | read | read | settings read only |
| Catalog (`services`) | ✓ | edit (no delete) | read | Published only |
| **User management** | ✓ | ✗ | ✗ | — |

Enforced in the database, not just hidden in the UI: helper functions `auth_role()`, `is_admin()`, `is_editor()` (admin|editor), `is_team()` (admin|editor|staff), all `SECURITY DEFINER` reading `profiles` (`role`, `is_active`).

---

## 3. Schema

### 3.1 New tables

**`cms_documents`**: the working copy (drafts). Editors and admins only.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `kind` | text | `global` · `page` · `immigration_service` · `visa_destination` · `travel_package` · `travel_destination` · `news_article` · `testimonial` · `form` |
| `slug` | text | kebab-case; `unique(kind, slug)`; locked for editors once published |
| `title` | text | list/admin label |
| `sort_order` | int | ordering in lists and grids |
| `draft` | jsonb | the content (shapes in §4) |
| `draft_revision` | int | +1 on every change; used for optimistic locking and "changed since publish" |
| `published_revision`, `published_version_id`, `published_at`, `published_by` | | written only by publish/unpublish (trigger-guarded) |
| `form_document_id` | uuid → `cms_documents` | a service's form |
| `service_id` | uuid → `services` | optional Catalog/CRM link |
| `is_archived` | bool | soft delete (admin only) |
| `created_*`, `updated_*` | | audit |

**`cms_versions`**: immutable history (`document_id`, `version_no`, `action` = `save|publish|restore|unpublish`, `title`, `slug`, `sort_order`, `content`, `draft_revision`, `note`, `created_by`, `created_at`). Written only by triggers and functions.

**`cms_published`**: the live copy (`document_id` PK, `kind`, `slug`, `title`, `sort_order`, `content`, `version_id`, `published_at`; `unique(kind, slug)`). **The only content table the public site reads.** Written only by `cms_publish` / `cms_unpublish`.

**View `cms_document_status`** (`security_invoker`): the dashboard list with a computed `status` = `draft` (never published) · `published` · `changed` (published, with newer draft edits) · `archived`.

**`newsletter_subscribers`**: `email` (unique, case-insensitive), `source_page`, `created_at`, `unsubscribed_at`.

### 3.2 Relations

```
profiles (1)──(n) cms_documents.created_by / updated_by / published_by
cms_documents (1)──(n) cms_versions
cms_documents (1)──(0..1) cms_published ──(1) cms_versions (the published snapshot)
cms_documents[service] ──form_document_id──▶ cms_documents[form]
cms_documents ──service_id──▶ services (Catalog)
form_submissions ──document_id──▶ cms_documents · ──form_version_id──▶ cms_versions
form_submissions (1)──(0..1) contacts (existing submission_id) ──▶ bookings, employee_tasks
media ──uploaded_by──▶ profiles
```

### 3.3 Changes to existing tables (additive only; nothing renamed or dropped)

| Table | Change | Migration |
|---|---|---|
| `profiles` | Role check `admin/editor/staff/none` (was `super_admin/client/staff`), default `none`; data mapping per D1; `+ is_active`, `+ updated_at`; new trigger `on_auth_user_created` + backfill for existing auth users | 1/3 |
| *all 20 existing public tables* | RLS enabled; **all existing policies dropped and replaced** (§5) | 1/3 |
| `testimonials` | anon now only sees `is_published = true` rows (was all rows) | 1/3 |
| `media` | `+ bucket, storage_path, file_name, mime_type, size_bytes, width, height, folder, tags, source_url, updated_at`; `uploaded_by` defaults to `auth.uid()` | 3/3 |
| `form_submissions` | `+ form_key, document_id, form_version_id, source_page, attachments (jsonb [{path,name,size,type}]), notes, handled_by, updated_at`; backfill `form_key` for the 6 existing rows | 3/3 |
| `contacts` | `+ phone` | 3/3 |
| `form_field_mappings` | No schema change. Now used as CRM routing, keyed by **form key** in its existing `form_type` column (rows seeded in Phase 3) | 3/3 |
| `fn_auto_create_contact_from_submission` | Now `SECURITY DEFINER` (otherwise anon submissions would **fail** once contacts are locked down); matches on `form_key`; copies phone; a failure never blocks the submission | 3/3 |
| `fn_auto_assign_stage_tasks` + trigger | Recreated idempotently (it may not exist live). Phase 5 removes the duplicate JS task creation | 3/3 |
| Storage `catalog-images` | Write narrowed to editors, delete to admins | 1/3 |
| Storage `form-attachments` | Exists live; forced **private**, 10 MB, pdf/images/doc(x) | 1/3 |

### 3.4 Existing tables kept but superseded (not deleted; I'll ask before dropping anything)

| Table | Status | Reason |
|---|---|---|
| `pages`, `sections`, `content_blocks` | Read by the site until Phase 4, then unused. The testimonials heading moves into the `home` document | No draft/publish/history. Adding them to 3 relational tables means versioning row-sets, which is much more complex than one JSON document per page |
| `testimonials` | Its 3 live rows are copied into `testimonial` documents in Phase 3 | Same reason; gives testimonials draft/publish too |
| `form_templates`, `faqs`, `field_schema`, `service_fields` | Empty and unused; stay dormant | Replaced by form documents and per-document JSON |

---

## 4. Content shapes (`draft` / `content` JSON)

Conventions:
- **Image fields** are `{ "src": url, "alt": text, "mediaId": uuid|null }`.
- **Icons** are names from an icon registry (extends today's `components/immigration/icons.js`).
- **Links** are `{ "label", "href" }`.
- Every document may carry `seo: { title, description, image }`.

| kind | slug(s) | Shape (abridged; keys mirror today's `src/lib` data so components barely change) |
|---|---|---|
| `global` | `site` | `promiseBar.items[]`, `browserBar.visible`, `nav {items[]{label,href,highlight}, ctaLabel, ctaHref, searchPlaceholder}`, `footer {blurb, columns[]{heading, links[]}, contactHeading, newsletter{heading, body, placeholder, thanks}, copyright, legalLinks[]}`, `chatBubbleLabel` |
| `page` | `home`, `immigration-hub`, `visa-hub`, `travel-hub`, `news` | `seo`, `sections[]` **in page order**: `{ key, label, visible, fields{…} }`. E.g. home: `hero{slides[]{tag, icon, headline, highlight, subheading, description, features[3], ctaLabel, ctaHref, images[4]}, flagLabel, trustLabel, trustItems[]}`, `accreditations`, `categories`, `immigration`, `srrv`, `visa`, `travel`, `trustBar`, `assessment`, `testimonials`, `news`, `contact`. Field lists per section follow cms-inventory §2 |
| `immigration_service` | 10 slugs (`13a-immigrant-visa` … `special-resident-retirees-visa`) | Today's keys (`title, titleHighlight, eyebrow, shortDescription, heroDescription, heroImage, heroPrimaryCta, aboutTitle, aboutParagraphs[], aboutImage, eligibility[], assistanceItems[], whyChooseAirfair, hideHelpCta, …`) + `card{description, icon, showOnHome, showOnHub}` + `seo`. Form via `form_document_id` |
| `visa_destination` | 8 slugs | Today's keys (`country, countryCode, flag, region, featured, visaType, title, hubTitle, hubDescription, hubCta, subtitle, description, gallery[], aboutParagraphs[], highlights[], requirements[], faqs[], relatedServices[]`) + `poster` + `seo`. Form → `visa-inquiry` |
| `travel_package` | 12 slugs | One unified shape for full packages and homepage offers: `variant ('package'|'offer'), place, flagCode, price, duration, featured, showOnHome, image, gallery[], subtitle, description, heroBadge, inclusions[], aboutParagraphs[], aboutDetails[], packageHighlights[], whatsIncluded[], faqs[], relatedCard, poster, seo`. Form → `travel-inquiry` |
| `travel_destination` | 5 slugs | `name, region, shortDescription, image, packageSlug` |
| `news_article` | 7 slugs | `type ('story'|'guide'), featured, category, date, dateTime, description, source, initials, logo, image, href, article{intro, heading, body, takeaway, points[], outlook} | null` |
| `testimonial` | per client | `clientName, quote, serviceCategory, photo` |
| `form` | `immigration-<slug>` ×10, `visa-inquiry`, `travel-inquiry`, `website-contact` | `title, description, submitLabel, privacyNote, successTitle, successMessage, consent{required, text}, layout ('sections'|'grid'), sections[]{id, title, fields[]{name, label, type, required, placeholder, options[], showWhen{field, equals}, help}}` |

**Form field types.** Your list (text, email, phone, date, dropdown, checkbox, file upload, textarea) maps to `text, email, tel, date, select, checkbox, file, textarea`. The current forms **also use `number`, `radio`, `yesno`, `country`**, and the builder must support these too, or the migrated forms would change. So the builder gets 12 types and 4 of them are extras. Conditional `showWhen` logic is preserved.

---

## 5. RLS summary

All defined in 1/3 (existing tables) and 2/3–3/3 (new tables). Every existing policy on the 20 tables is dropped first, because unknown permissive live policies would otherwise stay OR-ed in.

| Table | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| `cms_published` | public | — (RPC only) | — (RPC only) | — (RPC only) |
| `cms_documents` | editor | editor | editor (publish columns trigger-guarded) | admin |
| `cms_versions` | editor | — (trigger/RPC) | — | — |
| `site_settings` | public | admin | admin | admin |
| `pages`, `sections`, `content_blocks` (legacy) | public | admin | admin | admin |
| `testimonials` (legacy) | public if published; editor all | admin | admin | admin |
| `services` | public if Published; team all | editor | editor | admin |
| `media` | team | editor | editor | admin |
| `form_submissions` | team | public (`status='New'`, no staff fields, ≤200 KB) | team | admin |
| `newsletter_subscribers` | team | public | team | admin |
| `contacts`, `bookings`, `employee_tasks` | team | team | team | admin |
| `employees`, `pipeline_stages`, `stage_task_templates`, `form_field_mappings` | team | admin | admin | admin |
| `faqs`, `field_schema`, `service_fields`, `form_templates` | team | admin | admin | admin |
| `profiles` | own row / admin | — (trigger) | admin | admin |

**RPCs** (`SECURITY DEFINER`, execute revoked from anon):
- `cms_publish(ids uuid[], note)`: admin.
- `cms_unpublish(id, note)`: admin.
- `cms_restore_version(version_id)`: editor.

The service-role key and SQL-editor sessions are also allowed, so the Phase 3 seed can publish. The check uses the JWT role and `session_user`, **not** `current_user`, which inside a definer function is always the owner. I caught that bug during review.

## 6. Storage rules

| Bucket | Public | Limits | Read | Upload | Replace | Delete |
|---|---|---|---|---|---|---|
| `catalog-images` (site images, media library, posters) | yes | 5 MB; jpeg/png/webp/gif (no SVG: script risk) | everyone | editor | editor | admin |
| `form-attachments` (visitor documents) | **no** | 10 MB; pdf, jpeg, png, webp, heic, doc, docx | team only, via **signed URLs** | anyone (with a submission) | — | admin |

Folder conventions inside `catalog-images`:
- `media/<yyyy>/<file>` for library uploads
- `seed/<original-name>` for Phase 3 imports
- `travel-package-posters/<slug>/poster` (existing, kept so the current poster uploader keeps working)

Inside `form-attachments`: `submissions/<yyyy-mm>/<uuid>-<name>`.

Note: images uploaded for a *draft* are publicly fetchable if someone knows the URL, because the bucket is public and filenames are random. That's the standard trade-off. Only the draft text/structure is private.

---

## 7. Draft → Preview → Publish → History

```
Editor edits in dashboard ──Save draft──▶ UPDATE cms_documents.draft  (… .eq('draft_revision', n))
                                         ├─ trigger: draft_revision n→n+1
                                         └─ trigger: cms_versions += {action:'save', content}
Preview ──▶ opens the real page with ?preview=1 in a new tab
            site sees a logged-in editor session → reads cms_documents.draft (RLS allows)
            anon with ?preview=1 → cms_documents returns nothing → normal published view
Publish (admin) ──▶ rpc cms_publish([serviceId, formId])
                    ├─ cms_versions += {action:'publish'}
                    ├─ cms_published upsert (content = draft)
                    └─ cms_documents.published_revision = draft_revision
Public site ──▶ SELECT from cms_published only → falls back to hardcoded values if missing/failed
History ──▶ list cms_versions; Restore = rpc cms_restore_version(v) → copies into DRAFT
            (+ version {action:'restore'}); goes live only after the next Publish
Unpublish (admin) ──▶ rpc cms_unpublish(id) → row removed from cms_published; draft kept
```

- **Status badge:** Draft / Published / Unpublished changes / Archived (from `cms_document_status`).
- **Concurrency:** saves send the `draft_revision` they loaded. If another editor saved in between, 0 rows update and the UI says "changed by someone else, reload".
- **Guarantee that drafts never appear publicly:** anon has no SELECT on `cms_documents` or `cms_versions`, and `cms_published` is only written by admin-only RPCs. The preview flag grants nothing by itself; it only changes which table a *logged-in editor's* session reads.
- **Submissions** record `form_version_id` (the published form snapshot). The inbox can always label answers correctly, even after the form is later edited.

## 8. Forms → submissions → CRM

1. The site renders the form from the published form document. The code schema is the fallback.
2. Files upload to `form-attachments/submissions/…`. The **path** is stored in `form_submissions.attachments` (today's code stores a public URL, which won't work with a private bucket; fixed in Phase 4).
3. Insert into `form_submissions` with `form_key`, `document_id`, `form_version_id`, `source_page`, `raw_data`.
4. Trigger → `form_field_mappings[form_key]` → a `contacts` row in the first pipeline stage with category, e.g.:
   - immigration → "Immigration Processing"
   - visa → "Visa"
   - travel → "Tour Package"
   - contact → "General"
5. The dashboard inbox shows the lead link. The existing "Add to Pipeline" button becomes "View lead".

---

## 9. Needs more work than expected (please read)

| # | Item | Impact | Proposal |
|---|---|---|---|
| W1 | **I can't run migrations yet.** No Supabase CLI or DB password in this environment, and the anon key can't run DDL | Phase 3 is blocked until one of these is done | **(a)** You add `SUPABASE_DB_URL` and `SUPABASE_SERVICE_ROLE_KEY` to `.env` (never committed; see `.env.example`) and I apply the files with a small Node runner. **(b)** You paste each file into the Supabase SQL editor in order. I **won't** use `supabase db push`: it would also try to re-run the old seed migrations, and `sections` has no unique key, so they would duplicate rows |
| W2 | **User management needs a server-side piece.** Inviting users or disabling logins needs the service-role key, which must never be in the browser | One Supabase **Edge Function** (`admin-users`: invite, set role, deactivate), deployed with the CLI (`npx supabase functions deploy`) and an access token | If you'd rather not deploy functions, the dashboard can manage **roles** of existing users, and new users are invited from the Supabase dashboard. Tell me which |
| W3 | Form builder must support 12 field types, not 8 (see §4) | Slightly bigger builder | Proceed unless you object |
| W4 | ~60 Unsplash images downloaded into Storage | ~30–60 MB storage; one-time | Proceed (Unsplash licence permits), or keep them hot-linked |
| W5 | Applying 1/3 immediately locks the **current** dashboard for everyone but the promoted admin; the Editors/Employees UI changes come in Phase 5 | Expected | Promote yourself right after applying |
| W6 | Supabase must be on Postgres 15+ for the `security_invoker` view | Projects created since 2023 are | Verified during Phase 3 |

### Decisions confirmed (2026-09-26)
- **W1:** Migrations are applied by you in the **Supabase SQL Editor**, in filename order. Old seed migrations are never re-run.
- **W2:** User management uses a **secure Edge Function** (`admin-users`: invite + deactivate/reactivate). The service-role key lives only in the function's secrets; the function verifies the caller's JWT and `profiles.role = 'admin'` before acting. Built in Phase 5.
- **W3:** The form builder supports **all 12 field types**: `text, email, tel, date, number, textarea, select, radio, yesno, checkbox, country, file`.

### Phase 3 seed: `20260926130000_cms_seed_content.sql`
Generated from the live source files, not retyped:
- 61 documents: 1 global, 5 pages, 13 forms, 10 immigration services, 8 visa destinations, 12 travel packages, 5 destinations, 7 news items
- testimonials copied from the live table
- 108 image references registered in `media`
- 13 CRM routing rows

Then it publishes everything. INSERT-only and idempotent. Images stay at their current URLs; the copy into Storage happens from the dashboard in Phase 5 (no service-role key needed on your machine).

## 10. Files in this phase

- `docs/cms-plan.md` (this file)
- `supabase/migrations/20260926120000_cms_roles_and_security.sql`
- `supabase/migrations/20260926120100_cms_content_versioning.sql`
- `supabase/migrations/20260926120200_cms_media_forms_submissions.sql`
- `.env.example`
- `docs/cms-inventory.md` (Phase 1 audit, committed now)

No application code, website files or existing migrations were changed.
