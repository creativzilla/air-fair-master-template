-- Compose/Reply recipients: manual CC/BCC plus the server-enforced sender copy.
-- The dashboard shows the final recipients before sending; the server computes
-- them the same way and refuses (before saving anything) if they differ.

-- Lower-cased, trimmed, first occurrence kept in order, `p_exclude` removed.
create or replace function public.inbox_unique_addresses(p_list text[], p_exclude text[]) returns text[]
language sql immutable set search_path = public as $$
  select coalesce(array_agg(a order by pos), '{}') from (
    select lower(btrim(x)) a, min(pos) pos from unnest(coalesce(p_list, '{}')) with ordinality u(x, pos)
    where nullif(btrim(x), '') is not null and lower(btrim(x)) <> all(coalesce(p_exclude, '{}'))
    group by lower(btrim(x))) s;
$$;

-- What Compose/Reply prefill: the caller's own registered email and the copy
-- mode. Read-only; inbox users only (staff cannot read email_settings itself).
create or replace function public.inbox_compose_defaults() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare mode text; addr text; test boolean;
begin
  if not public.can_use_email_inbox() then raise exception 'Inbox access denied' using errcode = '42501'; end if;
  select coalesce(inbox_sender_copy, 'cc'), test_redirect_to is not null into mode, test from public.email_settings where id = 1;
  select lower(btrim(email)) into addr from auth.users where id = auth.uid();
  if addr !~ '^[^[:space:]<>,;@]+@[^[:space:]<>,;@]+\.[^[:space:]<>,;@]+$' then addr := null; end if;
  return jsonb_build_object('copy_mode', coalesce(mode, 'cc'), 'sender_email', addr, 'test_mode', coalesce(test, false));
end $$;
revoke all on function public.inbox_compose_defaults() from public, anon;
grant execute on function public.inbox_compose_defaults() to authenticated;

-- New optional p_cc/p_bcc. Called without them (older dashboard), behaviour is
-- unchanged: only the automatic sender copy. Called with them, they are the
-- final lists shown to the sender, and must equal what the server computes.
drop function if exists public.queue_inbox_message(uuid, uuid, uuid, text, text);
create function public.queue_inbox_message(p_key uuid, p_contact uuid, p_conversation uuid, p_subject text, p_body text,
  p_cc text[] default null, p_bcc text[] default null)
returns public.email_messages language plpgsql security definer set search_path = public as $$
declare c public.email_conversations; m public.email_messages; recipient text; a text;
  sender_full text; sender_addr text; mode text; auto_copy text[]; final_cc text[]; final_bcc text[];
  checked boolean := p_cc is not null or p_bcc is not null;
  sorted text[]; shown text[];
begin
  if not public.can_use_email_inbox() then raise exception 'Inbox access denied' using errcode = '42501'; end if;
  if p_key is null or length(btrim(p_body)) not between 1 and 50000 then raise exception 'Message is required (maximum 50000 characters)'; end if;
  if coalesce(cardinality(p_cc), 0) > 20 or coalesce(cardinality(p_bcc), 0) > 20 then raise exception 'Too many recipients (maximum 20 CC and 20 BCC)'; end if;
  foreach a in array coalesce(p_cc, '{}') || coalesce(p_bcc, '{}') loop
    if lower(btrim(a)) !~ '^[^[:space:]<>,;@]+@[^[:space:]<>,;@]+\.[^[:space:]<>,;@]+$' then raise exception 'Invalid recipient address: %', left(a, 100); end if;
  end loop;
  perform pg_advisory_xact_lock(hashtextextended(p_key::text, 0));
  select * into m from public.email_messages where request_key = p_key;
  if found then
    if m.sender_user_id <> auth.uid() or m.body_text <> p_body or (p_conversation is not null and m.conversation_id <> p_conversation)
      or (checked and (
        (select array_agg(x order by x) from unnest(public.inbox_unique_addresses(p_cc, '{}')) x) is distinct from
        (select array_agg(x order by x) from unnest(string_to_array(m.cc_email, ', ')) x)
        or (select array_agg(x order by x) from unnest(public.inbox_unique_addresses(p_bcc, '{}')) x) is distinct from
        (select array_agg(x order by x) from unnest(string_to_array(m.bcc_email, ', ')) x)))
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
  -- Same rules as the dashboard preview and the send payload.
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
      sender_user_id,sender_name,sender_email,copy_mode,cc_email,bcc_email)
    values(c.id,'outgoing','no-reply@airfairtravel.com',c.participant_email,
      case when p_conversation is null or c.subject ~* '^re:' then c.subject else 'Re: ' || c.subject end,
      p_body,p_key,auth.uid(),sender_full,sender_addr,mode,
      nullif(array_to_string(final_cc, ', '), ''), nullif(array_to_string(final_bcc, ', '), '')) returning * into m;
  update public.email_conversations set updated_at=now(),last_outgoing_at=now() where id=c.id;
  return m;
end $$;
revoke all on function public.queue_inbox_message(uuid,uuid,uuid,text,text,text[],text[]) from public, anon;
grant execute on function public.queue_inbox_message(uuid,uuid,uuid,text,text,text[],text[]) to authenticated;
