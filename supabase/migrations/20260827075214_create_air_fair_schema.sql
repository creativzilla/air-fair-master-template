/*
# Air Fair Travel & Immigration — Full Database Schema

## Summary
Creates the complete database for the Air Fair Travel & Immigration website + dashboard system.
This is a no-auth single-tenant app (no sign-in screen yet), so all tables use `TO anon, authenticated` RLS policies allowing the anon-key frontend to read and write.

## New Tables (20 total)
1. `profiles` — user identity (for future auth;
 currently unused)
2. `site_settings` — business info, branding, social links, SEO, chat widget code
3. `field_schema` — registry of editable fields per template type
4. `pages` — website pages
5. `sections` — sections within pages
6. `content_blocks` — field values within sections
7. `services` — unified catalog of services AND products/packages
8. `service_fields` — extra custom fields per service
9. `testimonials` — client testimonials
10. `faqs` — frequently asked questions
11. `media` — media library
12. `form_submissions` — inquiries submitted through website forms
13. `form_field_mappings` — auto-create-contact routing per form type
14. `form_templates` — form builder configs
15. `pipeline_stages` — configurable CRM pipeline columns
16. `employees` — internal staff
17. `contacts` — CRM contact records (pipeline cards)
18. `bookings` — scheduled meetings/appointments
19. `stage_task_templates` — task templates per pipeline stage
20. `employee_tasks` — tasks assigned to employees

## Automation
- Trigger: stage change on contacts auto-creates employee tasks from templates
- Trigger: new form_submission auto-creates a contact if a mapping exists

## Security
- RLS enabled on ALL tables
- All policies use `TO anon, authenticated` (no-auth app — the anon-key client must be able to read/write)
- `USING (true)` / `WITH CHECK (true)` is appropriate here because this is a single-tenant app with no sign-in screen;
 all data is intentionally shared

## Seed Data
- 6 default pipeline stages: New Lead, Contacted, Qualified, Proposal Sent, Booked Appointment, Close
- 27 catalog items (services + tour packages from Air Fair's actual service list)
*/

-- ============================================================================
-- 1. ROLES & SITE IDENTITY
-- ============================================================================

CREATE TABLE IF NOT EXISTS profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  role text not null default 'client'
    check (role in ('super_admin', 'client', 'staff')),
  created_at timestamptz not null default now()
);


CREATE TABLE IF NOT EXISTS site_settings (
  id uuid primary key default gen_random_uuid(),
  business_name text,
  logo_url text,
  favicon_url text,
  contact_email text,
  contact_phone text,
  address text,
  business_hours text,
  primary_color text,
  secondary_color text,
  accent_color text,
  heading_font text,
  body_font text,
  facebook_url text,
  instagram_url text,
  linkedin_url text,
  youtube_url text,
  tiktok_url text,
  seo_title text,
  seo_description text,
  seo_social_image_url text,
  currency_symbol text not null default '₱',
  enabled_modules jsonb not null default
    '{"pipeline": true, "bookings": true, "employees": true, "services": true}'::jsonb,
  chat_widget_code text,
  updated_at timestamptz not null default now()
);


-- ============================================================================
-- 2. FIELD SCHEMA REGISTRY
-- ============================================================================

CREATE TABLE IF NOT EXISTS field_schema (
  id uuid primary key default gen_random_uuid(),
  template_type text not null,
  field_key text not null,
  label text not null,
  field_type text not null default 'text'
    check (field_type in ('text', 'textarea', 'image', 'url', 'richtext', 'number')),
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  unique (template_type, field_key)
);


-- ============================================================================
-- 3. WEBSITE CONTENT ENGINE
-- ============================================================================

CREATE TABLE IF NOT EXISTS pages (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  seo_title text,
  seo_description text,
  is_published boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);


