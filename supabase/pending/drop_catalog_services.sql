/*
# Remove the old Catalog table (public.services)

APPLY ONLY AFTER the website build without the Catalog is published in Bolt
(commit "Remove Catalog"), so no live page still reads this table.
Kept in supabase/pending/ so `db push` can't apply it early. To apply:
  npx supabase@2.118.0 migration new drop_catalog_services
  copy this file's SQL into the new migration, then npx supabase@2.118.0 db push

What it does:
- drops the two foreign keys that point at services (both have 0 rows set):
  cms_documents.service_id (the column stays; the dashboard still reads it)
  and service_fields.service_id (empty, unused table; left in place);
- drops public.services (16 rows) with its RLS policies.
Not touched: the `catalog-images` storage bucket (Media and travel posters use it).

Backup: supabase/backups/catalog-services-2026-10-01.json (all rows and columns).
Rollback: recreate the table from 20260827075214_create_air_fair_schema.sql
(plus its policies from 20260913150000 / 20260926120000) and insert the rows
from the backup file.
*/

alter table public.cms_documents drop constraint if exists cms_documents_service_id_fkey;
alter table public.service_fields drop constraint if exists service_fields_service_id_fkey;
drop table if exists public.services;
