// Isolated PostgreSQL via PGlite. PGLITE_MODULE can point to a temporary install.
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const { PGlite } = await import(process.env.PGLITE_MODULE || '@electric-sql/pglite');
const db = new PGlite();
await db.exec(`
create role anon; create role authenticated; create role service_role bypassrls;
create schema auth;
create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('test.uid',true),'')::uuid $$;
grant usage on schema auth,public to authenticated,anon,service_role;
create table profiles(id uuid primary key,role text,is_active boolean,full_name text,email text);
create table auth.users(id uuid primary key,email text);
-- Minimal Supabase Storage stand-in (bucket rows, objects with size metadata, foldername()).
create schema storage; grant usage on schema storage to authenticated,anon,service_role;
create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint);
create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,metadata jsonb,unique(bucket_id,name));
create function storage.foldername(name text) returns text[] language sql immutable as $$ select (string_to_array(name,'/'))[1:cardinality(string_to_array(name,'/'))-1] $$;
create table email_settings(id smallint primary key default 1,sending_enabled boolean not null default false,test_redirect_to text);
insert into email_settings(id) values(1);
create function auth_role() returns text language sql security definer as $$ select coalesce((select role from profiles where id=auth.uid() and is_active),'none') $$;
create function is_admin() returns boolean language sql stable security definer as $$ select auth_role()='admin' $$;
create table employees(id uuid primary key default gen_random_uuid(),user_id uuid,allowed_modules jsonb);
create table form_submissions(id uuid primary key,email text);
create table contacts(id uuid primary key,submission_id uuid,email text,name text,created_at timestamptz default now());
create table email_outbox(id uuid primary key default gen_random_uuid(),dedupe_key text unique,kind text,status text,submission_id uuid,reply_to text,to_email text,subject text,body_text text,provider_message_id text,sent_at timestamptz,last_error text);
insert into profiles values ('00000000-0000-0000-0000-000000000001','admin',true,'Admin','admin@example.com'),('00000000-0000-0000-0000-000000000002','staff',true,'Staff','staff@example.com'),('00000000-0000-0000-0000-000000000009','admin',true,null,'second@example.com');
-- Registered (auth) emails differ from profile emails, to prove the auth account is used.
insert into auth.users values ('00000000-0000-0000-0000-000000000001','Admin.Account@Airfairtravel.com'),('00000000-0000-0000-0000-000000000002','staff.account@airfairtravel.com'),('00000000-0000-0000-0000-000000000009','second.admin@airfairtravel.com');
insert into employees(user_id,allowed_modules) values('00000000-0000-0000-0000-000000000002','{"clients":true,"email-inbox":false}');
insert into contacts(id,email) values('00000000-0000-0000-0000-000000000003','customer@example.com');
`);
const migrations=['20261002100000_email_inbox.sql','20261002120000_email_inbox_short_reply_to.sql','20261002140000_email_inbox_provider_status.sql','20261002160000_email_inbox_sender_copy.sql','20261002180000_email_inbox_compose_recipients.sql','20261002200000_email_inbox_mailbox.sql','20261003100000_email_shared_mailboxes.sql'];
for (const f of migrations)
  await db.exec(await readFile(new URL(`../supabase/migrations/${f}`,import.meta.url),'utf8'));