CREATE TABLE IF NOT EXISTS sections (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references pages(id) on delete cascade,
  template_type text not null,
  sort_order int not null default 0,
  is_visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

CREATE INDEX IF NOT EXISTS idx_sections_page ON sections(page_id);


CREATE TABLE IF NOT EXISTS content_blocks (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references sections(id) on delete cascade,
  field_key text not null,
  value text,
  updated_at timestamptz not null default now(),
  unique (section_id, field_key)
);

CREATE INDEX IF NOT EXISTS idx_content_blocks_section ON content_blocks(section_id);


-- ============================================================================
-- 4. CATALOG — unified Services + Products/Packages
-- ============================================================================

CREATE TABLE IF NOT EXISTS services (
  id uuid primary key default gen_random_uuid(),
  type text not null default 'service'
    check (type in ('service', 'product')),
  name text not null,
  slug text unique,
  category text not null,
  template_type text not null default 'service_standard',
  short_description text,
  full_description text,
  image_url text,
  gallery jsonb not null default '[]'::jsonb,
  cta_label text,
  cta_link text,
  featured boolean not null default false,
  status text not null default 'Draft'
    check (status in ('Published', 'Draft')),
  pricing_type text
    check (pricing_type in ('fixed', 'starting', 'range', 'quote', 'free')),
  price numeric,
  price_min numeric,
  price_max numeric,
  duration text,
  regular_price numeric,
  sale_price numeric,
  pricing_unit text,
  inclusions text,
  exclusions text,
  availability text,
  start_date date,
  end_date date,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);


CREATE TABLE IF NOT EXISTS service_fields (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references services(id) on delete cascade,
  field_key text not null,
  value text,
  updated_at timestamptz not null default now(),
  unique (service_id, field_key)
);

CREATE INDEX IF NOT EXISTS idx_service_fields_service ON service_fields(service_id);


-- ============================================================================
-- 5. TESTIMONIALS & FAQS
-- ============================================================================

CREATE TABLE IF NOT EXISTS testimonials (
  id uuid primary key default gen_random_uuid(),
  client_name text not null,
  quote text not null,
  service_category text,
  photo_url text,
  is_published boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);


CREATE TABLE IF NOT EXISTS faqs (
  id uuid primary key default gen_random_uuid(),
  question text not null,
  answer text not null,
  is_published boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);


-- ============================================================================
-- 6. MEDIA LIBRARY
-- ============================================================================

CREATE TABLE IF NOT EXISTS media (
  id uuid primary key default gen_random_uuid(),
  url text not null,
  alt_text text,
  uploaded_by uuid references profiles(id),
  created_at timestamptz not null default now()
);


-- ============================================================================
-- 7. FORMS — submissions, routing automation, and the Form Builder itself
-- ============================================================================

CREATE TABLE IF NOT EXISTS form_submissions (
  id uuid primary key default gen_random_uuid(),
  form_type text not null,
  name text,
  email text,
  phone text,
  raw_data jsonb not null default '{}'::jsonb,
  status text not null default 'New'
    check (status in ('New', 'Contacted', 'Qualified', 'Closed', 'Archived')),
  created_at timestamptz not null default now()
);

CREATE INDEX IF NOT EXISTS idx_form_submissions_type ON form_submissions(form_type);


CREATE TABLE IF NOT EXISTS form_field_mappings (
  id uuid primary key default gen_random_uuid(),
  form_type text not null unique,
  auto_create_contact boolean not null default true,
  maps_to_category text,
  field_mapping jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);


CREATE TABLE IF NOT EXISTS form_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  form_type text not null unique,
  fields jsonb not null default '[]'::jsonb,
  share_slug text unique,
  is_active boolean not null default true,
  updated_by uuid references profiles(id),
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

CREATE INDEX IF NOT EXISTS idx_form_templates_form_type ON form_templates(form_type);


-- ============================================================================
-- 8. CONFIGURABLE PIPELINE STAGES
-- ============================================================================

CREATE TABLE IF NOT EXISTS pipeline_stages (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);


INSERT INTO pipeline_stages (name, sort_order)
SELECT * FROM (VALUES
  ('New Lead', 0), ('Contacted', 1), ('Qualified', 2),
  ('Proposal Sent', 3), ('Booked Appointment', 4), ('Close', 5)
) AS v(name, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM pipeline_stages WHERE name = v.name);


-- ============================================================================
-- 9. CRM PIPELINE (Contacts)
-- ============================================================================

CREATE TABLE IF NOT EXISTS employees (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),
  name text not null,
  email text,
  role text,
  allowed_modules jsonb not null default
    '{"pipeline": true, "bookings": true, "clients": true, "forms": true, "services": false, "media": false, "edit-website": false, "employees": false, "settings": false}'::jsonb,
  created_at timestamptz not null default now()
);


