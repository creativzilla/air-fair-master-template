-- Mailbox view: folder lists with previews/unread state, folder unread counts,
-- server-side search, and outgoing attachments for manual inbox emails.
-- Additive. Everything runs as the caller (RLS + can_use_email_inbox) except
-- the queue function, which already enforced the same checks.

-- ---------------------------------------------------------------------------
-- List + search. Folders: inbox (has incoming), sent (has outgoing),
-- unassigned (no lead), all. Unread = newer incoming than the caller's read state.
-- ---------------------------------------------------------------------------
create or replace function public.inbox_list(p_folder text, p_query text default null, p_contact uuid default null,
  p_offset integer default 0, p_limit integer default 50)
returns table(id uuid, subject text, participant_email text, contact_id uuid, contact_name text, updated_at timestamptz,
  last_incoming_at timestamptz, last_outgoing_at timestamptz, unread boolean, message_count integer,
  last_direction text, last_preview text, last_sender text, has_attachments boolean, total_count bigint)
language sql stable security invoker set search_path = public as $$
  with q as (
    select case when nullif(btrim(p_query), '') is null then null
      else '%' || replace(replace(replace(left(btrim(p_query), 200), '\', '\\'), '%', '\%'), '_', '\_') || '%' end as pattern
  ), base as (
    select c.*, k.name as contact_name,
      c.last_incoming_at is not null and c.last_incoming_at > coalesce(
        (select r.read_at from public.email_read_state r where r.conversation_id = c.id and r.user_id = auth.uid()), '-infinity') as unread
    from public.email_conversations c
    left join public.contacts k on k.id = c.contact_id
    cross join q
    where public.can_use_email_inbox()
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
    b.unread, s.n::integer, l.direction, l.preview, l.sender, s.files, count(*) over ()
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
revoke all on function public.inbox_list(text, text, uuid, integer, integer) from public, anon;
grant execute on function public.inbox_list(text, text, uuid, integer, integer) to authenticated;

create or replace function public.inbox_folder_counts() returns jsonb
language sql stable security invoker set search_path = public as $$
  select jsonb_build_object(
    'inbox_unread', count(*) filter (where unread),
    'unassigned_unread', count(*) filter (where unread and contact_id is null),
    'unassigned', count(*) filter (where contact_id is null))
  from (
    select c.contact_id, c.last_incoming_at is not null and c.last_incoming_at > coalesce(
      (select r.read_at from public.email_read_state r where r.conversation_id = c.id and r.user_id = auth.uid()), '-infinity') as unread
    from public.email_conversations c where public.can_use_email_inbox()
  ) x;
$$;
revoke all on function public.inbox_folder_counts() from public, anon;
grant execute on function public.inbox_folder_counts() to authenticated;

-- ---------------------------------------------------------------------------
-- Outgoing attachments. Private bucket; staff upload only under
-- outgoing/<their user id>/; nobody can overwrite or delete through the API,
-- so a saved email's files are immutable for retries.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit)
values ('email-attachments', 'email-attachments', false, 10485760)
on conflict (id) do nothing;

drop policy if exists "email_attachments_inbox_read" on storage.objects;
create policy "email_attachments_inbox_read" on storage.objects
  for select to authenticated using (bucket_id = 'email-attachments' and public.can_use_email_inbox());
drop policy if exists "email_attachments_own_upload" on storage.objects;
create policy "email_attachments_own_upload" on storage.objects
  for insert to authenticated with check (bucket_id = 'email-attachments' and public.can_use_email_inbox()
    and (storage.foldername(name))[1] = 'outgoing' and (storage.foldername(name))[2] = auth.uid()::text);

-- Resend refuses executable/script attachments; refuse them before saving.
create or replace function public.inbox_blocked_attachment(p_filename text) returns boolean
language sql immutable set search_path = public as $$
  select lower(coalesce(substring(p_filename from '\.([A-Za-z0-9]+)$'), '')) = any(array[
    'adp','app','asp','bas','bat','cer','chm','cmd','com','cpl','crt','csh','der','exe','fxp','gadget','hlp','hta','inf','ins',
    'isp','its','js','jse','ksh','lib','lnk','mad','maf','mag','mam','maq','mar','mas','mat','mau','mav','maw','mda','mdb','mde',
    'mdt','mdw','mdz','msc','msh','msi','msp','mst','ops','pcd','pif','plg','prf','prg','ps1','reg','scf','scr','sct','shb','shs',
    'sys','tmp','url','vb','vbe','vbs','vps','vsmacros','vss','vst','vsw','vxd','ws','wsc','wsf','wsh','xnk']);
$$;

-- Adds p_attachments: [{path, filename}] uploaded under outgoing/<uid>/<request key>/.
-- Sizes and types are read from storage, not the request. Stored as
-- attachments [{path, filename, content_type, size}] and frozen for retries.
drop function if exists public.queue_inbox_message(uuid, uuid, uuid, text, text, text[], text[]);
create function public.queue_inbox_message(p_key uuid, p_contact uuid, p_conversation uuid, p_subject text, p_body text,
  p_cc text[] default null, p_bcc text[] default null, p_attachments jsonb default null)
returns public.email_messages language plpgsql security definer set search_path = public as $$
declare c public.email_conversations; m public.email_messages; recipient text; a text;
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
    select * into strict c from public.email_conversations where id = p_conversation;
  else
    if length(btrim(p_subject)) not between 1 and 200 or p_subject ~ E'[\r\n]' then raise exception 'A valid subject is required'; end if;
    select email into recipient from public.contacts where id = p_contact;
    if recipient is null or recipient !~ '^[^[:space:]<>,;@]+@[^[:space:]<>,;@]+\.[^[:space:]<>,;@]+$' then raise exception 'Select a lead with a valid email'; end if;
  end if;
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
    insert into public.email_conversations(contact_id, subject, participant_email)
      values(p_contact, btrim(p_subject), recipient) returning * into c;
  end if;
  insert into public.email_messages(conversation_id,direction,from_email,to_email,subject,body_text,request_key,
      sender_user_id,sender_name,sender_email,copy_mode,cc_email,bcc_email,attachments)
    values(c.id,'outgoing','no-reply@airfairtravel.com',c.participant_email,
      case when p_conversation is null or c.subject ~* '^re:' then c.subject else 'Re: ' || c.subject end,
      p_body,p_key,auth.uid(),sender_full,sender_addr,mode,
      nullif(array_to_string(final_cc, ', '), ''), nullif(array_to_string(final_bcc, ', '), ''), files) returning * into m;
  update public.email_conversations set updated_at=now(),last_outgoing_at=now() where id=c.id;
  return m;
end $$;
revoke all on function public.queue_inbox_message(uuid,uuid,uuid,text,text,text[],text[],jsonb) from public, anon;
grant execute on function public.queue_inbox_message(uuid,uuid,uuid,text,text,text[],text[],jsonb) to authenticated;