const owner=()=>db.exec('reset role');
// Seeded General mailbox: the migration ran before any traffic existed here, so it is not active.
const general=(await db.query('select * from email_mailboxes where is_default')).rows[0];
assert.equal(general.address,'no-reply@airfairtravel.com');assert.equal(general.all_inbox_users,true);
assert.equal(general.status,'pending','no traffic: General is not active just because it exists');
// Fixture: emulate the live project, where existing sent+received mail verified it.
await db.exec("update email_mailboxes set status='active',sending_verified_at=now(),receiving_verified_at=now() where is_default");
const user=async(id)=>{await db.exec(`set role authenticated; set test.uid='${id}'`);};
const second='00000000-0000-0000-0000-000000000009',admin='00000000-0000-0000-0000-000000000001',staff='00000000-0000-0000-0000-000000000002',contact='00000000-0000-0000-0000-000000000003';
const queue=async(key,thread=null)=> (await db.query("select (queue_inbox_message($1,$2,$3,'Hello','A message')).*",[key,contact,thread])).rows[0];
await user(admin);
const m=await queue('00000000-0000-0000-0000-000000000004');
assert.equal(m.to_email,'customer@example.com');
assert.equal((await queue('00000000-0000-0000-0000-000000000004')).id,m.id);
// Sender attribution comes from auth.uid() and the registered auth email; default copy mode is CC.
assert.equal(m.sender_user_id,admin);assert.equal(m.sender_name,'Admin');
assert.equal(m.sender_email,'admin.account@airfairtravel.com');
assert.equal(m.copy_mode,'cc');assert.equal(m.cc_email,'admin.account@airfairtravel.com');assert.equal(m.bcc_email,null);
// A different admin cannot reuse the request key to re-attribute or alter it.
await user(second);await assert.rejects(queue('00000000-0000-0000-0000-000000000004'),/Request key already used/);
// Second admin without a full name: name null, email fallback recorded. BCC mode.
await owner();await db.exec("update email_settings set inbox_sender_copy='bcc'");await user(second);
const bccMsg=await queue('00000000-0000-0000-0000-000000000010');
assert.equal(bccMsg.sender_name,null);assert.equal(bccMsg.sender_email,'second.admin@airfairtravel.com');
assert.equal(bccMsg.copy_mode,'bcc');assert.equal(bccMsg.bcc_email,'second.admin@airfairtravel.com');assert.equal(bccMsg.cc_email,null);
await owner();await db.exec("update email_settings set inbox_sender_copy='off'");await user(second);
const offMsg=await queue('00000000-0000-0000-0000-000000000011');
assert.equal(offMsg.copy_mode,'off');assert.equal(offMsg.cc_email,null);assert.equal(offMsg.bcc_email,null);
// Emailing your own address never adds a duplicate copy.
await owner();await db.exec("update email_settings set inbox_sender_copy='cc'; insert into contacts(id,email) values('00000000-0000-0000-0000-000000000012','SECOND.admin@airfairtravel.com')");await user(second);
const selfMsg=(await db.query("select (queue_inbox_message($1,'00000000-0000-0000-0000-000000000012',null,'Self','A message')).*",['00000000-0000-0000-0000-000000000013'])).rows[0];
assert.equal(selfMsg.cc_email,null);
// Frontend cannot set or change attribution/recipients directly.
await assert.rejects(db.query("update email_messages set sender_user_id=$1,cc_email='x@example.com' where id=$2",[second,m.id]),/permission denied/);
await owner();
// Retry/refresh claims (any admin, via inbox-send's service role) keep the original sender and copy.
const reclaimed=(await db.query('select * from claim_inbox_send($1)',[m.id])).rows[0];
assert.equal(reclaimed.sender_user_id,admin);assert.equal(reclaimed.cc_email,'admin.account@airfairtravel.com');
await db.query("update email_messages set locked_until=null,status='queued' where id=$1",[m.id]);
await db.query("delete from email_messages where id in ($1,$2,$3)",[bccMsg.id,offMsg.id,selfMsg.id]);
await db.query("delete from email_conversations where id in ($1,$2,$3)",[bccMsg.conversation_id,offMsg.conversation_id,selfMsg.conversation_id]);
await db.query("delete from contacts where id='00000000-0000-0000-0000-000000000012'");
await user(admin);
const c=(await db.query('select * from email_conversations')).rows[0];
assert.equal(c.reply_token.length,64);
await user(staff);
assert.equal((await db.query('select * from email_messages')).rows.length,0);
await assert.rejects(queue('00000000-0000-0000-0000-000000000005'),/access denied/);
await assert.rejects(db.query("insert into email_messages(conversation_id,direction,from_email,to_email,subject,body_text) values($1,'outgoing','x','x','x','x')",[c.id]),/permission denied/);
await owner();await db.exec("set role anon");
await assert.rejects(db.query('select * from email_messages'),/permission denied/);
await owner();await db.exec(`update employees set allowed_modules='{"clients":true,"email-inbox":true}'`);await user(staff);
assert.equal((await db.query('select * from email_messages')).rows.length,1);
await assert.rejects(db.query('insert into email_read_state values($1,$2,now())',[c.id,admin]),/row-level security/);
await owner();
const incoming={id:'resend-in-1',from:'customer@example.com',to:'inbox@reply.airfairtravel.com',subject:'Reply',text:'Hi',headers:{},attachments:[],message_id:'<incoming@example.com>',tokens:[c.reply_token],references:[]};
const accept=async(event,email)=> (await db.query('select accept_inbound_email($1,$2) as id',[event,JSON.stringify(email)])).rows[0].id;
const replyAll=await accept('evt-ra',{...incoming,id:'resend-in-ra',tokens:[c.reply_token.slice(0,48)],cc:'admin.account@airfairtravel.com'});
assert.equal(replyAll,c.id,'Reply All with the CC sender stays in the same conversation');
assert.equal((await db.query("select cc_email from email_messages where resend_id='resend-in-ra'")).rows[0].cc_email,'admin.account@airfairtravel.com');
await db.query("delete from email_messages where resend_id='resend-in-ra'");await db.query("delete from email_webhook_events where event_id='evt-ra'");
const results=await Promise.all([accept('evt-1',incoming),accept('evt-1',incoming),accept('evt-2',incoming)]);
assert.ok(results.every(id=>id===c.id));
assert.equal((await db.query("select * from email_messages where direction='incoming'")).rows.length,1);
const unmatched=await accept('evt-3',{...incoming,id:'resend-in-2',tokens:[],references:[],message_id:'<unmatched@example.com>'});
assert.notEqual(unmatched,c.id,'Same participant must not merge independent conversations');
assert.equal((await db.query('select contact_id from email_conversations where id=$1',[unmatched])).rows[0].contact_id,null);
assert.equal(await accept('evt-5',{...incoming,id:'resend-in-4',tokens:[c.reply_token.slice(0,48)]}),c.id,'Short t-<48> addresses match');
assert.equal(await accept('evt-4',{...incoming,id:'resend-in-3',tokens:[],references:['<incoming@example.com>']}),c.id);
assert.equal((await db.query('select count(*)::int n from contacts')).rows[0].n,1);
await db.exec(`insert into form_submissions values('00000000-0000-0000-0000-000000000006','form@example.com'); update contacts set submission_id='00000000-0000-0000-0000-000000000006';`);
const insertOutbox=async(kind,key)=> (await db.query("insert into email_outbox(dedupe_key,kind,status,submission_id,reply_to,to_email,subject,body_text) values($1,$2,'pending','00000000-0000-0000-0000-000000000006','staff@example.com','form@example.com','Confirmation','Thanks') returning *",[key,kind])).rows[0];
const confirmation=await insertOutbox('client_confirmation','client');
assert.match(confirmation.reply_to,/^t-[a-f0-9]{48}@reply.airfairtravel.com$/);
assert.ok(confirmation.reply_to.split('@')[0].length<=64,'RFC 5321 local-part limit');
assert.equal((await insertOutbox('staff_notification','staff')).reply_to,'staff@example.com');
assert.equal((await insertOutbox('newsletter_confirmation','newsletter')).reply_to,'staff@example.com');
await db.query("update email_outbox set status='retry',last_error='provider offline' where id=$1",[confirmation.id]);
const mirrored=(await db.query('select * from email_messages where outbox_id=$1',[confirmation.id])).rows[0];
assert.equal(mirrored.status,'retry');assert.equal(mirrored.last_error,'provider offline');
// Accepted emails can be claimed for a read-only status refresh and stay 'sent'; unsent ones become 'sending'.
await db.query("update email_messages set status='sent',resend_id='resend-out-1',last_error='Waiting for provider Message-ID; retry to refresh status' where id=$1",[m.id]);
await db.query("insert into email_messages(conversation_id,direction,from_email,to_email,subject,body_text) values($1,'incoming','a@example.com','inbox@reply.airfairtravel.com, inbox@reply.airfairtravel.com, other@reply.airfairtravel.com','x','x')",[c.id]);
await db.exec(await readFile(new URL(`../supabase/migrations/${migrations[2]}`,import.meta.url),'utf8'));
const claimed=(await db.query('select * from claim_inbox_send($1)',[m.id])).rows[0];
assert.equal(claimed.status,'sent');assert.equal(claimed.last_error,null,'accepted email no longer shows the Message-ID wait as an error');
assert.equal((await db.query('select * from claim_inbox_send($1)',[m.id])).rows.length,0,'lease still excludes concurrent refresh');
const deduped=(await db.query("select to_email from email_messages where from_email='a@example.com'")).rows[0].to_email;
assert.equal(deduped,'inbox@reply.airfairtravel.com, other@reply.airfairtravel.com');
// Compose/Reply recipients: server computes the final lists from auth + policy + manual entries.
await owner();await db.exec("update email_settings set inbox_sender_copy='cc'");
await user(admin);
const defaults=(await db.query('select inbox_compose_defaults() d')).rows[0].d;
assert.deepEqual(defaults,{copy_mode:'cc',sender_email:'admin.account@airfairtravel.com',test_mode:false});
const queueWith=(key,conv,cc,bcc)=>db.query("select (queue_inbox_message($1,$2,$3,'Recipients','Body text',$4,$5)).*",[key,conv?null:contact,conv,cc,bcc]).then(r=>r.rows[0]);
// Compose: automatic sender CC + manual CC/BCC exactly as the dashboard shows them.
const composed=await queueWith('00000000-0000-0000-0000-000000000020',null,['admin.account@airfairtravel.com','Partner@Example.com'],['audit@airfairtravel.com']);
assert.equal(composed.cc_email,'admin.account@airfairtravel.com, partner@example.com');
assert.equal(composed.bcc_email,'audit@airfairtravel.com');assert.equal(composed.sender_user_id,admin);
// Reply in the same conversation keeps routing; recipients stored per message.
const replied=await queueWith('00000000-0000-0000-0000-000000000021',composed.conversation_id,['admin.account@airfairtravel.com'],['extra@example.com']);
assert.equal(replied.conversation_id,composed.conversation_id);assert.equal(replied.subject,'Re: Recipients');
assert.equal(replied.cc_email,'admin.account@airfairtravel.com');assert.equal(replied.bcc_email,'extra@example.com');
// Same request key replayed (retry of a saved send) returns the same message; changed lists are refused.
assert.equal((await queueWith('00000000-0000-0000-0000-000000000021',composed.conversation_id,['admin.account@airfairtravel.com'],['extra@example.com'])).id,replied.id);
await assert.rejects(queueWith('00000000-0000-0000-0000-000000000021',composed.conversation_id,['admin.account@airfairtravel.com'],[]),/Request key already used/);
const count=async()=>(await db.query('select count(*)::int n from email_messages')).rows[0].n;
const before=await count();
// Omitting/removing the enforced sender copy, or a stale preview after a policy change, is refused before saving.
await assert.rejects(queueWith('00000000-0000-0000-0000-000000000022',composed.conversation_id,['partner@example.com'],[]),/Recipients changed/);
// Preview made while the copy was Off, sent after an admin switched to CC: refused, so the sender sees the new CC.
await assert.rejects(queueWith('00000000-0000-0000-0000-000000000023',composed.conversation_id,[],[]),/Recipients changed/);
await owner();await db.exec("update email_settings set inbox_sender_copy='bcc'");await user(admin);
// In BCC mode a sender who also lists themselves in CC gets one CC copy, exactly as previewed.
const ownCc=await queueWith('00000000-0000-0000-0000-000000000030',composed.conversation_id,['admin.account@airfairtravel.com'],[]);
assert.equal(ownCc.cc_email,'admin.account@airfairtravel.com');assert.equal(ownCc.bcc_email,null);
// Someone else's address cannot be passed off as the sender copy: it is just a manual recipient.
const bccOk=await queueWith('00000000-0000-0000-0000-000000000024',composed.conversation_id,['second.admin@airfairtravel.com'],['admin.account@airfairtravel.com']);
assert.equal(bccOk.cc_email,'second.admin@airfairtravel.com');assert.equal(bccOk.bcc_email,'admin.account@airfairtravel.com');assert.equal(bccOk.sender_email,'admin.account@airfairtravel.com');
// Validation: invalid address, too many recipients, client address duplicated into CC.
await assert.rejects(queueWith('00000000-0000-0000-0000-000000000025',composed.conversation_id,['not-an-email'],['admin.account@airfairtravel.com']),/Invalid recipient address/);
await assert.rejects(queueWith('00000000-0000-0000-0000-000000000026',composed.conversation_id,Array.from({length:21},(_,i)=>`p${i}@example.com`),['admin.account@airfairtravel.com']),/Too many recipients/);
await assert.rejects(queueWith('00000000-0000-0000-0000-000000000027',composed.conversation_id,['customer@example.com'],['admin.account@airfairtravel.com']),/Recipients changed/);
assert.equal(await count(),before+2,'refused requests save nothing');
// Older dashboards (no lists) still work: automatic copy only.
const legacy=(await db.query("select (queue_inbox_message($1,null,$2,'','Legacy')).*",['00000000-0000-0000-0000-000000000028',composed.conversation_id])).rows[0];
assert.equal(legacy.bcc_email,'admin.account@airfairtravel.com');assert.equal(legacy.cc_email,null);
// Staff without inbox access get neither defaults nor sends; anon cannot call them.
await owner();await db.exec(`update employees set allowed_modules='{"clients":true,"email-inbox":false}'`);await user(staff);
await assert.rejects(db.query('select inbox_compose_defaults()'),/access denied/);
await assert.rejects(queueWith('00000000-0000-0000-0000-000000000029',composed.conversation_id,[],[]),/access denied/);
await owner();await db.exec('set role anon');
await assert.rejects(db.query('select inbox_compose_defaults()'),/permission denied/);
await owner();await db.exec("update email_settings set inbox_sender_copy='cc'");
// Mailbox: folders, search, unread counts and per-user read state through inbox_list / inbox_folder_counts.
await owner();await db.exec(`update employees set allowed_modules='{"clients":true,"email-inbox":true}'`);
await db.exec("alter table contacts add column if not exists name text; update contacts set name='Maria Santos' where id='00000000-0000-0000-0000-000000000003'");
await db.exec('grant select on contacts to authenticated');
const fresh={id:'resend-in-mailbox',from:'new.client@example.com',to:'inbox@reply.airfairtravel.com',cc:'',subject:'Visa question',text:'Hello, about my passport renewal',headers:{},attachments:[{filename:'scan.pdf',content_type:null}],message_id:'<mb@example.com>',tokens:[],references:[]};
const freshConv=await accept('evt-mailbox',fresh);
await user(admin);
const list=async(folder,q=null,contactId=null)=>(await db.query('select * from inbox_list($1,$2,$3,0,50)',[folder,q,contactId])).rows;
const inbox=await list('inbox');
const row=inbox.find(r=>r.id===freshConv);
assert.ok(row,'Inbox shows incoming mail without switching to All');assert.equal(row.unread,true);assert.equal(row.has_attachments,true);
assert.equal(row.last_preview,'Hello, about my passport renewal');assert.equal(row.last_sender,'new.client@example.com');
assert.equal(Number(row.total_count),inbox.length);
assert.ok((await list('unassigned')).some(r=>r.id===freshConv));
assert.ok(!(await list('sent')).some(r=>r.id===freshConv),'Sent lists only conversations with outgoing mail');
assert.ok((await list('sent')).some(r=>r.id===composed.conversation_id));
assert.ok((await list('all')).length>=inbox.length);
// Search covers subject, addresses, lead name and message text; LIKE wildcards are literal.
assert.deepEqual((await list('all','passport')).map(r=>r.id),[freshConv]);
assert.ok((await list('all','maria')).every(r=>r.contact_name==='Maria Santos'));
assert.ok((await list('all','maria')).length>0);
assert.equal((await list('all','%')).length,0);
// Outgoing previews carry the recorded staff sender.
assert.equal((await list('all',null,contact)).find(r=>r.id===composed.conversation_id).last_direction,'outgoing');
let counts=(await db.query('select inbox_folder_counts() c')).rows[0].c;
assert.ok(counts.inbox_unread>=1);assert.ok(counts.unassigned_unread>=1);
const unreadBefore=counts.inbox_unread;
// Read state is per user: admin marks read, staff still sees it unread; mark unread restores it.
await db.query('insert into email_read_state values($1,$2,now()) on conflict (conversation_id,user_id) do update set read_at=now()',[freshConv,admin]);
assert.equal((await list('inbox')).find(r=>r.id===freshConv).unread,false);
assert.equal((await db.query('select inbox_folder_counts() c')).rows[0].c.inbox_unread,unreadBefore-1);
await user(staff);assert.equal((await list('inbox')).find(r=>r.id===freshConv).unread,true);
await user(admin);
await db.query("update email_read_state set read_at='1970-01-01' where conversation_id=$1 and user_id=$2",[freshConv,admin]);
assert.equal((await list('inbox')).find(r=>r.id===freshConv).unread,true);
// No inbox access: empty lists and zero counts (RLS + can_use_email_inbox), anon refused.
await owner();await db.exec(`update employees set allowed_modules='{"clients":true,"email-inbox":false}'`);await user(staff);
assert.equal((await list('all')).length,0);
assert.equal((await db.query('select inbox_folder_counts() c')).rows[0].c.inbox_unread,0);
await owner();await db.exec('set role anon');await assert.rejects(db.query("select * from inbox_list('all')"),/permission denied/);
await owner();await db.exec(`update employees set allowed_modules='{"clients":true,"email-inbox":true}'`);

