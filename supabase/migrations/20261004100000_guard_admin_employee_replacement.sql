-- UPDATE already has team_change_guard. Cover the replacement paths too.
create or replace function public.guard_admin_employee_replacement()
returns trigger language plpgsql security definer set search_path = public as $$
declare target_user uuid;
begin
  if tg_op = 'DELETE' then target_user := old.user_id;
  else target_user := new.user_id; end if;

  if not (public.is_admin() or public.cms_is_service_caller())
    and exists (select 1 from public.profiles where id = target_user and role = 'admin') then
    raise exception 'Only an admin can create or remove an admin''s team record' using errcode = '42501';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;
revoke all on function public.guard_admin_employee_replacement() from public, anon, authenticated;
create trigger employees_admin_replacement_guard before insert or delete on public.employees
  for each row execute function public.guard_admin_employee_replacement();

-- Inserting custom access can also remove the last administrator's Team access.
drop trigger employees_ensure_team_admin on public.employees;
create trigger employees_ensure_team_admin after insert or update or delete on public.employees
  for each statement execute function public.ensure_team_admin();
