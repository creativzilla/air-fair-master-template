-- Send-only mailboxes (e.g. admin@airfairtravel.com, the Google Workspace staff
-- inbox): usable as From in Email Inbox and bulk email once Verify Setup proves
-- Resend sends from the address. Mail sent directly to the address stays in
-- Google Workspace (no forwarding); replies to dashboard emails still return
-- through the thread / reply.airfairtravel.com addresses.
alter table public.email_mailboxes add column if not exists send_only boolean not null default false;

drop function if exists public.admin_save_mailbox(uuid, text, text, boolean);
create function public.admin_save_mailbox(p_id uuid, p_name text, p_address text, p_all_inbox_users boolean default false, p_send_only boolean default false)
returns public.email_mailboxes language plpgsql security definer set search_path = public as $$
declare b public.email_mailboxes; addr text := lower(btrim(p_address)); local text;
begin
  if not public.is_admin() then raise exception 'Only administrators can manage mailboxes' using errcode = '42501'; end if;
  if addr !~ '^[a-z0-9._+-]+@airfairtravel\.com$' then raise exception 'Use an @airfairtravel.com address (letters, numbers, . _ + -)'; end if;
  local := split_part(addr, '@', 1);
  if local ~ '^(t-|thread-)' then raise exception 'Addresses starting with t- or thread- are reserved for reply threads'; end if;
  if p_id is null then
    insert into public.email_mailboxes(name, address, receiving_address, all_inbox_users, send_only, status, status_detail)
      values (btrim(p_name), addr, local || '@reply.airfairtravel.com', coalesce(p_all_inbox_users, false), coalesce(p_send_only, false), 'pending',
        case when p_send_only then 'Send-only: click Verify Setup.' else 'Set up forwarding in Google Workspace, then Verify Setup.' end) returning * into b;
  else
    select * into strict b from public.email_mailboxes where id = p_id;
    if b.address <> addr then
      if b.is_default then raise exception 'Change the default mailbox before changing its address'; end if;
      update public.email_mailboxes set address = addr, receiving_address = local || '@reply.airfairtravel.com',
        status = case when status = 'disabled' then 'disabled' else 'pending' end, status_detail = 'Address changed. Verify Setup again.',
        sending_verified_at = null, receiving_verified_at = null, updated_at = now() where id = p_id;
      delete from public.email_mailbox_verifications where mailbox_id = p_id;
    end if;
    update public.email_mailboxes set name = btrim(p_name), all_inbox_users = coalesce(p_all_inbox_users, false), send_only = coalesce(p_send_only, false),
      -- Switching mode re-evaluates Active: full mailboxes also need receiving proven.
      status = case when status = 'disabled' then 'disabled'
        when sending_verified_at is not null and (coalesce(p_send_only, false) or receiving_verified_at is not null) then 'active'
        when status = 'active' then 'pending' else status end,
      updated_at = now()
      where id = p_id returning * into b;
  end if;
  return b;
exception when unique_violation then raise exception 'That address (or its forwarding address) is already a mailbox';
end $$;
revoke all on function public.admin_save_mailbox(uuid, text, text, boolean, boolean) from public, anon;
grant execute on function public.admin_save_mailbox(uuid, text, text, boolean, boolean) to authenticated;

create or replace function public.admin_set_mailbox_enabled(p_id uuid, p_enabled boolean)
returns public.email_mailboxes language plpgsql security definer set search_path = public as $$
declare b public.email_mailboxes;
begin
  if not public.is_admin() then raise exception 'Only administrators can manage mailboxes' using errcode = '42501'; end if;
  select * into strict b from public.email_mailboxes where id = p_id;
  if not p_enabled and b.is_default then raise exception 'Choose another default mailbox before disabling this one'; end if;
  update public.email_mailboxes set
    status = case when not p_enabled then 'disabled'
      when sending_verified_at is not null and (send_only or receiving_verified_at is not null) then 'active' else 'pending' end,
    status_detail = case when not p_enabled then 'Disabled by an administrator. Incoming mail goes to the default mailbox.'
      when sending_verified_at is not null and (send_only or receiving_verified_at is not null) then 'Re-enabled (previously verified).' else 'Verify Setup to activate.' end,
    updated_at = now() where id = p_id returning * into b;
  return b;
end $$;

-- admin@airfairtravel.com as a send-only mailbox, pending until Verify Setup.
insert into public.email_mailboxes(name, address, receiving_address, all_inbox_users, send_only, status, status_detail, created_by)
values ('Air Fair Admin', 'admin@airfairtravel.com', 'admin@reply.airfairtravel.com', false, true, 'pending', 'Send-only: click Verify Setup.', null)
on conflict (address) do nothing;
