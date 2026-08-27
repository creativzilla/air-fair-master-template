-- ============================================================================
-- MASTER TEMPLATE DATABASE SCHEMA (consolidated, v2)
-- Reusable Website + Dashboard system (Bolt / Supabase)
--
-- This is the ONE file to run for a fresh project — it already includes
-- everything from the original schema plus the Catalog/Pipeline-stages/
-- Settings/Form-Builder additions. Superseded files (do not use):
--   - database-schema.sql (v1)
--   - database-schema-v2-updates.sql (the additive patch, now merged in here)
--
-- Going forward, once this is live with real data, switch back to the
-- additive-only approach described at the top of the original file: new
-- migrations add columns/tables, never rename or drop columns with data.
-- ============================================================================


-- ============================================================================
-- 1. ROLES & SITE IDENTITY
-- ============================================================================

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  role text not null default 'client'
    check (role in ('super_admin', 'client', 'staff')),
  created_at timestamptz not null default now()
);

create table site_settings (
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
  -- Raw embed script from any chat provider (Messenger Chat Plugin,
  -- Tawk.to, Crisp, Tidio, WhatsApp click-to-chat, etc.) — injected as-is
  -- into the public website's <body>. No code change needed to swap
  -- providers, just paste a new snippet here.
  chat_widget_code text,
  updated_at timestamptz not null default now()
);


-- ============================================================================
-- 2. FIELD SCHEMA REGISTRY
-- Drives every schema-driven editable UI (Edit Website sections, and any
-- future content type). Adding a row here is how a developer exposes a
-- new field in the design to the CMS, with zero dashboard code changes.
-- ============================================================================

