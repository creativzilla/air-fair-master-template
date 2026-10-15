-- Bulk email campaigns from the Client List.
--
-- * One email per recipient (never a shared To/CC/BCC list); the initiating
--   user is recorded on the campaign, not copied on each email.
-- * Persistent jobs processed server-side by the campaign-worker Edge Function,
--   started every minute by pg_cron (same pattern as form-email-retries).
-- * Jobs are claimed with FOR UPDATE SKIP LOCKED plus a lease, so concurrent
--   workers never send the same job; Resend gets a stable Idempotency-Key per job.
-- * Eligibility is rechecked when each job is claimed (right before sending).
-- * Promotional campaigns need recorded marketing consent (newsletter double
--   opt-in) and carry a working unsubscribe link; service emails don't, and
--   marketing unsubscribes never block them. Hard bounces and complaints are
--   suppressed for all campaigns.
-- Individual inbox emails, the shared inbox and form notifications are unchanged.

create table public.email_suppressions (
  email text primary key check (email = lower(email)),
  reason text not null check (reason in ('hard_bounce', 'complaint', 'unsubscribe')),
  source text,
  details text,
  created_at timestamptz not null default now()
);

create table public.email_campaigns (
  id uuid primary key default gen_random_uuid(),
  request_key uuid not null unique,
  kind text not null check (kind in ('service', 'promotional')),
  mailbox_id uuid not null references public.email_mailboxes(id),
  from_email text not null,
  from_name text not null,
  reply_to text not null,
  subject text not null check (length(btrim(subject)) between 1 and 200 and subject !~ '[\r\n]'),
  body_html text not null check (length(body_html) between 1 and 100000),
  first_name_fallback text not null default 'there' check (length(first_name_fallback) <= 40),
  status text not null default 'queued' check (status in ('queued', 'processing', 'paused', 'completed', 'cancelled')),
  status_reason text,
  -- Pacing: batch_size jobs per batch, then wait interval_minutes. Without drip
  -- the worker still paces sends to the provider's rate limit.
  drip boolean not null default false,
  batch_size integer not null default 50 check (batch_size between 1 and 500),
  interval_minutes integer not null default 0 check (interval_minutes between 0 and 10080),
  start_at timestamptz,
  window_start time,
  window_end time,
  timezone text not null default 'Asia/Manila',
  next_batch_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_by_name text,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  check ((window_start is null) = (window_end is null))
);
create index email_campaigns_active on public.email_campaigns(status, next_batch_at) where status in ('queued', 'processing');

create table public.email_campaign_recipients (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.email_campaigns(id) on delete cascade,
  seq integer not null,
  contact_id uuid references public.contacts(id) on delete set null,
  email text not null,
  first_name text,
  status text not null default 'pending' check (status in
    ('pending', 'sending', 'retry', 'accepted', 'delivered', 'delayed', 'bounced', 'complained', 'failed', 'skipped', 'cancelled', 'unknown')),
  skip_reason text,
  attempts integer not null default 0,
  first_attempt_at timestamptz,
  next_attempt_at timestamptz not null default now(),
  locked_until timestamptz,
  lease_token uuid,
  provider_id text unique,
  last_error text,
  accepted_at timestamptz,
  delivered_at timestamptz,
  unsubscribe_token uuid not null unique default gen_random_uuid(),
  updated_at timestamptz not null default now(),
  unique (campaign_id, email),
  unique (campaign_id, seq)
);
create index email_campaign_recipients_due on public.email_campaign_recipients(campaign_id, status, next_attempt_at, seq);

-- ---------------------------------------------------------------------------
-- Who may run campaigns: Clients access plus send access to the From mailbox.
-- ---------------------------------------------------------------------------
create or replace function public.can_manage_campaigns() returns boolean
language sql stable security definer set search_path = public as $$
  select public.has_section('clients') and public.can_use_email_inbox();
$$;

alter table public.email_suppressions enable row level security;
alter table public.email_campaigns enable row level security;
alter table public.email_campaign_recipients enable row level security;
create policy email_campaigns_read on public.email_campaigns for select to authenticated
  using (public.can_manage_campaigns() and public.can_read_mailbox(mailbox_id));
