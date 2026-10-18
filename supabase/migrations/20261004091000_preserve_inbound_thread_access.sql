-- Inbound recipients must not grant access to an existing conversation.
-- CREATE OR REPLACE preserves the existing service-role-only execution grant.
create or replace function public.accept_inbound_email(p_event text, p_email jsonb)
returns uuid language plpgsql security definer set search_path=public as $$
declare c uuid; existing uuid; tokens text[]; refs text[]; candidates uuid[]; recips text[]; boxes uuid[]; receiving_box uuid;
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
    -- Recipients establish visibility only when the conversation is first created.
    insert into public.email_conversation_mailboxes(conversation_id, mailbox_id) select c, unnest(coalesce(boxes, '{}')) on conflict do nothing;
  end if;
  -- A reply cannot add readers to history or select an unrelated sending mailbox.
  select cm.mailbox_id into receiving_box from public.email_conversation_mailboxes cm
    where cm.conversation_id = c and cm.mailbox_id = any(coalesce(boxes, '{}'))
    order by array_position(boxes, cm.mailbox_id) limit 1;
  insert into public.email_messages(conversation_id,direction,from_email,to_email,cc_email,subject,body_text,headers,attachments,resend_id,rfc_message_id,status,mailbox_id)
    values(c,'incoming',p_email->>'from',p_email->>'to',nullif(p_email->>'cc',''),p_email->>'subject',p_email->>'text',p_email->'headers',p_email->'attachments',
      p_email->>'id',p_email->>'message_id','received',coalesce(receiving_box, (select mailbox_id from public.email_conversations where id = c)));
  update public.email_conversations set updated_at=clock_timestamp(),last_incoming_at=clock_timestamp() where id=c;
  insert into public.email_webhook_events(event_id,resend_id) values(p_event,p_email->>'id');
  return c;
end $$;
