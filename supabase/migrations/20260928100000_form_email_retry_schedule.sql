/*
# Scheduled retries for form emails

Every 5 minutes, pg_cron runs public.form_email_process_due(), which asks the
form-submit Edge Function (action "process_due") to send queued emails whose
retry time has passed. Without this, a failed email would only be retried
when the next form arrived or an admin pressed "Retry failed now".

- The call is made only when something is due (no HTTP traffic otherwise).
- process_due only sends already-queued, due emails: it can't change content
  or recipients and never resets permanently failed emails.
- The request needs the project's public anon key (the same key the website
  uses) because the function verifies JWTs. It is read from Supabase Vault
  secret `form_submit_anon_key`, so no key is written in this file. Until that
  secret exists the job does nothing (and logs a warning).

Requires migration 20260928090000_form_email_notifications.
Rollback: select cron.unschedule('form-email-retries');
*/

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;

create or replace function public.form_email_process_due()
returns bigint
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  anon_key text;
  request_id bigint;
begin
  if not exists (
    select 1 from public.email_outbox
     where (status in ('pending', 'retry') and next_attempt_at <= now())
        or (status = 'sending' and locked_until < now())
  ) then
    return null; -- nothing due
  end if;

  select decrypted_secret into anon_key from vault.decrypted_secrets where name = 'form_submit_anon_key' limit 1;
  if anon_key is null then
    raise warning 'form_email_process_due: Vault secret form_submit_anon_key is missing; retries skipped.';
    return null;
  end if;

  -- Production project's form-submit function.
  select net.http_post(
    url := 'https://ddhqkzjtlburzkipnoew.supabase.co/functions/v1/form-submit',
    body := jsonb_build_object('action', 'process_due'),
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || anon_key, 'apikey', anon_key),
    timeout_milliseconds := 20000
  ) into request_id;
  return request_id;
end;
$$;
revoke all on function public.form_email_process_due() from public, anon, authenticated;

-- (Re)create the schedule idempotently.
select cron.unschedule(jobid) from cron.job where jobname = 'form-email-retries';
select cron.schedule('form-email-retries', '*/5 * * * *', $cron$select public.form_email_process_due()$cron$);