create policy email_campaign_recipients_read on public.email_campaign_recipients for select to authenticated
  using (exists (select 1 from public.email_campaigns c where c.id = campaign_id and public.can_manage_campaigns() and public.can_read_mailbox(c.mailbox_id)));
create policy email_suppressions_read on public.email_suppressions for select to authenticated using (public.can_manage_campaigns());
revoke all on public.email_suppressions, public.email_campaigns, public.email_campaign_recipients from anon, authenticated;
grant select on public.email_suppressions, public.email_campaigns, public.email_campaign_recipients to authenticated;
grant all on public.email_suppressions, public.email_campaigns, public.email_campaign_recipients to service_role;

-- ---------------------------------------------------------------------------
-- Eligibility (used for the review screen and again right before each send).
-- ---------------------------------------------------------------------------
create or replace function public.campaign_block_reason(p_email text, p_kind text) returns text
language sql stable security definer set search_path = public as $$
  select case
    when coalesce(p_email, '') = '' then 'No email address'
    when p_email !~ '^[^[:space:]<>,;@]+@[^[:space:]<>,;@]+\.[^[:space:]<>,;@]+$' then 'Invalid email address'
    when exists (select 1 from public.email_suppressions s where s.email = lower(p_email) and s.reason = 'hard_bounce') then 'Hard bounced'
    when exists (select 1 from public.email_suppressions s where s.email = lower(p_email) and s.reason = 'complaint') then 'Marked as spam'
    when p_kind = 'promotional' and (exists (select 1 from public.email_suppressions s where s.email = lower(p_email) and s.reason = 'unsubscribe')
      or exists (select 1 from public.newsletter_subscribers n where lower(n.email) = lower(p_email) and n.unsubscribed_at is not null)) then 'Unsubscribed'
    when p_kind = 'promotional' and not exists (select 1 from public.newsletter_subscribers n where lower(n.email) = lower(p_email)
      and n.confirmed_at is not null and n.unsubscribed_at is null) then 'No marketing consent'
    else null end;
$$;

