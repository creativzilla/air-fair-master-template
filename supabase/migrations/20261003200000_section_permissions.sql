-- Any section can be granted to any role, and granting it gives the server
-- permissions that section needs (Team page / role defaults decide).
--
-- What stays role-based on purpose:
--   * publishing, unpublishing, archiving and deleting website content: admin
--   * making someone an admin, changing an admin's role, access or status,
--     and the admin role defaults: admin only (prevents self-promotion)
-- Section → server permission:
--   edit-website / cms-services / news / testimonials → edit drafts of that content type
--   media (or any website section)                    → upload and edit media
--   form-emails                                        → email templates and Form Emails settings
--   settings (or form-emails)                          → site settings; settings → pipeline stages
--   team                                               → accounts, access, role defaults, task templates

-- 1. Every section is grantable to admin, editor and staff ('none' sees nothing).
create or replace function public.role_sections(p_role text) returns text[] language sql immutable as $$
  select case when p_role in ('admin', 'editor', 'staff')
    then array['clients','email-inbox','pipeline','forms','documents','bookings','edit-website','cms-services','news','testimonials','media','form-emails','team','settings']
    else '{}'::text[] end;
$$;

create or replace function public.cms_kind_section(p_kind text) returns text language sql immutable as $$
  select case
    when p_kind in ('page', 'global') then 'edit-website'
    when p_kind in ('immigration_service', 'visa_destination', 'travel_package', 'travel_destination') then 'cms-services'
    when p_kind = 'news_article' then 'news'
    when p_kind = 'testimonial' then 'testimonials'
    else null end;
$$;
create or replace function public.has_website_section() returns boolean
language sql stable security definer set search_path = public as $$
  select public.has_section('edit-website') or public.has_section('cms-services') or public.has_section('news')
    or public.has_section('testimonials') or public.has_section('media');
$$;
grant execute on function public.has_website_section() to authenticated;

-- 2. Website content. Reads: editors as before, or anyone with that section.
--    Edits: the section for that content type. Forms keep their rule (admin edits).
drop policy if exists "cms_documents_editor_read" on public.cms_documents;
create policy "cms_documents_editor_read" on public.cms_documents for select to authenticated
  using (public.is_editor() or public.has_section(public.cms_kind_section(kind)) or (kind = 'form' and public.has_section('cms-services')));
drop policy if exists "cms_documents_editor_insert" on public.cms_documents;
create policy "cms_documents_editor_insert" on public.cms_documents for insert to authenticated
  with check (case when kind = 'form' then public.is_editor() else public.has_section(public.cms_kind_section(kind)) end);
drop policy if exists "cms_documents_editor_update" on public.cms_documents;
create policy "cms_documents_editor_update" on public.cms_documents for update to authenticated
  using (case when kind = 'form' then public.is_admin() else public.has_section(public.cms_kind_section(kind)) end)
  with check (case when kind = 'form' then public.is_admin() else public.has_section(public.cms_kind_section(kind)) end);
drop policy if exists "cms_versions_editor_read" on public.cms_versions;
create policy "cms_versions_editor_read" on public.cms_versions for select to authenticated
  using (public.is_editor() or public.has_website_section());

create or replace function public.cms_restore_version(p_version_id uuid)
returns public.cms_documents language plpgsql security definer set search_path = public as $$
declare v public.cms_versions; d public.cms_documents;
begin
  select * into v from public.cms_versions where id = p_version_id;
  if not found then raise exception 'Version not found'; end if;
  select * into d from public.cms_documents where id = v.document_id;
  if not (public.cms_is_service_caller()
    or (d.kind = 'form' and public.is_admin())
    or (d.kind <> 'form' and public.has_section(public.cms_kind_section(d.kind)))) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  perform set_config('cms.skip_version', 'on', true);
  update public.cms_documents set draft = v.content, title = v.title, sort_order = v.sort_order
   where id = v.document_id returning * into d;
  perform set_config('cms.skip_version', 'off', true);
  insert into public.cms_versions (document_id, version_no, action, title, slug, sort_order, content, draft_revision, note, created_by)
  values (d.id, public.cms_next_version_no(d.id), 'restore', d.title, d.slug, d.sort_order, d.draft, d.draft_revision,
    'Restored from version ' || v.version_no, auth.uid());
  return d;
end $$;

-- 3. Media (image pickers live in every website editor).
drop policy if exists "media_editor_insert" on public.media;
create policy "media_editor_insert" on public.media for insert to authenticated with check (public.is_editor() or public.has_website_section());
drop policy if exists "media_editor_update" on public.media;
create policy "media_editor_update" on public.media for update to authenticated
  using (public.is_editor() or public.has_website_section()) with check (public.is_editor() or public.has_website_section());
