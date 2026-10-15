# Phase 2: authentication and authorization

## Implemented locally

- A database trigger prevents non-admin Team delegates from inserting or deleting
  administrator employee records, including replacement/upsert attempts. Existing
  update restrictions remain in force. The last-admin check now covers insertion.
- Role and section checks require trusted `auth.users.email_confirmed_at` and
  reject an active Auth ban, even when an older access token is still present.
  The verification helper is private to database functions and the service role.
- User management, mailbox verification and privileged form-email actions use
  the database authorization helpers instead of reading a profile role alone.
- Unconfirmed sessions receive a confirmation message in the dashboard. Password
  setup/recovery remains available through Supabase Auth.
- Invitation redirects must target `/dashboard` on `SITE_URL` (default:
  `https://airfairtravel.com`) or an explicit `AUTH_REDIRECT_ORIGINS` origin.
  Credentials, query strings, fragments and other paths are rejected.

## Deployment

1. Review hosted Supabase Auth settings before applying the migrations. Require
   email confirmation, disable public signup for the internal dashboard, and
   verify a working invite/recovery email provider. Confirmation timestamps are
   not independent proof of mailbox ownership if Auth auto-confirmation was
   previously enabled. Do not bulk-mark users confirmed to bypass this control.
2. Confirm at least one active administrator with Team access has completed email
   verification. The migration deliberately fails when no eligible admin exists.
3. Apply pending migrations in order, including Phase 1, then
   `20261004100000_guard_admin_employee_replacement.sql` and
   `20261004101000_require_verified_team_accounts.sql`.
4. Deploy `admin-users`, `mailbox-verify`, and `form-submit`, followed by the
   dashboard. No credentials are embedded in these files.
5. Configure exact Supabase invitation/recovery redirect URLs. If needed, set
   `AUTH_REDIRECT_ORIGINS` to comma-separated additional trusted origins. Add
   `http://localhost:5173` only to the development environment; localhost is not
   implicitly trusted by the production invitation endpoint. A www origin must
   also be explicitly listed if the dashboard uses it.
6. Smoke-test an existing verified admin, a newly accepted invitation, a denied
   unconfirmed account, password recovery, and a delegated Team user. Verify the
   latter cannot change or replace an administrator's access record.

## Remaining hosted authentication work

Live Auth settings and account state were not inspected or changed. Password
strength, compromised-password protection, recovery redirects, email delivery,
session lifetimes and Auth rate limits still require deployment verification.

Mandatory MFA is not enabled by this patch. It needs enrollment, challenge and
recovery flows plus server-side assurance-level checks. Introduce those together
after enrolling administrators; forcing an assurance-level requirement alone
would lock out existing users. This phase does not claim MFA protection.

The existing last-admin check is a per-statement safeguard, not a tested guarantee
against concurrent administrator-management transactions. Concurrency hardening
and production checks remain necessary before treating account management as
fully hardened.

References: [Supabase password authentication](https://supabase.com/docs/guides/auth/passwords)
and [redirect configuration](https://supabase.com/docs/guides/auth/redirect-urls).

## Checks

- `npm run test:inbox:db`: real SQL in isolated PGlite, including replacement,
  upsert, last-admin, unconfirmed-account and banned-session cases.
- `npm run test:auth`: invitation redirect rejection and configured origins.
- `npm run test:email:e2e`: real form Edge Function against local fake services;
  rejects privileged email requests when database authorization denies them.
- `npm run test:email` and `npm run test:inbox`: regression checks.
- Deno type checks for the three changed Edge Functions; production frontend
  bundle compiled into a temporary directory without replacing existing `dist`.