// Attachments: own folder + request key only, real size/type from storage, limits, immutable references.
const keyA='00000000-0000-0000-0000-000000000040';
const put=(name,size,mime='application/pdf')=>db.query("insert into storage.objects(bucket_id,name,metadata) values('email-attachments',$1,$2)",[name,JSON.stringify({size,mimetype:mime})]);
await put(`outgoing/${admin}/${keyA}/0-quote.pdf`,2048);
await user(admin);
const withFiles=(key,files,conv=composed.conversation_id)=>db.query("select (queue_inbox_message($1,null,$2,'','With files',$3,$4,$5)).*",[key,conv,['admin.account@airfairtravel.com'],[],JSON.stringify(files)]).then(r=>r.rows[0]);
await owner();await db.exec("update email_settings set inbox_sender_copy='cc'");await user(admin);
const attached=await withFiles(keyA,[{path:`outgoing/${admin}/${keyA}/0-quote.pdf`,filename:'Quote "final".pdf'}]);
assert.deepEqual(attached.attachments,[{path:`outgoing/${admin}/${keyA}/0-quote.pdf`,filename:'Quote _final_.pdf',content_type:'application/pdf',size:2048}]);
assert.equal((await withFiles(keyA,[{path:`outgoing/${admin}/${keyA}/0-quote.pdf`,filename:'Quote "final".pdf'}])).id,attached.id,'retry of the saved request');
await assert.rejects(withFiles(keyA,[]),/Request key already used/);
const keyB='00000000-0000-0000-0000-000000000041';
await assert.rejects(withFiles(keyB,[{path:`outgoing/${staff}/${keyB}/0-x.pdf`,filename:'x.pdf'}]),/Invalid attachment/,"another user's upload");
await assert.rejects(withFiles(keyB,[{path:`outgoing/${admin}/${keyA}/0-quote.pdf`,filename:'x.pdf'}]),/Invalid attachment/,'file from another request');
await assert.rejects(withFiles(keyB,[{path:`outgoing/${admin}/${keyB}/0-gone.pdf`,filename:'gone.pdf'}]),/not found/);
await owner();await put(`outgoing/${admin}/${keyB}/0-run.exe`,10);await put(`outgoing/${admin}/${keyB}/1-big.bin`,11*1024*1024);await user(admin);
await assert.rejects(withFiles(keyB,[{path:`outgoing/${admin}/${keyB}/0-run.exe`,filename:'run.exe'}]),/cannot be emailed/);
await assert.rejects(withFiles(keyB,[{path:`outgoing/${admin}/${keyB}/1-big.bin`,filename:'big.bin'}]),/10 MB/,'size comes from storage, not the request');
await assert.rejects(withFiles(keyB,Array.from({length:6},(_,i)=>({path:`outgoing/${admin}/${keyB}/${i}-a`,filename:'a'}))),/maximum 5/);
// Storage policies: inbox users upload only into their own outgoing/<uid>/ folder.
const policies=(await db.query("select policyname, cmd from pg_policies where tablename='objects' and policyname like 'email_attachments%' order by 1")).rows;
assert.deepEqual(policies.map(p=>p.cmd),['SELECT','INSERT']);
await owner();await db.exec("update email_settings set inbox_sender_copy='cc'");
// ---------------- Shared mailboxes ----------------
await owner();
const sha=async v=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(v)))].map(b=>b.toString(16).padStart(2,'0')).join('');
const rpc1=async(sql,args=[])=>(await db.query(sql,args)).rows[0];
await user(staff);
await assert.rejects(db.query("select admin_save_mailbox(null,'Visa','visa@airfairtravel.com',false)"),/Only administrators/);
await user(admin);
const visa=await rpc1("select * from admin_save_mailbox(null,'Visa','Visa@AirfairTravel.com',false)");
assert.equal(visa.address,'visa@airfairtravel.com');assert.equal(visa.receiving_address,'visa@reply.airfairtravel.com');
assert.equal(visa.status,'pending','created, not verified: not active');
await assert.rejects(db.query("select admin_save_mailbox(null,'X','x@gmail.com',false)"),/airfairtravel\.com/);
await assert.rejects(db.query("select admin_save_mailbox(null,'X','t-abc@airfairtravel.com',false)"),/reserved/);
await assert.rejects(db.query("select admin_save_mailbox(null,'Visa 2','visa@airfairtravel.com',false)"),/already a mailbox/);
await assert.rejects(db.query("select admin_save_mailbox(null,'Inbox','inbox@airfairtravel.com',false)"),/already a mailbox/,'forwarding address taken by General');
await assert.rejects(db.query("update email_mailboxes set status='active' where id=$1",[visa.id]),/permission denied/,'no client path to Active');
await assert.rejects(db.query('select admin_set_default_mailbox($1)',[visa.id]),/Only an active mailbox/);
// Verification: the probe must come back for this mailbox's address; replays stay consumed.
await owner();
const token='a'.repeat(64);
await db.query('insert into email_mailbox_verifications(mailbox_id,token_hash) values($1,$2)',[visa.id,await sha(token)]);
await db.query('update email_mailboxes set sending_verified_at=now() where id=$1',[visa.id]);
const confirm=async(t,r)=>(await db.query('select confirm_mailbox_verification($1,$2) ok',[await sha(t),r])).rows[0].ok;
assert.equal(await confirm(token,['someone@else.test']),false,'wrong recipient');
assert.equal(await confirm('b'.repeat(64),['visa@airfairtravel.com']),false,'unknown token');
assert.equal((await rpc1('select status from email_mailboxes where id=$1',[visa.id])).status,'pending');
assert.equal(await confirm(token,['visa@reply.airfairtravel.com']),true);
assert.equal((await rpc1('select status from email_mailboxes where id=$1',[visa.id])).status,'active');
assert.equal(await confirm(token,['visa@reply.airfairtravel.com']),true,'provider retry of the probe stays consumed');
await user(admin);await assert.rejects(db.query('select confirm_mailbox_verification($1,$2)',[await sha(token),['x']]),/permission denied/);
// Travel: active, no members. Info: active then disabled.
const travel=await rpc1("select * from admin_save_mailbox(null,'Travel','travel@airfairtravel.com',false)");
const info=await rpc1("select * from admin_save_mailbox(null,'Info','info@airfairtravel.com',false)");
await owner();await db.query("update email_mailboxes set status='active',sending_verified_at=now(),receiving_verified_at=now() where id in ($1,$2)",[travel.id,info.id]);
await user(admin);
await db.query("select admin_set_mailbox_members($1,$2)",[visa.id,JSON.stringify([{user_id:staff,can_send:true}])]);
await assert.rejects(db.query('select admin_set_mailbox_enabled($1,false)',[general.id]),/default/);
assert.equal((await rpc1('select status from admin_set_mailbox_enabled($1,false)',[info.id])).status,'disabled');
// Inbound routing from recipient data: one message for two mailboxes; envelope-only; disabled/unknown -> default.
await owner();
const inbound=(id,recipients,extra={})=>accept(`evt-${id}`,{id,from:'customer@example.com',to:recipients[0],subject:`Routing ${id}`,text:'Body',headers:{},attachments:[],message_id:`<${id}@example.com>`,tokens:[],references:[],recipients,...extra});
const multi=await inbound('mb-multi',['visa@airfairtravel.com','travel@airfairtravel.com']);
assert.equal((await rpc1('select count(*)::int n from email_messages where conversation_id=$1',[multi])).n,1,'not duplicated');
assert.deepEqual((await db.query('select mailbox_id from email_conversation_mailboxes where conversation_id=$1 order by mailbox_id',[multi])).rows.map(r=>r.mailbox_id).sort(),[visa.id,travel.id].sort());
assert.equal((await rpc1('select mailbox_id from email_conversations where id=$1',[multi])).mailbox_id,visa.id,'first addressed mailbox receives');
const envelope=await inbound('mb-env',['customer.alias@example.com','travel@reply.airfairtravel.com']);
assert.equal((await rpc1('select mailbox_id from email_conversations where id=$1',[envelope])).mailbox_id,travel.id,'routed by envelope (received_for)');
const disabledTo=await inbound('mb-dis',['info@airfairtravel.com']);
assert.equal((await rpc1('select mailbox_id from email_conversations where id=$1',[disabledTo])).mailbox_id,general.id,'disabled mailbox: default receives');
const subjectOnly=await inbound('mb-subj',['inbox@reply.airfairtravel.com'],{subject:'visa@airfairtravel.com',from:'visa@airfairtravel.com'});
assert.equal((await rpc1('select mailbox_id from email_conversations where id=$1',[subjectOnly])).mailbox_id,general.id,'subject/sender never route');
await db.query("insert into email_messages(conversation_id,direction,from_email,to_email,subject,body_text,attachments) values($1,'incoming','c@example.com','travel@airfairtravel.com','x','x',$2)",
  [envelope,JSON.stringify([{path:'outgoing/x/y/0-secret.pdf',filename:'secret.pdf'}])]);
