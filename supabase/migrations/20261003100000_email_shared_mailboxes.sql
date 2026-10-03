-- Shared mailboxes (info@, visa@, travel@ ...) with per-mailbox staff access.
--
-- Sending: Resend sends from the verified airfairtravel.com domain.
-- Receiving: airfairtravel.com MX stays with Google Workspace; Resend receives on
-- reply.airfairtravel.com. A shared address reaches the dashboard when Google
-- Workspace forwards a copy to <local>@reply.airfairtravel.com (its
-- receiving_address). A mailbox becomes 'active' only after the mailbox-verify
-- function proves both directions (Resend domain capabilities + a test email
-- that comes back through the inbound webhook). Clients cannot set status.

create table public.email_mailboxes (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 80 and name !~ '[\r\n<>"\\]'),
  address text not null unique check (address = lower(address) and address ~ '^[a-z0-9._+-]+@airfairtravel\.com$'),
  receiving_address text not null unique check (receiving_address = lower(receiving_address) and receiving_address ~ '^[a-z0-9._+-]+@reply\.airfairtravel\.com$'),
  status text not null default 'pending' check (status in ('pending', 'active', 'disabled', 'setup_failed')),
  status_detail text,
  is_default boolean not null default false,
  all_inbox_users boolean not null default false,
  sending_verified_at timestamptz,
  receiving_verified_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  updated_at timestamptz not null default now()
);
create unique index email_mailboxes_one_default on public.email_mailboxes(is_default) where is_default;

