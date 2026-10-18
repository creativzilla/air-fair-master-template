-- Additional restrictive policies intersect existing role policies. A legacy
-- permissive policy cannot OR its way around the section boundary.
-- Shared CRM records stay team-wide within the sections that consume them.

alter table public.contacts enable row level security;
revoke all on public.contacts from anon;
create policy section_scope_select on public.contacts as restrictive for select to authenticated using (public.has_section('clients') or public.has_section('pipeline') or public.has_section('forms') or public.has_section('documents') or public.has_section('bookings'));
create policy section_scope_insert on public.contacts as restrictive for insert to authenticated with check (public.has_section('clients') or public.has_section('pipeline') or public.has_section('forms'));
create policy section_scope_update on public.contacts as restrictive for update to authenticated using (public.has_section('clients') or public.has_section('pipeline') or public.has_section('forms')) with check (public.has_section('clients') or public.has_section('pipeline') or public.has_section('forms'));
create policy section_scope_delete on public.contacts as restrictive for delete to authenticated using (public.is_admin() and (public.has_section('clients') or public.has_section('pipeline') or public.has_section('forms')));

alter table public.bookings enable row level security;
revoke all on public.bookings from anon;
create policy section_scope_select on public.bookings as restrictive for select to authenticated using (public.has_section('clients') or public.has_section('pipeline') or public.has_section('bookings'));
create policy section_scope_insert on public.bookings as restrictive for insert to authenticated with check (public.has_section('clients') or public.has_section('pipeline') or public.has_section('bookings'));
create policy section_scope_update on public.bookings as restrictive for update to authenticated using (public.has_section('clients') or public.has_section('pipeline') or public.has_section('bookings')) with check (public.has_section('clients') or public.has_section('pipeline') or public.has_section('bookings'));
create policy section_scope_delete on public.bookings as restrictive for delete to authenticated using (public.is_admin() and (public.has_section('clients') or public.has_section('pipeline') or public.has_section('bookings')));

alter table public.form_submissions enable row level security;
revoke all on public.form_submissions from anon;
create policy section_scope_select on public.form_submissions as restrictive for select to authenticated using (public.has_section('forms') or public.has_section('documents'));
create policy section_scope_insert on public.form_submissions as restrictive for insert to authenticated with check (public.has_section('forms'));
create policy section_scope_update on public.form_submissions as restrictive for update to authenticated using (public.has_section('forms')) with check (public.has_section('forms'));
create policy section_scope_delete on public.form_submissions as restrictive for delete to authenticated using (public.is_admin() and (public.has_section('forms')));

alter table public.client_documents enable row level security;
revoke all on public.client_documents from anon;
create policy section_scope_select on public.client_documents as restrictive for select to authenticated using (public.has_section('documents'));
create policy section_scope_insert on public.client_documents as restrictive for insert to authenticated with check (public.has_section('documents'));
create policy section_scope_update on public.client_documents as restrictive for update to authenticated using (public.has_section('documents')) with check (public.has_section('documents'));
create policy section_scope_delete on public.client_documents as restrictive for delete to authenticated using (public.is_admin() and (public.has_section('documents')));

alter table public.team_resources enable row level security;
revoke all on public.team_resources from anon;
create policy section_scope_select on public.team_resources as restrictive for select to authenticated using (public.has_section('documents'));
create policy section_scope_insert on public.team_resources as restrictive for insert to authenticated with check (public.has_section('documents'));
create policy section_scope_update on public.team_resources as restrictive for update to authenticated using (public.has_section('documents')) with check (public.has_section('documents'));
create policy section_scope_delete on public.team_resources as restrictive for delete to authenticated using (public.is_admin() and (public.has_section('documents')));

