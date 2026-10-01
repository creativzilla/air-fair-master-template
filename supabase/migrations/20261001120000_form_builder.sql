/*
# Form Studio: field registry, answers by field id, admin-only form editing

Forms stay CMS documents (kind 'form'): the draft is the form's schema, every
publish snapshots it in cms_versions, and cms_published is what the website
renders. This migration adds what the Form Studio needs around that:

1. form_submissions.answers: answers keyed by the field's stable id (the Edge
   Function validates them against the published schema). raw_data (keyed by
   field key) stays for compatibility; form_version_id is set by the server to
   the version that was live, so old submissions show their original labels.
2. public.form_fields: a registry of every field and design element of every
   form, kept in sync from the draft by a trigger. Fields removed from the
   form are marked archived (never deleted), so historical answers can always
   be labelled. Read-only for the team; written only by the trigger.
3. Only admins can change a form's draft (publishing was already admin-only).
   Editors can still create a service, which copies a starter form.
4. Website uploads may only go under submissions/ in the private
   form-attachments bucket.
5. The CRM lead gets the inquiry message / requested service when the form
   maps a field to them (Form Studio > field > "Save to contact").
*/

-- ---------------------------------------------------------------- 1. answers
alter table public.form_submissions
  add column if not exists answers jsonb not null default '{}'::jsonb;
alter table public.form_submissions drop constraint if exists form_submissions_answers_object;
alter table public.form_submissions add constraint form_submissions_answers_object
  check (jsonb_typeof(answers) = 'object' and octet_length(answers::text) <= 200000);
create index if not exists idx_form_submissions_form_key_created on public.form_submissions (form_key, created_at desc);
create index if not exists idx_form_submissions_version on public.form_submissions (form_version_id);

-- The direct-save fallback (until the lockdown) can't fake validated answers.
drop policy if exists "form_submissions_public_insert" on public.form_submissions;
create policy "form_submissions_public_insert" on public.form_submissions
  for insert to anon, authenticated
  with check (
    status = 'New' and notes is null and handled_by is null
    and octet_length(raw_data::text) <= 200000 and jsonb_typeof(attachments) = 'array'
    and answers = '{}'::jsonb
  );

-- ---------------------------------------------------------------- 2. field registry
create table if not exists public.form_fields (
  id uuid primary key default gen_random_uuid(),
  form_document_id uuid not null references public.cms_documents(id) on delete cascade,
  element_id text not null,
  kind text not null check (kind in ('input', 'design', 'layout')),
  type text not null,
  field_key text,
  label text,
  settings jsonb not null default '{}'::jsonb,
  section_id text,
  parent_id text,
  position integer not null default 0,
  is_archived boolean not null default false,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (form_document_id, element_id)
);
create index if not exists idx_form_fields_form on public.form_fields (form_document_id, is_archived, position);
create index if not exists idx_form_fields_key on public.form_fields (form_document_id, field_key);

alter table public.form_fields enable row level security;
drop policy if exists "form_fields_team_read" on public.form_fields;
create policy "form_fields_team_read" on public.form_fields for select to authenticated using (public.is_team());
revoke insert, update, delete on public.form_fields from anon, authenticated;