create table field_schema (
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

create table pages (
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

create table sections (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references pages(id) on delete cascade,
  template_type text not null,
  sort_order int not null default 0,
  is_visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_sections_page on sections(page_id);

create table content_blocks (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references sections(id) on delete cascade,
  field_key text not null,
  value text,
  updated_at timestamptz not null default now(),
  unique (section_id, field_key)
);
create index idx_content_blocks_section on content_blocks(section_id);


-- ============================================================================
-- 4. CATALOG — unified Services + Products/Packages
-- `type` is the only thing distinguishing a service from a product; both
-- share this one table so the dashboard's Catalog module (and future
-- reuse for other industries) never needs two parallel systems.
-- ============================================================================

create table services (
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

  -- Service-specific pricing
  pricing_type text
    check (pricing_type in ('fixed', 'starting', 'range', 'quote', 'free')),
  price numeric,
  price_min numeric,
  price_max numeric,
  duration text,

  -- Product/Package-specific pricing
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

-- Extra fields specific to a service/product's template_type, defined
-- per-row in field_schema and filled in here — for anything beyond the
-- standard columns above.
create table service_fields (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references services(id) on delete cascade,
  field_key text not null,
  value text,
  updated_at timestamptz not null default now(),
  unique (service_id, field_key)
);
create index idx_service_fields_service on service_fields(service_id);


-- ============================================================================
-- 5. TESTIMONIALS & FAQS
-- ============================================================================

create table testimonials (
  id uuid primary key default gen_random_uuid(),
  client_name text not null,
  quote text not null,
  service_category text,
  photo_url text,
  is_published boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table faqs (
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

create table media (
  id uuid primary key default gen_random_uuid(),
  url text not null,
  alt_text text,
  uploaded_by uuid references profiles(id),
  created_at timestamptz not null default now()
);


-- ============================================================================
-- 7. FORMS — submissions, routing automation, and the Form Builder itself
-- ============================================================================

create table form_submissions (
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
create index idx_form_submissions_type on form_submissions(form_type);

create table form_field_mappings (
  id uuid primary key default gen_random_uuid(),
  form_type text not null unique,
  auto_create_contact boolean not null default true,
  maps_to_category text,
  field_mapping jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- The Form Builder's own configs — what fields a form has, in what order.
-- Distinct from form_submissions (the answers) and form_field_mappings
-- (the automation routing).
create table form_templates (
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
create index idx_form_templates_form_type on form_templates(form_type);


-- ============================================================================
-- 8. CONFIGURABLE PIPELINE STAGES
-- Stages are client-editable (add/rename/reorder/remove from Settings),
-- so contacts.status and stage_task_templates.stage are plain text with
-- no fixed enum — validity is enforced at the application layer against
-- this table's contents, the same way the dashboard already does it.
-- ============================================================================

create table pipeline_stages (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

insert into pipeline_stages (name, sort_order) values
  ('New Lead', 0), ('Contacted', 1), ('Qualified', 2),
  ('Proposal Sent', 3), ('Booked Appointment', 4), ('Close', 5);


-- ============================================================================
-- 9. CRM PIPELINE (Contacts)
-- ============================================================================

create table employees (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),
  name text not null,
  email text,
  role text,
  -- What dashboard modules this employee can see once they log in with
  -- their own account. Editable only by super_admin/client (see RLS below,
  -- and the dashboard's Employees page, which never exposes this control
  -- to the employee's own logged-in view).
  allowed_modules jsonb not null default
    '{"pipeline": true, "bookings": true, "clients": true, "forms": true, "services": false, "media": false, "edit-website": false, "employees": false, "settings": false}'::jsonb,
  created_at timestamptz not null default now()
);

create table contacts (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid references form_submissions(id),
  name text not null,
  email text,
  category text not null,
  status text not null default 'New Lead',  -- validated against pipeline_stages at the app layer
  amount numeric,
  assigned_employee_id uuid references employees(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_contacts_status on contacts(status);
create index idx_contacts_assigned on contacts(assigned_employee_id);

create table bookings (
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
create index idx_bookings_contact on bookings(contact_id);


-- ============================================================================
-- 10. PIPELINE AUTOMATION + EMPLOYEE TASKS
-- ============================================================================

create table stage_task_templates (
  id uuid primary key default gen_random_uuid(),
  stage text not null,  -- validated against pipeline_stages at the app layer
  title text not null,
  created_at timestamptz not null default now()
);

create table employee_tasks (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id) on delete cascade,
  contact_id uuid references contacts(id),
  title text not null,
  due_date date,
  is_done boolean not null default false,
  created_at timestamptz not null default now()
);
create index idx_employee_tasks_employee on employee_tasks(employee_id);


-- ============================================================================
-- 11. AUTOMATION: stage-change -> auto-create employee tasks
-- ============================================================================

create or replace function fn_auto_assign_stage_tasks()
returns trigger as $$
begin
  if new.status is distinct from old.status and new.assigned_employee_id is not null then
    insert into employee_tasks (employee_id, contact_id, title, due_date, is_done)
    select new.assigned_employee_id, new.id, tmpl.title || ' — ' || new.name, null, false
    from stage_task_templates tmpl
    where tmpl.stage = new.status;
  end if;
  return new;
end;
$$ language plpgsql;

create trigger trg_auto_assign_stage_tasks
  after update of status on contacts
  for each row
  execute function fn_auto_assign_stage_tasks();


-- ============================================================================
-- 12. AUTOMATION: form_submissions -> contacts
-- ============================================================================

create or replace function fn_auto_create_contact_from_submission()
returns trigger as $$
declare
  mapping form_field_mappings%rowtype;
  computed_category text;
  computed_amount numeric;
begin
  select * into mapping from form_field_mappings where form_type = new.form_type;

  if mapping.form_type is null or not mapping.auto_create_contact then
    return new;
  end if;

  computed_category := coalesce(
    new.raw_data ->> (mapping.field_mapping ->> 'category'),
    mapping.maps_to_category
  );
  computed_amount := nullif(new.raw_data ->> (mapping.field_mapping ->> 'amount'), '')::numeric;

  insert into contacts (submission_id, name, email, category, status, amount)
  values (new.id, new.name, new.email, computed_category, 'New Lead', computed_amount);

  return new;
end;
$$ language plpgsql;

create trigger trg_auto_create_contact
  after insert on form_submissions
  for each row
  execute function fn_auto_create_contact_from_submission();


-- ============================================================================
-- 13. ROW LEVEL SECURITY (sketch)
-- Finalized once auth is wired up in Bolt — this is the shape: staff see
-- only their own tasks; only super_admin manages schema/automation config.
-- ============================================================================

alter table employee_tasks enable row level security;

create policy "staff see only their own tasks"
  on employee_tasks for select
  using (
    exists (
      select 1 from employees e
      where e.id = employee_tasks.employee_id
      and e.user_id = auth.uid()
    )
    or exists (
      select 1 from profiles p
      where p.id = auth.uid() and p.role in ('super_admin', 'client')
    )
  );

alter table field_schema enable row level security;
alter table stage_task_templates enable row level security;
alter table pipeline_stages enable row level security;
alter table employees enable row level security;

create policy "employees view their own record, admins view all"
  on employees for select
  using (
    user_id = auth.uid()
    or exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('super_admin', 'client'))
  );

create policy "only super_admin/client edit employee access"
  on employees for update
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('super_admin', 'client')));
-- Note the deliberate gap: employees can SELECT their own row (so the
-- dashboard can read their own allowed_modules to build their sidebar)
-- but have no UPDATE policy on this table at all — meaning even if
-- someone tried, an employee can never change their own access.

create policy "only super_admin manages field_schema"
  on field_schema for all
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'super_admin'));

create policy "only super_admin manages stage_task_templates"
  on stage_task_templates for all
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'super_admin'));

create policy "client and super_admin manage pipeline_stages"
  on pipeline_stages for all
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('super_admin', 'client')));

-- Remaining tables (pages, sections, content_blocks, services, contacts,
-- bookings, forms, media, site_settings) get RLS enabled the same way
-- once the client-vs-admin auth flow is wired up in Bolt.
