-- Shared by all provider send paths; only trusted server code can reserve.
create table public.email_send_limits (
  id integer primary key check (id=1),
  hourly_recipients integer not null check (hourly_recipients between 1 and 100000),
  daily_recipients integer not null check (daily_recipients between 1 and 1000000)
);
insert into public.email_send_limits values(1,200,1000);
create table public.email_send_reservations (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default clock_timestamp(),
  recipients integer not null check (recipients between 1 and 100)
);
create index email_send_reservations_created on public.email_send_reservations(created_at);
alter table public.email_send_limits enable row level security;
alter table public.email_send_reservations enable row level security;
revoke all on public.email_send_limits,public.email_send_reservations from anon,authenticated;

create function public.reserve_email_budget(p_recipients integer) returns boolean
language plpgsql security definer set search_path=public as $$
declare limits public.email_send_limits; hour_used bigint; day_used bigint; stamp timestamptz;
begin
  if p_recipients is null or p_recipients not between 1 and 100 then
    raise exception 'Invalid recipient count';
  end if;
  -- One global lock makes check + reserve indivisible across workers/functions.
  perform pg_advisory_xact_lock(7142041400::bigint);
  stamp:=clock_timestamp();
  select * into strict limits from public.email_send_limits where id=1;
  select coalesce(sum(recipients) filter(where created_at>stamp-interval '1 hour'),0),coalesce(sum(recipients),0)
    into hour_used,day_used from public.email_send_reservations where created_at>stamp-interval '24 hours';
  if hour_used+p_recipients>limits.hourly_recipients or day_used+p_recipients>limits.daily_recipients then return false; end if;
  insert into public.email_send_reservations(created_at,recipients) values(stamp,p_recipients);
  delete from public.email_send_reservations where created_at<stamp-interval '2 days';
  return true;
end $$;
revoke all on function public.reserve_email_budget(integer) from public,anon,authenticated;
grant execute on function public.reserve_email_budget(integer) to service_role;
