import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
export async function testEmailBudgets({db,owner,user,admin}) {
  await owner();
  await db.exec(await readFile(new URL('../supabase/migrations/20261004140000_email_send_budgets.sql',import.meta.url),'utf8'));
  await user(admin);
  await assert.rejects(db.query('select reserve_email_budget(1)'),/permission denied/);
  await assert.rejects(db.query('update email_send_limits set daily_recipients=9999'),/permission denied/);
  await owner();await db.exec('update email_send_limits set hourly_recipients=3,daily_recipients=5');
  const reserve=async n=>(await db.query('select reserve_email_budget($1) ok',[n])).rows[0].ok;
  await db.exec('set role service_role');
  assert.equal(await reserve(2),true);assert.equal(await reserve(2),false);assert.equal(await reserve(1),true);
  assert.equal(await reserve(1),false);
  for(const n of [0,-1,101,null])await assert.rejects(reserve(n),/Invalid recipient count/);
  await owner();await db.exec("update email_send_reservations set created_at=now()-interval '2 hours'");
  await db.exec('set role service_role');assert.equal(await reserve(2),true);assert.equal(await reserve(1),false);
  await owner();await db.exec("update email_send_reservations set created_at=now()-interval '25 hours'");
  await db.exec('set role service_role');assert.equal(await reserve(3),true);
  await owner();
  assert.equal((await db.query('select count(*)::int n from email_send_reservations')).rows[0].n,4,'denials never create reservations');
  console.log('Email budget DB checks passed: private controls, weighted hourly/daily limits, expiry, service-only reservations.');
}
