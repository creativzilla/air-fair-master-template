// Run with PGLITE_MODULE pointing to an installed @electric-sql/pglite module.
// Uses an isolated in-memory database; never connects to Supabase.
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const { PGlite } = await import(process.env.PGLITE_MODULE || '@electric-sql/pglite');
const db = new PGlite();
await db.exec(`
  create role anon; create role authenticated;
  create function public.is_admin() returns boolean language sql as
    $$ select coalesce(current_setting('test.admin', true), 'true') = 'true' $$;
  create table pipeline_stages(id uuid primary key default gen_random_uuid(), name text unique not null, sort_order int not null default 0);
  create table contacts(id uuid primary key default gen_random_uuid(), name text, status text, assigned_employee_id uuid);
  create table stage_task_templates(id uuid primary key default gen_random_uuid(), stage text, title text);
  create table employee_tasks(employee_id uuid, contact_id uuid, title text, due_date date, is_done boolean);
  insert into pipeline_stages(name, sort_order) values ('New Lead', 0), ('Contacted', 1), ('Qualified', 2);
  insert into contacts(name, status, assigned_employee_id) values ('Test lead', 'New Lead', gen_random_uuid());
  insert into stage_task_templates(stage, title) values ('New Lead', 'Welcome'), ('Contacted', 'Follow up');
`);
await db.exec(await readFile(new URL('../supabase/migrations/20261001150000_configure_pipeline_stages.sql', import.meta.url), 'utf8'));
await db.exec(`create trigger trg_auto_assign_stage_tasks after update of status on contacts for each row execute function fn_auto_assign_stage_tasks();`);
const rows = async () => (await db.query('select * from pipeline_stages order by sort_order, id')).rows;
const save = async (expected, next) => (await db.query('select configure_pipeline_stages($1::jsonb, $2::jsonb) as stages', [JSON.stringify(expected), JSON.stringify(next)])).rows[0].stages;
let before = await rows();
// Swap names, reorder columns, and create a stage in one transaction.
let after = await save(before, [
  { id: before[1].id, name: 'New Lead' },
  { id: before[0].id, name: 'Contacted' },
  { id: before[2].id, name: 'Qualified' },
  { id: null, name: 'Completed' },
]);
assert.deepEqual(after.map(r => r.name), ['New Lead', 'Contacted', 'Qualified', 'Completed']);
assert.equal((await db.query('select status from contacts')).rows[0].status, 'Contacted');
assert.equal((await db.query("select stage from stage_task_templates where title = 'Welcome'")).rows[0].stage, 'Contacted');
assert.equal((await db.query('select count(*)::int as n from employee_tasks')).rows[0].n, 0);
await assert.rejects(save(before, before), /changed since/);
await assert.rejects(save(after, after.filter(r => r.name !== 'Contacted')), /Move leads/);
await assert.rejects(save(after, after.filter(r => r.name !== 'New Lead')), /Move leads/);
await assert.rejects(save(after, after.map(r => ({ ...r, name: 'Duplicate' }))), /unique/);
await assert.rejects(save(after, after.map((r, i) => ({ ...r, name: i ? r.name : '   ' }))), /1–80/);
await assert.rejects(save(after, after.slice(0, 1)), /at least two/);
await assert.rejects(save(after, [after[0], after[0]]), /unique|twice/);
await assert.rejects(save(after, after.map((r, i) => i ? r : { ...r, id: '00000000-0000-0000-0000-000000000000' })), /no longer exists/);
assert.deepEqual(await rows(), after, 'Rejected saves leave the configuration unchanged');
await db.exec("set test.admin = 'false'");
await assert.rejects(save(after, after), /Only admins/);
await db.exec("set test.admin = 'true'");
// Removing an empty stage is allowed, with contiguous saved ordering.
after = await save(after, after.filter(r => r.name !== 'Qualified'));
assert.deepEqual(after.map(r => r.sort_order), [0, 1, 2]);
// Ordinary board transitions must still create tasks after a configuration save.
await db.exec("update contacts set status = 'New Lead'");
assert.equal((await db.query('select count(*)::int as n from employee_tasks')).rows[0].n, 1);
await db.close();
console.log('Pipeline stages: rename, swap, reorder, add, remove, references, task automation, validation, stale edits, and admin checks passed.');
