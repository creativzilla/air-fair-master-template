/*
# CMS 1/3 — Roles, helper functions, RLS and Storage rules

Standalone and safe to apply on its own (it does not depend on the CMS
tables in 2/3 and 3/3). It supersedes 20260913150000_lock_down_rls_policies.sql,
which is NOT in effect on the live project: as of 2026-09-26 the anon key can
read form_submissions, contacts, employees and bookings.

What it does
1. Roles on `profiles`: admin | editor | staff | none (default none).
   - super_admin -> admin. `client` (the old default for every sign-up) -> none,
     so unknown self-registered accounts get NO access.
   - A trigger creates a `none` profile for every new auth user; existing auth
     users are backfilled as `none`.
2. Helper functions auth_role(), is_admin(), is_editor(), is_team().
3. Drops EVERY existing policy on the listed public tables (unknown live
   policy names could otherwise keep the leak open, because permissive
   policies are OR-ed) and recreates a least-privilege set.
4. Storage: catalog-images stays public-read, editor write, admin delete.
   form-attachments becomes PRIVATE: public upload only, team read, admin delete.

AFTER APPLYING, promote yourself (the dashboard shows no data until you do):
  update public.profiles set role = 'admin' where email = '<your-login-email>';
Also disable open sign-ups: Supabase Dashboard -> Authentication -> Providers
-> Email -> turn off "Allow new users to sign up".
*/

-- ============================================================================
-- 1. Roles on profiles
-- ============================================================================

alter table public.profiles drop constraint if exists profiles_role_check;
update public.profiles set role = 'admin' where role = 'super_admin';
update public.profiles set role = 'none' where role not in ('admin', 'editor', 'staff');
alter table public.profiles alter column role set default 'none';
alter table public.profiles
  add constraint profiles_role_check check (role in ('admin', 'editor', 'staff', 'none'));

alter table public.profiles
  add column if not exists is_active boolean not null default true,
  add column if not exists updated_at timestamptz not null default now();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'full_name', ''), 'none')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

insert into public.profiles (id, email, role)
select u.id, u.email, 'none' from auth.users u
on conflict (id) do nothing;

-- ============================================================================
-- 2. Helper functions (security definer so policies can read profiles)
-- ============================================================================

create or replace function public.auth_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select p.role from public.profiles p where p.id = auth.uid() and p.is_active),
    'none'
  );
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public
as $$ select public.auth_role() = 'admin'; $$;

-- Content editors: admin or editor
create or replace function public.is_editor()
returns boolean language sql stable security definer set search_path = public
as $$ select public.auth_role() in ('admin', 'editor'); $$;

-- Anyone allowed into the dashboard: admin, editor, staff
create or replace function public.is_team()
returns boolean language sql stable security definer set search_path = public
as $$ select public.auth_role() in ('admin', 'editor', 'staff'); $$;

create or replace function public.set_updated_at()
returns trigger language plpgsql
as $$ begin new.updated_at := now(); return new; end; $$;

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- ============================================================================
-- 3. Reset all policies on existing public tables
-- ============================================================================

do $$
declare
  r record;
  t text;
  tables text[] := array[
    'profiles', 'site_settings', 'field_schema', 'pages', 'sections', 'content_blocks',
    'services', 'service_fields', 'testimonials', 'faqs', 'media',
    'form_submissions', 'form_field_mappings', 'form_templates',
    'pipeline_stages', 'employees', 'contacts', 'bookings',
    'stage_task_templates', 'employee_tasks'
  ];
begin
  foreach t in array tables loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
  for r in
    select policyname, tablename from pg_policies
    where schemaname = 'public' and tablename = any(tables)
  loop
    execute format('drop policy %I on public.%I', r.policyname, r.tablename);
  end loop;
end;
$$;

-- profiles: see own row; admins see and manage everyone. No self-update
-- (the old "users_update_own_profile" policy allowed self-promotion).
create policy "profiles_select_own_or_admin" on public.profiles
  for select to authenticated using (id = auth.uid() or public.is_admin());
create policy "profiles_admin_update" on public.profiles
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "profiles_admin_delete" on public.profiles
  for delete to authenticated using (public.is_admin());

-- site_settings: public read (the site needs it), admin write
create policy "site_settings_public_read" on public.site_settings
  for select to anon, authenticated using (true);
create policy "site_settings_admin_write" on public.site_settings
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Legacy content engine (still read by the site until Phase 4): public read, admin write
create policy "pages_public_read" on public.pages for select to anon, authenticated using (true);
create policy "pages_admin_write" on public.pages for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "sections_public_read" on public.sections for select to anon, authenticated using (true);
create policy "sections_admin_write" on public.sections for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "content_blocks_public_read" on public.content_blocks for select to anon, authenticated using (true);
create policy "content_blocks_admin_write" on public.content_blocks for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- testimonials (legacy): public sees published rows only
create policy "testimonials_read" on public.testimonials
  for select to anon, authenticated using (is_published or public.is_editor());
create policy "testimonials_admin_write" on public.testimonials
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Dormant tables: team read, admin write
create policy "faqs_team_read" on public.faqs for select to authenticated using (public.is_team());
create policy "faqs_admin_write" on public.faqs for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "field_schema_team_read" on public.field_schema for select to authenticated using (public.is_team());
create policy "field_schema_admin_write" on public.field_schema for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "service_fields_team_read" on public.service_fields for select to authenticated using (public.is_team());
create policy "service_fields_admin_write" on public.service_fields for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "form_templates_team_read" on public.form_templates for select to authenticated using (public.is_team());
create policy "form_templates_admin_write" on public.form_templates for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- services (Catalog): public sees Published; team sees all; editors edit; admins delete
create policy "services_read" on public.services
  for select to anon, authenticated using (status = 'Published' or public.is_team());
