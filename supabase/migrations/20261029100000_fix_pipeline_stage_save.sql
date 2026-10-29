-- Saving pipeline stages failed with "UPDATE requires a WHERE clause":
-- Supabase's safeupdate guard rejects the temporary-rename UPDATE, which had
-- no WHERE. Same function, with an explicit WHERE on that statement.
CREATE OR REPLACE FUNCTION public.configure_pipeline_stages(expected_stages jsonb, next_stages jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  -- (WHERE is required: Supabase blocks UPDATE statements without one.)
  update public.pipeline_stages set name = '__stage_edit_' || gen_random_uuid()::text where id is not null;
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
$function$;
