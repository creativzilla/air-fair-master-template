import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

export async function testClientValidation({ db, owner, user, grant, staff, contact }) {
  await owner();
  await db.exec(`alter table contacts add column phone text, add column category text default 'General',
    add column amount numeric, add column source text, add column notes text;
    grant select on pipeline_stages to authenticated;
    alter table pipeline_stages enable row level security;
    create policy validation_stage_read on pipeline_stages for select to authenticated using(is_team());`);
  await db.query("update contacts set email='legacy invalid' where id=$1", [contact]);
  await db.exec(await readFile(new URL('../supabase/migrations/20261004120000_validate_client_fields.sql', import.meta.url), 'utf8'));
  await grant(staff, {clients:true}); await user(staff);
  await db.query("update contacts set notes='Valid edit of legacy record' where id=$1", [contact]);
  assert.equal((await db.query('select email from contacts where id=$1', [contact])).rows[0].email, 'legacy invalid');
  for (const [field,value] of [
    ['name',''], ['name','x'.repeat(201)], ['email','a@b'], ['email','a@b.com\nInjected'],
    ['email','x'.repeat(250)+'@b.com'], ['phone','x'.repeat(81)], ['phone','123\n456'],
    ['amount','-1'], ['amount','NaN'], ['amount','Infinity'], ['category','Unknown'],
    ['status','Missing stage'], ['source','x'.repeat(201)], ['notes','x'.repeat(10001)],
  ]) {
    await assert.rejects(db.query(`update contacts set ${field}=$1 where id=$2`, [value,contact]),
      e => e.code === '23514', `${field} must reject invalid direct writes`);
  }
  const id='00000000-0000-0000-0000-000000000f51';
  await db.query(`insert into contacts(id,name,email,phone,category,status,amount)
    values($1,'José 李','jose@example.com','+63 (917) 123-4567','General','Security Done',0)`,[id]);
  assert.equal(Number((await db.query('select amount from contacts where id=$1',[id])).rows[0].amount),0);
  await assert.rejects(db.query(`insert into contacts(id,name,category,status) values($1,'','General','Security Done')
    on conflict(id) do update set name=excluded.name`,[id]),e=>e.code==='23514');
  await owner(); await grant(staff,{settings:true}); await user(staff);
  const stages=(await db.query('select id,name,sort_order from pipeline_stages order by sort_order,id')).rows;
  await db.query('select configure_pipeline_stages($1,$2)',[
    JSON.stringify(stages),JSON.stringify(stages.map(s=>({...s,name:s.name==='Security Done'?'Validated Done':s.name}))),
  ]);
  await owner();
  assert.equal((await db.query('select status from contacts where id=$1',[id])).rows[0].status,'Validated Done');
  console.log('Client validation passed: direct writes, upserts, Unicode names, phone formatting, zero amounts, legacy edits, and stage renames.');
}
