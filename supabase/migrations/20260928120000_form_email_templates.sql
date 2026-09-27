/*
# Form Emails: editable client auto-replies

Admins edit the client auto-reply in Dashboard > Form Emails:
- one default per service_type (general, immigration, visa, travel), with an
  on/off switch, subject and message;
- optional override for a single form (form_id), which wins while enabled.
A new form, service or package has no override, so it automatically uses its
category's default. Templates are plain text with {{variables}}; the Edge
Function escapes the result, so no HTML can be injected.

Also: email_outbox gets `template_ref` (which template was used) and a new
kind `test_email` for "Send test" from the dashboard (only ever sent to an
inbox already configured in email_settings).

Requires 20260928090000_form_email_notifications.
*/

-- Category of a form_id; mirrors itemRefFromFormId() in the Edge Function.
create or replace function public.service_type_for_form_id(p_form_id text)
returns text
language sql
immutable
set search_path = public
as $$
  select case
    when p_form_id like 'immigration-%'    then 'immigration'
    when p_form_id like 'visa-inquiry-%'   then 'visa'
    when p_form_id like 'travel-inquiry-%' then 'travel'
    else 'general'
  end
$$;

create table if not exists public.email_templates (
  id uuid primary key default gen_random_uuid(),
  service_type text not null check (service_type in ('general', 'immigration', 'visa', 'travel')),
  form_id text check (form_id is null or (form_id ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(form_id) <= 120)),
  enabled boolean not null default true,
  subject text not null check (length(btrim(subject)) between 1 and 200),
  body text not null check (length(btrim(body)) between 1 and 5000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null default auth.uid(),
  -- An override belongs to its form's own category.
  constraint email_templates_form_matches_category check (form_id is null or service_type = public.service_type_for_form_id(form_id))
);
-- One default per category, one override per form.
create unique index if not exists email_templates_one_default on public.email_templates (service_type) where form_id is null;
create unique index if not exists email_templates_one_override on public.email_templates (form_id) where form_id is not null;

drop trigger if exists trg_email_templates_updated_at on public.email_templates;
create trigger trg_email_templates_updated_at before update on public.email_templates
  for each row execute function public.set_updated_at();

alter table public.email_templates enable row level security;
drop policy if exists "email_templates_admin_read" on public.email_templates;
create policy "email_templates_admin_read" on public.email_templates for select to authenticated using (public.is_admin());
drop policy if exists "email_templates_admin_insert" on public.email_templates;
create policy "email_templates_admin_insert" on public.email_templates for insert to authenticated with check (public.is_admin());
drop policy if exists "email_templates_admin_update" on public.email_templates;
create policy "email_templates_admin_update" on public.email_templates for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "email_templates_admin_delete" on public.email_templates;
-- Overrides can be deleted; category defaults stay (switch them off instead).
create policy "email_templates_admin_delete" on public.email_templates for delete to authenticated using (public.is_admin() and form_id is not null);

-- Defaults: the same wording the function used before (built-in copy).
insert into public.email_templates (service_type, form_id, enabled, subject, body) values
  ('general', null, true,
   $tpl$We received your message ({{reference}})$tpl$,
   $tpl$Hi {{client_first_name}},

Thank you for contacting {{business_name}}. We have received your message.

Reference: {{reference}}
Received: {{submitted_date}}

A member of our team will read your message and reply by email, usually within one business day.

If you need to add anything, just reply to this email.

Thank you,
{{business_name}}$tpl$),
  ('immigration', null, true,
   $tpl$We received your {{item_name}} assessment request ({{reference}})$tpl$,
   $tpl$Hi {{client_first_name}},

Thank you for requesting an assessment for {{item_name}}. We have received your details.

Reference: {{reference}}
Received: {{submitted_date}}

What happens next:
- Our immigration team will review your answers.
- We will contact you to confirm the requirements and next steps for your case.

If you need to add anything, just reply to this email.

Thank you,
{{business_name}}$tpl$),
  ('visa', null, true,
   $tpl$We received your {{item_name}} inquiry ({{reference}})$tpl$,
   $tpl$Hi {{client_first_name}},

Thank you for your inquiry about {{item_name}}. We have received your details.

Reference: {{reference}}
Received: {{submitted_date}}

What happens next:
- Our visa team will review your travel dates and details.
- We will contact you with the requirements checklist and the next steps.

If you need to add anything, just reply to this email.

Thank you,
{{business_name}}$tpl$),
  ('travel', null, true,
   $tpl$We received your inquiry for {{item_name}} ({{reference}})$tpl$,
   $tpl$Hi {{client_first_name}},

Thank you for your interest in {{item_name}}. We have received your inquiry.

Reference: {{reference}}
Received: {{submitted_date}}

What happens next:
- Our travel team will check availability for your preferred dates.
- We will contact you with the package details and pricing.

If you need to add anything, just reply to this email.

Thank you,
{{business_name}}$tpl$)
on conflict do nothing;

-- Outbox: record which template was used; allow dashboard test emails.
alter table public.email_outbox add column if not exists template_ref text check (template_ref is null or length(template_ref) <= 200);
alter table public.email_outbox drop constraint if exists email_outbox_kind_check;
alter table public.email_outbox add constraint email_outbox_kind_check
  check (kind in ('staff_notification', 'client_confirmation', 'newsletter_confirmation', 'test_email'));
