/*
# Close the direct-save bypass for website forms (DEFERRED: not a migration yet)

Kept out of supabase/migrations on purpose, because db push applies every
pending migration at once. Add it as the LAST deployment step, only after:
  1. the form-submit Edge Function is deployed and verified, and
  2. the new website (which sends forms through the function) is published.
Then: npx supabase@2.118.0 migration new lock_direct_form_inserts
copy this file's SQL into the new migration file, and run db push.

The older site saves forms straight into the table; after this migration
those direct saves are refused.

Removes the public INSERT permissions on form_submissions and
newsletter_subscribers, so every visitor submission goes through the Edge
Function's honeypot, rate limits and validation. The function writes with the
service role and is not affected. Staff read/update/delete policies are
unchanged. CRM lead creation (trigger) is unchanged.

Rollback (restores the previous public insert rules exactly):

  create policy "form_submissions_public_insert" on public.form_submissions
    for insert to anon, authenticated
    with check (status = 'New' and notes is null and handled_by is null
                and octet_length(raw_data::text) <= 200000
                and jsonb_typeof(attachments) = 'array');
  create policy "newsletter_public_insert" on public.newsletter_subscribers
    for insert to anon, authenticated with check (unsubscribed_at is null);
*/

drop policy if exists "form_submissions_public_insert" on public.form_submissions;
drop policy if exists "public_submit_form" on public.form_submissions; -- legacy name, if present
drop policy if exists "newsletter_public_insert" on public.newsletter_subscribers;
