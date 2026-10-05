-- Optional CC/BCC on bulk emails. Each client still gets a separate email;
-- the CC/BCC addresses are added to every one of those emails (so they receive
-- one copy per client), never another client's address. Max 5 each.
alter table public.email_campaigns add column if not exists cc text[] not null default '{}';
alter table public.email_campaigns add column if not exists bcc text[] not null default '{}';

drop function if exists public.campaign_create(uuid, uuid, text, text, text, text, uuid[], jsonb);
create function public.campaign_create(p_request_key uuid, p_mailbox uuid, p_kind text, p_subject text, p_body_html text,
  p_first_name_fallback text, p_contact_ids uuid[], p_drip jsonb default '{}'::jsonb, p_cc text[] default '{}', p_bcc text[] default '{}')
returns public.email_campaigns language plpgsql security definer set search_path = public as $$
declare c public.email_campaigns; box public.email_mailboxes; r record; n int := 0; drip boolean := coalesce((p_drip->>'enabled')::boolean, false);
  cc_list text[]; bcc_list text[]; a text;
begin
  if not public.can_manage_campaigns() then raise exception 'Not allowed' using errcode = '42501'; end if;
  select * into c from public.email_campaigns where request_key = p_request_key;
  if found then
    if c.created_by is distinct from auth.uid() then raise exception 'Request key already used'; end if;
    return c;
  end if;
  foreach a in array coalesce(p_cc, '{}') || coalesce(p_bcc, '{}') loop
    if lower(btrim(a)) !~ '^[^[:space:]<>,;@]+@[^[:space:]<>,;@]+\.[^[:space:]<>,;@]+$' then raise exception 'Invalid CC/BCC address: %', left(a, 100); end if;
  end loop;
  cc_list := public.inbox_unique_addresses(p_cc, '{}');
  bcc_list := public.inbox_unique_addresses(p_bcc, cc_list);
  if cardinality(cc_list) > 5 or cardinality(bcc_list) > 5 then raise exception 'Bulk email allows up to 5 CC and 5 BCC addresses'; end if;
  select * into box from public.email_mailboxes where id = p_mailbox;
  if box.id is null or not public.can_send_mailbox(box.id) then raise exception 'You cannot send from this mailbox' using errcode = '42501'; end if;
  if coalesce(cardinality(p_contact_ids), 0) = 0 or cardinality(p_contact_ids) > 5000 then raise exception 'Select between 1 and 5000 clients'; end if;
  insert into public.email_campaigns(request_key, kind, mailbox_id, from_email, from_name, reply_to, subject, body_html, first_name_fallback,
      drip, batch_size, interval_minutes, start_at, window_start, window_end, timezone, next_batch_at, created_by_name, cc, bcc)
    values (p_request_key, p_kind, box.id, box.address, box.name, box.receiving_address, btrim(p_subject), p_body_html,
      left(coalesce(nullif(btrim(p_first_name_fallback), ''), 'there'), 40),
      drip, case when drip then coalesce((p_drip->>'batch_size')::int, 50) else 50 end,
      case when drip then coalesce((p_drip->>'interval_minutes')::int, 60) else 0 end,
      nullif(p_drip->>'start_at', '')::timestamptz,
      case when drip then nullif(p_drip->>'window_start', '')::time end, case when drip then nullif(p_drip->>'window_end', '')::time end,
      coalesce(nullif(p_drip->>'timezone', ''), 'Asia/Manila'),
      coalesce(nullif(p_drip->>'start_at', '')::timestamptz, now()),
      (select coalesce(nullif(btrim(full_name), ''), email) from public.profiles where id = auth.uid()), cc_list, bcc_list)
    returning * into c;
  for r in select * from public.campaign_preview_recipients(p_contact_ids, p_kind) loop
    n := n + 1;
    if r.eligible then
      insert into public.email_campaign_recipients(campaign_id, seq, contact_id, email, first_name)
        values (c.id, n, r.contact_id, r.email, r.first_name);
    elsif r.reason <> 'Duplicate email address' then
      insert into public.email_campaign_recipients(campaign_id, seq, contact_id, email, first_name, status, skip_reason)
        values (c.id, n, r.contact_id, coalesce(r.email, 'missing-' || r.contact_id), r.first_name, 'skipped', r.reason)
        on conflict (campaign_id, email) do nothing;
    end if;
  end loop;
  perform public.campaign_kick_worker();
  return c;
end $$;
revoke all on function public.campaign_create(uuid, uuid, text, text, text, text, uuid[], jsonb, text[], text[]) from public, anon;
grant execute on function public.campaign_create(uuid, uuid, text, text, text, text, uuid[], jsonb, text[], text[]) to authenticated;

-- Claimed jobs also carry the campaign's CC/BCC (return type changes).
drop function if exists public.campaign_claim_jobs(integer, timestamptz);
create function public.campaign_claim_jobs(p_limit integer default 20, p_now timestamptz default now())
returns table(id uuid, campaign_id uuid, email text, first_name text, unsubscribe_token uuid, lease_token uuid, attempts integer,
  first_attempt_at timestamptz, kind text, from_email text, from_name text, reply_to text, subject text, body_html text, first_name_fallback text,
  cc text[], bcc text[])
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
      reply_to := c.reply_to; subject := c.subject; body_html := c.body_html; first_name_fallback := c.first_name_fallback; cc := c.cc; bcc := c.bcc;
      return next;
    end loop;
    left_over := left_over - took;
    update public.email_campaigns set status = case when status = 'queued' then 'processing' else status end,
      started_at = coalesce(started_at, case when took > 0 then p_now end),
      next_batch_at = case when took > 0 and drip then p_now + make_interval(mins => interval_minutes) else next_batch_at end,
      updated_at = now() where email_campaigns.id = c.id;
    perform public.campaign_finish_if_done(c.id);
  end loop;
end $$;
revoke all on function public.campaign_claim_jobs(integer, timestamptz) from public, anon, authenticated;
grant execute on function public.campaign_claim_jobs(integer, timestamptz) to service_role;