create table public.email_mailbox_members (
  mailbox_id uuid not null references public.email_mailboxes(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  can_send boolean not null default true,
  primary key (mailbox_id, user_id)
);

-- A conversation can belong to several mailboxes (e.g. To: info@, Cc: visa@)
-- without duplicating its messages. mailbox_id is the reply-from default.
create table public.email_conversation_mailboxes (
  conversation_id uuid not null references public.email_conversations(id) on delete cascade,
  mailbox_id uuid not null references public.email_mailboxes(id) on delete cascade,
  primary key (conversation_id, mailbox_id)
);
create index email_conversation_mailboxes_mailbox on public.email_conversation_mailboxes(mailbox_id, conversation_id);

-- Verification probes (service role only). Only a hash of the token is stored.
create table public.email_mailbox_verifications (
  mailbox_id uuid primary key references public.email_mailboxes(id) on delete cascade,
  token_hash text not null unique,
  sent_at timestamptz not null default now(),
  confirmed_at timestamptz
);

alter table public.email_conversations add column if not exists mailbox_id uuid references public.email_mailboxes(id);
alter table public.email_messages add column if not exists mailbox_id uuid references public.email_mailboxes(id);
alter table public.email_messages add column if not exists from_name text;

-- Existing sender becomes the General mailbox, open to every inbox user, so
-- current behaviour is unchanged. Active only if live traffic already proves
-- both directions; otherwise it waits for verification like any mailbox.
insert into public.email_mailboxes(name, address, receiving_address, is_default, all_inbox_users, status, status_detail,
  sending_verified_at, receiving_verified_at, created_by)
select 'Air Fair Travel & Immigration', 'no-reply@airfairtravel.com', 'inbox@reply.airfairtravel.com', true, true,
  case when s.at is not null and r.at is not null then 'active' else 'pending' end,
  case when s.at is not null and r.at is not null then 'Verified by existing email traffic.' else 'Run Verify Setup.' end,
  s.at, r.at, null
from (select min(sent_at) at from public.email_messages where direction = 'outgoing' and status = 'sent' and resend_id is not null) s,
     (select min(created_at) at from public.email_messages where direction = 'incoming') r;

update public.email_conversations set mailbox_id = (select id from public.email_mailboxes where is_default) where mailbox_id is null;
update public.email_messages m set mailbox_id = c.mailbox_id from public.email_conversations c where c.id = m.conversation_id and m.mailbox_id is null;
insert into public.email_conversation_mailboxes(conversation_id, mailbox_id) select id, mailbox_id from public.email_conversations on conflict do nothing;

-- New conversations (website forms, compose, inbound) default to the default mailbox and are linked to it.
create function public.email_conversation_default_mailbox() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.mailbox_id is null then select id into new.mailbox_id from public.email_mailboxes where is_default; end if;
  return new;
end $$;
create trigger email_conversation_default_mailbox before insert on public.email_conversations
  for each row execute function public.email_conversation_default_mailbox();
create function public.email_conversation_link_mailbox() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.mailbox_id is not null then
    insert into public.email_conversation_mailboxes(conversation_id, mailbox_id) values (new.id, new.mailbox_id) on conflict do nothing;
  end if;
  return new;
end $$;
create trigger email_conversation_link_mailbox after insert or update of mailbox_id on public.email_conversations
  for each row execute function public.email_conversation_link_mailbox();
-- Form auto-replies mirrored into the inbox carry their conversation's mailbox.
create function public.email_message_default_mailbox() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.mailbox_id is null then select mailbox_id into new.mailbox_id from public.email_conversations where id = new.conversation_id; end if;
  return new;
end $$;
create trigger email_message_default_mailbox before insert on public.email_messages
  for each row execute function public.email_message_default_mailbox();

-- ---------------------------------------------------------------------------
-- Permissions. Admins: every mailbox. Others: Email Inbox access plus either
-- an all-inbox-users mailbox or membership. Sending also needs 'active'.
-- ---------------------------------------------------------------------------
create function public.can_read_mailbox(p_mailbox uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.can_use_email_inbox() and exists (select 1 from public.email_mailboxes b where b.id = p_mailbox and (
    public.is_admin() or b.all_inbox_users or exists (select 1 from public.email_mailbox_members mm where mm.mailbox_id = b.id and mm.user_id = auth.uid())));
$$;
create function public.can_send_mailbox(p_mailbox uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.can_use_email_inbox() and exists (select 1 from public.email_mailboxes b where b.id = p_mailbox and b.status = 'active' and (
    public.is_admin() or b.all_inbox_users or exists (select 1 from public.email_mailbox_members mm where mm.mailbox_id = b.id and mm.user_id = auth.uid() and mm.can_send)));
$$;
create function public.can_read_conversation(p_conversation uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.email_conversation_mailboxes cm where cm.conversation_id = p_conversation and public.can_read_mailbox(cm.mailbox_id));
$$;
-- Attachment downloads: own pending uploads, or files on a message the caller can read.
create function public.can_read_email_attachment(p_name text) returns boolean
language sql stable security definer set search_path = public as $$
  select public.can_use_email_inbox() and (
    split_part(p_name, '/', 2) = auth.uid()::text
    or exists (select 1 from public.email_messages m where m.attachments @> jsonb_build_array(jsonb_build_object('path', p_name))
      and public.can_read_conversation(m.conversation_id)));
$$;
revoke all on function public.can_read_mailbox(uuid), public.can_send_mailbox(uuid), public.can_read_conversation(uuid), public.can_read_email_attachment(text) from public, anon;
grant execute on function public.can_read_mailbox(uuid), public.can_send_mailbox(uuid), public.can_read_conversation(uuid), public.can_read_email_attachment(text) to authenticated;

drop policy if exists inbox_conversations_read on public.email_conversations;
create policy inbox_conversations_read on public.email_conversations for select to authenticated using (public.can_read_conversation(id));
drop policy if exists inbox_messages_read on public.email_messages;
create policy inbox_messages_read on public.email_messages for select to authenticated using (public.can_read_conversation(conversation_id));
drop policy if exists inbox_reads_write on public.email_read_state;
create policy inbox_reads_write on public.email_read_state for insert to authenticated with check (user_id = auth.uid() and public.can_read_conversation(conversation_id));
drop policy if exists inbox_reads_update on public.email_read_state;
create policy inbox_reads_update on public.email_read_state for update to authenticated
  using (user_id = auth.uid() and public.can_read_conversation(conversation_id)) with check (user_id = auth.uid() and public.can_read_conversation(conversation_id));
drop policy if exists "email_attachments_inbox_read" on storage.objects;
create policy "email_attachments_inbox_read" on storage.objects
  for select to authenticated using (bucket_id = 'email-attachments' and public.can_read_email_attachment(name));

alter table public.email_mailboxes enable row level security;
alter table public.email_mailbox_members enable row level security;
alter table public.email_conversation_mailboxes enable row level security;
alter table public.email_mailbox_verifications enable row level security;
create policy email_mailboxes_read on public.email_mailboxes for select to authenticated using (public.can_read_mailbox(id));
create policy email_mailbox_members_read on public.email_mailbox_members for select to authenticated using (public.is_admin() or user_id = auth.uid());
create policy email_conversation_mailboxes_read on public.email_conversation_mailboxes for select to authenticated using (public.can_read_mailbox(mailbox_id));
revoke all on public.email_mailboxes, public.email_mailbox_members, public.email_conversation_mailboxes, public.email_mailbox_verifications from anon, authenticated;
grant select on public.email_mailboxes, public.email_mailbox_members, public.email_conversation_mailboxes to authenticated;
grant all on public.email_mailboxes, public.email_mailbox_members, public.email_conversation_mailboxes, public.email_mailbox_verifications to service_role;

-- ---------------------------------------------------------------------------
-- Admin management (the only write path for clients). Status 'active' is set
-- only by verification; these functions never set it except to restore a
-- mailbox that was already verified in both directions.
-- ---------------------------------------------------------------------------
create function public.admin_save_mailbox(p_id uuid, p_name text, p_address text, p_all_inbox_users boolean default false)
returns public.email_mailboxes language plpgsql security definer set search_path = public as $$
declare b public.email_mailboxes; addr text := lower(btrim(p_address)); local text;
begin
  if not public.is_admin() then raise exception 'Only administrators can manage mailboxes' using errcode = '42501'; end if;
  if addr !~ '^[a-z0-9._+-]+@airfairtravel\.com$' then raise exception 'Use an @airfairtravel.com address (letters, numbers, . _ + -)'; end if;
  local := split_part(addr, '@', 1);
  if local ~ '^(t-|thread-)' then raise exception 'Addresses starting with t- or thread- are reserved for reply threads'; end if;
  if p_id is null then
    insert into public.email_mailboxes(name, address, receiving_address, all_inbox_users, status, status_detail)
      values (btrim(p_name), addr, local || '@reply.airfairtravel.com', coalesce(p_all_inbox_users, false), 'pending',
        'Set up forwarding in Google Workspace, then Verify Setup.') returning * into b;
  else
    select * into strict b from public.email_mailboxes where id = p_id;
    if b.address <> addr then
      if b.is_default then raise exception 'Change the default mailbox before changing its address'; end if;
      -- New address: previous verification no longer applies.
      update public.email_mailboxes set address = addr, receiving_address = local || '@reply.airfairtravel.com',
        status = case when status = 'disabled' then 'disabled' else 'pending' end, status_detail = 'Address changed. Verify Setup again.',
        sending_verified_at = null, receiving_verified_at = null, updated_at = now() where id = p_id;
      delete from public.email_mailbox_verifications where mailbox_id = p_id;
    end if;
    update public.email_mailboxes set name = btrim(p_name), all_inbox_users = coalesce(p_all_inbox_users, false), updated_at = now()
      where id = p_id returning * into b;
  end if;
  return b;
exception when unique_violation then raise exception 'That address (or its forwarding address) is already a mailbox';
end $$;

create function public.admin_set_mailbox_enabled(p_id uuid, p_enabled boolean)
returns public.email_mailboxes language plpgsql security definer set search_path = public as $$
declare b public.email_mailboxes;
begin
  if not public.is_admin() then raise exception 'Only administrators can manage mailboxes' using errcode = '42501'; end if;
  select * into strict b from public.email_mailboxes where id = p_id;
  if not p_enabled and b.is_default then raise exception 'Choose another default mailbox before disabling this one'; end if;
  update public.email_mailboxes set
    status = case when not p_enabled then 'disabled'
      when sending_verified_at is not null and receiving_verified_at is not null then 'active' else 'pending' end,
    status_detail = case when not p_enabled then 'Disabled by an administrator. Incoming mail goes to the default mailbox.'
      when sending_verified_at is not null and receiving_verified_at is not null then 'Re-enabled (previously verified).' else 'Verify Setup to activate.' end,
    updated_at = now() where id = p_id returning * into b;
  return b;
end $$;

create function public.admin_set_default_mailbox(p_id uuid)
returns public.email_mailboxes language plpgsql security definer set search_path = public as $$
declare b public.email_mailboxes;
begin
  if not public.is_admin() then raise exception 'Only administrators can manage mailboxes' using errcode = '42501'; end if;
  select * into strict b from public.email_mailboxes where id = p_id;
  if b.status <> 'active' then raise exception 'Only an active mailbox can be the default'; end if;
  update public.email_mailboxes set is_default = false, updated_at = now() where is_default and id <> p_id;
  update public.email_mailboxes set is_default = true, updated_at = now() where id = p_id returning * into b;
  return b;
end $$;

-- p_members: [{user_id, can_send}]. Replaces the mailbox's staff list.
create function public.admin_set_mailbox_members(p_id uuid, p_members jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Only administrators can manage mailboxes' using errcode = '42501'; end if;
  perform 1 from public.email_mailboxes where id = p_id;
  if not found then raise exception 'Mailbox not found'; end if;
  if jsonb_typeof(coalesce(p_members, '[]')) <> 'array' then raise exception 'Invalid staff list'; end if;
  delete from public.email_mailbox_members where mailbox_id = p_id;
  insert into public.email_mailbox_members(mailbox_id, user_id, can_send)
    select p_id, (x->>'user_id')::uuid, coalesce((x->>'can_send')::boolean, true)
    from jsonb_array_elements(coalesce(p_members, '[]')) x
    join public.profiles p on p.id = (x->>'user_id')::uuid and p.is_active
    on conflict do nothing;
end $$;

-- Staff an admin can assign, with whether they currently have Email Inbox access.
create function public.admin_mailbox_staff()
returns table(id uuid, full_name text, email text, role text, inbox_access boolean)
language sql stable security definer set search_path = public as $$
  select p.id, p.full_name, p.email, p.role,
    p.role in ('admin', 'editor') or exists (select 1 from public.employees e where e.user_id = p.id
      and e.allowed_modules->>'clients' = 'true' and e.allowed_modules->>'email-inbox' = 'true')
  from public.profiles p where public.is_admin() and p.is_active order by coalesce(p.full_name, p.email);
$$;
revoke all on function public.admin_save_mailbox(uuid, text, text, boolean), public.admin_set_mailbox_enabled(uuid, boolean),
  public.admin_set_default_mailbox(uuid), public.admin_set_mailbox_members(uuid, jsonb), public.admin_mailbox_staff() from public, anon;
grant execute on function public.admin_save_mailbox(uuid, text, text, boolean), public.admin_set_mailbox_enabled(uuid, boolean),
  public.admin_set_default_mailbox(uuid), public.admin_set_mailbox_members(uuid, jsonb), public.admin_mailbox_staff() to authenticated;

-- Inbound probe confirmation (service role, from resend-inbound). The probe
-- must arrive for the mailbox's own address or forwarding address.
create function public.confirm_mailbox_verification(p_token_hash text, p_recipients text[])
returns boolean language plpgsql security definer set search_path = public as $$
declare v public.email_mailbox_verifications; b public.email_mailboxes;
begin
  select * into v from public.email_mailbox_verifications where token_hash = p_token_hash and sent_at > now() - interval '1 day';
  if not found then return false; end if;
  -- Provider retries of the same probe stay consumed (never become a conversation).
  if v.confirmed_at is not null then return true; end if;
  select * into b from public.email_mailboxes where id = v.mailbox_id;
  if b.status = 'disabled' or not (b.address = any(p_recipients) or b.receiving_address = any(p_recipients)) then return false; end if;
  update public.email_mailbox_verifications set confirmed_at = now() where mailbox_id = v.mailbox_id;
  update public.email_mailboxes set receiving_verified_at = now(),
    status = case when sending_verified_at is not null then 'active' else status end,
    status_detail = case when sending_verified_at is not null then 'Verified: sending and receiving work.' else status_detail end,
    updated_at = now() where id = v.mailbox_id;
  return true;
end $$;
revoke all on function public.confirm_mailbox_verification(text, text[]) from public, anon, authenticated;
grant execute on function public.confirm_mailbox_verification(text, text[]) to service_role;

-- Mailboxes the caller can read, with send permission and unread counts.
create function public.inbox_my_mailboxes()
returns table(id uuid, name text, address text, status text, is_default boolean, can_send boolean, unread integer)
language sql stable security invoker set search_path = public as $$
  select b.id, b.name, b.address, b.status, b.is_default, public.can_send_mailbox(b.id),
    (select count(*)::integer from public.email_conversation_mailboxes cm join public.email_conversations c on c.id = cm.conversation_id
      where cm.mailbox_id = b.id and c.last_incoming_at is not null and c.last_incoming_at > coalesce(
        (select r.read_at from public.email_read_state r where r.conversation_id = c.id and r.user_id = auth.uid()), '-infinity'))
  from public.email_mailboxes b where public.can_read_mailbox(b.id)
  order by b.is_default desc, b.name;
$$;
revoke all on function public.inbox_my_mailboxes() from public, anon;
grant execute on function public.inbox_my_mailboxes() to authenticated;

-- ---------------------------------------------------------------------------
-- Inbound routing: managed mailboxes are matched from the provider's
-- recipient data (To, Cc, Bcc, received_for), never subject or sender. One
-- message, linked to every matched mailbox. Unmatched mail goes to the
-- default mailbox; disabled mailboxes are not matched.
-- ---------------------------------------------------------------------------
create or replace function public.accept_inbound_email(p_event text, p_email jsonb)
returns uuid language plpgsql security definer set search_path=public as $$
declare c uuid; existing uuid; tokens text[]; refs text[]; candidates uuid[]; recips text[]; boxes uuid[];
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
  select array_agg(lower(value) order by ord) into recips from jsonb_array_elements_text(coalesce(p_email->'recipients', '[]')) with ordinality r(value, ord);
  select array_agg(id order by pos) into boxes from (
    select b.id, min(r.pos) pos from unnest(coalesce(recips, '{}')) with ordinality r(a, pos)
    join public.email_mailboxes b on b.status <> 'disabled' and (b.address = r.a or b.receiving_address = r.a)
    group by b.id) m;
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
    insert into public.email_conversations(subject,participant_email,mailbox_id) values(p_email->>'subject',p_email->>'from',boxes[1]) returning id into c;
  end if;
  insert into public.email_conversation_mailboxes(conversation_id, mailbox_id) select c, unnest(coalesce(boxes, '{}')) on conflict do nothing;
  insert into public.email_messages(conversation_id,direction,from_email,to_email,cc_email,subject,body_text,headers,attachments,resend_id,rfc_message_id,status,mailbox_id)
    values(c,'incoming',p_email->>'from',p_email->>'to',nullif(p_email->>'cc',''),p_email->>'subject',p_email->>'text',p_email->'headers',p_email->'attachments',
      p_email->>'id',p_email->>'message_id','received',coalesce(boxes[1], (select mailbox_id from public.email_conversations where id = c)));
  update public.email_conversations set updated_at=clock_timestamp(),last_incoming_at=clock_timestamp() where id=c;
  insert into public.email_webhook_events(event_id,resend_id) values(p_event,p_email->>'id');
  return c;
end $$;

-- ---------------------------------------------------------------------------
-- Sending: From is a mailbox the caller may send from. New emails use
-- p_mailbox (default: default mailbox); replies default to the conversation's
-- mailbox (the one that received it). Thread Reply-To is unchanged.
-- ---------------------------------------------------------------------------
drop function if exists public.queue_inbox_message(uuid, uuid, uuid, text, text, text[], text[], jsonb);
create function public.queue_inbox_message(p_key uuid, p_contact uuid, p_conversation uuid, p_subject text, p_body text,
  p_cc text[] default null, p_bcc text[] default null, p_attachments jsonb default null, p_mailbox uuid default null)
returns public.email_messages language plpgsql security definer set search_path = public as $$
declare c public.email_conversations; m public.email_messages; recipient text; a text; box public.email_mailboxes;
  sender_full text; sender_addr text; mode text; auto_copy text[]; final_cc text[]; final_bcc text[];
  checked boolean := p_cc is not null or p_bcc is not null;
  sorted text[]; shown text[]; files jsonb := '[]'; item jsonb; obj storage.objects; total bigint := 0; fname text;
begin
  if not public.can_use_email_inbox() then raise exception 'Inbox access denied' using errcode = '42501'; end if;
  if p_key is null or length(btrim(p_body)) not between 1 and 50000 then raise exception 'Message is required (maximum 50000 characters)'; end if;
  if coalesce(cardinality(p_cc), 0) > 20 or coalesce(cardinality(p_bcc), 0) > 20 then raise exception 'Too many recipients (maximum 20 CC and 20 BCC)'; end if;
  foreach a in array coalesce(p_cc, '{}') || coalesce(p_bcc, '{}') loop
    if lower(btrim(a)) !~ '^[^[:space:]<>,;@]+@[^[:space:]<>,;@]+\.[^[:space:]<>,;@]+$' then raise exception 'Invalid recipient address: %', left(a, 100); end if;
  end loop;
  if p_attachments is not null and (jsonb_typeof(p_attachments) <> 'array' or jsonb_array_length(p_attachments) > 5) then
    raise exception 'Attachments: maximum 5 files'; end if;
  for item in select * from jsonb_array_elements(coalesce(p_attachments, '[]')) loop
    if item->>'path' is null or item->>'path' !~ ('^outgoing/' || auth.uid()::text || '/' || p_key::text || '/[^/]+$') then
      raise exception 'Invalid attachment'; end if;
    select * into obj from storage.objects where bucket_id = 'email-attachments' and name = item->>'path';
    if not found then raise exception 'Attachment upload not found. Attach the file again.'; end if;
    fname := left(regexp_replace(coalesce(nullif(btrim(item->>'filename'), ''), 'attachment'), '[[:cntrl:]/\\"]', '_', 'g'), 200);
    if public.inbox_blocked_attachment(fname) then raise exception 'This file type cannot be emailed: %', fname; end if;
    total := total + coalesce((obj.metadata->>'size')::bigint, 0);
    files := files || jsonb_build_object('path', obj.name, 'filename', fname,
      'content_type', obj.metadata->>'mimetype', 'size', coalesce((obj.metadata->>'size')::bigint, 0));
  end loop;
  if total > 10485760 then raise exception 'Attachments are limited to 10 MB in total'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_key::text, 0));
  select * into m from public.email_messages where request_key = p_key;
  if found then
    if m.sender_user_id <> auth.uid() or m.body_text <> p_body or (p_conversation is not null and m.conversation_id <> p_conversation)
      or (p_mailbox is not null and m.mailbox_id is distinct from p_mailbox)
      or (checked and (
        (select array_agg(x order by x) from unnest(public.inbox_unique_addresses(p_cc, '{}')) x) is distinct from
        (select array_agg(x order by x) from unnest(string_to_array(m.cc_email, ', ')) x)
        or (select array_agg(x order by x) from unnest(public.inbox_unique_addresses(p_bcc, '{}')) x) is distinct from
        (select array_agg(x order by x) from unnest(string_to_array(m.bcc_email, ', ')) x)))
      or (select coalesce(array_agg(f->>'path' order by f->>'path'), '{}') from jsonb_array_elements(files) f) is distinct from
        (select coalesce(array_agg(f->>'path' order by f->>'path'), '{}') from jsonb_array_elements(coalesce(m.attachments, '[]')) f)
    then raise exception 'Request key already used'; end if;
    return m;
  end if;
  if p_conversation is not null then
    -- Security definer bypasses RLS: check mailbox read access explicitly.
    if not public.can_read_conversation(p_conversation) then raise exception 'Conversation not found' using errcode = '42501'; end if;
    select * into strict c from public.email_conversations where id = p_conversation;
    select * into box from public.email_mailboxes where id = coalesce(p_mailbox, c.mailbox_id);
  else
    if length(btrim(p_subject)) not between 1 and 200 or p_subject ~ E'[\r\n]' then raise exception 'A valid subject is required'; end if;
    select email into recipient from public.contacts where id = p_contact;
    if recipient is null or recipient !~ '^[^[:space:]<>,;@]+@[^[:space:]<>,;@]+\.[^[:space:]<>,;@]+$' then raise exception 'Select a lead with a valid email'; end if;
    select * into box from public.email_mailboxes where id = coalesce(p_mailbox, (select id from public.email_mailboxes where is_default));
  end if;
  if box.id is null or not public.can_send_mailbox(box.id) then
    raise exception 'You cannot send from this mailbox (no permission, or it is not active)' using errcode = '42501'; end if;
  select nullif(btrim(full_name), '') into sender_full from public.profiles where id = auth.uid();
  select lower(btrim(email)) into sender_addr from auth.users where id = auth.uid();
  if sender_addr !~ '^[^[:space:]<>,;@]+@[^[:space:]<>,;@]+\.[^[:space:]<>,;@]+$' then sender_addr := null; end if;
  select coalesce(inbox_sender_copy, 'cc') into mode from public.email_settings where id = 1;
  mode := coalesce(mode, 'cc');
  recipient := lower(coalesce(c.participant_email, recipient));
  auto_copy := case when mode <> 'off' and sender_addr is not null then array[sender_addr] else '{}' end;
  final_cc := public.inbox_unique_addresses((case when mode = 'cc' then auto_copy else '{}' end) || coalesce(p_cc, '{}'), array[recipient]);
  final_bcc := public.inbox_unique_addresses((case when mode = 'bcc' then auto_copy else '{}' end) || coalesce(p_bcc, '{}'), array[recipient] || final_cc);
  if checked then
    select array_agg(x order by x) into sorted from unnest(final_cc) x;
    select array_agg(x order by x) into shown from unnest(public.inbox_unique_addresses(p_cc, '{}')) x;
    if sorted is distinct from shown then raise exception 'Recipients changed. Review the recipients and send again.'; end if;
    select array_agg(x order by x) into sorted from unnest(final_bcc) x;
    select array_agg(x order by x) into shown from unnest(public.inbox_unique_addresses(p_bcc, '{}')) x;
    if sorted is distinct from shown then raise exception 'Recipients changed. Review the recipients and send again.'; end if;
  end if;
  if p_conversation is null then
    insert into public.email_conversations(contact_id, subject, participant_email, mailbox_id)
      values(p_contact, btrim(p_subject), recipient, box.id) returning * into c;
  else
    -- Replying from another mailbox also files the thread under it.
    insert into public.email_conversation_mailboxes(conversation_id, mailbox_id) values (c.id, box.id) on conflict do nothing;
  end if;
  insert into public.email_messages(conversation_id,direction,from_email,from_name,mailbox_id,to_email,subject,body_text,request_key,
      sender_user_id,sender_name,sender_email,copy_mode,cc_email,bcc_email,attachments)
    values(c.id,'outgoing',box.address,box.name,box.id,c.participant_email,
      case when p_conversation is null or c.subject ~* '^re:' then c.subject else 'Re: ' || c.subject end,
      p_body,p_key,auth.uid(),sender_full,sender_addr,mode,
      nullif(array_to_string(final_cc, ', '), ''), nullif(array_to_string(final_bcc, ', '), ''), files) returning * into m;
  update public.email_conversations set updated_at=now(),last_outgoing_at=now() where id=c.id;
  return m;
end $$;
revoke all on function public.queue_inbox_message(uuid,uuid,uuid,text,text,text[],text[],jsonb,uuid) from public, anon;
grant execute on function public.queue_inbox_message(uuid,uuid,uuid,text,text,text[],text[],jsonb,uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- List/search/counts: add the mailbox filter (RLS already limits rows to
-- readable mailboxes, so search and counts never reveal other mailboxes).
-- ---------------------------------------------------------------------------
drop function if exists public.inbox_list(text, text, uuid, integer, integer);
create function public.inbox_list(p_folder text, p_query text default null, p_contact uuid default null,
  p_offset integer default 0, p_limit integer default 50, p_mailbox uuid default null)
returns table(id uuid, subject text, participant_email text, contact_id uuid, contact_name text, updated_at timestamptz,
  last_incoming_at timestamptz, last_outgoing_at timestamptz, unread boolean, message_count integer,
  last_direction text, last_preview text, last_sender text, has_attachments boolean, mailbox_id uuid, mailbox_name text, total_count bigint)
language sql stable security invoker set search_path = public as $$
  with q as (
    select case when nullif(btrim(p_query), '') is null then null
      else '%' || replace(replace(replace(left(btrim(p_query), 200), '\', '\\'), '%', '\%'), '_', '\_') || '%' end as pattern
  ), base as (
    select c.*, k.name as contact_name, b.name as box_name,
      c.last_incoming_at is not null and c.last_incoming_at > coalesce(
        (select r.read_at from public.email_read_state r where r.conversation_id = c.id and r.user_id = auth.uid()), '-infinity') as unread
    from public.email_conversations c
    left join public.contacts k on k.id = c.contact_id
    left join public.email_mailboxes b on b.id = c.mailbox_id
    cross join q
    where public.can_use_email_inbox()
      and (p_mailbox is null or exists (select 1 from public.email_conversation_mailboxes cm where cm.conversation_id = c.id and cm.mailbox_id = p_mailbox))
      and case coalesce(p_folder, 'inbox')
        when 'inbox' then c.last_incoming_at is not null
        when 'sent' then c.last_outgoing_at is not null
        when 'unassigned' then c.contact_id is null
        else true end
      and (p_contact is null or c.contact_id = p_contact)
      and (q.pattern is null or c.subject ilike q.pattern or c.participant_email ilike q.pattern or k.name ilike q.pattern
        or exists (select 1 from public.email_messages m where m.conversation_id = c.id
          and (m.body_text ilike q.pattern or m.subject ilike q.pattern or m.from_email ilike q.pattern
            or m.to_email ilike q.pattern or m.cc_email ilike q.pattern)))
  )
  select b.id, b.subject, b.participant_email, b.contact_id, b.contact_name, b.updated_at, b.last_incoming_at, b.last_outgoing_at,
    b.unread, s.n::integer, l.direction, l.preview, l.sender, s.files, b.mailbox_id, b.box_name, count(*) over ()
  from base b
  left join lateral (
    select m.direction, left(regexp_replace(m.body_text, '\s+', ' ', 'g'), 160) as preview,
      case when m.direction = 'incoming' then m.from_email when m.outbox_id is not null then 'Airfair auto-reply'
        else coalesce(m.sender_name, m.sender_email, 'Unknown staff') end as sender
    from public.email_messages m where m.conversation_id = b.id order by m.created_at desc, m.id desc limit 1
  ) l on true
  left join lateral (
    select count(*) as n, bool_or(jsonb_array_length(coalesce(m.attachments, '[]')) > 0) as files
    from public.email_messages m where m.conversation_id = b.id
  ) s on true
  order by b.updated_at desc, b.id
  offset greatest(coalesce(p_offset, 0), 0) limit least(greatest(coalesce(p_limit, 50), 1), 100);
$$;
revoke all on function public.inbox_list(text, text, uuid, integer, integer, uuid) from public, anon;
grant execute on function public.inbox_list(text, text, uuid, integer, integer, uuid) to authenticated;

drop function if exists public.inbox_folder_counts();
create function public.inbox_folder_counts(p_mailbox uuid default null) returns jsonb
language sql stable security invoker set search_path = public as $$
  select jsonb_build_object(
    'inbox_unread', count(*) filter (where unread),
    'unassigned_unread', count(*) filter (where unread and contact_id is null),
    'unassigned', count(*) filter (where contact_id is null))
  from (
    select c.contact_id, c.last_incoming_at is not null and c.last_incoming_at > coalesce(
      (select r.read_at from public.email_read_state r where r.conversation_id = c.id and r.user_id = auth.uid()), '-infinity') as unread
    from public.email_conversations c where public.can_use_email_inbox()
      and (p_mailbox is null or exists (select 1 from public.email_conversation_mailboxes cm where cm.conversation_id = c.id and cm.mailbox_id = p_mailbox))
  ) x;
$$;
revoke all on function public.inbox_folder_counts(uuid) from public, anon;
grant execute on function public.inbox_folder_counts(uuid) to authenticated;
