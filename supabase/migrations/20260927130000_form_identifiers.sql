/*
# Form identifiers: form_id, service_type, source

Every website submission and newsletter signup gets three consistent
identifiers, as columns (filterable in the dashboard and in reports):

- form_id       unique per form and page:
                  contact-home                    homepage contact form
                  newsletter-footer               footer newsletter signup
                  immigration-<service-slug>      immigration assessment forms
                  visa-inquiry-<country-slug>     visa country inquiry forms
                  travel-inquiry-<package-slug>   travel package inquiry forms
- service_type  general | newsletter | immigration | visa | travel
- source        the page path the form was sent from

The website sends form_id / service_type / source inside raw_data; a
BEFORE INSERT trigger copies them into the columns. When they are missing
(e.g. an older cached version of the site), they are derived from the
existing form_type, so every row is always filled. Existing rows are
backfilled. Visitor insert policies are unchanged; values are validated by
check constraints.
*/

-- ---------------------------------------------------------------------------
-- Derivation from the legacy form_type naming (also used for backfill)
-- ---------------------------------------------------------------------------
create or replace function public.form_id_from_type(p_form_type text, p_form_key text)
returns text
language sql
immutable
set search_path = public
as $$
  select case
    when p_form_type like 'immigration\_%'     then 'immigration-' || replace(substr(p_form_type, 13), '_', '-')
    when p_form_type like 'visa\_%'            then 'visa-inquiry-' || replace(substr(p_form_type, 6), '_', '-')
    when p_form_type like 'travel\_package\_%' then 'travel-inquiry-' || replace(substr(p_form_type, 16), '_', '-')
    when p_form_type = 'website_inquiry'       then 'contact-home'
    else lower(regexp_replace(coalesce(nullif(p_form_key, ''), nullif(p_form_type, ''), 'unknown'), '[^a-zA-Z0-9]+', '-', 'g'))
  end
$$;

create or replace function public.service_type_from_type(p_form_type text)
returns text
language sql
immutable
set search_path = public
as $$
  select case
    when p_form_type like 'immigration\_%'     then 'immigration'
    when p_form_type like 'visa\_%'            then 'visa'
    when p_form_type like 'travel\_package\_%' then 'travel'
    else 'general'
  end
$$;

-- ---------------------------------------------------------------------------
-- form_submissions
-- ---------------------------------------------------------------------------
alter table public.form_submissions
  add column if not exists form_id text,
  add column if not exists service_type text,
  add column if not exists source text;

update public.form_submissions
set form_id      = coalesce(form_id, public.form_id_from_type(form_type, form_key)),
    service_type = coalesce(service_type, public.service_type_from_type(form_type)),
    source       = coalesce(source, source_page, raw_data ->> 'source_page')
where form_id is null or service_type is null or source is null;

create or replace function public.fn_fill_form_identifiers()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  sent_form_id text := new.raw_data ->> 'form_id';
  sent_service text := new.raw_data ->> 'service_type';
begin
  new.form_id := coalesce(
    new.form_id,
    case when sent_form_id ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(sent_form_id) <= 120 then sent_form_id end,
    public.form_id_from_type(new.form_type, new.form_key));
  new.service_type := coalesce(
    new.service_type,
    case when sent_service in ('general', 'newsletter', 'immigration', 'visa', 'travel') then sent_service end,
    public.service_type_from_type(new.form_type));
  new.source := left(coalesce(new.source, new.raw_data ->> 'source', new.source_page), 300);
  return new;
end;
$$;

drop trigger if exists trg_form_submissions_identifiers on public.form_submissions;
create trigger trg_form_submissions_identifiers
  before insert on public.form_submissions
  for each row execute function public.fn_fill_form_identifiers();

alter table public.form_submissions
  alter column form_id set not null,
  alter column service_type set not null;

alter table public.form_submissions drop constraint if exists form_submissions_form_id_format;
alter table public.form_submissions add constraint form_submissions_form_id_format
  check (form_id ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(form_id) <= 120);
alter table public.form_submissions drop constraint if exists form_submissions_service_type_check;
alter table public.form_submissions add constraint form_submissions_service_type_check
  check (service_type in ('general', 'newsletter', 'immigration', 'visa', 'travel'));
alter table public.form_submissions drop constraint if exists form_submissions_source_length;
alter table public.form_submissions add constraint form_submissions_source_length
  check (source is null or length(source) <= 300);

create index if not exists idx_form_submissions_form_id on public.form_submissions (form_id, created_at desc);
create index if not exists idx_form_submissions_service_type on public.form_submissions (service_type, created_at desc);

-- ---------------------------------------------------------------------------
-- newsletter_subscribers (one form: the footer signup)
-- ---------------------------------------------------------------------------
alter table public.newsletter_subscribers
  add column if not exists form_id text not null default 'newsletter-footer',
  add column if not exists service_type text not null default 'newsletter',
  add column if not exists source text;

update public.newsletter_subscribers set source = source_page where source is null;

create or replace function public.fn_fill_newsletter_source()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.source := left(coalesce(new.source, new.source_page), 300);
  return new;
end;
$$;

drop trigger if exists trg_newsletter_identifiers on public.newsletter_subscribers;
create trigger trg_newsletter_identifiers
  before insert on public.newsletter_subscribers
  for each row execute function public.fn_fill_newsletter_source();

alter table public.newsletter_subscribers drop constraint if exists newsletter_subscribers_identifiers_check;
alter table public.newsletter_subscribers add constraint newsletter_subscribers_identifiers_check
  check (form_id ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(form_id) <= 120
         and service_type = 'newsletter' and (source is null or length(source) <= 300));