create policy "services_editor_insert" on public.services
  for insert to authenticated with check (public.is_editor());
create policy "services_editor_update" on public.services
  for update to authenticated using (public.is_editor()) with check (public.is_editor());
create policy "services_admin_delete" on public.services
  for delete to authenticated using (public.is_admin());

-- media library
create policy "media_team_read" on public.media for select to authenticated using (public.is_team());
create policy "media_editor_insert" on public.media for insert to authenticated with check (public.is_editor());
create policy "media_editor_update" on public.media for update to authenticated using (public.is_editor()) with check (public.is_editor());
create policy "media_admin_delete" on public.media for delete to authenticated using (public.is_admin());

-- form_submissions: anyone may submit (status must be New, bounded size);
-- only the team can read/update; only admins delete.
-- (Tightened again in 3/3 once the new columns exist.)
create policy "form_submissions_public_insert" on public.form_submissions
  for insert to anon, authenticated
  with check (status = 'New' and octet_length(raw_data::text) <= 200000);
create policy "form_submissions_team_read" on public.form_submissions
  for select to authenticated using (public.is_team());
create policy "form_submissions_team_update" on public.form_submissions
  for update to authenticated using (public.is_team()) with check (public.is_team());
create policy "form_submissions_admin_delete" on public.form_submissions
  for delete to authenticated using (public.is_admin());

-- CRM configuration: team read, admin write
create policy "form_field_mappings_team_read" on public.form_field_mappings for select to authenticated using (public.is_team());
create policy "form_field_mappings_admin_write" on public.form_field_mappings for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "pipeline_stages_team_read" on public.pipeline_stages for select to authenticated using (public.is_team());
create policy "pipeline_stages_admin_write" on public.pipeline_stages for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "stage_task_templates_team_read" on public.stage_task_templates for select to authenticated using (public.is_team());
create policy "stage_task_templates_admin_write" on public.stage_task_templates for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "employees_team_read" on public.employees for select to authenticated using (public.is_team());
create policy "employees_admin_write" on public.employees for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- CRM working data: team read/insert/update, admin delete
create policy "contacts_team_read" on public.contacts for select to authenticated using (public.is_team());
create policy "contacts_team_insert" on public.contacts for insert to authenticated with check (public.is_team());
create policy "contacts_team_update" on public.contacts for update to authenticated using (public.is_team()) with check (public.is_team());
create policy "contacts_admin_delete" on public.contacts for delete to authenticated using (public.is_admin());

create policy "bookings_team_read" on public.bookings for select to authenticated using (public.is_team());
create policy "bookings_team_insert" on public.bookings for insert to authenticated with check (public.is_team());
create policy "bookings_team_update" on public.bookings for update to authenticated using (public.is_team()) with check (public.is_team());
create policy "bookings_admin_delete" on public.bookings for delete to authenticated using (public.is_admin());

create policy "employee_tasks_team_read" on public.employee_tasks for select to authenticated using (public.is_team());
create policy "employee_tasks_team_insert" on public.employee_tasks for insert to authenticated with check (public.is_team());
create policy "employee_tasks_team_update" on public.employee_tasks for update to authenticated using (public.is_team()) with check (public.is_team());
create policy "employee_tasks_admin_delete" on public.employee_tasks for delete to authenticated using (public.is_admin());

-- ============================================================================
-- 4. Storage buckets and policies
-- ============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('catalog-images', 'catalog-images', true, 5242880,
        array['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do update
  set public = true,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('form-attachments', 'form-attachments', false, 10485760,
        array['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic',
              'application/msword',
              'application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Drop existing policies for these buckets, plus any blanket "true" policy on
-- storage.objects (which would expose private attachments).
do $$
declare r record;
begin
  for r in
    select policyname from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and (
        coalesce(qual, '') || coalesce(with_check, '') ~ '(catalog-images|form-attachments)'
        or coalesce(qual, with_check, '') = 'true'
      )
  loop
    begin
      execute format('drop policy %I on storage.objects', r.policyname);
    exception when insufficient_privilege then
      raise warning 'Could not drop storage policy %; remove it manually in the dashboard', r.policyname;
    end;
  end loop;
end;
$$;

create policy "catalog_images_public_read" on storage.objects
  for select to anon, authenticated using (bucket_id = 'catalog-images');
create policy "catalog_images_editor_insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'catalog-images' and public.is_editor());
create policy "catalog_images_editor_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'catalog-images' and public.is_editor())
  with check (bucket_id = 'catalog-images' and public.is_editor());
create policy "catalog_images_admin_delete" on storage.objects
  for delete to authenticated using (bucket_id = 'catalog-images' and public.is_admin());

-- Website visitors can upload attachments with their submission but can never
-- list or read them. Staff read via signed URLs.
create policy "form_attachments_public_insert" on storage.objects
  for insert to anon, authenticated with check (bucket_id = 'form-attachments');
create policy "form_attachments_team_read" on storage.objects
  for select to authenticated using (bucket_id = 'form-attachments' and public.is_team());
create policy "form_attachments_admin_delete" on storage.objects
  for delete to authenticated using (bucket_id = 'form-attachments' and public.is_admin());
