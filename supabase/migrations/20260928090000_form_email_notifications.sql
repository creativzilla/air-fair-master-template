/*
# Form email notifications

Staff notification + client confirmation for website forms, and double
opt-in for the newsletter. Emails are sent by the `form-submit` Edge Function
(Resend); this migration only adds the tables it needs.

- email_settings        one row: monitored staff inbox(es), test redirect and
                        an on/off switch. Admin-only. Sending stays OFF until
                        an admin enters the inbox and switches it on.
- email_outbox          one row per email. `dedupe_key` is unique (one staff +
                        one client email per submission), the row id is sent
                        to Resend as the Idempotency-Key, and status /
                        attempts / last_error drive retries and the dashboard
                        log. Content is stored so a retry sends the same email.
- rate_limit_events     hashed IP / email counters for server-side limits.
- newsletter_subscribers  + confirmed_at, token hashes (double opt-in).
                        Marketing sends must use newsletter_marketing_audience
                        (confirmed and not unsubscribed) only.

No triggers, pg_net or pg_cron: the Edge Function sends right after saving and
retries due emails on later calls or from the dashboard "Retry" button.
Existing form_submissions / CRM behaviour is unchanged.
*/

-- ---------------------------------------------------------------------------
-- Settings (single row, admin only)
-- ---------------------------------------------------------------------------
create table if not exists public.email_settings (
  id smallint primary key default 1 check (id = 1),
  sending_enabled boolean not null default false,
  staff_inbox text,
  inbox_general text,
  inbox_immigration text,
  inbox_visa text,
  inbox_travel text,
  test_redirect_to text,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null default auth.uid(),
  constraint email_settings_addresses check (
        (staff_inbox       is null or staff_inbox       ~* '^[^@\s<>,;]+@[^@\s<>,;]+\.[^@\s<>,;]+$')
    and (inbox_general     is null or inbox_general     ~* '^[^@\s<>,;]+@[^@\s<>,;]+\.[^@\s<>,;]+$')
    and (inbox_immigration is null or inbox_immigration ~* '^[^@\s<>,;]+@[^@\s<>,;]+\.[^@\s<>,;]+$')
    and (inbox_visa        is null or inbox_visa        ~* '^[^@\s<>,;]+@[^@\s<>,;]+\.[^@\s<>,;]+$')
    and (inbox_travel      is null or inbox_travel      ~* '^[^@\s<>,;]+@[^@\s<>,;]+\.[^@\s<>,;]+$')
    and (test_redirect_to  is null or test_redirect_to  ~* '^[^@\s<>,;]+@[^@\s<>,;]+\.[^@\s<>,;]+$')
  ),
  -- Can't switch sending on without a monitored inbox.
  constraint email_settings_enabled_needs_inbox check (not sending_enabled or staff_inbox is not null)
);
-- Monitored staff inbox confirmed by the owner (2026-09-28). Sending stays off
-- until an admin switches it on in Dashboard > Form Emails.
insert into public.email_settings (id, staff_inbox) values (1, 'admin@airfairtravel.com') on conflict (id) do nothing;

drop trigger if exists trg_email_settings_updated_at on public.email_settings;
create trigger trg_email_settings_updated_at before update on public.email_settings
  for each row execute function public.set_updated_at();

alter table public.email_settings enable row level security;
drop policy if exists "email_settings_admin_read" on public.email_settings;
create policy "email_settings_admin_read" on public.email_settings
  for select to authenticated using (public.is_admin());
