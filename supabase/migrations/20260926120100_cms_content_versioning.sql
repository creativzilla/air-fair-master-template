/*
# CMS 2/3 — Versioned content documents (draft / preview / publish / history)

Requires 1/3 (is_admin / is_editor helpers).

Model
- cms_documents   one row per editable thing (page, service, form, article…).
                  Holds the working DRAFT only. Editors and admins only.
- cms_versions    immutable snapshots: every draft save, publish, restore, unpublish.
- cms_published   the live copy the public site reads. Written ONLY by
                  cms_publish()/cms_unpublish() (admin). Public read.

The public site never touches cms_documents, so drafts can't leak through RLS,
and there is no column-level-security trickery or definer view to get wrong.
*/

-- ============================================================================
-- 1. Tables
-- ============================================================================

create table if not exists public.cms_documents (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in (
    'global', 'page', 'immigration_service', 'visa_destination', 'travel_package',
    'travel_destination', 'news_article', 'testimonial', 'form'
  )),
  slug text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text not null,
  sort_order int not null default 0,
  draft jsonb not null default '{}'::jsonb check (jsonb_typeof(draft) = 'object'),
  draft_revision int not null default 1,
  -- Publish bookkeeping: only cms_publish()/cms_unpublish() can change these
  published_revision int,
  published_version_id uuid,
  published_at timestamptz,
  published_by uuid references public.profiles(id) on delete set null,
  -- Optional links
  form_document_id uuid references public.cms_documents(id) on delete set null,
  service_id uuid references public.services(id) on delete set null,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null,
  unique (kind, slug)
);
create index if not exists idx_cms_documents_kind on public.cms_documents(kind, sort_order);

create table if not exists public.cms_versions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.cms_documents(id) on delete cascade,
  version_no int not null,
  action text not null check (action in ('save', 'publish', 'restore', 'unpublish')),
  title text not null,
  slug text not null,
  sort_order int not null default 0,
  content jsonb not null,
  draft_revision int not null,
  note text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (document_id, version_no)
);
create index if not exists idx_cms_versions_document on public.cms_versions(document_id, version_no desc);

alter table public.cms_documents
  drop constraint if exists cms_documents_published_version_fk;
alter table public.cms_documents
  add constraint cms_documents_published_version_fk
  foreign key (published_version_id) references public.cms_versions(id) on delete set null;

create table if not exists public.cms_published (
  document_id uuid primary key references public.cms_documents(id) on delete cascade,
  kind text not null,
  slug text not null,
  title text not null,
  sort_order int not null default 0,
  content jsonb not null,
  version_id uuid not null references public.cms_versions(id),
  published_at timestamptz not null default now(),
  unique (kind, slug)
);
create index if not exists idx_cms_published_kind on public.cms_published(kind, sort_order);

-- Dashboard list view with a computed status; security_invoker keeps RLS in force
create or replace view public.cms_document_status
with (security_invoker = true) as
select
  d.id, d.kind, d.slug, d.title, d.sort_order, d.is_archived,
  d.draft_revision, d.published_revision, d.published_at, d.updated_at, d.updated_by,
  d.form_document_id, d.service_id,
  case
    when d.is_archived then 'archived'
    when d.published_version_id is null then 'draft'
    when d.draft_revision > coalesce(d.published_revision, 0) then 'changed'
    else 'published'
  end as status
from public.cms_documents d;

-- ============================================================================
-- 2. Triggers: guard publish columns, bump revision, snapshot every save
-- ============================================================================

-- True for the service-role key, or for a direct database connection
-- (SQL Editor, `supabase db push`, which logs in via a temporary cli_login_*
-- role, psql). Website/dashboard traffic always arrives through PostgREST,
-- whose session user is `authenticator` with an anon/authenticated JWT role.
-- Deliberately NOT based on current_user: inside SECURITY DEFINER functions
-- current_user is the function owner (postgres) for every caller.
create or replace function public.cms_is_service_caller()
returns boolean language sql stable
as $$
  select coalesce(auth.role(), '') = 'service_role'
      or (session_user <> 'authenticator'
          and auth.uid() is null
          and coalesce(auth.role(), '') not in ('anon', 'authenticated'));
$$;

