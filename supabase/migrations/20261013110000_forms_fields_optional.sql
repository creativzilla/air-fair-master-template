-- Make every form field optional except the contact Email (replies, the
-- auto-reply and the CRM lead need it; form-submit rejects a missing email).
-- The privacy consent tick box is left as it is. Republishes only forms whose
-- draft matched the live version, so no unpublished staff edits go live.
do $$
declare
  d public.cms_documents;
  in_sync boolean;
  to_publish uuid[] := '{}';
begin
  for d in select * from public.cms_documents where kind = 'form' and not is_archived and draft ? 'sections' loop
    in_sync := d.published_version_id is not null and d.published_revision = d.draft_revision;
    update public.cms_documents set draft = jsonb_set(draft, '{sections}', (
      select coalesce(jsonb_agg(case when jsonb_typeof(s->'fields') = 'array' then jsonb_set(s, '{fields}', (
        select coalesce(jsonb_agg(case
          when f->>'type' = 'email' or f->>'name' = 'email' or f->>'mapTo' = 'email' or not (f ? 'required') then f
          else f || '{"required": false}'::jsonb end order by fo), '[]'::jsonb)
        from jsonb_array_elements(s->'fields') with ordinality as x(f, fo))) else s end order by so), '[]'::jsonb)
      from jsonb_array_elements(draft->'sections') with ordinality as y(s, so)))
    where id = d.id;
    if in_sync then to_publish := to_publish || d.id; end if;
  end loop;
  if array_length(to_publish, 1) > 0 then
    perform public.cms_publish(to_publish, 'All fields optional except Email');
  end if;
end $$;