CREATE TABLE IF NOT EXISTS contacts (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid references form_submissions(id),
  name text not null,
  email text,
  category text not null,
  status text not null default 'New Lead',
  amount numeric,
  assigned_employee_id uuid references employees(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

CREATE INDEX IF NOT EXISTS idx_contacts_status ON contacts(status);

CREATE INDEX IF NOT EXISTS idx_contacts_assigned ON contacts(assigned_employee_id);


CREATE TABLE IF NOT EXISTS bookings (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid references contacts(id),
  name text not null,
  purpose text,
  date date,
  time time,
  status text not null default 'Pending'
    check (status in ('Pending', 'Confirmed', 'Cancelled', 'Completed')),
  created_at timestamptz not null default now()
);

CREATE INDEX IF NOT EXISTS idx_bookings_contact ON bookings(contact_id);


-- ============================================================================
-- 10. PIPELINE AUTOMATION + EMPLOYEE TASKS
-- ============================================================================

CREATE TABLE IF NOT EXISTS stage_task_templates (
  id uuid primary key default gen_random_uuid(),
  stage text not null,
  title text not null,
  created_at timestamptz not null default now()
);


CREATE TABLE IF NOT EXISTS employee_tasks (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id) on delete cascade,
  contact_id uuid references contacts(id),
  title text not null,
  due_date date,
  is_done boolean not null default false,
  created_at timestamptz not null default now()
);

CREATE INDEX IF NOT EXISTS idx_employee_tasks_employee ON employee_tasks(employee_id);


-- ============================================================================
-- 11. AUTOMATION: stage-change -> auto-create employee tasks
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_auto_assign_stage_tasks()
RETURNS trigger AS $$
BEGIN
  IF new.status IS DISTINCT FROM old.status AND new.assigned_employee_id IS NOT NULL THEN
    INSERT INTO employee_tasks (employee_id, contact_id, title, due_date, is_done)
    SELECT new.assigned_employee_id, new.id, tmpl.title || ' — ' || new.name, NULL, false
    FROM stage_task_templates tmpl
    WHERE tmpl.stage = new.status;

  END IF;

  RETURN new;

END;

$$ LANGUAGE plpgsql;


DROP TRIGGER IF EXISTS trg_auto_assign_stage_tasks ON contacts;

CREATE TRIGGER trg_auto_assign_stage_tasks
  AFTER UPDATE OF status ON contacts
  FOR EACH ROW
  EXECUTE FUNCTION fn_auto_assign_stage_tasks();


-- ============================================================================
-- 12. AUTOMATION: form_submissions -> contacts
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_auto_create_contact_from_submission()
RETURNS trigger AS $$
DECLARE
  mapping form_field_mappings%rowtype;

  computed_category text;

  computed_amount numeric;

BEGIN
  SELECT * INTO mapping FROM form_field_mappings WHERE form_type = new.form_type;


  IF mapping.form_type IS NULL OR NOT mapping.auto_create_contact THEN
    RETURN new;

  END IF;


  computed_category := COALESCE(
    new.raw_data ->> (mapping.field_mapping ->> 'category'),
    mapping.maps_to_category
  );

  computed_amount := NULLIF(new.raw_data ->> (mapping.field_mapping ->> 'amount'), '')::numeric;


  INSERT INTO contacts (submission_id, name, email, category, status, amount)
  VALUES (new.id, new.name, new.email, computed_category, 'New Lead', computed_amount);


  RETURN new;

END;

$$ LANGUAGE plpgsql;


DROP TRIGGER IF EXISTS trg_auto_create_contact ON form_submissions;

CREATE TRIGGER trg_auto_create_contact
  AFTER INSERT ON form_submissions
  FOR EACH ROW
  EXECUTE FUNCTION fn_auto_create_contact_from_submission();


-- ============================================================================
-- 13. ROW LEVEL SECURITY
-- No-auth single-tenant app: anon + authenticated can read/write all tables.
-- This is intentional — the dashboard and website share the same anon-key
-- client and there is no sign-in screen yet.
-- ============================================================================

-- Helper: enable RLS and create 4 CRUD policies for a table
DO $$
DECLARE
  tbl text;

  tables text[] := ARRAY[
    'profiles', 'site_settings', 'field_schema', 'pages', 'sections',
    'content_blocks', 'services', 'service_fields', 'testimonials', 'faqs',
    'media', 'form_submissions', 'form_field_mappings', 'form_templates',
    'pipeline_stages', 'employees', 'contacts', 'bookings',
    'stage_task_templates', 'employee_tasks'
  ];

BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);


    EXECUTE format('DROP POLICY IF EXISTS "anon_select_%s" ON %I', tbl, tbl);

    EXECUTE format('CREATE POLICY "anon_select_%s" ON %I FOR SELECT TO anon, authenticated USING (true)', tbl, tbl);


    EXECUTE format('DROP POLICY IF EXISTS "anon_insert_%s" ON %I', tbl, tbl);

    EXECUTE format('CREATE POLICY "anon_insert_%s" ON %I FOR INSERT TO anon, authenticated WITH CHECK (true)', tbl, tbl);


    EXECUTE format('DROP POLICY IF EXISTS "anon_update_%s" ON %I', tbl, tbl);

    EXECUTE format('CREATE POLICY "anon_update_%s" ON %I FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true)', tbl, tbl);


    EXECUTE format('DROP POLICY IF EXISTS "anon_delete_%s" ON %I', tbl, tbl);

    EXECUTE format('CREATE POLICY "anon_delete_%s" ON %I FOR DELETE TO anon, authenticated USING (true)', tbl, tbl);

  END LOOP;

