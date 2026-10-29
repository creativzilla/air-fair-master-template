-- Editable role defaults: admins choose which sections each role gets by
-- default (Team → Role defaults). People with custom access are unaffected.
-- Defaults stay within what the role permits (role_sections).

create table public.role_access_defaults (
  role text primary key check (role in ('admin', 'editor', 'staff')),
  sections text[] not null default '{}',
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null default auth.uid()
);
insert into public.role_access_defaults(role, sections, updated_by) values
  ('admin', public.role_sections('admin'), null),
  ('editor', public.role_sections('editor'), null),
  ('staff', array['clients','pipeline','forms','documents','bookings'], null);

-- Everyone signed in reads them (the dashboard builds each menu from them);
-- only admins with Team access change them.
alter table public.role_access_defaults enable row level security;
create policy role_access_defaults_read on public.role_access_defaults for select to authenticated using (true);
create policy role_access_defaults_write on public.role_access_defaults for update to authenticated
  using (public.is_admin() and public.has_section('team')) with check (public.is_admin() and public.has_section('team'));
revoke all on public.role_access_defaults from anon, authenticated;
grant select, update (sections) on public.role_access_defaults to authenticated;
grant all on public.role_access_defaults to service_role;

create or replace function public.role_access_defaults_clean() returns trigger
language plpgsql as $$
begin
  -- Keep only sections the role permits, in the standard order.
  new.sections := array(select k from unnest(public.role_sections(new.role)) k where k = any(new.sections));
  new.updated_at := now(); new.updated_by := auth.uid();
  return new;
end $$;
create trigger role_access_defaults_clean before insert or update on public.role_access_defaults
  for each row execute function public.role_access_defaults_clean();
create trigger role_access_defaults_team_admin after update on public.role_access_defaults
  for each statement execute function public.ensure_team_admin();

-- Defaults now come from the table (built-in values if a row is missing).
create or replace function public.role_default_sections(p_role text) returns text[]
language sql stable security definer set search_path = public as $$
  select coalesce((select d.sections from public.role_access_defaults d where d.role = p_role),
    case p_role when 'staff' then array['clients','pipeline','forms','documents','bookings'] else public.role_sections(p_role) end);
$$;