create or replace function public.cms_next_version_no(p_document_id uuid)
returns int language sql
as $$ select coalesce(max(version_no), 0) + 1 from public.cms_versions where document_id = p_document_id; $$;

create or replace function public.cms_documents_before_write()
returns trigger
language plpgsql
as $$
declare
  publishing boolean := coalesce(current_setting('cms.publishing', true), '') = 'on';
begin
  if tg_op = 'INSERT' then
    if not publishing then
      new.published_revision := null;
      new.published_version_id := null;
      new.published_at := null;
      new.published_by := null;
    end if;
    new.draft_revision := 1;
    new.created_by := coalesce(new.created_by, auth.uid());
    new.updated_by := auth.uid();
    return new;
  end if;

  if not publishing then
    new.published_revision := old.published_revision;
    new.published_version_id := old.published_version_id;
    new.published_at := old.published_at;
    new.published_by := old.published_by;
    if not (public.is_admin() or public.cms_is_service_caller()) then
      new.is_archived := old.is_archived;   -- archive = soft delete = admin only
      if old.published_version_id is not null and new.slug is distinct from old.slug then
        raise exception 'Only admins can change the URL slug of a published item'
          using errcode = '42501';
      end if;
    end if;
  end if;

  if new.draft is distinct from old.draft
     or new.title is distinct from old.title
     or new.slug is distinct from old.slug
     or new.sort_order is distinct from old.sort_order then
    new.draft_revision := old.draft_revision + 1;
  else
    new.draft_revision := old.draft_revision;
  end if;

  new.created_at := old.created_at;
  new.created_by := old.created_by;
  new.updated_at := now();
  new.updated_by := coalesce(auth.uid(), old.updated_by);
  return new;
end;
$$;

drop trigger if exists trg_cms_documents_before_write on public.cms_documents;
create trigger trg_cms_documents_before_write
  before insert or update on public.cms_documents
  for each row execute function public.cms_documents_before_write();

create or replace function public.cms_documents_after_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(current_setting('cms.skip_version', true), '') = 'on' then
    return new;
  end if;
  if tg_op = 'INSERT' or new.draft_revision <> old.draft_revision then
    insert into public.cms_versions
      (document_id, version_no, action, title, slug, sort_order, content, draft_revision, created_by)
    values
      (new.id, public.cms_next_version_no(new.id), 'save', new.title, new.slug, new.sort_order,
       new.draft, new.draft_revision, auth.uid());
  end if;
  return new;
end;
$$;

drop trigger if exists trg_cms_documents_after_write on public.cms_documents;
create trigger trg_cms_documents_after_write
  after insert or update on public.cms_documents
  for each row execute function public.cms_documents_after_write();

-- ============================================================================
-- 3. Workflow functions
-- ============================================================================

-- Publish one or more documents (e.g. a service and its form together). Admin only.
create or replace function public.cms_publish(p_document_ids uuid[], p_note text default null)
returns setof public.cms_published
language plpgsql
security definer
set search_path = public
as $$
declare
  d public.cms_documents;
  v_id uuid;
begin
  if not (public.is_admin() or public.cms_is_service_caller()) then
    raise exception 'Only admins can publish' using errcode = '42501';
  end if;

  perform set_config('cms.publishing', 'on', true);

  for d in
    select * from public.cms_documents
    where id = any(p_document_ids) and not is_archived
    order by id
    for update
  loop
    insert into public.cms_versions
      (document_id, version_no, action, title, slug, sort_order, content, draft_revision, note, created_by)
    values
      (d.id, public.cms_next_version_no(d.id), 'publish', d.title, d.slug, d.sort_order,
       d.draft, d.draft_revision, p_note, auth.uid())
    returning id into v_id;

    insert into public.cms_published (document_id, kind, slug, title, sort_order, content, version_id, published_at)
    values (d.id, d.kind, d.slug, d.title, d.sort_order, d.draft, v_id, now())
    on conflict (document_id) do update set
      kind = excluded.kind, slug = excluded.slug, title = excluded.title,
      sort_order = excluded.sort_order, content = excluded.content,
      version_id = excluded.version_id, published_at = excluded.published_at;

    update public.cms_documents set
      published_revision = d.draft_revision,
      published_version_id = v_id,
      published_at = now(),
      published_by = auth.uid()
    where id = d.id;
  end loop;

  perform set_config('cms.publishing', 'off', true);

  return query select * from public.cms_published where document_id = any(p_document_ids);
