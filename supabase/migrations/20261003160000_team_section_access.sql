-- Per-person dashboard section access for every role (admins included).
-- Each person follows their role's defaults, or an admin customizes the list.
-- Custom lists never exceed what the role permits. Matches src/dashboard/access.js.
--
-- Enforced here for Email Inbox (can_use_email_inbox) and Team management
-- (profiles/employees writes, admin-users). Other sections are hidden in the
-- dashboard; what a role may change in them is still limited by role policies.

alter table public.employees add column if not exists custom_access boolean not null default false;
-- Staff checkboxes already chose their access: keep it as custom. Admin/editor
-- checkboxes were ignored before, so they start on role defaults.
update public.employees e set custom_access = true from public.profiles p where p.id = e.user_id and p.role = 'staff';

create or replace function public.role_sections(p_role text) returns text[] language sql immutable as $$
  select case p_role
    when 'admin' then array['clients','email-inbox','pipeline','forms','documents','bookings','edit-website','cms-services','news','testimonials','media','form-emails','team','settings']
    when 'editor' then array['clients','email-inbox','pipeline','forms','documents','bookings','edit-website','cms-services','news','testimonials','media']
    when 'staff' then array['clients','email-inbox','pipeline','forms','documents','bookings']
    else '{}'::text[] end;
$$;
create or replace function public.role_default_sections(p_role text) returns text[] language sql immutable as $$
  select case p_role
    when 'staff' then array['clients','pipeline','forms','documents','bookings']
    else public.role_sections(p_role) end;
$$;

-- Whether an active account may open a section.
create or replace function public.section_allowed(p_user uuid, p_key text) returns boolean
language sql stable security definer set search_path = public as $$
  with chosen as (
    select p.role, case when coalesce(e.custom_access, false)
        then array(select k from unnest(public.role_sections(p.role)) k where (e.allowed_modules->>k)::boolean is true)
        else public.role_default_sections(p.role) end as keys
    from public.profiles p left join public.employees e on e.user_id = p.id
    where p.id = p_user and p.is_active
  )
  select coalesce((select p_key = any(public.role_sections(role)) and p_key = any(keys)
    and (p_key <> 'email-inbox' or 'clients' = any(keys)) from chosen), false);
$$;
create or replace function public.has_section(p_key text) returns boolean
language sql stable security definer set search_path = public as $$ select public.section_allowed(auth.uid(), p_key); $$;
revoke all on function public.section_allowed(uuid, text) from public, anon, authenticated;
grant execute on function public.section_allowed(uuid, text) to service_role;
revoke all on function public.has_section(text) from public, anon;
grant execute on function public.has_section(text) to authenticated;

-- Email Inbox: same defaults as before (admins/editors on, staff off unless
-- granted), now following each person's access for every role.
create or replace function public.can_use_email_inbox() returns boolean
language sql stable security definer set search_path = public as $$
  select public.has_section('email-inbox');
$$;

-- Team management needs admin role plus Team access.
drop policy if exists "profiles_admin_update" on public.profiles;
create policy "profiles_admin_update" on public.profiles for update to authenticated
  using (public.is_admin() and public.has_section('team')) with check (public.is_admin() and public.has_section('team'));
drop policy if exists "employees_admin_write" on public.employees;
create policy "employees_admin_write" on public.employees for all to authenticated
  using (public.is_admin() and public.has_section('team')) with check (public.is_admin() and public.has_section('team'));

-- Never lock everyone out: at least one active admin keeps Team access.
create or replace function public.ensure_team_admin() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.profiles p where p.role = 'admin' and p.is_active and public.section_allowed(p.id, 'team')) then
    raise exception 'At least one active admin must keep access to Team';
  end if;
  return null;
end $$;
drop trigger if exists employees_ensure_team_admin on public.employees;
create trigger employees_ensure_team_admin after update or delete on public.employees
  for each statement execute function public.ensure_team_admin();
drop trigger if exists profiles_ensure_team_admin on public.profiles;
create trigger profiles_ensure_team_admin after update or delete on public.profiles
  for each statement execute function public.ensure_team_admin();

-- Mailbox staff picker: show whether each person can open Email Inbox.
create or replace function public.admin_mailbox_staff()
returns table(id uuid, full_name text, email text, role text, inbox_access boolean)
language sql stable security definer set search_path = public as $$
  select p.id, p.full_name, p.email, p.role, public.section_allowed(p.id, 'email-inbox')
  from public.profiles p where public.is_admin() and p.is_active order by coalesce(p.full_name, p.email);
$$;
