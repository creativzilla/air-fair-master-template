# Production security release status

Checked 2026-10-05. Backend release applied; Bolt frontend publication pending.

## Verified

- Linked Supabase project: `ddhqkzjtlburzkipnoew`.
- Remote migration history matches local history through `20261003300000`.
- Migration dry run identifies exactly the eight security migrations from
  `20261004090000` through `20261004140000` as pending.
- Three active, confirmed, non-banned administrators have Team access.
- Public Auth configuration: signup disabled, email auto-confirmation disabled.
- Production build succeeded using 64 published CMS documents and generated
  42 pages plus sitemap. Existing dashboard chunk-size warning remains.
- The owner publishes `https://airfairtravel.com/` through Bolt.new, connected
  to this GitHub repository. Its HTTP `server: Netlify` header describes serving
  infrastructure, not the owner's publishing workflow.
- Live root response does not yet include the new CSP or X-Frame-Options.
- Supabase backup listing returned no physical backups and PITR disabled.
  This does not establish whether independent external backups exist.

## Release dependency

The release branch is `feature/cms`. Bolt's authenticated Publish control is
not available in this workspace. Open the connected project, select that branch
and allow it to sync the release commit before publishing. Preserve the existing
public Supabase environment values and set `VITE_SITE_URL=https://airfairtravel.com`
using `.env.production.example`; production environment files are no longer tracked.

Seven migrations are now applied: all reviewed security migrations except
`20261004130000_protect_public_uploads.sql`. They introduce 50 section policies;
three administrators retain Team access. Anonymous and authenticated roles
cannot execute the email budget reservation function.

Deployed: `admin-users`, `form-submit`, `inbox-send`, `mailbox-verify`,
`resend-inbound`, `campaign-worker`, and `form-upload`. Negative live requests
verify authentication/signature rejection and invalid-input handling without
sending email, uploading files or creating customer records.

The former public function definitions, policies, triggers and table grants
were saved outside the repository before applying migrations. This is a schema
reference, not a full data backup or tested restore procedure.

`dist` contains the successfully built release. After Bolt publishes and the
new frontend's broker integration is verified live, apply the remaining upload
lockdown using `supabase db push --include-all --dry-run` followed by
`supabase db push --include-all`. The flag is needed because the later email
budget migration was applied first. The dry run must list only the upload
lockdown. Do not apply it before publication: the old frontend uploads directly
to Storage. Existing open browser tabs need a reload after rollout.

## Remaining work

Finish Bolt publication and upload lockdown; verify live headers and permissions.
Establish a full backup/recovery path. Auth redirect/rate-limit settings,
MFA, private-file scanning, orphan cleanup and authenticated production smoke
tests remain open. This document is not a production security sign-off.
