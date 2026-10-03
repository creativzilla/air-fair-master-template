# Email Inbox deployment handoff

This feature is implemented locally. Do not run these production commands until
deployment is approved. No DNS changes are needed: Google Workspace retains the
main-domain MX records; Resend receives on `reply.airfairtravel.com`.

## Data and access

- Uses existing `contacts.id` and `contacts.submission_id`, plus `profiles` and
  `employees.user_id/allowed_modules`.
- `email_conversations`, `email_messages`, `email_read_state`, and
  `email_webhook_events` are additive, RLS-protected tables.
- Active admins/editors have inbox access. Staff need an employee login link,
  `clients: true` and `email-inbox: true` in Dashboard → Employees → Dashboard
  Access. Staff access defaults off. The same check runs in RLS and send RPCs.
- Existing CRM access permits active team members to read all contacts; inbox
  does not introduce an assignment-only restriction. If lead RLS changes later,
  update the inbox policies and RPC checks together.
- New incoming conversations remain unassigned unless a random thread address
  matches, or RFC references identify exactly one conversation for that
  participant. Sender email alone never merges conversations. No lead is created
  by inbound email. Staff can explicitly associate an unassigned conversation.
- New pending client confirmations acquire thread Reply-To addresses through
  additive outbox triggers. Old rows are not backfilled. Staff recipients,
  newsletter behavior and global inbox settings are unchanged.

## Local validation (no real messages)

```powershell
npm.cmd run test:email
npm.cmd run test:inbox
npm.cmd run typecheck:functions
deno check --node-modules-dir=none supabase/functions/resend-inbound/index.ts supabase/functions/inbox-send/index.ts
npm.cmd run test:email:e2e
npm.cmd run build
```

The SQL suite uses an isolated PostgreSQL engine, not the linked project:

```powershell
$inboxTestTools = Join-Path $env:TEMP 'airfair-inbox-tests'
npm.cmd install --prefix $inboxTestTools --no-package-lock --no-audit --no-fund @electric-sql/pglite
$env:PGLITE_MODULE = ([System.Uri](Join-Path $inboxTestTools 'node_modules/@electric-sql/pglite/dist/index.js')).AbsoluteUri
npm.cmd run test:inbox:db
```

Tests cover raw signatures and replay protection, API/content failures,
concurrent send claims, lost send responses, frozen retry payloads, expiration of
the provider deduplication window, thread/reference matching, duplicate inbound
events, unassigned conversations, RLS and denied sends, per-user read isolation,
form confirmation linking, and staff/newsletter routing. PGlite serializes
concurrent SQL calls; the database suite also checks the persisted lease and
deduplication constraints. Verify real concurrent HTTP deliveries in staging.

## Deploy after approval

Actual project reference from `supabase/.temp/project-ref`:
`ddhqkzjtlburzkipnoew`.

1. Review/apply only expected pending migrations:

```powershell
npx supabase link --project-ref ddhqkzjtlburzkipnoew
npx supabase db push --dry-run
npx supabase db push
```

