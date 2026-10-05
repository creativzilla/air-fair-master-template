-- Sender attribution and automatic sender copies for manual inbox emails.
-- Additive; existing grants on replaced functions are kept by create or replace.

-- Admin-only (existing email_settings RLS): copy the sending staff member.
alter table public.email_settings add column if not exists inbox_sender_copy text not null default 'cc'
  check (inbox_sender_copy in ('off', 'cc', 'bcc'));

-- Snapshot at queue time, so retries/refreshes by anyone keep the original
-- sender and recipients even if settings or the retrying user differ.
-- sender_user_id/sender_name already exist; sender_name is now the full name only.
alter table public.email_messages add column if not exists sender_email text;
alter table public.email_messages add column if not exists copy_mode text check (copy_mode in ('off', 'cc', 'bcc'));
alter table public.email_messages add column if not exists cc_email text;
alter table public.email_messages add column if not exists bcc_email text;

-- Historical attribution: only where a sender user ID was recorded. No guessing.
update public.email_messages m set sender_email = lower(u.email)
from auth.users u
where m.sender_user_id = u.id and m.sender_email is null and m.direction = 'outgoing' and m.outbox_id is null;

-- Sender identity comes from auth.uid() inside this function, never from the
-- request. Signature unchanged, so inbox-send and the dashboard call it as before.
create or replace function public.queue_inbox_message(p_key uuid, p_contact uuid, p_conversation uuid, p_subject text, p_body text)
returns public.email_messages language plpgsql security definer set search_path = public as $$
declare c public.email_conversations; m public.email_messages; recipient text;
  sender_full text; sender_addr text; mode text; copy_to text;
begin
  if not public.can_use_email_inbox() then raise exception 'Inbox access denied' using errcode = '42501'; end if;
  if p_key is null or length(btrim(p_body)) not between 1 and 50000 then raise exception 'Message is required (maximum 50000 characters)'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_key::text, 0));
  select * into m from public.email_messages where request_key = p_key;
  if found then
    if m.sender_user_id <> auth.uid() or m.body_text <> p_body or (p_conversation is not null and m.conversation_id <> p_conversation) then raise exception 'Request key already used'; end if;
    return m;
  end if;
  if p_conversation is not null then
    select * into strict c from public.email_conversations where id = p_conversation;
  else
    if length(btrim(p_subject)) not between 1 and 200 or p_subject ~ E'[\r\n]' then raise exception 'A valid subject is required'; end if;
    select email into recipient from public.contacts where id = p_contact;
    if recipient is null or recipient !~ '^[^[:space:]<>,;@]+@[^[:space:]<>,;@]+\.[^[:space:]<>,;@]+$' then raise exception 'Select a lead with a valid email'; end if;
    insert into public.email_conversations(contact_id, subject, participant_email)
      values(p_contact, btrim(p_subject), lower(recipient)) returning * into c;
  end if;
  select nullif(btrim(full_name), '') into sender_full from public.profiles where id = auth.uid();
  -- Registered account email from Supabase Auth.
  select lower(btrim(email)) into sender_addr from auth.users where id = auth.uid();
  if sender_addr !~ '^[^[:space:]<>,;@]+@[^[:space:]<>,;@]+\.[^[:space:]<>,;@]+$' then sender_addr := null; end if;
  select coalesce(inbox_sender_copy, 'cc') into mode from public.email_settings where id = 1;
  mode := coalesce(mode, 'cc');
  -- One copy to the sender only; never duplicate the client's own address.
  copy_to := case when mode <> 'off' and sender_addr is not null and sender_addr <> lower(c.participant_email) then sender_addr end;
  insert into public.email_messages(conversation_id,direction,from_email,to_email,subject,body_text,request_key,
      sender_user_id,sender_name,sender_email,copy_mode,cc_email,bcc_email)
    values(c.id,'outgoing','no-reply@airfairtravel.com',c.participant_email,
      case when p_conversation is null or c.subject ~* '^re:' then c.subject else 'Re: ' || c.subject end,
      p_body,p_key,auth.uid(),sender_full,sender_addr,mode,
      case when mode = 'cc' then copy_to end, case when mode = 'bcc' then copy_to end) returning * into m;
  update public.email_conversations set updated_at=now(),last_outgoing_at=now() where id=c.id;
  return m;
end $$;

-- Incoming CC (e.g. a client's Reply All that includes the CC'd staff member)
-- is stored for display. Matching/threading is unchanged.
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
  insert into public.email_messages(conversation_id,direction,from_email,to_email,cc_email,subject,body_text,headers,attachments,resend_id,rfc_message_id,status)
    values(c,'incoming',p_email->>'from',p_email->>'to',nullif(p_email->>'cc',''),p_email->>'subject',p_email->>'text',p_email->'headers',p_email->'attachments',p_email->>'id',p_email->>'message_id','received');
  update public.email_conversations set updated_at=clock_timestamp(),last_incoming_at=clock_timestamp() where id=c;
  insert into public.email_webhook_events(event_id,resend_id) values(p_event,p_email->>'id');
  return c;
end $$;
