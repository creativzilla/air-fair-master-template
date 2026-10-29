-- Hide follow-up questions until the Yes/No question they depend on is "Yes".
-- Hidden fields are not required and their answers are not saved (enforced
-- server-side in _shared/forms/schema.ts). Republishes only forms whose
-- draft matched the live version, so no unpublished staff edits go live.
do $$
declare
  rules jsonb := '[
    {"slug":"immigration-13a-immigrant-visa","when":"legallyMarried","fields":["spouseFullName","spouseCitizenship","dateOfMarriage","placeOfMarriage","marriageRegisteredPH"]},
    {"slug":"immigration-visa-reconsideration","when":"hasDecisionCopy","fields":["denialReason","decisionDocument"]},
    {"slug":"immigration-tourist-visa-extension","when":"currentlyInPH","fields":["dateOfArrival","currentVisaType","currentVisaExpiration"]}
  ]'::jsonb;
  r jsonb;
  d public.cms_documents;
  in_sync boolean;
  to_publish uuid[] := '{}';
begin
  for r in select * from jsonb_array_elements(rules) loop
    select * into d from public.cms_documents where kind = 'form' and slug = r->>'slug' and not is_archived;
    continue when not found;
    in_sync := d.published_version_id is not null and d.published_revision = d.draft_revision;
    update public.cms_documents set draft = jsonb_set(draft, '{sections}', (
      select jsonb_agg(jsonb_set(s, '{fields}', (
        select coalesce(jsonb_agg(case
          when f->>'name' in (select jsonb_array_elements_text(r->'fields')) and f->'showWhen' is null
          then f || jsonb_build_object('showWhen', jsonb_build_object('field', r->>'when', 'equals', 'Yes'))
          else f end order by fo), '[]'::jsonb)
        from jsonb_array_elements(s->'fields') with ordinality as x(f, fo))) order by so)
      from jsonb_array_elements(draft->'sections') with ordinality as y(s, so)))
    where id = d.id;
    if in_sync then to_publish := to_publish || d.id; end if;
  end loop;
  if array_length(to_publish, 1) > 0 then
    perform public.cms_publish(to_publish, 'Show follow-up questions only when the Yes/No answer is Yes');
  end if;
end $$;