// Staff: member of Visa (send) + General (all inbox users); not Travel.
await user(staff);
const mine=(await db.query('select * from inbox_my_mailboxes()')).rows;
assert.deepEqual(mine.map(b=>b.address).sort(),['no-reply@airfairtravel.com','visa@airfairtravel.com']);
assert.equal(mine.find(b=>b.id===visa.id).can_send,true);
assert.equal((await db.query('select id from email_conversations where id=$1',[multi])).rows.length,1,'visible through Visa');
assert.equal((await db.query('select id from email_conversations where id=$1',[envelope])).rows.length,0,'Travel-only thread hidden');
assert.equal((await db.query('select id from email_messages where conversation_id=$1',[envelope])).rows.length,0);
assert.ok(!(await list('all','Routing')).some(r=>r.id===envelope),'search cannot reveal other mailboxes');
assert.ok((await list('all',null,null)).some(r=>r.id===multi));
assert.deepEqual((await db.query("select id from inbox_list('all',null,null,0,50,$1)",[visa.id])).rows.map(r=>r.id).includes(multi),true);
assert.equal((await rpc1('select can_read_email_attachment($1) ok',['outgoing/x/y/0-secret.pdf'])).ok,false,'attachment of a hidden thread');
await assert.rejects(db.query("select (queue_inbox_message($1,null,$2,'','Hi')).*",['00000000-0000-0000-0000-000000000050',envelope]),/Conversation not found/);
// Reply defaults to the mailbox that received it: From visa@, Reply-To thread unchanged (payload test in core tests).
const staffReply=(await db.query("select (queue_inbox_message($1,null,$2,'','Reply from visa')).*",['00000000-0000-0000-0000-000000000051',multi])).rows[0];
assert.equal(staffReply.mailbox_id,visa.id);assert.equal(staffReply.from_email,'visa@airfairtravel.com');assert.equal(staffReply.from_name,'Visa');
assert.equal(staffReply.sender_user_id,staff);assert.equal(staffReply.cc_email,'staff.account@airfairtravel.com','automatic sender CC kept');
await assert.rejects(db.query("select (queue_inbox_message($1,$2,null,'New','Body',null,null,null,$3)).*",['00000000-0000-0000-0000-000000000052',contact,travel.id]),/cannot send from this mailbox/);
const fromVisa=(await db.query("select (queue_inbox_message($1,$2,null,'New from visa','Body',null,null,null,$3)).*",['00000000-0000-0000-0000-000000000053',contact,visa.id])).rows[0];
assert.equal(fromVisa.from_email,'visa@airfairtravel.com');
assert.equal((await rpc1('select mailbox_id from email_conversations where id=$1',[fromVisa.conversation_id])).mailbox_id,visa.id);
// Read-only member: can read, cannot send.
await user(admin);await db.query("select admin_set_mailbox_members($1,$2)",[visa.id,JSON.stringify([{user_id:staff,can_send:false}])]);
await user(staff);
assert.equal((await db.query('select id from email_conversations where id=$1',[multi])).rows.length,1);
await assert.rejects(db.query("select (queue_inbox_message($1,null,$2,'','No send')).*",['00000000-0000-0000-0000-000000000054',multi]),/cannot send/);
// Replying from another sendable mailbox (General) files the thread there too.
const viaGeneral=(await db.query("select (queue_inbox_message($1,null,$2,'','Via general',null,null,null,$3)).*",['00000000-0000-0000-0000-000000000055',multi,general.id])).rows[0];
assert.equal(viaGeneral.from_email,'no-reply@airfairtravel.com');
await user(admin);
assert.equal((await db.query('select id from email_conversations where id=$1',[envelope])).rows.length,1,'admins read every mailbox');
assert.equal((await rpc1('select can_read_email_attachment($1) ok',['outgoing/x/y/0-secret.pdf'])).ok,true);
// Disable stops sending; re-enable restores only a previously verified mailbox; address change re-verifies.
await db.query('select admin_set_mailbox_enabled($1,false)',[visa.id]);
await assert.rejects(db.query("select (queue_inbox_message($1,null,$2,'','Disabled',null,null,null,$3)).*",['00000000-0000-0000-0000-000000000056',multi,visa.id]),/not active/);
assert.equal((await rpc1('select status from admin_set_mailbox_enabled($1,true)',[visa.id])).status,'active');
const moved=await rpc1("select * from admin_save_mailbox($1,'Visa','visas@airfairtravel.com',false)",[visa.id]);
assert.equal(moved.status,'pending');assert.equal(moved.sending_verified_at,null);assert.equal(moved.receiving_address,'visas@reply.airfairtravel.com');
// Mailboxes table: staff see only readable mailboxes; members list only their own rows.
await user(staff);
assert.equal((await db.query('select id from email_mailboxes where id=$1',[travel.id])).rows.length,0);
await assert.rejects(db.query('select * from email_mailbox_verifications'),/permission denied/);
await owner();
console.log('Inbox database checks passed: RLS, permissions, durable deduplication, thread matching, unassigned messages, queue idempotency, form auto-reply link and preserved staff/newsletter routing.');
await db.close();
