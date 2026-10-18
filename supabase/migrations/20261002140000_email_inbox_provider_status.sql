-- Accepted vs delivered: status stays the send lifecycle (queued/sending/retry/
-- sent/unknown); provider_event is Resend's last_event (delivered, bounced, …).
alter table public.email_messages add column if not exists provider_event text;
alter table public.email_messages add column if not exists provider_checked_at timestamptz;

-- Accepted rows (resend_id set) may be claimed to refresh Message-ID/delivery
-- status. They keep status 'sent' while claimed, and the function only reads
-- from Resend for them, so a refresh can never send again.
create or replace function public.claim_inbox_send(p_id uuid) returns setof public.email_messages
language sql security definer set search_path=public as $$
  update public.email_messages set locked_until=now()+interval '2 minutes',lease_token=gen_random_uuid(),
    status=case when resend_id is not null then 'sent' else 'sending' end,
    first_attempt_at=coalesce(first_attempt_at,now())
  where id=p_id and direction='outgoing' and outbox_id is null
    and status in ('queued','retry','sending','sent')
    and (locked_until is null or locked_until<now())
    and (status<>'sent' or resend_id is not null)
  returning *;
$$;

-- An accepted email is not an error: clear the old "Waiting for provider
-- Message-ID" text so it no longer shows as failed.
update public.email_messages set last_error=null
  where direction='outgoing' and status='sent' and resend_id is not null
    and last_error like 'Waiting for%Message-ID%';

-- Incoming To lists repeated the same address (Resend lists it in several
-- fields). Keep the first occurrence of each address, in order.
update public.email_messages m set to_email=d.deduped
from (
  select id, string_agg(addr, ', ' order by first_pos) deduped
  from (
    select id, lower(btrim(a)) addr, min(pos) first_pos
    from public.email_messages, unnest(string_to_array(to_email, ',')) with ordinality u(a, pos)
    where direction='incoming' and to_email like '%,%'
    group by id, lower(btrim(a))
  ) s group by id
) d
where m.id=d.id and m.to_email<>d.deduped;