end;
$$;

-- Take a document off the live site (draft is kept). Admin only.
create or replace function public.cms_unpublish(p_document_id uuid, p_note text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare d public.cms_documents;
begin
  if not (public.is_admin() or public.cms_is_service_caller()) then
    raise exception 'Only admins can unpublish' using errcode = '42501';
  end if;

  select * into d from public.cms_documents where id = p_document_id for update;
  if not found then raise exception 'Document not found'; end if;

  delete from public.cms_published where document_id = p_document_id;

  perform set_config('cms.publishing', 'on', true);
  update public.cms_documents set
    published_revision = null, published_version_id = null, published_at = null, published_by = null
  where id = p_document_id;
  perform set_config('cms.publishing', 'off', true);

  insert into public.cms_versions
    (document_id, version_no, action, title, slug, sort_order, content, draft_revision, note, created_by)
  values
    (d.id, public.cms_next_version_no(d.id), 'unpublish', d.title, d.slug, d.sort_order,
     d.draft, d.draft_revision, p_note, auth.uid());
end;
$$;

-- Copy an old version back into the DRAFT (never straight to live). Editors allowed.
create or replace function public.cms_restore_version(p_version_id uuid)
returns public.cms_documents
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.cms_versions;
  d public.cms_documents;
begin
  if not (public.is_editor() or public.cms_is_service_caller()) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  select * into v from public.cms_versions where id = p_version_id;
  if not found then raise exception 'Version not found'; end if;

  perform set_config('cms.skip_version', 'on', true);
  update public.cms_documents
     set draft = v.content, title = v.title, sort_order = v.sort_order
   where id = v.document_id
  returning * into d;
  perform set_config('cms.skip_version', 'off', true);

  insert into public.cms_versions
    (document_id, version_no, action, title, slug, sort_order, content, draft_revision, note, created_by)
  values
    (d.id, public.cms_next_version_no(d.id), 'restore', d.title, d.slug, d.sort_order,
     d.draft, d.draft_revision, 'Restored from version ' || v.version_no, auth.uid());

  return d;
end;
$$;

revoke execute on function public.cms_publish(uuid[], text) from public, anon;
revoke execute on function public.cms_unpublish(uuid, text) from public, anon;
revoke execute on function public.cms_restore_version(uuid) from public, anon;
grant execute on function public.cms_publish(uuid[], text) to authenticated;
grant execute on function public.cms_unpublish(uuid, text) to authenticated;
grant execute on function public.cms_restore_version(uuid) to authenticated;

-- ============================================================================
-- 4. RLS
-- ============================================================================

alter table public.cms_documents enable row level security;
alter table public.cms_versions enable row level security;
alter table public.cms_published enable row level security;

drop policy if exists "cms_documents_editor_read" on public.cms_documents;
create policy "cms_documents_editor_read" on public.cms_documents
  for select to authenticated using (public.is_editor());
drop policy if exists "cms_documents_editor_insert" on public.cms_documents;
create policy "cms_documents_editor_insert" on public.cms_documents
  for insert to authenticated with check (public.is_editor());
drop policy if exists "cms_documents_editor_update" on public.cms_documents;
create policy "cms_documents_editor_update" on public.cms_documents
  for update to authenticated using (public.is_editor()) with check (public.is_editor());
drop policy if exists "cms_documents_admin_delete" on public.cms_documents;
create policy "cms_documents_admin_delete" on public.cms_documents
  for delete to authenticated using (public.is_admin());

-- Versions are immutable: readable by editors, written only by triggers/functions
drop policy if exists "cms_versions_editor_read" on public.cms_versions;
create policy "cms_versions_editor_read" on public.cms_versions
  for select to authenticated using (public.is_editor());

-- The live copy: public read, written only by cms_publish/cms_unpublish
drop policy if exists "cms_published_public_read" on public.cms_published;
create policy "cms_published_public_read" on public.cms_published
  for select to anon, authenticated using (true);
