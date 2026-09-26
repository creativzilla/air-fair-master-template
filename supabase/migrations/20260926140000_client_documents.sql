/*
# Client documents and team resources

Files the team keeps for each client (passports, visas, contracts, ...).
- Table client_documents: one row per file, linked to a CRM contact.
- Storage bucket client-documents: PRIVATE; files are opened through
  short-lived signed URLs from the dashboard. 25 MB per file.
- Access: admin / editor / staff can list, upload, download and edit the
  category/note; only admins can delete. A contact that still has
  documents can't be deleted (prevents orphaned files).

Additive only: no existing table or row is changed.
*/

create table if not exists public.client_documents (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.contacts(id) on delete restrict,
  file_name text not null check (length(file_name) between 1 and 255),
  storage_path text not null unique,
  mime_type text,
  size_bytes bigint check (size_bytes is null or size_bytes >= 0),
  category text not null default 'Other' check (length(category) between 1 and 60),
  note text check (note is null or length(note) <= 2000),
  uploaded_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists idx_client_documents_contact on public.client_documents(contact_id, created_at desc);

alter table public.client_documents enable row level security;

drop policy if exists "client_documents_team_read" on public.client_documents;
create policy "client_documents_team_read" on public.client_documents
  for select to authenticated using (public.is_team());
drop policy if exists "client_documents_team_insert" on public.client_documents;
create policy "client_documents_team_insert" on public.client_documents
  for insert to authenticated with check (public.is_team());
drop policy if exists "client_documents_team_update" on public.client_documents;
create policy "client_documents_team_update" on public.client_documents
  for update to authenticated using (public.is_team()) with check (public.is_team());
drop policy if exists "client_documents_admin_delete" on public.client_documents;
create policy "client_documents_admin_delete" on public.client_documents
  for delete to authenticated using (public.is_admin());

-- Private bucket
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('client-documents', 'client-documents', false, 26214400,
        array['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif',
              'application/msword',
              'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
              'application/vnd.ms-excel',
              'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
              'text/plain'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "client_documents_storage_team_read" on storage.objects;
create policy "client_documents_storage_team_read" on storage.objects
  for select to authenticated using (bucket_id = 'client-documents' and public.is_team());
drop policy if exists "client_documents_storage_team_insert" on storage.objects;
create policy "client_documents_storage_team_insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'client-documents' and public.is_team());
drop policy if exists "client_documents_storage_admin_delete" on storage.objects;
create policy "client_documents_storage_admin_delete" on storage.objects
  for delete to authenticated using (bucket_id = 'client-documents' and public.is_admin());

-- ============================================================================
-- Team resources: internal files shared by the whole team (templates,
-- checklists, government forms, guides). Not linked to a client.
-- Same access model: team read/upload/edit, admin-only delete. Private bucket.
-- ============================================================================

create table if not exists public.team_resources (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(title) between 1 and 200),
  description text check (description is null or length(description) <= 2000),
  category text not null default 'Other' check (length(category) between 1 and 60),
  file_name text not null check (length(file_name) between 1 and 255),
  storage_path text not null unique,
  mime_type text,
  size_bytes bigint check (size_bytes is null or size_bytes >= 0),
  uploaded_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_team_resources_category on public.team_resources(category, created_at desc);

drop trigger if exists trg_team_resources_updated_at on public.team_resources;
create trigger trg_team_resources_updated_at before update on public.team_resources
  for each row execute function public.set_updated_at();

alter table public.team_resources enable row level security;

drop policy if exists "team_resources_team_read" on public.team_resources;
create policy "team_resources_team_read" on public.team_resources
  for select to authenticated using (public.is_team());
drop policy if exists "team_resources_team_insert" on public.team_resources;
create policy "team_resources_team_insert" on public.team_resources
  for insert to authenticated with check (public.is_team());
drop policy if exists "team_resources_team_update" on public.team_resources;
create policy "team_resources_team_update" on public.team_resources
  for update to authenticated using (public.is_team()) with check (public.is_team());
drop policy if exists "team_resources_admin_delete" on public.team_resources;
create policy "team_resources_admin_delete" on public.team_resources
  for delete to authenticated using (public.is_admin());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('team-resources', 'team-resources', false, 26214400,
        array['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif',
              'application/msword',
              'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
              'application/vnd.ms-excel',
              'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
              'application/vnd.ms-powerpoint',
              'application/vnd.openxmlformats-officedocument.presentationml.presentation',
              'text/plain', 'text/csv', 'application/zip'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "team_resources_storage_team_read" on storage.objects;
create policy "team_resources_storage_team_read" on storage.objects
  for select to authenticated using (bucket_id = 'team-resources' and public.is_team());
drop policy if exists "team_resources_storage_team_insert" on storage.objects;
create policy "team_resources_storage_team_insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'team-resources' and public.is_team());
drop policy if exists "team_resources_storage_admin_delete" on storage.objects;
create policy "team_resources_storage_admin_delete" on storage.objects
  for delete to authenticated using (bucket_id = 'team-resources' and public.is_admin());