drop policy if exists "catalog_images_editor_insert" on storage.objects;
create policy "catalog_images_editor_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'catalog-images' and (public.is_editor() or public.has_website_section()));
drop policy if exists "catalog_images_editor_update" on storage.objects;
create policy "catalog_images_editor_update" on storage.objects for update to authenticated
  using (bucket_id = 'catalog-images' and (public.is_editor() or public.has_website_section()))
  with check (bucket_id = 'catalog-images' and (public.is_editor() or public.has_website_section()));

-- 4. Form Emails.
drop policy if exists "email_settings_admin_read" on public.email_settings;
create policy "email_settings_admin_read" on public.email_settings for select to authenticated using (public.has_section('form-emails'));
drop policy if exists "email_settings_admin_update" on public.email_settings;
create policy "email_settings_admin_update" on public.email_settings for update to authenticated
  using (public.has_section('form-emails')) with check (public.has_section('form-emails'));
drop policy if exists "email_templates_admin_read" on public.email_templates;
create policy "email_templates_admin_read" on public.email_templates for select to authenticated using (public.has_section('form-emails'));
drop policy if exists "email_templates_admin_insert" on public.email_templates;
create policy "email_templates_admin_insert" on public.email_templates for insert to authenticated with check (public.has_section('form-emails'));
drop policy if exists "email_templates_admin_update" on public.email_templates;
create policy "email_templates_admin_update" on public.email_templates for update to authenticated
  using (public.has_section('form-emails')) with check (public.has_section('form-emails'));
drop policy if exists "email_templates_admin_delete" on public.email_templates;
create policy "email_templates_admin_delete" on public.email_templates for delete to authenticated
  using (public.has_section('form-emails') and form_id is not null);

-- 5. Settings (Form Emails also stores its business details here).
drop policy if exists "site_settings_admin_write" on public.site_settings;
create policy "site_settings_admin_write" on public.site_settings for all to authenticated
  using (public.has_section('settings') or public.has_section('form-emails'))
  with check (public.has_section('settings') or public.has_section('form-emails'));

-- Settings → Pipeline tab edits the pipeline stages.
drop policy if exists "pipeline_stages_admin_write" on public.pipeline_stages;
create policy "pipeline_stages_admin_write" on public.pipeline_stages for all to authenticated
  using (public.is_admin() or public.has_section('settings')) with check (public.is_admin() or public.has_section('settings'));

-- Same rule for the stage editor function and its rename handling.
create or replace function public.configure_pipeline_stages(expected_stages jsonb, next_stages jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  current_stages jsonb;
  stage_map jsonb;
  result jsonb;
  item record;
begin
  if not (public.is_admin() or public.has_section('settings')) then
    raise exception 'Only admins can customize pipeline stages.';
  end if;
  if jsonb_typeof(next_stages) is distinct from 'array' then
    raise exception 'Provide a list of stages.';
  end if;
  if jsonb_array_length(next_stages) < 2 then
    raise exception 'Keep at least two stages.';
  end if;
  if exists (
    select 1 from jsonb_array_elements(next_stages) value
    where jsonb_typeof(value->'name') is distinct from 'string'
      or length(btrim(value->>'name')) not between 1 and 80
  ) then
    raise exception 'Each stage needs a name of 1–80 characters.';
  end if;
  if (select count(distinct lower(btrim(value->>'name'))) from jsonb_array_elements(next_stages) value)
      <> jsonb_array_length(next_stages) then
    raise exception 'Stage names must be unique.';
  end if;
  if (select count(value->>'id') from jsonb_array_elements(next_stages) value)
      <> (select count(distinct value->>'id') from jsonb_array_elements(next_stages) value) then
    raise exception 'A stage cannot appear twice.';
  end if;

  -- Prevent concurrent board moves or configuration edits during the save.
  lock table public.pipeline_stages, public.contacts, public.stage_task_templates in share row exclusive mode;
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'name', name, 'sort_order', sort_order) order by sort_order, id), '[]'::jsonb)
    into current_stages from public.pipeline_stages;
  if expected_stages is null
      or not (current_stages @> expected_stages and expected_stages @> current_stages) then
    raise exception 'Pipeline stages changed since you opened this editor. Reload the page before saving.';
  end if;
  if exists (
    select 1 from jsonb_array_elements(next_stages) value
    where value->>'id' is not null
      and not exists (select 1 from public.pipeline_stages where id = (value->>'id')::uuid)
  ) then
    raise exception 'One of these stages no longer exists. Reload the page.';
  end if;
  if exists (
    select 1 from public.pipeline_stages s
    where not exists (select 1 from jsonb_array_elements(next_stages) value where value->>'id' = s.id::text)
      and (exists (select 1 from public.contacts c where c.status = s.name)
        or exists (select 1 from public.stage_task_templates t where t.stage = s.name))
  ) then
    raise exception 'Move leads and task templates out of a stage before removing it.';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('old_name', s.name, 'new_name', btrim(value->>'name'))), '[]'::jsonb)
    into stage_map from public.pipeline_stages s
    join jsonb_array_elements(next_stages) value on value->>'id' = s.id::text;

  delete from public.pipeline_stages s
    where not exists (select 1 from jsonb_array_elements(next_stages) value where value->>'id' = s.id::text);
  -- Temporary names permit swaps without violating the unique-name constraint.
  update public.pipeline_stages set name = '__stage_edit_' || gen_random_uuid()::text;
  for item in select value, ordinality from jsonb_array_elements(next_stages) with ordinality loop
    if item.value->>'id' is null then
      insert into public.pipeline_stages(name, sort_order)
        values (btrim(item.value->>'name'), item.ordinality - 1);
    else
      update public.pipeline_stages set name = btrim(item.value->>'name'), sort_order = item.ordinality - 1
        where id = (item.value->>'id')::uuid;
    end if;
  end loop;

  -- Renaming a column is not a lead transition: don't create duplicate tasks.
  perform set_config('app.renaming_pipeline_stages', 'true', true);
  update public.contacts c set status = m.new_name
    from jsonb_to_recordset(stage_map) as m(old_name text, new_name text)
    where c.status = m.old_name and m.old_name <> m.new_name;
  perform set_config('app.renaming_pipeline_stages', 'false', true);
  update public.stage_task_templates t set stage = m.new_name
    from jsonb_to_recordset(stage_map) as m(old_name text, new_name text)
    where t.stage = m.old_name and m.old_name <> m.new_name;
  select jsonb_agg(to_jsonb(s) order by sort_order, id) into result from public.pipeline_stages s;
  return result;