alter table public.email_outbox enable row level security;
revoke all on public.email_outbox from anon;
create policy section_scope_select on public.email_outbox as restrictive for select to authenticated using (public.has_section('form-emails'));
create policy section_scope_insert on public.email_outbox as restrictive for insert to authenticated with check (public.has_section('form-emails'));
create policy section_scope_update on public.email_outbox as restrictive for update to authenticated using (public.has_section('form-emails')) with check (public.has_section('form-emails'));
create policy section_scope_delete on public.email_outbox as restrictive for delete to authenticated using (public.is_admin() and (public.has_section('form-emails')));

alter table public.newsletter_subscribers enable row level security;
revoke all on public.newsletter_subscribers from anon;
create policy section_scope_select on public.newsletter_subscribers as restrictive for select to authenticated using (public.has_section('forms') or public.has_section('form-emails') or public.has_section('email-inbox'));
create policy section_scope_insert on public.newsletter_subscribers as restrictive for insert to authenticated with check (public.has_section('forms') or public.has_section('form-emails'));
create policy section_scope_update on public.newsletter_subscribers as restrictive for update to authenticated using (public.has_section('forms') or public.has_section('form-emails')) with check (public.has_section('forms') or public.has_section('form-emails'));
create policy section_scope_delete on public.newsletter_subscribers as restrictive for delete to authenticated using (public.is_admin() and (public.has_section('forms') or public.has_section('form-emails')));

alter table public.employee_tasks enable row level security;
revoke all on public.employee_tasks from anon;
create policy section_scope_select on public.employee_tasks as restrictive for select to authenticated using (public.has_section('clients') or public.has_section('pipeline') or public.has_section('forms') or public.has_section('team'));
create policy section_scope_insert on public.employee_tasks as restrictive for insert to authenticated with check (public.has_section('clients') or public.has_section('pipeline') or public.has_section('forms') or public.has_section('team'));
create policy section_scope_update on public.employee_tasks as restrictive for update to authenticated using (public.has_section('clients') or public.has_section('pipeline') or public.has_section('forms') or public.has_section('team')) with check (public.has_section('clients') or public.has_section('pipeline') or public.has_section('forms') or public.has_section('team'));
create policy section_scope_delete on public.employee_tasks as restrictive for delete to authenticated using (public.is_admin() and (public.has_section('clients') or public.has_section('pipeline') or public.has_section('forms') or public.has_section('team')));

alter table public.stage_task_templates enable row level security;
revoke all on public.stage_task_templates from anon;
create policy section_scope_select on public.stage_task_templates as restrictive for select to authenticated using (public.has_section('clients') or public.has_section('pipeline') or public.has_section('forms') or public.has_section('team') or public.has_section('settings'));
create policy section_scope_insert on public.stage_task_templates as restrictive for insert to authenticated with check (public.has_section('team') or public.has_section('settings'));
create policy section_scope_update on public.stage_task_templates as restrictive for update to authenticated using (public.has_section('team') or public.has_section('settings')) with check (public.has_section('team') or public.has_section('settings'));
create policy section_scope_delete on public.stage_task_templates as restrictive for delete to authenticated using (public.is_admin() and (public.has_section('team') or public.has_section('settings')));

alter table public.employees enable row level security;
revoke all on public.employees from anon;
create policy section_scope_select on public.employees as restrictive for select to authenticated using (user_id = auth.uid() or public.has_section('clients') or public.has_section('pipeline') or public.has_section('forms') or public.has_section('bookings') or public.has_section('team'));
create policy section_scope_insert on public.employees as restrictive for insert to authenticated with check (public.has_section('team'));
create policy section_scope_update on public.employees as restrictive for update to authenticated using (public.has_section('team')) with check (public.has_section('team'));
create policy section_scope_delete on public.employees as restrictive for delete to authenticated using (public.has_section('team'));

alter table public.client_tags enable row level security;
revoke all on public.client_tags from anon;
create policy section_scope_select on public.client_tags as restrictive for select to authenticated using (public.has_section('clients') or public.has_section('pipeline'));
create policy section_scope_insert on public.client_tags as restrictive for insert to authenticated with check (public.has_section('clients'));
create policy section_scope_update on public.client_tags as restrictive for update to authenticated using (public.has_section('clients')) with check (public.has_section('clients'));
create policy section_scope_delete on public.client_tags as restrictive for delete to authenticated using (public.is_admin() and (public.has_section('clients')));

