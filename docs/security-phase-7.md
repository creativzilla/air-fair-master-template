# Security remediation — Phase 7

Status: application email budgets and manual-send throttles implemented and
tested locally. No production migration, deployment, commit or push performed.

## Shared provider budget

`20261004140000_email_send_budgets.sql` creates private limits and reservation
tables and a service-only `reserve_email_budget` RPC. A global transaction
advisory lock serializes the check and reservation across concurrent senders.
Defaults are **200 recipient attempts per rolling hour** and **1,000 per rolling
24 hours**, shared by forms, newsletter email, inbox replies, campaign sends and
tests, and mailbox verification probes. To, CC and BCC entries all count.

`_shared/auth/emailBudget.ts` wraps the provider fetch used by `form-submit`,
`inbox-send`, `campaign-worker` and `mailbox-verify`. Reservation occurs directly
before a provider POST. Exhaustion returns a safe application-budget error;
database errors/missing migrations fail closed without contacting the provider.
GET status lookups do not consume the budget. Unknown batch send formats are
refused so a future bulk sender cannot silently bypass counting.

Every provider attempt consumes capacity, including failures and idempotent
retries. Reservations are never refunded because a timed-out request might have
been accepted. Thus these are conservative attempt ceilings, not exact billing
or delivery counters. Provider idempotency keys and payloads remain unchanged.
Reservation history contains only timestamps and recipient counts, not addresses
or message content. Successful reservations remove history older than two days.

Limits can only be changed through trusted database administration. For example,
after reviewing actual traffic and provider capacity:

```sql
update public.email_send_limits
set hourly_recipients = 200, daily_recipients = 1000
where id = 1;
```

Neither an authenticated dashboard admin nor an anonymous caller can modify
these tables or call the reservation RPC. No new secret or frontend setting was
introduced. Requests still enforce existing account and mailbox authorization.

## Manual-action throttles and retries

Using the existing atomic, service-only `rate_limit_hit` RPC:

| Action | Limit per authenticated account |
| --- | --- |
| Inbox send/retry requests | 30 per rolling 10 minutes |
| Campaign test messages | 10 per rolling hour |
| Mailbox verification probes | 10 per rolling hour |

Inbox refresh requests using the same endpoint also consume its action budget.
Campaign test authorization runs before its throttle. Existing form/newsletter
and template-test throttles remain in force. These authenticated counters use
the account UUID; they contain no email address or token.

- Quota-blocked form/newsletter emails remain `retry`, scheduled one hour later,
  without consuming a provider-attempt retry. The submission remains saved.
- If a previously attempted form email is older than the conservative 23-hour
  duplicate-protection boundary, automatic delivery stops with a review message.
  Creation time is used as a conservative lower bound on the first attempt.
  Never-attempted messages may still send after a longer budget delay. Manual
  reset of a failed message remains an authorized operator action: check the
  provider before resetting an uncertain delivery.
- Campaigns pause on budget exhaustion or an unavailable budget check; resume
  after capacity returns or the check is restored. Existing conservative
  idempotency-window handling may require review after a long pause.
- Inbox messages keep existing retry/status behavior and duplicate safeguards.
  Mailbox verification reports failure instead of bypassing the budget.

## Validation

- 110 unit tests passed: 9 auth/budget, 43 inbox/campaign, 58 forms/uploads.
- Real isolated PostgreSQL tests verify service-only access, weighted hourly and
  daily limits, rejected invalid counts, expiry and unchanged reservations on
  denial. The advisory lock provides serialization; the local PGlite suite is
  not a multi-instance load test.
- 100 local endpoint checks passed: 29 form/email, 38 security and 33 upload.
  The new form endpoint scenario confirms budget denial makes no provider call
  while saving the submission and preserving pending email attempts.
- Shared adapter tests cover denial for inbox/probe, campaign and form senders;
  all stop before the network and keep their expected retry/pause handling.
- Deno checks passed for all four modified functions. No frontend source was
  changed in this phase, so the previously passing frontend build was not rerun.

All endpoint tests used local fake services. No real emails were sent.

## Release and remaining work

Apply prior migrations, then `20261004140000_email_send_budgets.sql`. Review the
default budget against expected traffic. Redeploy all four sending functions
with shared modules; retain the campaign worker's `deno.json`. An old deployed
sender will not enforce the new reservation until redeployed. Deploying new
functions before the migration will safely defer/fail sends.

Smoke-test normal form confirmations, inbox sending with copies, a campaign,
verification probes, budget denial and recovery. Monitor the retry queue and
paused campaigns. All senders share capacity, so abusive traffic can consume the
budget and temporarily delay legitimate messages; there is no priority reserve
for transactional mail in this phase.

This does not configure Supabase Auth login/signup/reset limits or CAPTCHA,
provider account limits, edge WAF rules, or protect all public reads from DoS.
Supabase Auth invitation/reset email is outside this Resend wrapper. Public
forms retain their existing throttles; distributed submission/database growth
still needs operational monitoring. Upload antivirus/quarantine and orphan
cleanup from Phase 6 remain outstanding. Phase 8 covers the remaining dependency
and production configuration review.

Provider reference: [Resend idempotency keys](https://resend.com/docs/dashboard/emails/idempotency-keys).
