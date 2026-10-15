-- Website inquiries appear in the Email Inbox as incoming messages.
-- Before: a form submission only produced the outgoing auto-reply in the
-- dashboard, so the conversation was "Sent" only — not in Inbox, never unread.
-- Now the inquiry itself (the staff notification's formatted details) is stored
-- as an incoming message from the client, so it lands in Inbox, unread for
-- every user who can read the mailbox, and replies go to the client in that
-- thread. Runs for every staff notification row, even when sending is off or
-- the client auto-reply is disabled. Email sending is unchanged.

create or replace function public.mirror_form_inquiry() returns trigger
language plpgsql security definer set search_path = public as $$
declare sub record; conv uuid; lead uuid;
begin
  if new.kind <> 'staff_notification' or new.submission_id is null then return null; end if;
  select id, lower(btrim(email)) as email, created_at into sub from public.form_submissions where id = new.submission_id;
  if sub.id is null or coalesce(sub.email, '') !~ '^[^[:space:]<>,;@]+@[^[:space:]<>,;@]+\.[^[:space:]<>,;@]+$' then return null; end if;
  select id into lead from public.contacts where submission_id = new.submission_id order by created_at limit 1;
  -- Usually already created (client auto-reply trigger); otherwise create it here.
  insert into public.email_conversations(contact_id, submission_id, subject, participant_email)
    values (lead, new.submission_id, left(regexp_replace(coalesce(new.subject, 'Website inquiry'), '^\[TEST\] ', ''), 998), sub.email)
    on conflict (submission_id) do nothing;
  select id into conv from public.email_conversations where submission_id = new.submission_id;
  if exists (select 1 from public.email_messages where conversation_id = conv and direction = 'incoming'
    and headers->>'x-airfair-form-submission' = new.submission_id::text) then return null; end if;
  insert into public.email_messages(conversation_id, direction, from_email, to_email, subject, body_text, headers, status, created_at)
    values (conv, 'incoming', sub.email, coalesce(new.to_email, ''), coalesce(new.subject, 'Website inquiry'),
      coalesce(nullif(new.body_text, ''), 'New website inquiry.'),
      jsonb_build_object('x-airfair-source', 'website-form', 'x-airfair-form-submission', new.submission_id::text),
      'received', coalesce(sub.created_at, now()));
  update public.email_conversations set last_incoming_at = greatest(coalesce(last_incoming_at, '-infinity'), coalesce(sub.created_at, now())),
    updated_at = greatest(updated_at, now()) where id = conv;
  return null;
end $$;
revoke all on function public.mirror_form_inquiry() from public, anon, authenticated;

-- AFTER INSERT: only rows actually inserted (duplicate submissions upsert
-- with ON CONFLICT DO NOTHING and never fire it).
drop trigger if exists inbox_form_inquiry on public.email_outbox;
create trigger inbox_form_inquiry after insert on public.email_outbox
  for each row execute function public.mirror_form_inquiry();

-- Backfill: inquiries whose dashboard conversation already exists (created by
-- the auto-reply since the inbox launched). Older submissions are not imported.
insert into public.email_messages(conversation_id, direction, from_email, to_email, subject, body_text, headers, status, created_at)
select c.id, 'incoming', lower(btrim(s.email)), coalesce(o.to_email, ''), coalesce(o.subject, 'Website inquiry'),
  coalesce(nullif(o.body_text, ''), 'New website inquiry.'),
  jsonb_build_object('x-airfair-source', 'website-form', 'x-airfair-form-submission', o.submission_id::text), 'received', s.created_at
from public.email_outbox o
join public.form_submissions s on s.id = o.submission_id
join public.email_conversations c on c.submission_id = o.submission_id
where o.kind = 'staff_notification'
  and lower(btrim(s.email)) ~ '^[^[:space:]<>,;@]+@[^[:space:]<>,;@]+\.[^[:space:]<>,;@]+$'
  and not exists (select 1 from public.email_messages m where m.conversation_id = c.id and m.direction = 'incoming'
    and m.headers->>'x-airfair-form-submission' = o.submission_id::text);
update public.email_conversations c set last_incoming_at = greatest(coalesce(c.last_incoming_at, '-infinity'), s.created_at)
from public.form_submissions s
where s.id = c.submission_id and exists (select 1 from public.email_messages m where m.conversation_id = c.id
  and m.headers->>'x-airfair-source' = 'website-form');