END $$;


-- ============================================================================
-- 14. SEED DATA: catalog items from Air Fair's actual service list
-- ============================================================================

INSERT INTO services (type, name, category, short_description, full_description, pricing_type, price, duration, image_url, cta_label, cta_link, featured, status, sort_order)
SELECT 'service', 'Tourist Visa Assistance', 'Visa', 'Document checklist, application filing, and appointment booking for tourist visas.', 'Document checklist, application filing, and appointment booking for tourist visas.', 'starting', 3500, '3-5 business days', 'https://picsum.photos/seed/svc1/300/200', 'Book Consultation', '/booking', true, 'Published', 0
WHERE NOT EXISTS (SELECT 1 FROM services WHERE name = 'Tourist Visa Assistance');


INSERT INTO services (type, name, category, short_description, full_description, pricing_type, price, duration, image_url, cta_label, cta_link, featured, status, sort_order)
SELECT 'service', 'Flight & Hotel Booking', 'Flight & Hotel', 'End-to-end booking for flights and accommodations, matched to your itinerary and budget.', 'End-to-end booking for flights and accommodations, matched to your itinerary and budget.', 'fixed', 800, 'Same day', 'https://picsum.photos/seed/svc2/300/200', 'Get a Quote', '/contact', false, 'Published', 1
WHERE NOT EXISTS (SELECT 1 FROM services WHERE name = 'Flight & Hotel Booking');


INSERT INTO services (type, name, category, short_description, full_description, pricing_type, price, duration, image_url, cta_label, cta_link, featured, status, sort_order)
SELECT 'service', 'Visa Consultation', 'Visa', 'One-on-one review of your documents and eligibility before you apply.', 'One-on-one review of your documents and eligibility before you apply.', 'fixed', 1500, '45 minutes', 'https://picsum.photos/seed/svc3/300/200', 'Book Now', '/booking', false, 'Published', 2
WHERE NOT EXISTS (SELECT 1 FROM services WHERE name = 'Visa Consultation');


INSERT INTO services (type, name, category, short_description, full_description, pricing_type, price, duration, image_url, cta_label, cta_link, featured, status, sort_order)
SELECT 'service', 'Travel Insurance', 'Insurance', 'Coverage options for medical, trip cancellation, and lost baggage.', 'Coverage options for medical, trip cancellation, and lost baggage.', 'starting', 950, '', 'https://picsum.photos/seed/svc4/300/200', 'Get Covered', '/contact', false, 'Published', 3
WHERE NOT EXISTS (SELECT 1 FROM services WHERE name = 'Travel Insurance');


INSERT INTO services (type, name, category, short_description, full_description, pricing_type, duration, image_url, cta_label, cta_link, featured, status, sort_order)
SELECT 'service', 'Immigration Processing', 'Immigration Processing', 'End-to-end assistance for immigrant visas, permanent residency, and work permits abroad.', 'End-to-end assistance for immigrant visas, permanent residency, and work permits abroad.', 'starting', 'Varies by case', 'https://picsum.photos/seed/svc5/300/200', 'Talk to Us', '/contact', true, 'Published', 4
WHERE NOT EXISTS (SELECT 1 FROM services WHERE name = 'Immigration Processing');


