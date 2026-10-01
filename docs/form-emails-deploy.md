# Form emails: deployment and rollback runbook

Production project: `ddhqkzjtlburzkipnoew` (airfairtravel.com, hosted via Bolt.new / Netlify).
No DNS changes are needed or made at any step.

## State as of 2026-09-28

| Piece | Production |
|---|---|
| Edge Function `form-submit` | **Deployed** (v1, 2026-09-28 00:21 Manila time, 43 s after the code was pushed to GitHub, so most likely by an automatic GitHub integration, not by hand). Code identical to commit `4727246`. JWT verification on. |
| Migration `20260928090000_form_email_notifications` | Not applied |
| Migration `20260928100000_form_email_retry_schedule` | Not applied |
| Migration `20260928120000_form_email_templates` (dashboard auto-replies) | Not applied |
| Function code with Form Emails templates / `send_template_test` | Not deployed (committed locally only) |
| Lockdown SQL (`supabase/pending/lock_direct_form_inserts.sql`) | Not applied; public direct saves still open |
| Website calling the function | Not yet (live site is an earlier Bolt build) |

While the migrations are missing, the deployed function can't send anything: its
first database call fails, so it returns an error before any email. The live
site doesn't call it.

**Pushing to `feature/cms` appears to redeploy `form-submit` automatically.**
Treat every push that touches `supabase/functions/` as a production deploy.

## Deployment (in this order)

Each step is safe to stop after. Customer emails only start at step 11.

1. **Rotate the Resend key** (the old one appeared in a screenshot): in Resend,
   create a new API key, delete the old one.
2. **Set Edge Function secrets** (Supabase dashboard > Edge Functions > Secrets,
   or type these yourself in a terminal; never paste keys into chat or code):
   - `RESEND_API_KEY`: the new key.
   - `RATE_LIMIT_SALT`: any long random string (recommended).
3. **Deploy the function code**: push `feature/cms` (auto-deploys), or run
   `npx supabase@2.118.0 functions deploy form-submit`.
   Check: `npx supabase@2.118.0 functions list` shows `form-submit` with a new
   version and `updated_at` after the push.
4. **Apply the email migrations**:
   `npx supabase@2.118.0 db push --dry-run` must list exactly
   `20260928090000_form_email_notifications.sql`,
   `20260928100000_form_email_retry_schedule.sql` and
   `20260928120000_form_email_templates.sql`; then
   `npx supabase@2.118.0 db push`.
5. **Give the retry schedule the public key** (Supabase > SQL Editor). Use the
   project's anon/public key from Project Settings > API (the same key the
   website uses):
   ```sql
   select vault.create_secret('<anon public key>', 'form_submit_anon_key',
     'Public anon key for the form email retry schedule');
   ```
6. **Verify the database** (SQL Editor):
   ```sql
   select jobname, schedule, active from cron.job where jobname = 'form-email-retries';  -- 1 row, */5 * * * *, true
   select sending_enabled, staff_inbox, test_redirect_to from public.email_settings;     -- false, admin@airfairtravel.com, null
   select count(*) from vault.decrypted_secrets where name = 'form_submit_anon_key';      -- 1
   select service_type, enabled from public.email_templates where form_id is null;       -- 4 rows, all true
   ```
