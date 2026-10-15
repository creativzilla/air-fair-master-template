-- Read trusted Auth state, never user-editable profile/email metadata.
create or replace function public.team_account_verified(p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from auth.users u where u.id = p_user
    and u.email_confirmed_at is not null
    and (u.banned_until is null or u.banned_until <= now()));
$$;
revoke all on function public.team_account_verified(uuid) from public, anon, authenticated;
grant execute on function public.team_account_verified(uuid) to service_role;

-- Fail deployment rather than silently locking out every existing administrator.
do $$ begin
  if not exists (select 1 from public.profiles p where p.role = 'admin' and p.is_active
    and public.team_account_verified(p.id) and public.section_allowed(p.id, 'team')) then
    raise exception 'Confirm an active administrator email with Team access before applying this migration';
  end if;
end $$;

create or replace function public.auth_role()
returns text language sql stable security definer set search_path = public as $$
  select coalesce((select p.role from public.profiles p
    where p.id = auth.uid() and p.is_active and public.team_account_verified(p.id)), 'none');
$$;

create or replace function public.section_allowed(p_user uuid, p_key text)
returns boolean language sql stable security definer set search_path = public as $$
  with chosen as (
    select p.role, case when coalesce(e.custom_access, false)
        then array(select k from unnest(public.role_sections(p.role)) k where (e.allowed_modules->>k)::boolean is true)
        else public.role_default_sections(p.role) end as keys
    from public.profiles p left join public.employees e on e.user_id = p.id
    where p.id = p_user and p.is_active and public.team_account_verified(p.id)
  )
  select coalesce((select p_key = any(public.role_sections(role)) and p_key = any(keys)
    and (p_key <> 'email-inbox' or 'clients' = any(keys)) from chosen), false);
$$;