alter table public.contact_tags enable row level security;
revoke all on public.contact_tags from anon;
create policy section_scope_select on public.contact_tags as restrictive for select to authenticated using (public.has_section('clients') or public.has_section('pipeline'));
create policy section_scope_insert on public.contact_tags as restrictive for insert to authenticated with check (public.has_section('clients'));
create policy section_scope_update on public.contact_tags as restrictive for update to authenticated using (public.has_section('clients')) with check (public.has_section('clients'));
create policy section_scope_delete on public.contact_tags as restrictive for delete to authenticated using (public.has_section('clients'));

-- Draft reads follow the document section even for editors with custom access.
create policy section_scope_documents on public.cms_documents as restrictive for select to authenticated
  using (public.has_section(public.cms_kind_section(kind))
    or (kind = 'form' and (public.has_section('cms-services') or public.has_section('edit-website'))));

-- CMS history follows the document's section, not any website permission.
create policy section_scope_versions on public.cms_versions as restrictive for select to authenticated
  using (exists (select 1 from public.cms_documents d where d.id = document_id
    and (public.has_section(public.cms_kind_section(d.kind))
      or (d.kind = 'form' and (public.has_section('cms-services') or public.has_section('edit-website'))))));

-- Keep the existing private-bucket role rules, adding the same section checks
-- used by metadata. Other buckets (including email attachments) are unaffected.
create policy private_document_section_read on storage.objects as restrictive for select to authenticated
  using (case when bucket_id in ('client-documents','team-resources') then public.has_section('documents')
    when bucket_id = 'form-attachments' then public.has_section('forms') or public.has_section('documents')
    else true end);
create policy private_document_section_insert on storage.objects as restrictive for insert to authenticated
  with check (bucket_id not in ('client-documents','team-resources') or public.has_section('documents'));
create policy private_document_section_update on storage.objects as restrictive for update to authenticated
  using (bucket_id not in ('client-documents','team-resources') or public.has_section('documents'))
  with check (bucket_id not in ('client-documents','team-resources') or public.has_section('documents'));
create policy private_document_section_delete on storage.objects as restrictive for delete to authenticated
  using (case when bucket_id in ('client-documents','team-resources') then public.has_section('documents')
    when bucket_id = 'form-attachments' then public.has_section('forms') or public.has_section('documents')
    else true end);

-- Stage renames synchronize existing leads/tasks. Keep this narrowly validated
-- operation working without granting Settings arbitrary CRM table writes.
-- The function already checks active admin/Settings access and validates IDs,
-- expected revisions, stage names, dependencies and transaction locks.
alter function public.configure_pipeline_stages(jsonb,jsonb) security definer;
revoke all on function public.configure_pipeline_stages(jsonb,jsonb) from public, anon;
grant execute on function public.configure_pipeline_stages(jsonb,jsonb) to authenticated;

-- Anonymous form uploads remain available, but private files never become
-- readable/updatable/deletable through an old anonymous permissive policy.
create policy private_document_anon_read on storage.objects as restrictive for select to anon
  using (bucket_id not in ('client-documents','team-resources','form-attachments','email-attachments'));
create policy private_document_anon_update on storage.objects as restrictive for update to anon
  using (bucket_id not in ('client-documents','team-resources','form-attachments','email-attachments'))
  with check (bucket_id not in ('client-documents','team-resources','form-attachments','email-attachments'));
create policy private_document_anon_delete on storage.objects as restrictive for delete to anon
  using (bucket_id not in ('client-documents','team-resources','form-attachments','email-attachments'));
create policy private_document_anon_insert on storage.objects as restrictive for insert to anon
  with check (bucket_id not in ('client-documents','team-resources','email-attachments'));