-- Review: one row per selected contact, deduplicated by address (first wins).
create or replace function public.campaign_preview_recipients(p_contact_ids uuid[], p_kind text)
returns table(contact_id uuid, name text, email text, first_name text, eligible boolean, reason text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.can_manage_campaigns() then raise exception 'Not allowed' using errcode = '42501'; end if;
  if p_kind not in ('service', 'promotional') then raise exception 'Choose service or promotional'; end if;
  return query
  with picked as (
    select c.id, c.name, lower(btrim(coalesce(c.email, ''))) as addr, x.ord
    from unnest(p_contact_ids) with ordinality x(id, ord) join public.contacts c on c.id = x.id
  ), ranked as (
    select p.*, row_number() over (partition by nullif(p.addr, '') order by p.ord) as rn from picked p
  )
  select r.id, r.name, nullif(r.addr, ''), nullif(split_part(btrim(coalesce(r.name, '')), ' ', 1), ''),
    (case when r.addr <> '' and r.rn > 1 then false else public.campaign_block_reason(nullif(r.addr, ''), p_kind) is null end),
    (case when r.addr <> '' and r.rn > 1 then 'Duplicate email address' else public.campaign_block_reason(nullif(r.addr, ''), p_kind) end)
  from ranked r order by r.ord;
end $$;

-- Create a campaign (idempotent per request key). Excluded contacts are
-- recorded as skipped so the history shows them.
create or replace function public.campaign_create(p_request_key uuid, p_mailbox uuid, p_kind text, p_subject text, p_body_html text,
  p_first_name_fallback text, p_contact_ids uuid[], p_drip jsonb default '{}'::jsonb)
returns public.email_campaigns language plpgsql security definer set search_path = public as $$
declare c public.email_campaigns; box public.email_mailboxes; r record; n int := 0; drip boolean := coalesce((p_drip->>'enabled')::boolean, false);
begin
  if not public.can_manage_campaigns() then raise exception 'Not allowed' using errcode = '42501'; end if;
  select * into c from public.email_campaigns where request_key = p_request_key;
  if found then
    if c.created_by is distinct from auth.uid() then raise exception 'Request key already used'; end if;
    return c;
  end if;
  select * into box from public.email_mailboxes where id = p_mailbox;
  if box.id is null or not public.can_send_mailbox(box.id) then raise exception 'You cannot send from this mailbox' using errcode = '42501'; end if;
  if coalesce(cardinality(p_contact_ids), 0) = 0 or cardinality(p_contact_ids) > 5000 then raise exception 'Select between 1 and 5000 clients'; end if;
  insert into public.email_campaigns(request_key, kind, mailbox_id, from_email, from_name, reply_to, subject, body_html, first_name_fallback,
      drip, batch_size, interval_minutes, start_at, window_start, window_end, timezone, next_batch_at, created_by_name)
    values (p_request_key, p_kind, box.id, box.address, box.name, box.receiving_address, btrim(p_subject), p_body_html,
      left(coalesce(nullif(btrim(p_first_name_fallback), ''), 'there'), 40),
      drip, case when drip then coalesce((p_drip->>'batch_size')::int, 50) else 50 end,
      case when drip then coalesce((p_drip->>'interval_minutes')::int, 60) else 0 end,
      nullif(p_drip->>'start_at', '')::timestamptz,
      case when drip then nullif(p_drip->>'window_start', '')::time end, case when drip then nullif(p_drip->>'window_end', '')::time end,
      coalesce(nullif(p_drip->>'timezone', ''), 'Asia/Manila'),
      coalesce(nullif(p_drip->>'start_at', '')::timestamptz, now()),
      (select coalesce(nullif(btrim(full_name), ''), email) from public.profiles where id = auth.uid()))
    returning * into c;
  for r in select * from public.campaign_preview_recipients(p_contact_ids, p_kind) loop
    n := n + 1;
    if r.eligible then
      insert into public.email_campaign_recipients(campaign_id, seq, contact_id, email, first_name)
        values (c.id, n, r.contact_id, r.email, r.first_name);
    elsif r.reason <> 'Duplicate email address' then
      -- Missing/invalid addresses get a placeholder row so the history lists them.
      insert into public.email_campaign_recipients(campaign_id, seq, contact_id, email, first_name, status, skip_reason)
        values (c.id, n, r.contact_id, coalesce(r.email, 'missing-' || r.contact_id), r.first_name, 'skipped', r.reason)
        on conflict (campaign_id, email) do nothing;
    end if;
  end loop;
  perform public.campaign_kick_worker();
  return c;
end $$;

create or replace function public.campaign_set_status(p_campaign uuid, p_action text)
returns public.email_campaigns language plpgsql security definer set search_path = public as $$
declare c public.email_campaigns;
begin
  if not public.can_manage_campaigns() then raise exception 'Not allowed' using errcode = '42501'; end if;
  select * into c from public.email_campaigns where id = p_campaign for update;
  if not found or not public.can_read_mailbox(c.mailbox_id) then raise exception 'Campaign not found'; end if;
  if p_action = 'pause' and c.status in ('queued', 'processing') then
    update public.email_campaigns set status = 'paused', status_reason = 'Paused by ' || coalesce((select coalesce(nullif(full_name, ''), email) from public.profiles where id = auth.uid()), 'a team member'), updated_at = now() where id = c.id returning * into c;
  elsif p_action = 'resume' and c.status = 'paused' then
    if not public.can_send_mailbox(c.mailbox_id) then raise exception 'You cannot send from this mailbox' using errcode = '42501'; end if;
    update public.email_campaigns set status = 'queued', status_reason = null, next_batch_at = greatest(coalesce(next_batch_at, now()), now()), updated_at = now() where id = c.id returning * into c;
    perform public.campaign_kick_worker();
  elsif p_action = 'cancel' and c.status in ('queued', 'processing', 'paused') then
    update public.email_campaign_recipients set status = 'cancelled', updated_at = now() where campaign_id = c.id and status in ('pending', 'retry');
    update public.email_campaigns set status = 'cancelled', status_reason = 'Cancelled by ' || coalesce((select coalesce(nullif(full_name, ''), email) from public.profiles where id = auth.uid()), 'a team member'),
      completed_at = now(), updated_at = now() where id = c.id returning * into c;
  else
    raise exception 'Cannot % a % campaign', p_action, c.status;
  end if;
  return c;
end $$;

-- Is "now" inside the campaign's sending window (in its timezone)?
create or replace function public.campaign_in_window(c public.email_campaigns, p_now timestamptz default now()) returns boolean
language sql stable set search_path = public as $$
  select c.window_start is null or (
    case when c.window_start <= c.window_end
      then (p_now at time zone c.timezone)::time between c.window_start and c.window_end
      else (p_now at time zone c.timezone)::time >= c.window_start or (p_now at time zone c.timezone)::time <= c.window_end end);
$$;

-- ---------------------------------------------------------------------------
-- Worker side (service role only).
-- ---------------------------------------------------------------------------
-- Claim up to p_limit due jobs: one batch per campaign whose next batch is due
-- and which is inside its window. Expired leases are reclaimed (same idempotency
-- key, so the provider deduplicates). Ineligible recipients are skipped here.
create or replace function public.campaign_claim_jobs(p_limit integer default 20, p_now timestamptz default now())
returns table(id uuid, campaign_id uuid, email text, first_name text, unsubscribe_token uuid, lease_token uuid, attempts integer,
  first_attempt_at timestamptz, kind text, from_email text, from_name text, reply_to text, subject text, body_html text, first_name_fallback text)
language plpgsql security definer set search_path = public as $$
declare c public.email_campaigns; j record; left_over int := greatest(p_limit, 0); took int; reason text; lease uuid;
begin
  for c in select * from public.email_campaigns ec where ec.status in ('queued', 'processing') and coalesce(ec.next_batch_at, ec.created_at) <= p_now
      order by ec.created_at for update skip locked loop
    exit when left_over <= 0;
    continue when not public.campaign_in_window(c, p_now);
    took := 0;
    for j in select r.* from public.email_campaign_recipients r
        where r.campaign_id = c.id and ((r.status in ('pending', 'retry') and r.next_attempt_at <= p_now) or (r.status = 'sending' and r.locked_until < p_now))
        order by r.seq for update skip locked limit least(left_over, c.batch_size) loop
      reason := public.campaign_block_reason(j.email, c.kind);
      if reason is not null then
        update public.email_campaign_recipients set status = 'skipped', skip_reason = reason, updated_at = now() where email_campaign_recipients.id = j.id;
        continue;
      end if;
      lease := gen_random_uuid();
      update public.email_campaign_recipients set status = 'sending', lease_token = lease, locked_until = p_now + interval '5 minutes',
        attempts = email_campaign_recipients.attempts + 1, first_attempt_at = coalesce(email_campaign_recipients.first_attempt_at, p_now), updated_at = now()
        where email_campaign_recipients.id = j.id;
      took := took + 1;
      id := j.id; campaign_id := c.id; email := j.email; first_name := j.first_name; unsubscribe_token := j.unsubscribe_token; lease_token := lease;
      attempts := j.attempts + 1; first_attempt_at := coalesce(j.first_attempt_at, p_now); kind := c.kind; from_email := c.from_email; from_name := c.from_name;
      reply_to := c.reply_to; subject := c.subject; body_html := c.body_html; first_name_fallback := c.first_name_fallback;
      return next;
    end loop;
    left_over := left_over - took;
    update public.email_campaigns set status = case when status = 'queued' then 'processing' else status end,
      started_at = coalesce(started_at, case when took > 0 then p_now end),
      -- Drip: the next batch waits interval_minutes; otherwise continue next run.
      next_batch_at = case when took > 0 and drip then p_now + make_interval(mins => interval_minutes) else next_batch_at end,
      updated_at = now() where email_campaigns.id = c.id;
    perform public.campaign_finish_if_done(c.id);
  end loop;
end $$;

create or replace function public.campaign_finish_if_done(p_campaign uuid) returns void
language sql security definer set search_path = public as $$
  update public.email_campaigns set status = 'completed', completed_at = now(), updated_at = now()
   where id = p_campaign and status in ('queued', 'processing')
     and not exists (select 1 from public.email_campaign_recipients r where r.campaign_id = p_campaign and r.status in ('pending', 'retry', 'sending'));
$$;

-- Record one send outcome (only by the lease holder).
--   accepted: provider took it; retry: temporary, try again at p_retry_at;
--   failed: permanent; unknown: ambiguous and too old to retry safely;
--   requeue_pause: provider quota/limit, put back and pause the campaign.
create or replace function public.campaign_job_result(p_job uuid, p_lease uuid, p_outcome text, p_provider_id text default null,
  p_error text default null, p_retry_at timestamptz default null)
returns void language plpgsql security definer set search_path = public as $$
declare j public.email_campaign_recipients;
begin
  select * into j from public.email_campaign_recipients where id = p_job and lease_token = p_lease and status = 'sending' for update;
  if not found then return; end if;
  if p_outcome = 'accepted' then
    update public.email_campaign_recipients set status = 'accepted', provider_id = p_provider_id, accepted_at = now(), last_error = null,
      locked_until = null, updated_at = now() where id = p_job;
  elsif p_outcome = 'retry' then
    update public.email_campaign_recipients set status = 'retry', last_error = left(p_error, 500), next_attempt_at = coalesce(p_retry_at, now() + interval '5 minutes'),
      locked_until = null, updated_at = now() where id = p_job;
  elsif p_outcome = 'requeue_pause' then
    update public.email_campaign_recipients set status = 'pending', attempts = greatest(attempts - 1, 0), last_error = left(p_error, 500),
      locked_until = null, updated_at = now() where id = p_job;
    update public.email_campaigns set status = 'paused', status_reason = left(coalesce(p_error, 'Provider limit reached'), 300), updated_at = now()
      where id = j.campaign_id and status in ('queued', 'processing');
  elsif p_outcome in ('failed', 'unknown') then
    update public.email_campaign_recipients set status = p_outcome, last_error = left(p_error, 500), locked_until = null, updated_at = now() where id = p_job;
  else
    raise exception 'Unknown outcome %', p_outcome;
  end if;
  perform public.campaign_finish_if_done(j.campaign_id);
end $$;

-- Verified provider webhook events (resend-inbound): delivery status and suppression.
create or replace function public.campaign_provider_event(p_event_id text, p_type text, p_email_id text, p_to text[], p_bounce_type text default null, p_detail text default null)
returns boolean language plpgsql security definer set search_path = public as $$
declare r public.email_campaign_recipients; addr text;
begin
  if exists (select 1 from public.email_webhook_events where event_id = p_event_id) then return false; end if;
  insert into public.email_webhook_events(event_id, resend_id) values (p_event_id, coalesce(p_email_id, ''));
  select * into r from public.email_campaign_recipients where provider_id = p_email_id for update;
  if p_type = 'email.delivered' and r.id is not null then
    update public.email_campaign_recipients set status = case when status in ('accepted', 'delayed') then 'delivered' else status end, delivered_at = now(), updated_at = now() where id = r.id;
  elsif p_type = 'email.delivery_delayed' and r.id is not null then
    update public.email_campaign_recipients set status = case when status = 'accepted' then 'delayed' else status end, updated_at = now() where id = r.id;
  elsif p_type = 'email.bounced' then
    if r.id is not null then
      update public.email_campaign_recipients set status = 'bounced', last_error = left(p_detail, 500), updated_at = now() where id = r.id;
    end if;
    if p_bounce_type = 'Permanent' then
      foreach addr in array coalesce(p_to, '{}') loop
        insert into public.email_suppressions(email, reason, source, details) values (lower(addr), 'hard_bounce', 'resend webhook', left(p_detail, 300))
          on conflict (email) do update set reason = case when email_suppressions.reason = 'complaint' then 'complaint' else 'hard_bounce' end;
      end loop;
    end if;
  elsif p_type = 'email.complained' then
    if r.id is not null then update public.email_campaign_recipients set status = 'complained', updated_at = now() where id = r.id; end if;
    foreach addr in array coalesce(p_to, '{}') loop
      insert into public.email_suppressions(email, reason, source) values (lower(addr), 'complaint', 'resend webhook')
        on conflict (email) do update set reason = 'complaint';
    end loop;
  end if;
  return true;
end $$;

-- Unsubscribe from a campaign email link (marketing only; service emails unaffected).
create or replace function public.campaign_unsubscribe(p_token uuid) returns text
language plpgsql security definer set search_path = public as $$
declare r public.email_campaign_recipients;
begin
  select * into r from public.email_campaign_recipients where unsubscribe_token = p_token;
  if not found then return null; end if;
  insert into public.email_suppressions(email, reason, source) values (lower(r.email), 'unsubscribe', 'campaign link')
    on conflict (email) do nothing;
  update public.newsletter_subscribers set unsubscribed_at = coalesce(unsubscribed_at, now()) where lower(email) = lower(r.email);
  return r.email;
end $$;

-- Worker trigger: cron every minute, and right after a campaign is created or
-- resumed. Calls the worker only when something is due. The shared secret is
-- generated here and kept in Vault; the worker checks it with
-- campaign_worker_secret_ok (service role).
do $$ begin
  if not exists (select 1 from vault.secrets where name = 'campaign_worker_secret') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'campaign_worker_secret', 'Shared secret: pg_cron → campaign-worker');
  end if;