New migrations: `20261002100000_email_inbox.sql`, then
`20261002120000_email_inbox_short_reply_to.sql` (thread Reply-To addresses are
`t-<48 hex>@reply.airfairtravel.com`; the original 71-character local part
exceeded RFC 5321's 64 limit and Resend rejected it with 422). It must precede function/UI
deployment. It adds triggers to new client-confirmation inserts; it does not
rewrite existing messages or change `email_settings`.

2. In Supabase Project Settings / Edge Functions → Secrets, retain
   `RESEND_API_KEY` and add `RESEND_WEBHOOK_SECRET` after creating the webhook.
   The API key must support sending and retrieving sent/received emails.
   `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are supplied
   by hosted Supabase. Optional `EXTRA_ALLOWED_ORIGINS` lists approved preview
   origins, comma-separated. Existing form-submit secrets remain unchanged.
   Never put these secret values in frontend env files, source, logs or chat.

3. Deploy the functions:

```powershell
npx supabase functions deploy resend-inbound --project-ref ddhqkzjtlburzkipnoew --no-verify-jwt
npx supabase functions deploy inbox-send --project-ref ddhqkzjtlburzkipnoew --no-verify-jwt
npx supabase functions deploy form-submit --project-ref ddhqkzjtlburzkipnoew --no-verify-jwt
```

`supabase/config.toml` disables gateway JWT verification for inbound. The inbound
function instead requires a valid Resend/Svix signature over the raw body. It
returns a retryable failure until its secret is configured. `inbox-send` also
bypasses the legacy gateway JWT check to support modern signing keys, but always
validates the user's bearer token with `auth.getUser()` and checks inbox
permission before any send or retry. It is **not** an anonymous send endpoint.

4. Resend → Webhooks → Add webhook:

- URL: `https://ddhqkzjtlburzkipnoew.supabase.co/functions/v1/resend-inbound`
- Event: **email.received**
- Copy the signing secret directly into Supabase's `RESEND_WEBHOOK_SECRET`.
- Do not enter a Supabase Authorization/JWT header for this webhook.

The function retrieves full content from `/emails/receiving/{email_id}` and only
accepts receiving-domain recipients. Success follows the committed database
transaction. API/database failures return 503 so Resend retries; failed events
can also be replayed from the Resend webhook dashboard.

5. Publish the frontend using the existing Bolt workflow, after approval.
   Grant intended staff both Clients and Email Inbox access.

## Controlled staging acceptance

Use only staff-controlled test addresses. Do not send customer test emails.

1. Set the existing Form Emails test redirect to a controlled address and turn
   sending on in the staging environment. Record the previous values for restore.
2. Create/select a dedicated test contact. Open lead → Send Email. Verify the
   fixed sender, test redirect, `[TEST]` subject and random thread Reply-To.
3. Reply from the controlled mailbox. Verify the same conversation receives the
   reply, unread state differs per staff user, and no new CRM lead is created.
4. Reply in-dashboard. Check `In-Reply-To`/`References`, persisted actual RFC
   `message_id`, and staff sender attribution.
5. Email `inbox@reply.airfairtravel.com` twice as separate new emails: two
   unassigned conversations must appear, even with identical sender/subject.
6. Replay one received event and issue overlapping deliveries: one message only.
   Temporarily simulate provider/database failures in staging and replay again.
7. Submit a test website form. Its new client confirmation must use a thread
   address and link to the created contact. Staff notification recipients and
   newsletter double opt-in must still behave as before.
8. Test inactive users, staff without either permission, and anonymous REST/RPC
   requests: no message reads or sends. Verify denied read-state updates for
   another user.
9. Test mobile conversation navigation, search/pagination, attachment notices,
   safe literal rendering of HTML-looking text, and retry/error states.
10. Restore sending/test-mode settings to their recorded values.

## Sender attribution and sender copies

Migration `20261002160000_email_inbox_sender_copy.sql` (after the earlier inbox
migrations):

- `queue_inbox_message` records the sender from `auth.uid()`: `sender_user_id`,
  `sender_name` (profile full name) and `sender_email` (registered Supabase Auth
  email). The request carries no sender fields; staff cannot write messages
  directly (select-only grant). Retries and status refreshes never change them.
- Dashboard shows the full name, else the account email, else "Unknown staff"
  (historical rows are backfilled only from a recorded `sender_user_id`). Form
  emails show "Airfair auto-reply". The client-facing From stays
  `no-reply@airfairtravel.com`.
- Admin-only setting Form Emails → Inboxes & sending → "Email Inbox: copy to
  the sender": CC (default; exposes the staff email to the client, and the
  client's Reply All includes it), BCC, or Off. It applies to manual compose
  and replies only, never to form auto-replies or staff notifications.
- The copy mode and CC/BCC recipient are stored on the message when queued;
  retries use them (and the frozen payload) even if the setting or retrying
  admin changes. Addresses are de-duplicated across To/CC/BCC; sending to your
  own address adds no copy. Test mode sends only to the test address (no copies).
- BCC is shown only inside the dashboard, readable only by inbox-authorized staff (RLS).
- Reply All: the client's reply reaches Resend once, via the thread `t-…`
  address, and joins the same conversation; the CC'd staff member also gets it
  directly in Google Workspace (not duplicated in the dashboard). Incoming CC is
  stored for display. If staff reply from Gmail to their copy, the thread
  Reply-To sends it to the dashboard conversation, not to the client — reply
  from the dashboard instead.

## Compose and Reply recipients

Migration `20261002180000_email_inbox_compose_recipients.sql`:

- Compose and Reply show To (the lead or conversation address, locked), CC and
  BCC as chips. The automatic sender copy is prefilled from
  `inbox_compose_defaults()` (the caller's registered Auth email + the admin's
  copy mode) as a locked "Automatic sender copy" chip in CC or BCC (none when
  Off). Staff can add/remove other CC/BCC recipients (max 20 each).
- `queue_inbox_message(..., p_cc, p_bcc)` validates every address, adds the
  sender copy from `auth.uid()`, and de-duplicates (lower-case; never To; BCC
  never repeats CC) — the same rules as the dashboard preview and send payload.
  If its final lists differ from those shown (e.g. the setting changed), it
  refuses before saving and the dashboard reloads the recipients.
- Final CC/BCC are stored on the message and frozen into the send payload, so
  retries keep them. Calls without lists (older dashboard) get the automatic
  copy only.
- Deploy order: migration → `inbox-send` → frontend. The new dashboard with the
  old `inbox-send` would drop manual CC/BCC.

## Mailbox layout, search and attachments

Migration `20261002200000_email_inbox_mailbox.sql`:

- `inbox_list(folder, query, contact, offset, limit)` and `inbox_folder_counts()`
  run as the caller (RLS + `can_use_email_inbox`). Folders: Inbox (has incoming),
  Sent (has outgoing), Unassigned (no lead), All conversations. Unread is per
  user (`email_read_state`); rows can be marked read/unread. Search covers
  subject, addresses, lead name and message text.
- Outgoing attachments: private bucket `email-attachments`. Staff upload only
  under `outgoing/<their user id>/<request key>/`; no update/delete policy, so
  saved files are immutable for retries. `queue_inbox_message(..., p_attachments)`
  checks path ownership, real size/type from `storage.objects` (5 files, 10 MB
  total, executable types refused) and stores references. `inbox-send` reads
  the files with the service role and sends base64 content to Resend; the saved
  payload and idempotency key contain references only.
- Received attachments stay name-only (their content is not stored).
- Uploads from a send that never got queued (e.g. refused recipients) stay in
  the bucket; they are not attached to anything.
- Deploy order: migration → `inbox-send` → frontend.

## Shared mailboxes

Migration `20261003100000_email_shared_mailboxes.sql`, new function `mailbox-verify`.

- Email Inbox → Settings · Mailboxes (administrators only). Add a mailbox with
  a name, an `@airfairtravel.com` address and authorized staff (Read, or Read
  and send; administrators always have every mailbox). All writes go through
  `admin_*` database functions; clients cannot set a status.
- How it works with the current setup: sending uses the airfairtravel.com
  domain verified in Resend. airfairtravel.com MX stays with Google
  Workspace; Resend only receives on reply.airfairtravel.com. Each mailbox
  therefore has a forwarding address `<local>@reply.airfairtravel.com`.
- External setup per mailbox (not done by the dashboard; it does not create a
  Google Workspace account): make the address receive mail in Google Workspace
  (user, group or alias) and add a Gmail routing rule (or group member) that
  also delivers a copy to the forwarding address.
- Verify Setup: checks the domain in Resend (`status` verified, sending
  capability), sends a test email from the mailbox to itself with a one-time
  `X-Airfair-Mailbox-Verify` token (only its hash is stored), and the mailbox
  becomes Active only when `resend-inbound` receives that email for the
  mailbox's address. No arrival within 15 minutes → Setup Failed with the
  reason. Statuses: Pending Setup, Active, Disabled, Setup Failed.
- The existing sender (`no-reply@airfairtravel.com`, `inbox@reply…`) is the
  seeded default "Air Fair Travel & Immigration" mailbox, open to everyone with
  Email Inbox access, and Active only because existing sent and received mail
  proves both directions. Existing conversations belong to it.
- Routing: managed mailboxes are matched from the provider's To, Cc, Bcc and
  `received_for` (envelope) recipients, never subject or sender. A message for
  several mailboxes is stored once and linked to each. Unmatched mail (and mail
  for a disabled mailbox) goes to the default mailbox. Thread replies stay in
  their conversation.
- Sending: the From is a mailbox the user can send from (active + permission,
  checked in `queue_inbox_message` and on retry). Replies default to the
  mailbox that received the conversation. Thread Reply-To, attachments, sender
  attribution and the automatic sender CC are unchanged.
- Permissions: conversations, messages, search/counts, read state and
  attachment downloads are filtered by mailbox access (RLS). The Resend key
  stays in the Edge Functions.
- Deploy order: migration → `resend-inbound`, `inbox-send`, `mailbox-verify` →
  frontend. Until `resend-inbound` is redeployed, new mail is filed under the
  default mailbox.

## Send status and recovery

Dashboard sends are durably saved before HTTP, claimed with a two-minute lease,
and retried via **Retry / refresh send** using the same immutable provider
payload/key. They do not use the form outbox's scheduled worker. Sending disabled
or temporary errors remain visible as retryable messages; queued rows survive
browser closures. Form notifications retain their existing scheduled retries.

Resend acceptance is shown as **Accepted by Resend**, not guaranteed delivery.
This v1 webhook subscribes only to incoming messages; it does not track delivery,
bounce or complaint webhooks. Actual RFC Message-IDs are retrieved from the sent
email API, not fabricated from provider UUIDs. Missing IDs can be reconciled by
retrying/refreshing a send or sending the next reply. Form-send enrichment is
best-effort and cannot interfere with existing queue results.

Never automatically resend a possibly accepted request after Resend's 24-hour
idempotency window. This code stops at 23 hours and displays `unknown`; inspect
Resend before explicitly composing another email. A changed test recipient also
blocks retry of a frozen payload rather than silently sending it elsewhere.
Plain-text messages only; attachment names/presence are shown, no downloads or
incoming HTML rendering in v1. History is loaded in batches of 50.

## Rollback

1. Disable the Resend inbound webhook (retains its event logs for later replay).
2. Restore the previous frontend and form-submit function version.
3. Disable the two new outbox triggers to restore the original Reply-To behavior
   for future confirmations; do not delete existing conversation data:

```sql
alter table public.email_outbox disable trigger inbox_link_form;
alter table public.email_outbox disable trigger inbox_sync_form;
```

4. Disable/remove `inbox-send` and `resend-inbound` deployments if required.
   Keep new tables, read state, provider IDs and idempotency records for recovery.
   Do not change Google MX records, delete old outbox rows or reset email settings.
5. After repair, re-enable triggers/functions/webhook and replay failed events.

## Provider references

- [Retrieve received email](https://resend.com/docs/api-reference/emails/retrieve-received-email)
- [Retrieve sent email](https://resend.com/docs/api-reference/emails/retrieve-email)
- [Reply threading](https://resend.com/docs/dashboard/receiving/reply-to-emails)
- [Webhook signature format](https://www.svix.com/guides/receiving/receive-webhooks-with-svix-cli/)