-- Products / Tour packages
INSERT INTO services (type, name, category, short_description, full_description, regular_price, pricing_unit, image_url, inclusions, exclusions, availability, featured, status, sort_order)
SELECT 'product', 'Japan Cherry Blossom 6D5N', 'Tour Package', '6 days, 5 nights through Tokyo, Osaka, and Kyoto at peak sakura season.', '6 days, 5 nights through Tokyo, Osaka, and Kyoto at peak sakura season, including a JR Pass, all transfers, and daily breakfast.', 49500, 'per person', 'https://picsum.photos/seed/prod1/300/200', 'Round-trip flights, 5-night hotel stay, JR Pass, daily breakfast, English-speaking tour guide', 'Travel insurance, personal expenses, optional side trips', 'Departures every Saturday', true, 'Published', 5
WHERE NOT EXISTS (SELECT 1 FROM services WHERE name = 'Japan Cherry Blossom 6D5N');


INSERT INTO services (type, name, category, short_description, full_description, regular_price, pricing_unit, image_url, inclusions, exclusions, availability, featured, status, sort_order)
SELECT 'product', 'Korea Autumn Package 5D4N', 'Tour Package', '5 days, 4 nights covering Seoul and Nami Island during peak autumn foliage.', '5 days, 4 nights covering Seoul and Nami Island during peak autumn foliage, including all entrance fees and airport transfers.', 38500, 'per person', 'https://picsum.photos/seed/prod2/300/200', 'Round-trip flights, 4-night hotel stay, airport transfers, entrance fees', 'Travel insurance, meals not specified, personal expenses', 'Limited slots', false, 'Draft', 6
WHERE NOT EXISTS (SELECT 1 FROM services WHERE name = 'Korea Autumn Package 5D4N');


-- Immigration visa services
INSERT INTO services (type, name, category, short_description, full_description, pricing_type, duration, image_url, cta_label, cta_link, featured, status, sort_order)
SELECT 'service', 'SRRV (Special Resident Retiree''s Visa)', 'Immigration Processing', 'A special, non-immigrant visa that entitles the holder to reside permanently in the Philippines.', 'The SRRV is a Special, Non-Immigrant Visa which entitles the holder to reside permanently in the Philippines. Benefits include permanent residency, unlimited travel, no annual reporting, tax-free imports, PhilHealth access, and government discounts.', 'quote', 'Varies by case', 'https://picsum.photos/seed/srrv/300/200', 'Start Your Retirement', '/contact', true, 'Published', 7
WHERE NOT EXISTS (SELECT 1 FROM services WHERE name = 'SRRV (Special Resident Retiree''s Visa)');


INSERT INTO services (type, name, category, short_description, full_description, pricing_type, duration, image_url, cta_label, cta_link, featured, status, sort_order)
SELECT 'service', '9G Pre-Arranged Employment Visa', 'Immigration Processing', 'Work visa for foreign nationals with a confirmed job offer in the Philippines.', 'Start your career in the Philippines with the 9G Work Visa. Benefits include legal work authorization, multiple entry privileges, and family inclusion.', 'quote', 'Varies by case', 'https://picsum.photos/seed/9gvisa/300/200', 'Apply Now', '/contact', true, 'Published', 8
WHERE NOT EXISTS (SELECT 1 FROM services WHERE name = '9G Pre-Arranged Employment Visa');


INSERT INTO services (type, name, category, short_description, full_description, pricing_type, duration, image_url, cta_label, cta_link, featured, status, sort_order)
SELECT 'service', '13A Immigrant Visa by Marriage', 'Immigration Processing', 'Permanent residency for foreign spouses of Filipino citizens.', 'Permanent residency for foreign spouses of Filipino citizens.', 'quote', 'Varies by case', 'https://picsum.photos/seed/thirteena/300/200', 'Talk to Us', '/contact', false, 'Published', 9
WHERE NOT EXISTS (SELECT 1 FROM services WHERE name = '13A Immigrant Visa by Marriage');


