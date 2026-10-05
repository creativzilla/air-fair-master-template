-- Save stage configuration atomically, preserving leads and task templates.
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
  if not public.is_admin() then
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

revoke all on function public.configure_pipeline_stages(jsonb, jsonb) from public, anon;
grant execute on function public.configure_pipeline_stages(jsonb, jsonb) to authenticated;

create or replace function public.fn_auto_assign_stage_tasks()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_setting('app.renaming_pipeline_stages', true) = 'true' and public.is_admin() then
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
