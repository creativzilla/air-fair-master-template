/*
# Lock down Row Level Security across all tables

Empirically confirmed (via the anon/publishable key, the same key shipped
in the public JS bundle) that every table in this project currently has
either RLS disabled or no restrictive policies — meaning contacts,
employees, bookings, and every other internal table can be read AND
written by anyone on the internet, no login required.

This migration is the pragmatic first pass:
- The public website keeps exactly the access it already needs: reading
  published site content/catalog, and submitting the contact form.
- Everything else (the CRM/ops side: contacts, bookings, employees,
  employee_tasks, pipeline_stages, stage_task_templates, and
  reading/updating leads in form_submissions) is restricted to
  `authenticated` — i.e. anyone signed into /dashboard.
- There is deliberately NO super_admin/staff/client distinction yet.
  This app currently has single-tier dashboard auth (one login = full
  access), so a finer-grained policy would just be unenforceable fiction
  until real per-role employee accounts exist. Tighten these further once
  that's built (see `profiles.role`).
- Six tables that exist in this project but aren't wired into any
  frontend code yet (profiles, field_schema, service_fields, faqs, media,
  form_field_mappings, form_templates) are locked to authenticated-only
  too. They're empty today, so this costs nothing, and it closes the same
  hole before they're ever put to use. Relax individual policies as each
  feature actually gets built (e.g. public SELECT on faqs once a public
  FAQ section exists).

1. Public website content — public reads, authenticated (dashboard) writes
2. Catalog (services) — public reads Published rows only, authenticated sees/edits everything
3. Form submissions — public can only INSERT (submit the contact form); reading/updating leads is authenticated-only
4. Internal CRM/ops tables — authenticated-only, no public access
5. Dormant/unused-but-provisioned tables — authenticated-only placeholder policies
*/

-- ============================================================================
-- 1. Public website content
-- ============================================================================

ALTER TABLE pages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public_read_pages" ON pages;
CREATE POLICY "public_read_pages" ON pages FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "authenticated_write_pages" ON pages;
CREATE POLICY "authenticated_write_pages" ON pages FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE sections ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public_read_sections" ON sections;
CREATE POLICY "public_read_sections" ON sections FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "authenticated_write_sections" ON sections;
CREATE POLICY "authenticated_write_sections" ON sections FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE content_blocks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public_read_content_blocks" ON content_blocks;
CREATE POLICY "public_read_content_blocks" ON content_blocks FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "authenticated_write_content_blocks" ON content_blocks;
CREATE POLICY "authenticated_write_content_blocks" ON content_blocks FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE testimonials ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public_read_testimonials" ON testimonials;
CREATE POLICY "public_read_testimonials" ON testimonials FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "authenticated_write_testimonials" ON testimonials;
CREATE POLICY "authenticated_write_testimonials" ON testimonials FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public_read_site_settings" ON site_settings;
CREATE POLICY "public_read_site_settings" ON site_settings FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "authenticated_write_site_settings" ON site_settings;
CREATE POLICY "authenticated_write_site_settings" ON site_settings FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================================
-- 2. Catalog (services) — public sees only Published rows
-- ============================================================================

ALTER TABLE services ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public_read_published_services" ON services;
CREATE POLICY "public_read_published_services" ON services FOR SELECT TO anon USING (status = 'Published');
DROP POLICY IF EXISTS "authenticated_read_all_services" ON services;
CREATE POLICY "authenticated_read_all_services" ON services FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "authenticated_insert_services" ON services;
CREATE POLICY "authenticated_insert_services" ON services FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "authenticated_update_services" ON services;
CREATE POLICY "authenticated_update_services" ON services FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "authenticated_delete_services" ON services;
CREATE POLICY "authenticated_delete_services" ON services FOR DELETE TO authenticated USING (true);

-- ============================================================================
-- 3. Form submissions — public can only submit, not read/edit leads
-- ============================================================================

ALTER TABLE form_submissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public_submit_form" ON form_submissions;
CREATE POLICY "public_submit_form" ON form_submissions FOR INSERT TO public WITH CHECK (true);
DROP POLICY IF EXISTS "authenticated_read_submissions" ON form_submissions;
CREATE POLICY "authenticated_read_submissions" ON form_submissions FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "authenticated_update_submissions" ON form_submissions;
CREATE POLICY "authenticated_update_submissions" ON form_submissions FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "authenticated_delete_submissions" ON form_submissions;
CREATE POLICY "authenticated_delete_submissions" ON form_submissions FOR DELETE TO authenticated USING (true);

-- ============================================================================
-- 4. Internal CRM/ops tables — authenticated (dashboard) only
-- ============================================================================

ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated_all_contacts" ON contacts;
CREATE POLICY "authenticated_all_contacts" ON contacts FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated_all_bookings" ON bookings;
CREATE POLICY "authenticated_all_bookings" ON bookings FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated_all_employees" ON employees;
CREATE POLICY "authenticated_all_employees" ON employees FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE employee_tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated_all_employee_tasks" ON employee_tasks;
CREATE POLICY "authenticated_all_employee_tasks" ON employee_tasks FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE stage_task_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated_all_stage_task_templates" ON stage_task_templates;
CREATE POLICY "authenticated_all_stage_task_templates" ON stage_task_templates FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE pipeline_stages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated_all_pipeline_stages" ON pipeline_stages;
CREATE POLICY "authenticated_all_pipeline_stages" ON pipeline_stages FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================================
-- 5. Dormant/provisioned-but-unused tables — authenticated-only placeholder
-- ============================================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated_read_profiles" ON profiles;
CREATE POLICY "authenticated_read_profiles" ON profiles FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "users_update_own_profile" ON profiles;
CREATE POLICY "users_update_own_profile" ON profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

ALTER TABLE field_schema ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated_all_field_schema" ON field_schema;
CREATE POLICY "authenticated_all_field_schema" ON field_schema FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE service_fields ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated_all_service_fields" ON service_fields;
CREATE POLICY "authenticated_all_service_fields" ON service_fields FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE faqs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated_all_faqs" ON faqs;
CREATE POLICY "authenticated_all_faqs" ON faqs FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE media ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated_all_media" ON media;
CREATE POLICY "authenticated_all_media" ON media FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE form_field_mappings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated_all_form_field_mappings" ON form_field_mappings;
CREATE POLICY "authenticated_all_form_field_mappings" ON form_field_mappings FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE form_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated_all_form_templates" ON form_templates;
CREATE POLICY "authenticated_all_form_templates" ON form_templates FOR ALL TO authenticated USING (true) WITH CHECK (true);
