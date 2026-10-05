# Phase 1 security fixes

## Deployment order

Apply the existing pending migrations in order, followed by:

- `20261004090000_protect_executable_settings.sql`
- `20261004091000_preserve_inbound_thread_access.sql`

Then deploy the dashboard build. These changes do not require an Edge Function
redeployment. A frontend deployment alone does not activate the protections.

## Behavior

Only active administrators and trusted server/database callers can change
`site_settings.chat_widget_code`. The database trigger covers inserts, updates,
upserts and deletion of settings containing a script. Delegated Settings and
Form Emails users retain ordinary settings access. The dashboard omits the
script field from their saves and shows its editor as read-only.

Administrator-managed scripts still execute on the public website. This is an
explicit trusted-administrator capability, not a general HTML sanitizer. Review
existing scripts before deployment; this migration does not certify or delete
previously saved code. Restrict privileged accounts accordingly.

Incoming recipients establish mailbox visibility for a new conversation. A
reply matched by a thread token or RFC references retains the existing mailbox
associations, even when it adds another managed mailbox to its recipients. Its
message mailbox must already belong to that conversation. Existing recipients,
message bodies and deduplication are preserved. Added mailboxes do not receive
access to the existing thread through the dashboard.

Review historical multi-mailbox associations before production. The migration
does not remove existing associations: the database cannot reliably distinguish
an intentional original recipient from an association added by an older reply.

## Verification

`npm run test:inbox:db` uses isolated PGlite, not a live Supabase database. It
checks script mutation denial for delegated Settings/Form Emails users, allowed
ordinary edits and admin changes, plus conversation/message/attachment isolation
for full tokens, shortened tokens and RFC-reference replies. Existing tests cover
new multi-mailbox routing, webhook deduplication and inbox sending behavior.

Run `npm run test:inbox` and `npm run test:email` as regression checks. Database
deployment and a live permissions smoke test remain separate release steps.