end $$;

create or replace function public.campaign_worker_secret_ok(p_secret text) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(p_secret, '') <> '' and p_secret = (select decrypted_secret from vault.decrypted_secrets where name = 'campaign_worker_secret' limit 1);
$$;

create or replace function public.campaign_kick_worker() returns bigint
language plpgsql security definer set search_path = public, extensions as $$
declare secret text; request_id bigint;
begin
  if not exists (
    select 1 from public.email_campaigns c where c.status in ('queued', 'processing') and coalesce(c.next_batch_at, c.created_at) <= now()
      and exists (select 1 from public.email_campaign_recipients r where r.campaign_id = c.id
        and ((r.status in ('pending', 'retry') and r.next_attempt_at <= now()) or (r.status = 'sending' and r.locked_until < now())))
  ) then return null; end if;
  select decrypted_secret into secret from vault.decrypted_secrets where name = 'campaign_worker_secret' limit 1;
  if secret is null then raise warning 'campaign_kick_worker: Vault secret campaign_worker_secret missing'; return null; end if;
  select net.http_post(
    url := 'https://ddhqkzjtlburzkipnoew.supabase.co/functions/v1/campaign-worker',
    body := jsonb_build_object('action', 'run'),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-campaign-worker-secret', secret),
    timeout_milliseconds := 60000
  ) into request_id;
  return request_id;
