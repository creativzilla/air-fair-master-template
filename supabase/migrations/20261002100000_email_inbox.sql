-- Additive inbox. No historical outbox rows are changed.
create table public.email_conversations (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid references public.contacts(id) on delete set null,
  submission_id uuid unique references public.form_submissions(id) on delete set null,
  subject text not null,
  participant_email text not null,
  reply_token text not null unique default replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_incoming_at timestamptz,
  last_outgoing_at timestamptz
);
create table public.email_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.email_conversations(id) on delete cascade,
  direction text not null check (direction in ('incoming','outgoing')),
  from_email text not null,
  to_email text not null,
  subject text not null,
  body_text text not null,
  headers jsonb not null default '{}',
  attachments jsonb not null default '[]',
  resend_id text unique,
  rfc_message_id text,
  sender_user_id uuid references public.profiles(id) on delete set null,
  sender_name text,
  status text not null default 'queued',
  last_error text,
  request_key uuid unique,
  outbox_id uuid unique references public.email_outbox(id) on delete set null,
  send_payload jsonb,
  first_attempt_at timestamptz,
  locked_until timestamptz,
  lease_token uuid,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
create index email_messages_thread on public.email_messages(conversation_id, created_at, id);
create index email_messages_rfc on public.email_messages(rfc_message_id);
create index email_conversations_recent on public.email_conversations(updated_at desc, id);
create index email_conversations_contact on public.email_conversations(contact_id);
create table public.email_read_state (
  conversation_id uuid not null references public.email_conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  read_at timestamptz not null,
  primary key(conversation_id,user_id)
);
create table public.email_webhook_events (
  event_id text primary key,
  resend_id text not null,
  processed_at timestamptz not null default now()
);

-- CRM currently permits all active team members to access contacts. For inbox
-- also require explicit employee module grants for staff (fail closed).
create function public.can_use_email_inbox() returns boolean
language sql stable security definer set search_path = public as $$
  select public.auth_role() in ('admin','editor') or
    (public.auth_role() = 'staff' and exists (
      select 1 from public.employees where user_id = auth.uid()
      and allowed_modules->>'clients' = 'true'
      and allowed_modules->>'email-inbox' = 'true'));
$$;
alter table public.email_conversations enable row level security;
alter table public.email_messages enable row level security;
alter table public.email_read_state enable row level security;
alter table public.email_webhook_events enable row level security;
create policy inbox_conversations_read on public.email_conversations for select to authenticated using (public.can_use_email_inbox());
create policy inbox_messages_read on public.email_messages for select to authenticated using (public.can_use_email_inbox());
create policy inbox_reads_select on public.email_read_state for select to authenticated using (user_id = auth.uid() and public.can_use_email_inbox());
create policy inbox_reads_write on public.email_read_state for insert to authenticated with check (user_id = auth.uid() and public.can_use_email_inbox());
create policy inbox_reads_update on public.email_read_state for update to authenticated using (user_id = auth.uid() and public.can_use_email_inbox()) with check (user_id = auth.uid() and public.can_use_email_inbox());
revoke all on public.email_conversations, public.email_messages, public.email_read_state, public.email_webhook_events from anon, authenticated;
grant select on public.email_conversations, public.email_messages to authenticated;
grant select, insert, update on public.email_read_state to authenticated;
grant all on public.email_conversations, public.email_messages, public.email_read_state, public.email_webhook_events to service_role;

create function public.queue_inbox_message(p_key uuid, p_contact uuid, p_conversation uuid, p_subject text, p_body text)
returns public.email_messages language plpgsql security definer set search_path = public as $$
declare c public.email_conversations; m public.email_messages; recipient text;
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
  insert into public.email_messages(conversation_id,direction,from_email,to_email,subject,body_text,request_key,sender_user_id,sender_name)
    values(c.id,'outgoing','no-reply@airfairtravel.com',c.participant_email,
      case when p_conversation is null or c.subject ~* '^re:' then c.subject else 'Re: ' || c.subject end,
      p_body,p_key,auth.uid(),(select coalesce(full_name,email) from public.profiles where id=auth.uid())) returning * into m;
  update public.email_conversations set updated_at=now(),last_outgoing_at=now() where id=c.id;
  return m;
end $$;

create function public.associate_email_conversation(p_conversation uuid, p_contact uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
  if not public.can_use_email_inbox() then raise exception 'Inbox access denied' using errcode='42501'; end if;
  if not exists(select 1 from public.contacts where id=p_contact) then raise exception 'Lead not found'; end if;
  update public.email_conversations set contact_id=p_contact where id=p_conversation;
end $$;

-- Called only after signature verification AND full-content retrieval. One
-- transaction records the event, resolves the thread and inserts the message.
create function public.accept_inbound_email(p_event text, p_email jsonb)
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
  select array_agg(id) into candidates from public.email_conversations where reply_token=any(tokens);
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

-- Lease excludes concurrent sends; immutable payload is saved before HTTP.
create function public.claim_inbox_send(p_id uuid) returns setof public.email_messages
language sql security definer set search_path=public as $$
  update public.email_messages set locked_until=now()+interval '2 minutes',lease_token=gen_random_uuid(),
    status='sending',first_attempt_at=coalesce(first_attempt_at,now())
  where id=p_id and direction='outgoing' and outbox_id is null
    and status in ('queued','retry','sending','sent')
    and (locked_until is null or locked_until<now())
    and (status<>'sent' or rfc_message_id is null)
  returning *;
$$;

-- New auto-replies retain the existing queue/retry system. A trigger runs only
-- for newly inserted pending client confirmations, never staff or newsletter.
create function public.link_form_email_thread() returns trigger
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
  new.reply_to := 'thread-' || c.reply_token || '@reply.airfairtravel.com';
  return new;
end $$;
create trigger inbox_link_form before insert on public.email_outbox for each row execute function public.link_form_email_thread();
create function public.sync_form_email_thread() returns trigger
language plpgsql security definer set search_path=public as $$
declare c uuid;
begin
  if new.kind<>'client_confirmation' or new.reply_to not like 'thread-%@reply.airfairtravel.com' then return new; end if;
  select id into c from public.email_conversations where submission_id=new.submission_id;
  if c is null then return new; end if;
  insert into public.email_messages(conversation_id,direction,from_email,to_email,subject,body_text,outbox_id,status,resend_id,sent_at,last_error)
    values(c,'outgoing','no-reply@airfairtravel.com',new.to_email,new.subject,new.body_text,new.id,new.status,new.provider_message_id,new.sent_at,new.last_error)
    on conflict(outbox_id) do update set status=excluded.status,resend_id=excluded.resend_id,sent_at=excluded.sent_at,last_error=excluded.last_error;
  update public.email_conversations set updated_at=now(),last_outgoing_at=now() where id=c;
  return new;
end $$;
create trigger inbox_sync_form after insert or update on public.email_outbox for each row execute function public.sync_form_email_thread();

revoke all on function public.queue_inbox_message(uuid,uuid,uuid,text,text), public.associate_email_conversation(uuid,uuid) from public,anon;
grant execute on function public.queue_inbox_message(uuid,uuid,uuid,text,text), public.associate_email_conversation(uuid,uuid) to authenticated;
revoke all on function public.accept_inbound_email(text,jsonb), public.claim_inbox_send(uuid), public.link_form_email_thread(), public.sync_form_email_thread() from public,anon,authenticated;
grant execute on function public.accept_inbound_email(text,jsonb), public.claim_inbox_send(uuid) to service_role;