7. **Configure test mode** (Dashboard > Form Emails > Inboxes & sending, admin):
   - Monitored staff inbox: pre-filled as `admin@airfairtravel.com` (confirm it's the inbox the team checks).
   - Test mode: send everything to: your own address.
   - Send emails: on. Save.

   Then **Client auto-replies**: review the four category defaults, add any
   form-specific overrides, and press **Send test** for each (goes only to a
   configured inbox, marked `[TEST]`). Test sends work even before "Send
   emails" is on, once the function and migrations are deployed.
8. **Publish the website** from Bolt.new (pull the latest `feature/cms` first).
   The new build sends forms through the function.
9. **Test one submission per category on airfairtravel.com** (test mode, so no
   client is emailed; stay under 5 submissions per 10 minutes per connection):

   | Category | Page | Expect in the test inbox |
   |---|---|---|
   | Contact | `/#contact` | `[TEST] New website inquiry from …` + `[TEST] We received your message (AF-…)` |
   | Immigration | `/philippine-immigration-services/consultation` | `[TEST] New immigration assessment: Immigration-Related Consultation (…)` + client confirmation |
   | Visa | `/visa-assistance/japan` | `[TEST] New visa inquiry: Japan Tourist Visa (…)` + client confirmation |
   | Travel | `/travel-tours/bali-indonesia` | `[TEST] New travel inquiry: Bali, Indonesia (…)` + client confirmation |
   | Newsletter | footer signup | `[TEST] Please confirm your subscription…`; the link shows "You're subscribed" |

   For each: the submission and CRM lead appear in the dashboard; Form
   Emails > Inboxes & sending > Recent emails shows **Sent**; replying to a
   staff email addresses the client. If you created an override (e.g. for
   Bali), its subject should appear for that form only.
10. **Close the direct-save bypass** (only after step 9 passes on the live site):
    ```
    npx supabase@2.118.0 migration new lock_direct_form_inserts
    ```
    Copy the SQL from `supabase/pending/lock_direct_form_inserts.sql` into the
    new file, then `npx supabase@2.118.0 db push`. Verify:
    ```sql
    select tablename, policyname from pg_policies
     where schemaname = 'public' and cmd = 'INSERT'
       and tablename in ('form_submissions', 'newsletter_subscribers');   -- 0 rows
    ```
    Submit one more test form to confirm the function path still works.
11. **Start customer emails**: Form Emails > Inboxes & sending > clear "Test
    mode", keep "Send emails" on, save. Watch Recent emails for the first day.

## Rollback (from least to most drastic)

| # | To undo | Do this | Effect |
|---|---|---|---|
| R1 | Any email problem | Form Emails > Inboxes & sending > turn **Send emails** off (or `update public.email_settings set sending_enabled = false;`) | Immediate. Forms keep saving and creating leads; emails are logged as "Not sent". |
| R1b | One auto-reply is wrong | Form Emails > Client auto-replies: switch the override or category off, or fix the text | Next submissions use the default / send no auto-reply; staff notifications continue. |
| R2 | Scheduled retries | `select cron.unschedule('form-email-retries');` | No background calls. Retries only on new submissions / "Retry failed now". |
| R3 | Direct-save lockdown (step 10) | Run the two `create policy` statements in the header of `supabase/pending/lock_direct_form_inserts.sql`, then `npx supabase@2.118.0 migration repair --status reverted <that migration's version>` | Visitors can save directly again (the website's fallback works again). |
| R4 | Website | Publish the previous version in Bolt.new (or `git revert` the email commits and republish) | **Do R3 first if step 10 was applied**, or the older site's direct saves are refused. |
| R5 | Edge Function | `npx supabase@2.118.0 functions delete form-submit` | The site falls back to saving directly (only works if R3 was done / step 10 not applied). No emails. |
| R6 | Remove the email tables entirely (only if abandoning the feature) | SQL below, then `migration repair --status reverted` for all three versions | Deletes the email log and settings. Submissions, leads and subscribers are kept. |

R6 SQL:
```sql
select cron.unschedule(jobid) from cron.job where jobname = 'form-email-retries';
drop function if exists public.form_email_process_due();
drop table if exists public.email_templates;
drop function if exists public.service_type_for_form_id(text);
drop view if exists public.newsletter_marketing_audience;
drop function if exists public.claim_email_outbox(uuid[], integer);
drop function if exists public.rate_limit_hit(text, text, integer, integer);
drop table if exists public.email_outbox;
drop table if exists public.rate_limit_events;
drop table if exists public.email_settings;
alter table public.newsletter_subscribers
  drop column if exists confirmed_at, drop column if exists confirm_token_hash,
  drop column if exists confirm_expires_at, drop column if exists confirmation_sent_at,
  drop column if exists unsubscribe_token_hash;
select vault.delete_secret(id) from vault.secrets where name = 'form_submit_anon_key';  -- if your Vault version has delete_secret; otherwise delete it in the dashboard
```
`pg_net` / `pg_cron` extensions can stay installed; they do nothing on their own.

## Checks before each deploy

```
npm run test:email            # 50 unit tests, in-memory, no email
npm run typecheck:functions   # Deno type-check of the Edge Function
npm run test:email:e2e        # real function under Deno, fake Supabase + Resend sink; network limited to localhost (25 checks)
```
(`deno` must be on PATH, or set `DENO_BIN`.)
