/*
# Leads: source + notes, safe deletes

- contacts: + source (where the lead came from) and + notes; updated_at kept
  current by trigger.
- Deleting a lead keeps its bookings and tasks (their link is cleared)
  instead of failing. Deleting an employee clears the assignee on their
  leads instead of failing. (Their own tasks were already removed with
  them: employee_tasks.employee_id is ON DELETE CASCADE.)
- Deleting a lead that still has client documents stays blocked
  (client_documents.contact_id is ON DELETE RESTRICT).

No rows are changed.
*/

alter table public.contacts
  add column if not exists source text check (source is null or length(source) <= 60),
  add column if not exists notes text check (notes is null or length(notes) <= 5000);

drop trigger if exists trg_contacts_updated_at on public.contacts;
create trigger trg_contacts_updated_at before update on public.contacts
  for each row execute function public.set_updated_at();

alter table public.bookings drop constraint if exists bookings_contact_id_fkey;
alter table public.bookings
  add constraint bookings_contact_id_fkey foreign key (contact_id) references public.contacts(id) on delete set null;

alter table public.employee_tasks drop constraint if exists employee_tasks_contact_id_fkey;
alter table public.employee_tasks
  add constraint employee_tasks_contact_id_fkey foreign key (contact_id) references public.contacts(id) on delete set null;

alter table public.contacts drop constraint if exists contacts_assigned_employee_id_fkey;
alter table public.contacts
  add constraint contacts_assigned_employee_id_fkey foreign key (assigned_employee_id) references public.employees(id) on delete set null;