INSERT INTO services (type, name, category, short_description, full_description, pricing_type, duration, image_url, cta_label, cta_link, featured, status, sort_order)
SELECT 'service', 'ACR I-Card (Issuance, Renewal, Cancellation)', 'Immigration Processing', 'Alien Certificate of Registration Identity Card processing for foreign residents.', 'Alien Certificate of Registration Identity Card processing for foreign residents — issuance, renewal, or cancellation.', 'quote', 'Varies by case', 'https://picsum.photos/seed/acricard/300/200', 'Talk to Us', '/contact', false, 'Published', 10
WHERE NOT EXISTS (SELECT 1 FROM services WHERE name = 'ACR I-Card (Issuance, Renewal, Cancellation)');


INSERT INTO services (type, name, category, short_description, full_description, pricing_type, duration, image_url, cta_label, cta_link, featured, status, sort_order)
SELECT 'service', 'Annual Report Filing', 'Immigration Processing', 'Mandatory annual report filing for registered foreign nationals residing in the Philippines.', 'Mandatory annual report filing for registered foreign nationals residing in the Philippines.', 'quote', 'Seasonal (Jan–Mar)', 'https://picsum.photos/seed/annualreport/300/200', 'Talk to Us', '/contact', false, 'Published', 11
WHERE NOT EXISTS (SELECT 1 FROM services WHERE name = 'Annual Report Filing');


-- Tour packages
INSERT INTO services (type, name, category, short_description, full_description, pricing_unit, image_url, inclusions, availability, featured, status, sort_order)
SELECT 'product', 'Puerto Princesa Getaway', 'Tour Package', 'Discover the Underground River and pristine white sand beaches of Palawan.', 'This summer, discover the natural wonders of Puerto Princesa! From the mesmerizing Underground River to pristine white sand beaches, let the beauty of nature refresh your soul.', 'per person', 'https://picsum.photos/seed/puertoprincesa/300/200', 'Please contact us for a full itinerary and rate', 'Summer departures', true, 'Published', 12
WHERE NOT EXISTS (SELECT 1 FROM services WHERE name = 'Puerto Princesa Getaway');


INSERT INTO services (type, name, category, short_description, full_description, pricing_unit, image_url, inclusions, availability, featured, status, sort_order)
SELECT 'product', 'Boracay Island Escape', 'Tour Package', 'White sand, crystal-clear waters, and endless summer vibes.', 'White sand, crystal-clear waters, and endless summer vibes — Boracay is calling! Whether you''re chasing sunsets, partying by the shore, or simply soaking up the sun, this island paradise promises the ultimate summer escape.', 'per person', 'https://picsum.photos/seed/boracay/300/200', 'Please contact us for a full itinerary and rate', 'Summer departures', true, 'Published', 13
WHERE NOT EXISTS (SELECT 1 FROM services WHERE name = 'Boracay Island Escape');


INSERT INTO services (type, name, category, short_description, full_description, pricing_unit, image_url, inclusions, availability, featured, status, sort_order)
SELECT 'product', 'El Nido, Palawan Adventure', 'Tour Package', 'Turquoise waters, towering limestone cliffs, and hidden lagoons.', 'Escape to El Nido, where turquoise waters meet towering limestone cliffs. Kayak through hidden lagoons, dive into vibrant coral reefs, and let the breathtaking island views take your worries away.', 'per person', 'https://picsum.photos/seed/elnido/300/200', 'Please contact us for a full itinerary and rate', 'Summer departures', false, 'Published', 14
WHERE NOT EXISTS (SELECT 1 FROM services WHERE name = 'El Nido, Palawan Adventure');


INSERT INTO services (type, name, category, short_description, full_description, regular_price, pricing_unit, image_url, inclusions, exclusions, availability, featured, status, sort_order)
SELECT 'product', 'Escape to Central Vietnam', 'Tour Package', 'Scenic beauty, delicious food, and the iconic Golden Bridge at Ba Na Hills.', 'Experience scenic beauty, delicious food, and romantic moments in one amazing journey through Central Vietnam, including a visit to the famous Golden Bridge.', 689, 'per person', 'https://picsum.photos/seed/vietnam/300/200', 'Transfer, Tours, Insurance, Flight, Hotel Accommodation, Meals as per itinerary, Guide', 'Personal expenses', 'Twin sharing rate — price in USD', true, 'Published', 15
WHERE NOT EXISTS (SELECT 1 FROM services WHERE name = 'Escape to Central Vietnam');

;
