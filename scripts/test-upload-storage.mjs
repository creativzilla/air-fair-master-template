import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

export async function testUploadStorage({db,owner,user,grant,staff,admin}) {
  await owner();
  await db.exec("insert into storage.buckets(id,name,public) values('form-attachments','form-attachments',true) on conflict(id) do update set public=true");
  await db.exec(await readFile(new URL('../supabase/migrations/20261004130000_protect_public_uploads.sql',import.meta.url),'utf8'));
  await db.exec(`grant select,insert,update,delete on storage.objects to anon,authenticated,service_role;
    create policy phase6_legacy_all on storage.objects for all to anon,authenticated using(true) with check(true);`);
  for(const account of [null,staff,admin]) {
    await owner();
    if(account) await user(account); else await db.exec('set role anon');
    await assert.rejects(db.query("insert into storage.objects(bucket_id,name) values('form-attachments','submissions/2026-10/forged-file.pdf')"),/row-level security/);
    assert.equal((await db.query("update storage.objects set metadata='{}' where bucket_id='form-attachments' returning id")).rows.length,0);
  }
  await owner();await db.exec('set role service_role');
  await db.query("insert into storage.objects(bucket_id,name) values('form-attachments','submissions/2026-10/broker-file.pdf')");
  await owner();await grant(staff,{forms:true});await user(staff);
  assert.ok((await db.query("select * from storage.objects where bucket_id='form-attachments'")).rows.length>0);
  await owner();await grant(staff,{news:true});await user(staff);
  assert.equal((await db.query("select * from storage.objects where bucket_id='form-attachments'")).rows.length,0);
  await owner();await grant(staff,{documents:true});await user(staff);
  await db.query("insert into storage.objects(bucket_id,name) values('client-documents','privacy/phase6.pdf')");
  await db.query("insert into storage.objects(bucket_id,name) values('team-resources','privacy/phase6.pdf')");
  await owner();
  const bucket=(await db.query("select * from storage.buckets where id='form-attachments'")).rows[0];
  assert.equal(bucket.public,false);assert.equal(Number(bucket.file_size_limit),10485760);
  assert.ok(!bucket.allowed_mime_types.includes('text/html'));
  // Exercise the real atomic quota function used by the upload broker.
  await db.exec('create table if not exists rate_limit_events(id bigint generated always as identity,bucket text,key_hash text,created_at timestamptz default now())');
  const migration=await readFile(new URL('../supabase/migrations/20260928090000_form_email_notifications.sql',import.meta.url),'utf8');
  const start=migration.indexOf('create or replace function public.rate_limit_hit(');
  const end=migration.indexOf('grant execute on function public.rate_limit_hit',start);
  await db.exec(migration.slice(start,migration.indexOf(';',end)+1));
  await user(admin);
  await assert.rejects(db.query("select rate_limit_hit('upload_global_day','all',86400,3)"),/permission denied/);
  await owner();await db.exec('set role service_role');
  for(const expected of [true,true,true,false,false]) {
    assert.equal((await db.query("select rate_limit_hit('upload_global_day','all',86400,3) ok")).rows[0].ok,expected);
  }
  await owner();
  console.log('Upload storage checks passed: direct upload/update denied despite legacy policies, broker upload, private reads, document uploads, bucket restrictions and service-only quotas.');
}
