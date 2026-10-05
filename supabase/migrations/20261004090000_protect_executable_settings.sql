-- Section access permits business settings edits, not executable website code.
-- A trigger covers direct REST writes, upserts, and removal of a configured row.
create or replace function public.guard_site_settings_script()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.is_admin() or public.cms_is_service_caller() then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  if tg_op = 'INSERT' then
    if coalesce(new.chat_widget_code, '') <> '' then
      raise exception 'Only administrators can change website scripts' using errcode = '42501';
    end if;
  elsif tg_op = 'UPDATE' then
    if coalesce(new.chat_widget_code, '') is distinct from coalesce(old.chat_widget_code, '') then
      raise exception 'Only administrators can change website scripts' using errcode = '42501';
    end if;
  elsif coalesce(old.chat_widget_code, '') <> '' then
    raise exception 'Only administrators can remove settings containing website scripts' using errcode = '42501';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;

revoke all on function public.guard_site_settings_script() from public, anon, authenticated;
create trigger site_settings_script_guard
  before insert or update or delete on public.site_settings
  for each row execute function public.guard_site_settings_script();
