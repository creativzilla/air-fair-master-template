# Security remediation — Phase 8

Status: compatible local configuration hardening and the subsequently approved
dependency upgrades are complete locally. See [upgrade results](security-dependency-upgrades.md)
for current versions, zero npm audit findings and regression checks. Hosted
production verification remains open. No deployment, commit or push was performed;
this is not a production security sign-off.

## Implemented

- `.gitignore` excludes `.env` variants at any depth, retaining example files.
  `.env.production` was removed from the Git index while preserving the local
  file. Its only settings were public site/analytics values, now also available
  in `.env.production.example`. This staged removal does not erase Git history.
  Configure the hosting environment from that example before the next clean
  deployment, since `.env.production` will no longer arrive with the checkout.
- `scripts/security-config.mjs` allows only the five reviewed VITE variables and
  rejects known private-key prefixes and privileged Supabase JWT roles before
  Vite starts/builds. Error messages never echo values. This is an accidental
  exposure guard, not JWT authentication or comprehensive secret detection.
- `vite.config.js` binds development and preview to localhost, limits development
  CORS to loopback origins, explicitly denies environment/credential/repository
  files, and disables build source maps. A CLI `--host` override can still expose
  the development server; do not use it with the currently vulnerable Vite.
- Vercel and Netlify-style hosting configs add `nosniff`, strict-origin referrer
  policy, same-origin framing, and baseline CSP containment. Same-origin previews
  continue to work; external sites cannot embed the app. The CSP does not restrict
  script sources and is not a complete XSS mitigation. A full script allowlist
  requires testing analytics and the intentionally configurable admin chat code.
- `package.json` declares Node >=22.12, matching the sanitizer requirement. The
  lockfile records that engine requirement. No dependency version was upgraded
  in this phase.

Browser-public values: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (anon JWT or
publishable key only), `VITE_SITE_URL`, `VITE_OG_IMAGE`, `VITE_GA_ID`.
Service-role, database, Resend, webhook, worker, rate-salt and other private
credentials stay in server/Edge Function secrets without the VITE prefix.

## Validation

- Two new production-configuration tests passed: private/unknown environment
  rejection and consistent hosting headers/routing.
- Production client bundle and SSR entry build passed in temporary directories.
  Existing dirty `dist` artifacts were preserved. The large dashboard chunk
  warning remains. Full live-data prerendering was not run.
- Actual development server smoke test passed: loopback address, foreign-origin
  CORS denial, private-file denial, security headers, transformed app entry and
  optimized React dependency serving. The initial sandboxed run blocked esbuild
  directory resolution; rerunning the local test with approved filesystem access
  passed. This was not a browser navigation/visual regression suite.
- Git ignore checks passed for `.env`, `.env.local`, `.env.production` and nested
  environment variants. The original local production file remains on disk.
- Prior phase results remain 110 unit tests, 100 local endpoint checks and the
  isolated database suite; those unrelated backend suites were not repeated for
  these configuration-only changes.

## Original dependency findings — resolved in the approved follow-up

Before the approved upgrade, `npm audit` reported **9 affected packages: 6 high, 3
moderate**. `npm outdated` confirmed no newer version within the installed Vite 5,
React Router 6 or Tailwind 3 major lines that fixes these findings. `braces`
latest is still 3.0.3, which is in the reported vulnerable range. Do not run
`npm audit fix --force` unattended.

The following bounded upgrade sequence was explicitly approved and completed.
The upgrade results document supersedes the earlier version/audit status below:

1. **Vite 5.4.21 → 6.4.3.** This is the smallest major step with the published
   Windows path-handling fix. Recheck plugin compatibility, dependency
   optimization, dev/preview, client and SSR/prerender builds, and lockfile audit.
   Loopback configuration is a mitigation, not removal of the vulnerable code.
2. **React Router 6.30.6 → 7.18.4.** Review router migration behavior and replace
   the current `react-router-dom/server` StaticRouter import as required. Test
   nested routes, authentication navigation, redirects and SSR output. The
   project uses BrowserRouter/StaticRouter rather than framework server mode,
   which affects exposure to individual advisories but does not clear the audit.
3. **Tailwind 3.4.19 → 4.3.3.** Review the PostCSS integration, theme/config
   migration and changed utility defaults. This has the largest visual regression
   risk and needs representative page/dashboard visual checks. Re-audit the
   transitive glob/watch dependencies afterwards; a major version alone is not
   proof every finding disappears.

Sources: [Vite Windows advisory and patched versions](https://github.com/vitejs/vite/security/advisories/GHSA-fx2h-pf6j-xcff),
[React Router navigation advisory](https://github.com/remix-run/react-router/security/advisories/GHSA-wrjc-x8rr-h8h6),
and the local npm audit/registry results collected during this phase.

## Production release checklist — not yet verified live

- [ ] Apply reviewed migrations from phases 1–7, respecting their preflight checks.
- [ ] Redeploy all changed Edge Functions and publish the dashboard/form frontend.
- [ ] Set hosting environment values previously supplied by `.env.production`.
- [ ] Verify hosted email confirmation, signup policy, redirects, password/reset
      limits, session behavior, and staff/admin MFA enrollment/enforcement plan.
- [ ] Verify hosted RLS/storage restrictions with real low-privilege test users.
- [x] Resolve the reported npm dependency advisories (audit now reports zero).
- [ ] Check HTTPS and actual response headers on the active host; checked-in
      Vercel/Netlify config is not evidence that either host is using it.
- [ ] Validate provider budgets, resend recovery, webhook authentication and queue
      monitoring; application quotas do not configure Supabase Auth email limits.
- [ ] Select and authorize private-file scanning/quarantine and implement safe
      abandoned-upload retention/cleanup (still open from Phase 6).
- [ ] Confirm backups/restore procedure, logging retention, production secret
      configuration, and repository secret protection/history review.
- [ ] Complete a browser smoke test covering dashboard, forms, uploads, email,
      public navigation and prerendered sharing/SEO pages before publishing.

Do not claim the site is production-secure solely from the local checks above.
The phase documents record exactly which protections are implemented and which
still require deployment, configuration, approval or additional work.
