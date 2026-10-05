# Approved dependency upgrades

Completed locally on 2026-10-05 after explicit approval for the three major
upgrades. No commit, push, deployment or live migration was performed.

| Package | Previous | Installed |
| --- | --- | --- |
| Vite | 5.4.21 | 6.4.3 |
| React Router DOM | 6.30.6 | 7.18.4 |
| Tailwind CSS | 3.4.19 | 4.3.3 |
| Tailwind PostCSS adapter | — | 4.3.3 |

These versions are pinned and recorded in the lockfile. React 18 and the existing
compatible React Vite plugin are retained. The obsolete separate Autoprefixer
dependency is removed because the Tailwind 4 adapter handles prefixing.

**Final `npm audit`: zero vulnerabilities**, down from 9 affected packages
(6 high, 3 moderate). This describes the audited dependency graph, not the entire
application's production security posture.

## Compatibility work

- SSR imports `StaticRouter` from the supported React Router DOM export instead
  of the removed `/server` entry.
- PostCSS uses `@tailwindcss/postcss`. `src/index.css` declares explicit source
  scanning and retains the exclusion of the unused `visible` utility. The old
  empty-theme JavaScript Tailwind config is removed.
- Theme, preflight and utilities imports deliberately preserve the existing
  unlayered CSS cascade. Wrapping utilities in a new layer would let broad custom
  rules such as `button { font: inherit }` override existing utility classes.
- `src/tailwind-compat.css` retains the app's referenced palette colors, small
  shadow/radius/blur defaults, ring defaults, accessible transparent outlines,
  placeholder colors, button cursors, native input backgrounds, date padding and
  partially specified table-cell padding. Browser comparisons caught and guided
  fixes for input and table changes; layouts were not redesigned.
- The prerender hook stops after a failed client build instead of obscuring the
  original error with a second missing-`index.html` exception.

## Validation

- Client and SSR builds passed after each upgrade. Six public routes were
  rendered through the SSR entry after each stage.
- The complete production build hook passed in a temporary checkout using local
  CMS fixtures from the repository: 42 pages plus sitemap, app shell and custom
  404. No external CMS request was sent; live published data still needs the
  release smoke test. The user's existing dirty `dist` files were preserved.
- Headless Edge checked five routes at both 1280px and 390px widths, client-side
  navigation/back, and synthetic authenticated Clients, Pipeline and Settings
  views. No browser runtime errors occurred. All external requests were blocked;
  synthetic account/customer fixtures never reached Supabase.
- Compared 337 sampled element styles/positions before and after Tailwind: 335
  matched exactly; two pill radii used different numeric values but the same
  fully rounded geometry. Eleven of thirteen screenshots had no pixels differing
  by more than 5/255 in any RGB channel. The two homepage screenshots showed text
  rasterization differences in the translucent hero, with sampled geometry and
  colors unchanged. Screenshots were also visually inspected for the login and
  homepage. This is representative regression coverage, not every dashboard
  interaction or browser.
- 113 unit/config tests passed: 9 auth, 58 forms/uploads, 43 inbox/campaign and
  3 production-config checks. The real isolated PostgreSQL suite passed.
- All 100 local endpoint checks passed: 29 form/email, 38 security, 33 upload.
- Actual Vite development serving passed loopback binding, sensitive-file denial,
  foreign-origin CORS denial, security headers, entry transformation and React
  dependency serving.

Reusable checks: `scripts/check-upgrade-build.mjs`,
`scripts/check-upgrade-prerender.mjs`, `scripts/check-upgrade-browser.mjs` and
`scripts/test-dev-security.mjs`. Browser checks require a local Playwright module
specified by `PLAYWRIGHT_MODULE` and installed Edge; test-only Playwright/pngjs
were installed under the temporary directory, not added to app dependencies.

## Release requirements and limits

Use Node >=22.12 (tested with Node 24.18) and `npm ci`. Tailwind 4 requires modern
browsers: Safari 16.4+, Chrome 111+, Firefox 128+. Older browsers are no longer
supported by this CSS toolchain. Safari and Firefox were not tested here.
See the [Tailwind upgrade guide](https://tailwindcss.com/docs/upgrade-guide).

The existing large-dashboard-chunk warning remains; it does not fail the build.
An npm cleanup warning left an old locked esbuild executable directory during
the first upgrade; the active installed Vite/esbuild builds and tests passed.
No process belonging to the user's running development session was terminated.
Restart that development session to use the new packages.

No live security protections have been activated by these local edits. Follow
the phase deployment notes, configure the hosting environment from the examples,
and verify real Auth settings, RLS, file scanning/retention, provider quotas,
headers, live CMS rendering and browser flows before production sign-off.
