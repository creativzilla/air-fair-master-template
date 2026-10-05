-- Client tags: admins and team members label clients (e.g. Inquiry only,
-- Nurturing, Lost) and filter the Clients list by tag. Tags describe the
-- lead's situation; pipeline stages stay as they are.

create table public.client_tags (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 40 and name !~ '[\r\n]'),
  color text not null default 'gray' check (color in ('gray','green','blue','amber','red','purple','teal','pink')),
  description text check (description is null or length(description) <= 200),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null default auth.uid()
);
create unique index client_tags_name_key on public.client_tags (lower(btrim(name)));

create table public.contact_tags (
  contact_id uuid not null references public.contacts(id) on delete cascade,
  tag_id uuid not null references public.client_tags(id) on delete cascade,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  primary key (contact_id, tag_id)
);
create index contact_tags_tag on public.contact_tags(tag_id);

insert into public.client_tags (name, color, description, sort_order, created_by) values
  ('Inquiry only',      'gray',   'Asking questions, no commitment yet', 10, null),
  ('Hot lead',          'red',    'Ready to proceed soon', 20, null),
  ('Nurturing',         'teal',   'Interested but not ready; keep in touch', 30, null),
  ('Follow-up needed',  'amber',  'Waiting on us to call, message or send something', 40, null),
  ('Awaiting documents','blue',   'Waiting on the client''s papers or requirements', 50, null),
  ('Unresponsive',      'gray',   'No reply after several follow-ups', 60, null),
  ('Lost',              'red',    'Chose someone else or decided not to proceed', 70, null),
  ('Price-sensitive',   'amber',  'Budget is the main concern', 80, null),
  ('Referral',          'purple', 'Came from a referral', 90, null),
  ('Returning client',  'green',  'Has worked with Air Fair before', 100, null),
  ('VIP',               'pink',   'Priority client', 110, null),
  ('Do not contact',    'red',    'Asked not to be contacted', 120, null);

-- Same people who work with clients read and apply tags; people with the
-- Clients section create and edit tags; deleting a tag (removes it from every
-- client) is for admins.
alter table public.client_tags enable row level security;
alter table public.contact_tags enable row level security;
create policy client_tags_team_read on public.client_tags for select to authenticated using (public.is_team());
create policy client_tags_clients_insert on public.client_tags for insert to authenticated with check (public.is_team() and public.has_section('clients'));
create policy client_tags_clients_update on public.client_tags for update to authenticated
  using (public.is_team() and public.has_section('clients')) with check (public.is_team() and public.has_section('clients'));
create policy client_tags_admin_delete on public.client_tags for delete to authenticated using (public.is_admin());
create policy contact_tags_team_read on public.contact_tags for select to authenticated using (public.is_team());
create policy contact_tags_team_insert on public.contact_tags for insert to authenticated with check (public.is_team());
create policy contact_tags_team_delete on public.contact_tags for delete to authenticated using (public.is_team());
revoke all on public.client_tags, public.contact_tags from anon, authenticated;
grant select, insert, update, delete on public.client_tags to authenticated;
grant select, insert, delete on public.contact_tags to authenticated;
grant all on public.client_tags, public.contact_tags to service_role;
