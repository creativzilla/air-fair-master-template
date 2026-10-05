-- One team: every team member is a dashboard account.
--
-- profiles (sign-in account) stays the source of truth for name, email, role
-- and active status. employees becomes the 1:1 team record for each account:
-- job title (employees.role), staff module access, tasks and lead assignment.
-- It is created automatically for every account and keeps name/email in sync.
-- Team records without an account are no longer possible.

-- 1. Remove the seeded sample employees (@airfair.com, never linked to an
--    account). Only records with no assigned leads are removed; their tasks
--    go with them (on delete cascade).
delete from public.employees e
where e.user_id is null and e.email ilike '%@airfair.com'
  and not exists (select 1 from public.contacts c where c.assigned_employee_id = e.id);

-- 2. Any other unlinked record: link it to the account with the same email.
update public.employees e set user_id = p.id
from public.profiles p
where e.user_id is null and lower(e.email) = lower(p.email)
  and not exists (select 1 from public.employees x where x.user_id = p.id);

do $$ begin
  if exists (select 1 from public.employees where user_id is null) then
    raise exception 'Team records without a sign-in account remain. Link or delete them, then run this migration again.';
  end if;
  if exists (select user_id from public.employees group by user_id having count(*) > 1) then
    raise exception 'Several team records share one account. Merge them, then run this migration again.';
  end if;
end $$;

-- 3. A team record for every existing account (e.g. staff who had none, so
--    their module and Email Inbox access could not be set).
create or replace function public.default_team_access() returns jsonb language sql immutable as $$
  select '{"email-inbox": false, "pipeline": true, "bookings": true, "clients": true, "documents": true, "forms": true,
           "media": false, "edit-website": false, "employees": false, "settings": false}'::jsonb;
$$;
insert into public.employees(user_id, name, email, allowed_modules)
select p.id, coalesce(nullif(btrim(p.full_name), ''), p.email, 'Team member'), p.email, public.default_team_access()
from public.profiles p
where not exists (select 1 from public.employees e where e.user_id = p.id);

-- 4. Enforce one team record per account.
alter table public.employees alter column user_id set not null;
alter table public.employees add constraint employees_user_id_key unique (user_id);
alter table public.employees drop constraint if exists employees_user_id_fkey;
alter table public.employees add constraint employees_user_id_fkey foreign key (user_id) references public.profiles(id) on delete cascade;

-- 5. New accounts (invites) get their team record; name/email follow the account.
create or replace function public.sync_team_member() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into public.employees(user_id, name, email, allowed_modules)
      values (new.id, coalesce(nullif(btrim(new.full_name), ''), new.email, 'Team member'), new.email, public.default_team_access())
      on conflict (user_id) do nothing;
  elsif new.full_name is distinct from old.full_name or new.email is distinct from old.email then
    update public.employees set name = coalesce(nullif(btrim(new.full_name), ''), new.email, name), email = new.email
      where user_id = new.id;
  end if;
  return null;
end $$;
revoke all on function public.sync_team_member() from public, anon, authenticated;
drop trigger if exists profiles_sync_team_member on public.profiles;
create trigger profiles_sync_team_member after insert or update of full_name, email on public.profiles
  for each row execute function public.sync_team_member();

-- 6. A team record's account cannot be swapped to someone else.
create or replace function public.employees_keep_account() returns trigger
language plpgsql as $$
begin
  if new.user_id is distinct from old.user_id then raise exception 'A team member stays linked to their own account'; end if;
  return new;
end $$;
drop trigger if exists employees_keep_account on public.employees;
create trigger employees_keep_account before update of user_id on public.employees
  for each row execute function public.employees_keep_account();