end;
$$;

create or replace function public.fn_auto_assign_stage_tasks()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_setting('app.renaming_pipeline_stages', true) = 'true' and (public.is_admin() or public.has_section('settings')) then
    return new;
  end if;
  if new.status is distinct from old.status and new.assigned_employee_id is not null then
    insert into public.employee_tasks (employee_id, contact_id, title, due_date, is_done)
    select new.assigned_employee_id, new.id, tmpl.title || ' — ' || new.name, null, false
    from public.stage_task_templates tmpl where tmpl.stage = new.status;
  end if;
  return new;
end;
$$;

-- 6. Team.
drop policy if exists "profiles_select_own_or_admin" on public.profiles;
create policy "profiles_select_own_or_admin" on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin() or public.has_section('team'));
drop policy if exists "profiles_admin_update" on public.profiles;
create policy "profiles_admin_update" on public.profiles for update to authenticated
  using (public.has_section('team')) with check (public.has_section('team'));
drop policy if exists "employees_admin_write" on public.employees;
create policy "employees_admin_write" on public.employees for all to authenticated
  using (public.has_section('team')) with check (public.has_section('team'));
drop policy if exists "role_access_defaults_write" on public.role_access_defaults;
create policy role_access_defaults_write on public.role_access_defaults for update to authenticated
  using (public.has_section('team')) with check (public.has_section('team'));
drop policy if exists "stage_task_templates_admin_write" on public.stage_task_templates;
create policy "stage_task_templates_admin_write" on public.stage_task_templates for all to authenticated
  using (public.is_admin() or public.has_section('team')) with check (public.is_admin() or public.has_section('team'));

-- 7. No self-promotion: admin-level changes need an admin. Server-side calls
--    (invites, deactivation through admin-users, migrations) have no auth user.
create or replace function public.team_change_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return new; end if;
  if tg_table_name = 'profiles' then
    if new.role is distinct from old.role then
      if new.id = auth.uid() then raise exception 'You cannot change your own role' using errcode = '42501'; end if;
      if not public.is_admin() and (new.role = 'admin' or old.role = 'admin') then
        raise exception 'Only an admin can make someone an admin or change an admin''s role' using errcode = '42501'; end if;
    end if;
    if new.is_active is distinct from old.is_active and old.role = 'admin' and not public.is_admin() then
      raise exception 'Only an admin can deactivate or reactivate an admin' using errcode = '42501'; end if;
  elsif tg_table_name = 'employees' then
    if (new.custom_access is distinct from old.custom_access or new.allowed_modules is distinct from old.allowed_modules)
       and not public.is_admin() and exists (select 1 from public.profiles p where p.id = new.user_id and p.role = 'admin') then
      raise exception 'Only an admin can change an admin''s access' using errcode = '42501'; end if;
  elsif tg_table_name = 'role_access_defaults' then
    if new.role = 'admin' and not public.is_admin() then
      raise exception 'Only an admin can change the admin defaults' using errcode = '42501'; end if;
  end if;
  return new;
end $$;
drop trigger if exists profiles_team_change_guard on public.profiles;
create trigger profiles_team_change_guard before update on public.profiles for each row execute function public.team_change_guard();
drop trigger if exists employees_team_change_guard on public.employees;
create trigger employees_team_change_guard before update on public.employees for each row execute function public.team_change_guard();
drop trigger if exists role_access_defaults_team_change_guard on public.role_access_defaults;
create trigger role_access_defaults_team_change_guard before update on public.role_access_defaults for each row execute function public.team_change_guard();