-- Rebuild one form's registry from its draft (sections -> elements -> row columns).
create or replace function public.form_fields_sync_doc(p_doc uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  d public.cms_documents;
  v_rows jsonb;
begin
  select * into d from public.cms_documents where id = p_doc;
  if not found or d.kind <> 'form' then return; end if;

  with sections as (
    select s.value as sec, s.ordinality as spos
    from jsonb_array_elements(case when jsonb_typeof(d.draft -> 'sections') = 'array' then d.draft -> 'sections' else '[]'::jsonb end) with ordinality s
  ),
  top as (
    select e.value as el, coalesce(sec ->> 'id', 'section' || spos) as section_id, null::text as parent_id,
           (spos * 100000 + e.ordinality * 100)::int as pos
    from sections
    cross join lateral jsonb_array_elements(case when jsonb_typeof(sec -> 'fields') = 'array' then sec -> 'fields' else '[]'::jsonb end) with ordinality e
  ),
  nested as (
    select c.value as el, t.section_id, coalesce(t.el ->> 'id', 'k_' || (t.el ->> 'name')) as parent_id,
           (t.pos + col.ordinality * 10 + c.ordinality)::int as pos
    from top t
    cross join lateral jsonb_array_elements(case when t.el ->> 'type' = 'row' and jsonb_typeof(t.el -> 'children') = 'array' then t.el -> 'children' else '[]'::jsonb end) with ordinality col(cv, ordinality)
    cross join lateral jsonb_array_elements(case when jsonb_typeof(col.cv) = 'array' then col.cv else '[]'::jsonb end) with ordinality c
  ),
  els as (
    select jsonb_build_object('id', coalesce(sec ->> 'id', 'section' || spos), 'type', 'section', 'label', sec ->> 'title') as el,
           coalesce(sec ->> 'id', 'section' || spos) as section_id, null::text as parent_id, (spos * 100000)::int as pos
    from sections
    union all select el, section_id, parent_id, pos from top
    union all select el, section_id, parent_id, pos from nested
  ),
  shaped as (
    select distinct on (element_id) * from (
      select coalesce(el ->> 'id', case when el ->> 'name' is not null then 'k_' || (el ->> 'name') end) as element_id,
             coalesce(el ->> 'type', 'text') as type,
             el ->> 'name' as field_key,
             left(coalesce(el ->> 'label', el ->> 'text'), 500) as label,
             (el - 'id' - 'type' - 'name' - 'label' - 'children') as settings,
             section_id, parent_id, pos
      from els
    ) x
    where element_id is not null
    order by element_id, pos
  )
  select coalesce(jsonb_agg(to_jsonb(shaped)), '[]'::jsonb) into v_rows from shaped;

  insert into public.form_fields as f (form_document_id, element_id, kind, type, field_key, label, settings, section_id, parent_id, position, is_archived, archived_at, updated_at)
  select p_doc, r.element_id,
         case when r.type in ('heading', 'paragraph', 'divider', 'spacer', 'image', 'submit') then 'design'
              when r.type in ('row', 'section') then 'layout' else 'input' end,
         r.type, r.field_key, r.label, coalesce(r.settings, '{}'::jsonb), r.section_id, r.parent_id, r.pos, false, null, now()
  from jsonb_to_recordset(v_rows) as r(element_id text, type text, field_key text, label text, settings jsonb, section_id text, parent_id text, pos int)
  on conflict (form_document_id, element_id) do update set
    kind = excluded.kind, type = excluded.type, field_key = excluded.field_key, label = excluded.label,
    settings = excluded.settings, section_id = excluded.section_id, parent_id = excluded.parent_id,
    position = excluded.position, is_archived = false, archived_at = null, updated_at = now()
  where (f.type, f.field_key, f.label, f.settings, f.section_id, f.parent_id, f.position, f.is_archived)
        is distinct from (excluded.type, excluded.field_key, excluded.label, excluded.settings, excluded.section_id, excluded.parent_id, excluded.position, false);

  -- Removed from the form: keep the definition, mark it archived.
  update public.form_fields set is_archived = true, archived_at = now(), updated_at = now()
   where form_document_id = p_doc and not is_archived
     and element_id not in (select r.element_id from jsonb_to_recordset(v_rows) as r(element_id text));
end;
$$;
revoke all on function public.form_fields_sync_doc(uuid) from public, anon, authenticated;

create or replace function public.form_fields_after_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.kind = 'form' and (tg_op = 'INSERT' or new.draft is distinct from old.draft) then
    perform public.form_fields_sync_doc(new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_form_fields_sync on public.cms_documents;
create trigger trg_form_fields_sync after insert or update of draft on public.cms_documents
  for each row execute function public.form_fields_after_write();

-- Backfill every existing form.
do $$
declare r record;
begin
  for r in select id from public.cms_documents where kind = 'form' loop
    perform public.form_fields_sync_doc(r.id);
  end loop;
end $$;

-- ---------------------------------------------------------------- 3. only admins edit forms
drop policy if exists "cms_documents_editor_update" on public.cms_documents;
create policy "cms_documents_editor_update" on public.cms_documents
  for update to authenticated
  using (public.is_editor() and (kind <> 'form' or public.is_admin()))
  with check (public.is_editor() and (kind <> 'form' or public.is_admin()));

-- ---------------------------------------------------------------- 4. uploads only under submissions/
drop policy if exists "form_attachments_public_insert" on storage.objects;
create policy "form_attachments_public_insert" on storage.objects
  for insert to anon, authenticated
  with check (bucket_id = 'form-attachments' and (storage.foldername(name))[1] = 'submissions');

-- ---------------------------------------------------------------- 5. lead notes from mapped fields
create or replace function public.fn_auto_create_contact_from_submission()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  mapping public.form_field_mappings%rowtype;
  computed_category text;
  computed_amount numeric;
  first_stage text;
  lead_notes text;
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

  -- Fields mapped in the Form Studio to "Service requested" / "Inquiry message".
  lead_notes := nullif(concat_ws(E'\n\n',
    case when nullif(new.raw_data ->> 'mapped_service', '') is not null then 'Service requested: ' || (new.raw_data ->> 'mapped_service') end,
    nullif(new.raw_data ->> 'mapped_message', '')), '');

  select name into first_stage from public.pipeline_stages order by sort_order limit 1;

  begin
    insert into public.contacts (submission_id, name, email, phone, category, status, amount, notes)
    values (new.id, coalesce(nullif(new.name, ''), '(no name)'), new.email, new.phone,
            computed_category, coalesce(first_stage, 'New Lead'), computed_amount, left(lead_notes, 5000));
  exception when others then
    -- Never lose a submission because lead creation failed
    raise warning 'Auto-create contact failed for submission %: %', new.id, sqlerrm;
  end;

  return new;
end;
$$;
