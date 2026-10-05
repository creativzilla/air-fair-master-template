-- Validate direct REST writes as well as dashboard edits. Legacy values are
-- checked only when changed; this migration neither rewrites nor deletes data.
create or replace function public.validate_client_fields()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'INSERT' or new.name is distinct from old.name then
    if new.name is null or length(btrim(new.name)) not between 1 and 200 then
      raise exception 'Client name must contain 1 to 200 characters' using errcode = '23514';
    end if;
  end if;
  if tg_op = 'INSERT' or new.email is distinct from old.email then
    if coalesce(new.email, '') <> '' and (length(new.email) > 254
      or new.email !~ '^[^[:space:]<>@,;]+@[^[:space:]<>@,;]+\.[^[:space:]<>@,;]+$') then
      raise exception 'Enter a valid client email or leave it empty' using errcode = '23514';
    end if;
  end if;
  if tg_op = 'INSERT' or new.phone is distinct from old.phone then
    if length(new.phone) > 80 or new.phone ~ '[[:cntrl:]]' then
      raise exception 'Client phone must be at most 80 characters without control characters' using errcode = '23514';
    end if;
  end if;
  if tg_op = 'INSERT' or new.amount is distinct from old.amount then
    if new.amount < 0 or new.amount::text in ('NaN','Infinity','-Infinity') then
      raise exception 'Client amount must be a finite, non-negative number' using errcode = '23514';
    end if;
  end if;
  if tg_op = 'INSERT' or new.category is distinct from old.category then
    if new.category is null or new.category not in ('Immigration Processing','Visa','Tour Package','General') then
      raise exception 'Choose a valid client category' using errcode = '23514';
    end if;
  end if;
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    if not exists (select 1 from public.pipeline_stages where name = new.status) then
      raise exception 'Choose an existing pipeline stage' using errcode = '23514';
    end if;
  end if;
  if (tg_op = 'INSERT' or new.source is distinct from old.source) and length(new.source) > 200 then
    raise exception 'Client source must be at most 200 characters' using errcode = '23514';
  end if;
  if (tg_op = 'INSERT' or new.notes is distinct from old.notes) and length(new.notes) > 10000 then
    raise exception 'Client notes must be at most 10000 characters' using errcode = '23514';
  end if;
  return new;
end $$;
revoke all on function public.validate_client_fields() from public, anon, authenticated;
create trigger contacts_validate_fields before insert or update on public.contacts
  for each row execute function public.validate_client_fields();