drop policy if exists "email_settings_admin_update" on public.email_settings;
create policy "email_settings_admin_update" on public.email_settings
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Outbox (written and sent only by the Edge Function; team can read the log)
-- ---------------------------------------------------------------------------
create table if not exists public.email_outbox (
  id uuid primary key default gen_random_uuid(),
  dedupe_key text not null unique check (length(dedupe_key) <= 200),
  kind text not null check (kind in ('staff_notification', 'client_confirmation', 'newsletter_confirmation')),
  submission_id uuid references public.form_submissions(id) on delete set null,
  subscriber_id uuid references public.newsletter_subscribers(id) on delete set null,
  service_type text check (service_type in ('general', 'newsletter', 'immigration', 'visa', 'travel')),
  form_id text,
  to_email text not null check (length(to_email) <= 254),
  reply_to text check (reply_to is null or length(reply_to) <= 254),
  subject text not null check (length(subject) <= 300),
  html text not null,
  body_text text not null,
  status text not null default 'pending' check (status in ('pending', 'sending', 'retry', 'sent', 'failed', 'skipped')),
  attempts integer not null default 0 check (attempts >= 0),
  next_attempt_at timestamptz not null default now(),
  locked_until timestamptz,
  last_error text check (last_error is null or length(last_error) <= 1000),
  provider_message_id text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_email_outbox_due on public.email_outbox (status, next_attempt_at)
  where status in ('pending', 'retry', 'sending');
create index if not exists idx_email_outbox_recipient on public.email_outbox (kind, lower(to_email), created_at desc);
create index if not exists idx_email_outbox_created on public.email_outbox (created_at desc);

drop trigger if exists trg_email_outbox_updated_at on public.email_outbox;
create trigger trg_email_outbox_updated_at before update on public.email_outbox
  for each row execute function public.set_updated_at();

alter table public.email_outbox enable row level security;
drop policy if exists "email_outbox_team_read" on public.email_outbox;
create policy "email_outbox_team_read" on public.email_outbox
  for select to authenticated using (public.is_team());

-- Claim due emails for sending. FOR UPDATE SKIP LOCKED means two overlapping
-- runs never take the same row; a row stuck in 'sending' (crashed run) is
-- reclaimed after its lock expires.
create or replace function public.claim_email_outbox(p_ids uuid[] default null, p_limit integer default 10)
returns setof public.email_outbox
language sql
security definer
set search_path = public
as $$
  update public.email_outbox o
     set status = 'sending', attempts = o.attempts + 1, locked_until = now() + interval '2 minutes'
   where o.id in (
     select id from public.email_outbox
      where (p_ids is null or id = any (p_ids))
        and ((status in ('pending', 'retry') and next_attempt_at <= now())
             or (status = 'sending' and locked_until < now()))
      order by created_at
      for update skip locked
      limit greatest(1, least(coalesce(p_limit, 10), 50)))
  returning o.*;
$$;
revoke all on function public.claim_email_outbox(uuid[], integer) from public, anon, authenticated;
grant execute on function public.claim_email_outbox(uuid[], integer) to service_role;

-- ---------------------------------------------------------------------------
-- Rate limiting (hashed keys only; service role only)
-- ---------------------------------------------------------------------------
create table if not exists public.rate_limit_events (
  id bigint generated always as identity primary key,
  bucket text not null check (length(bucket) <= 60),
  key_hash text not null check (length(key_hash) <= 128),
  created_at timestamptz not null default now()
);
create index if not exists idx_rate_limit_events_lookup on public.rate_limit_events (bucket, key_hash, created_at desc);
alter table public.rate_limit_events enable row level security;  -- no policies: service role only

-- Records a hit and returns true when under the limit, false when over it.
create or replace function public.rate_limit_hit(p_bucket text, p_key_hash text, p_window_seconds integer, p_max integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  hits integer;
begin
  perform pg_advisory_xact_lock(hashtext(p_bucket || ':' || p_key_hash));
  select count(*) into hits from public.rate_limit_events
   where bucket = p_bucket and key_hash = p_key_hash
     and created_at > now() - make_interval(secs => p_window_seconds);
  if hits >= p_max then
    return false;
  end if;
  insert into public.rate_limit_events (bucket, key_hash) values (p_bucket, p_key_hash);
  -- Housekeeping: counters older than two days are never needed.
  delete from public.rate_limit_events where created_at < now() - interval '2 days' and random() < 0.02;
  return true;
end;
$$;
revoke all on function public.rate_limit_hit(text, text, integer, integer) from public, anon, authenticated;
grant execute on function public.rate_limit_hit(text, text, integer, integer) to service_role;

-- ---------------------------------------------------------------------------
-- Newsletter double opt-in
-- ---------------------------------------------------------------------------
alter table public.newsletter_subscribers
  add column if not exists confirmed_at timestamptz,
  add column if not exists confirm_token_hash text,
  add column if not exists confirm_expires_at timestamptz,
  add column if not exists confirmation_sent_at timestamptz,
  add column if not exists unsubscribe_token_hash text;
create unique index if not exists newsletter_subscribers_confirm_token on public.newsletter_subscribers (confirm_token_hash) where confirm_token_hash is not null;
create unique index if not exists newsletter_subscribers_unsubscribe_token on public.newsletter_subscribers (unsubscribe_token_hash) where unsubscribe_token_hash is not null;

-- The only list marketing emails may use.
create or replace view public.newsletter_marketing_audience
with (security_invoker = true) as
  select id, email, confirmed_at, source
    from public.newsletter_subscribers
   where confirmed_at is not null and unsubscribed_at is null;
