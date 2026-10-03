-- Thread Reply-To addresses were "thread-<64 hex>@…": a 71-character local
-- part, over RFC 5321's 64 limit, which Resend rejects (422). New addresses are
-- "t-<first 48 hex of reply_token>@…" (192 random bits). Tokens are not
-- rewritten; inbound matching accepts both the full token and its 48 prefix.
-- create or replace keeps the existing grants on these functions.

create index if not exists email_conversations_reply_prefix on public.email_conversations(left(reply_token, 48));

create or replace function public.accept_inbound_email(p_event text, p_email jsonb)
returns uuid language plpgsql security definer set search_path=public as $$
declare c uuid; existing uuid; tokens text[]; refs text[]; candidates uuid[];
begin
  perform pg_advisory_xact_lock(hashtextextended(p_email->>'id', 0));
  select conversation_id into existing from public.email_messages where resend_id=p_email->>'id';
  if existing is not null then
    insert into public.email_webhook_events(event_id,resend_id) values(p_event,p_email->>'id') on conflict do nothing;
    return existing;
  end if;
  if exists(select 1 from public.email_webhook_events where event_id=p_event) then raise exception 'Event ID conflict'; end if;
  select array_agg(value) into tokens from jsonb_array_elements_text(p_email->'tokens');
  select array_agg(value) into refs from jsonb_array_elements_text(p_email->'references');
  select array_agg(id) into candidates from public.email_conversations
    where left(reply_token, 48) = any(tokens) or reply_token = any(tokens);
  if cardinality(candidates)=1 then c:=candidates[1]; end if;
  if c is null and coalesce(cardinality(tokens),0)=0 then
    select array_agg(distinct m.conversation_id) into candidates from public.email_messages m
    join public.email_conversations t on t.id=m.conversation_id
    where m.rfc_message_id=any(refs) and lower(t.participant_email)=lower(p_email->>'from');
    if cardinality(candidates)=1 then c:=candidates[1]; end if;
  end if;
  if c is null then
    insert into public.email_conversations(subject,participant_email) values(p_email->>'subject',p_email->>'from') returning id into c;
  end if;
  insert into public.email_messages(conversation_id,direction,from_email,to_email,subject,body_text,headers,attachments,resend_id,rfc_message_id,status)
    values(c,'incoming',p_email->>'from',p_email->>'to',p_email->>'subject',p_email->>'text',p_email->'headers',p_email->'attachments',p_email->>'id',p_email->>'message_id','received');
  update public.email_conversations set updated_at=clock_timestamp(),last_incoming_at=clock_timestamp() where id=c;
  insert into public.email_webhook_events(event_id,resend_id) values(p_event,p_email->>'id');
  return c;
end $$;

create or replace function public.link_form_email_thread() returns trigger
language plpgsql security definer set search_path=public as $$
declare c public.email_conversations; recipient text; lead_id uuid;
begin
  if new.kind<>'client_confirmation' or new.status<>'pending' or new.submission_id is null then return new; end if;
  if exists(select 1 from public.email_outbox where dedupe_key=new.dedupe_key) then return new; end if;
  select email into recipient from public.form_submissions where id=new.submission_id;
  select id into lead_id from public.contacts where submission_id=new.submission_id order by created_at limit 1;
  insert into public.email_conversations(contact_id,submission_id,subject,participant_email)
    values(lead_id,new.submission_id,new.subject,lower(recipient)) on conflict(submission_id) do nothing;
  select * into c from public.email_conversations where submission_id=new.submission_id;
  new.reply_to := 't-' || left(c.reply_token, 48) || '@reply.airfairtravel.com';
  return new;
end $$;

create or replace function public.sync_form_email_thread() returns trigger
language plpgsql security definer set search_path=public as $$
declare c uuid;
begin
  if new.kind<>'client_confirmation' or not (new.reply_to like 't-%@reply.airfairtravel.com' or new.reply_to like 'thread-%@reply.airfairtravel.com') then return new; end if;
  select id into c from public.email_conversations where submission_id=new.submission_id;
  if c is null then return new; end if;
  insert into public.email_messages(conversation_id,direction,from_email,to_email,subject,body_text,outbox_id,status,resend_id,sent_at,last_error)
    values(c,'outgoing','no-reply@airfairtravel.com',new.to_email,new.subject,new.body_text,new.id,new.status,new.provider_message_id,new.sent_at,new.last_error)
    on conflict(outbox_id) do update set status=excluded.status,resend_id=excluded.resend_id,sent_at=excluded.sent_at,last_error=excluded.last_error;
  update public.email_conversations set updated_at=now(),last_outgoing_at=now() where id=c;
  return new;
end $$;