end $$;

revoke all on function public.campaign_claim_jobs(integer, timestamptz), public.campaign_job_result(uuid, uuid, text, text, text, timestamptz),
  public.campaign_provider_event(text, text, text, text[], text, text), public.campaign_unsubscribe(uuid),
  public.campaign_worker_secret_ok(text), public.campaign_kick_worker(), public.campaign_finish_if_done(uuid) from public, anon, authenticated;
grant execute on function public.campaign_claim_jobs(integer, timestamptz), public.campaign_job_result(uuid, uuid, text, text, text, timestamptz),
  public.campaign_provider_event(text, text, text, text[], text, text), public.campaign_unsubscribe(uuid),
  public.campaign_worker_secret_ok(text), public.campaign_kick_worker() to service_role;
revoke all on function public.campaign_preview_recipients(uuid[], text), public.campaign_create(uuid, uuid, text, text, text, text, uuid[], jsonb),
  public.campaign_set_status(uuid, text), public.can_manage_campaigns(), public.campaign_block_reason(text, text) from public, anon;
grant execute on function public.campaign_preview_recipients(uuid[], text), public.campaign_create(uuid, uuid, text, text, text, text, uuid[], jsonb),
  public.campaign_set_status(uuid, text), public.can_manage_campaigns() to authenticated;

select cron.unschedule(jobid) from cron.job where jobname = 'email-campaign-worker';
select cron.schedule('email-campaign-worker', '* * * * *', $cron$select public.campaign_kick_worker()$cron$);

-- Per-campaign counts for the history list (runs with the viewer's RLS).
-- accepted = provider took it; delivered = recipient server confirmed (webhook).
create view public.email_campaign_stats with (security_invoker = true) as
select campaign_id,
  count(*) filter (where status in ('pending', 'retry', 'sending')) as pending,
  count(*) filter (where status in ('accepted', 'delayed')) as accepted,
  count(*) filter (where status = 'delivered') as delivered,
  count(*) filter (where status in ('failed', 'bounced', 'complained', 'unknown')) as failed,
  count(*) filter (where status = 'skipped') as skipped,
  count(*) filter (where status = 'cancelled') as cancelled,
  count(*) as total
from public.email_campaign_recipients group by campaign_id;
grant select on public.email_campaign_stats to authenticated;
