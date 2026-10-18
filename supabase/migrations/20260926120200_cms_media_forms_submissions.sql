/*
# CMS 3/3 — Media library, submissions, CRM routing, newsletter

Requires 1/3 and 2/3.

Changes to EXISTING tables (additive only; nothing renamed or dropped):
- media:            storage metadata columns
- form_submissions: form_key, document_id, form_version_id, source_page,
                    attachments, notes, handled_by, updated_at (+ backfill of form_key)
- contacts:         phone
- form_field_mappings: reused as the CRM routing table, keyed by form key
                    (stored in its existing form_type column)
- fn_auto_create_contact_from_submission: now security definer, matches on
                    form_key, never blocks a submission if lead creation fails
New table: newsletter_subscribers
*/

-- ============================================================================
-- 1. Media library (reuses `media`)
-- ============================================================================

alter table public.media
  add column if not exists bucket text not null default 'catalog-images',
  add column if not exists storage_path text,
  add column if not exists file_name text,
  add column if not exists mime_type text,
  add column if not exists size_bytes bigint,
  add column if not exists width int,
  add column if not exists height int,
  add column if not exists folder text not null default 'library',
  add column if not exists tags text[] not null default '{}',
  add column if not exists source_url text,          -- original hardcoded URL (seed traceability)
  add column if not exists updated_at timestamptz not null default now();

alter table public.media alter column uploaded_by set default auth.uid();

create unique index if not exists media_bucket_path_key
  on public.media(bucket, storage_path) where storage_path is not null;
create index if not exists idx_media_folder on public.media(folder, created_at desc);

drop trigger if exists trg_media_updated_at on public.media;
create trigger trg_media_updated_at before update on public.media
  for each row execute function public.set_updated_at();

-- ============================================================================
-- 2. Submissions (reuses `form_submissions`)
-- ============================================================================

alter table public.form_submissions
  add column if not exists form_key text,
  add column if not exists document_id uuid references public.cms_documents(id) on delete set null,
  add column if not exists form_version_id uuid references public.cms_versions(id) on delete set null,
  add column if not exists source_page text,
  add column if not exists attachments jsonb not null default '[]'::jsonb,
  add column if not exists notes text,
  add column if not exists handled_by uuid references public.profiles(id) on delete set null,
  add column if not exists updated_at timestamptz not null default now();

create index if not exists idx_form_submissions_form_key on public.form_submissions(form_key);
create index if not exists idx_form_submissions_status on public.form_submissions(status, created_at desc);

-- Backfill form_key for existing rows from the legacy form_type naming
update public.form_submissions set form_key = case
    when form_type like 'immigration\_%'    then 'immigration-' || substr(form_type, 13)
    when form_type like 'visa\_%'           then 'visa-inquiry'
    when form_type like 'travel\_package\_%' then 'travel-inquiry'
    when form_type = 'website_inquiry'      then 'website-contact'
    else form_type
  end
where form_key is null;

drop trigger if exists trg_form_submissions_updated_at on public.form_submissions;
create trigger trg_form_submissions_updated_at before update on public.form_submissions
  for each row execute function public.set_updated_at();

-- Visitors can't set staff-only fields on insert
drop policy if exists "form_submissions_public_insert" on public.form_submissions;
create policy "form_submissions_public_insert" on public.form_submissions
  for insert to anon, authenticated
  with check (
    status = 'New'
    and notes is null
    and handled_by is null
    and octet_length(raw_data::text) <= 200000
    and jsonb_typeof(attachments) = 'array'
  );

-- ============================================================================
-- 3. CRM routing: submission -> lead (contact)
-- ============================================================================

alter table public.contacts add column if not exists phone text;

create or replace function public.fn_auto_create_contact_from_submission()
returns trigger
language plpgsql
security definer          -- anon submitters have no rights on contacts
set search_path = public
as $$
declare
  mapping public.form_field_mappings%rowtype;
  computed_category text;
  computed_amount numeric;
  first_stage text;
begin
  select * into mapping from public.form_field_mappings
   where form_type = coalesce(new.form_key, new.form_type);

  if not found or not mapping.auto_create_contact then
    return new;
  end if;

  computed_category := coalesce(
    nullif(new.raw_data ->> (mapping.field_mapping ->> 'category'), ''),
    mapping.maps_to_category,
    'General'
  );

  begin
    computed_amount := nullif(new.raw_data ->> (mapping.field_mapping ->> 'amount'), '')::numeric;
  exception when others then
    computed_amount := null;
  end;

  select name into first_stage from public.pipeline_stages order by sort_order limit 1;

  begin
    insert into public.contacts (submission_id, name, email, phone, category, status, amount)
    values (new.id, coalesce(nullif(new.name, ''), '(no name)'), new.email, new.phone,
            computed_category, coalesce(first_stage, 'New Lead'), computed_amount);
  exception when others then
    -- Never lose a submission because lead creation failed
    raise warning 'Auto-create contact failed for submission %: %', new.id, sqlerrm;
  end;

  return new;
end;
$$;

drop trigger if exists trg_auto_create_contact on public.form_submissions;
create trigger trg_auto_create_contact
  after insert on public.form_submissions
  for each row execute function public.fn_auto_create_contact_from_submission();

-- Stage-change -> employee tasks stays in the database (single source of truth).
-- Phase 5 removes the duplicate client-side task creation in Dashboard.jsx.
create or replace function public.fn_auto_assign_stage_tasks()
returns trigger
language plpgsql
as $$
begin
  if new.status is distinct from old.status and new.assigned_employee_id is not null then
    insert into public.employee_tasks (employee_id, contact_id, title, due_date, is_done)
    select new.assigned_employee_id, new.id, tmpl.title || ' — ' || new.name, null, false
    from public.stage_task_templates tmpl
    where tmpl.stage = new.status;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_auto_assign_stage_tasks on public.contacts;
create trigger trg_auto_assign_stage_tasks
  after update of status on public.contacts
  for each row execute function public.fn_auto_assign_stage_tasks();

-- ============================================================================
-- 4. Newsletter
-- ============================================================================

create table if not exists public.newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' and length(email) <= 254),
  source_page text,
  created_at timestamptz not null default now(),
  unsubscribed_at timestamptz
);
create unique index if not exists newsletter_subscribers_email_key
  on public.newsletter_subscribers (lower(email));

alter table public.newsletter_subscribers enable row level security;

drop policy if exists "newsletter_public_insert" on public.newsletter_subscribers;
create policy "newsletter_public_insert" on public.newsletter_subscribers
  for insert to anon, authenticated with check (unsubscribed_at is null);
drop policy if exists "newsletter_team_read" on public.newsletter_subscribers;
create policy "newsletter_team_read" on public.newsletter_subscribers
  for select to authenticated using (public.is_team());
drop policy if exists "newsletter_team_update" on public.newsletter_subscribers;
create policy "newsletter_team_update" on public.newsletter_subscribers
  for update to authenticated using (public.is_team()) with check (public.is_team());
drop policy if exists "newsletter_admin_delete" on public.newsletter_subscribers;
create policy "newsletter_admin_delete" on public.newsletter_subscribers
  for delete to authenticated using (public.is_admin());
