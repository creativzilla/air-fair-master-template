# Phase 3: private data and document access

Apply `20261004110000_enforce_private_section_access.sql` after the Phase 1/2
migrations, then deploy the dashboard's permission descriptions. The migration
does not delete or rewrite customer data. It has not been applied to production.

## Access matrix

These are additional section requirements, intersected with existing role
policies. Granting a section does not turn a staff account into an administrator.
Client records remain shared across authorized staff, not assignment-only.

| Data | Read access | Insert/update access |
| --- | --- | --- |
| Clients | Clients, Pipeline, Forms, Documents, or Calendar | Clients, Pipeline, or Forms |
| Meetings | Clients, Pipeline, or Calendar | Same |
| Form submissions | Forms or Documents | Forms; public submissions still use the server function |
| Client documents and team resources | Documents | Documents |
| Email delivery log | Form Emails | Existing server-only writes remain unchanged |
| Newsletter subscribers | Forms, Form Emails, or Email Inbox | Forms or Form Emails, subject to existing policies |
| Employee tasks | Clients, Pipeline, Forms, or Team | Same |
| Stage task templates | Clients, Pipeline, Forms, Team, or Settings | Team or Settings, subject to existing policies |
| Employee directory | Own record, or Clients/Pipeline/Forms/Calendar/Team | Team |
| Client tags | Clients or Pipeline | Clients |
| Contact/tag links | Clients or Pipeline | Clients |
| CMS drafts and history | Corresponding website section; forms require Pages or Services | Existing mutation restrictions remain |

Operational sections share client records because their existing screens use
them for lead cards, client pickers and appointments. Documents also grants access
to submitted forms/attachments. Removing Clients alone does not remove client
data access while one of these dependent sections remains granted. Permission
tooltips now identify these dependencies. For a staff member who must not see any
customer data, remove all of those operational sections and Email Inbox.

Customer/document deletion still requires an administrator with the relevant
section. Team-account deletion and removal of contact/tag links retain their
existing distinct permissions. The administrator record guards remain active.

## Storage and server operations

- Client-document and team-resource listing, downloads and uploads require
  Documents access in addition to existing storage rules.
- Form attachment downloads require Forms or Documents. Anonymous public-form
  uploads remain available, but do not confer private download access.
- Anonymous access to private tables is revoked. Restrictive storage policies
  deny private reads/updates/deletes even if an old anonymous policy is present.
- Existing signed URLs remain usable until their expiry. The dashboard requests
  short-lived URLs; this patch does not invalidate previously issued links.
- Email mailbox/conversation policies are preserved. Form Emails intentionally
  grants broad access to form delivery logs; Email Inbox membership alone does not.
- Settings can rename/reorder stages through the existing validated RPC, now
  running with definer privileges. Its explicit authorization, input validation,
  optimistic concurrency check and transaction locks remain in place. Settings
  does not gain direct CRM table access.

Restrictive policies are AND-ed with the existing permissive policies, preventing
an unrelated legacy permissive grant from bypassing the section boundary. Trusted
server/service-role operations bypass RLS as before; API authorization must remain
in force. Remaining Edge Function authorization work belongs to Phase 4.

## Verification

`npm run test:inbox:db` includes `scripts/test-private-sections.mjs`. It exercises
direct SQL as real authenticated/anonymous roles in isolated PGlite, including:

- Denied reads, inserts, updates and deletes, including known client IDs.
- An intentionally permissive legacy policy that cannot bypass section checks.
- Document metadata and storage access with and without Documents permission.
- Anonymous uploads without private download access, including an old public
  storage read policy.
- Admin-only document deletion and restricted CMS draft/history visibility.
- Pipeline task creation and Settings stage renaming without general CRM access.

Before release, inspect the deployed policies and smoke-test section grants with
separate accounts. This local suite models Supabase tables and roles; it does not
replace testing hosted Storage signed-URL behavior or live API grants.

Anonymous upload quotas, file scanning and additional field validation remain
scheduled for later phases. This phase does not claim those protections.
