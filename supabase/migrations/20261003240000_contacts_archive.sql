-- Archive clients: hidden from the active Clients list, Pipeline, overview,
-- calendar and email lead pickers, but kept (and restorable). Archiving is an
-- ordinary contacts update, so the existing team update policy applies;
-- deleting stays admin-only.
alter table public.contacts add column if not exists archived_at timestamptz;
alter table public.contacts add column if not exists archived_by uuid references public.profiles(id) on delete set null;
create index if not exists contacts_archived_at on public.contacts(archived_at);
