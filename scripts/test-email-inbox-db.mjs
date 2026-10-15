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
create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz default now(),banned_until timestamptz);
-- Minimal Supabase Storage stand-in (bucket rows, objects with size metadata, foldername()).
create schema storage; grant usage on schema storage to authenticated,anon,service_role;
create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint);
create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,metadata jsonb,unique(bucket_id,name));
create function storage.foldername(name text) returns text[] language sql immutable as $$ select (string_to_array(name,'/'))[1:cardinality(string_to_array(name,'/'))-1] $$;
create table email_settings(id smallint primary key default 1,sending_enabled boolean not null default false,test_redirect_to text);
insert into email_settings(id) values(1);
create function auth_role() returns text language sql security definer as $$ select coalesce((select role from profiles where id=auth.uid() and is_active),'none') $$;
create function is_admin() returns boolean language sql stable security definer as $$ select auth_role()='admin' $$;
create function is_editor() returns boolean language sql stable security definer as $$ select auth_role() in ('admin','editor') $$;
create function is_team() returns boolean language sql stable security definer as $$ select auth_role() in ('admin','editor','staff') $$;
-- Minimal stand-ins for tables whose policies the section-permission migration replaces.
create table cms_documents(id uuid primary key default gen_random_uuid(),kind text,slug text,title text,sort_order int default 0,draft jsonb default '{}',draft_revision int default 1);
create table cms_versions(id uuid primary key default gen_random_uuid(),document_id uuid,version_no int,action text,title text,slug text,sort_order int,content jsonb,draft_revision int,note text,created_by uuid);
create function cms_is_service_caller() returns boolean language sql as $$ select false $$;
create function cms_next_version_no(p uuid) returns int language sql as $$ select 1 $$;
create table media(id uuid primary key default gen_random_uuid(),name text);
create table email_templates(id uuid primary key default gen_random_uuid(),form_id text,subject text);
create table site_settings(id text primary key,value jsonb,chat_widget_code text);
create table stage_task_templates(id uuid primary key default gen_random_uuid(),stage text,title text);
create table pipeline_stages(id uuid primary key default gen_random_uuid(),name text);
-- Stand-ins for Supabase Vault, pg_cron, pg_net and pgcrypto's gen_random_bytes, plus newsletter subscribers.
create schema vault; create table vault.secrets(id uuid primary key default gen_random_uuid(),name text unique,secret text);
create view vault.decrypted_secrets as select name, secret as decrypted_secret from vault.secrets;
create function vault.create_secret(s text,n text,d text default null) returns uuid language sql as $$ insert into vault.secrets(name,secret) values(n,s) returning id $$;
create schema if not exists extensions; create function extensions.gen_random_bytes(n int) returns bytea language sql as $$ select decode(md5(random()::text)||md5(random()::text),'hex') $$;
create schema cron; create table cron.job(jobid serial primary key,jobname text,schedule text,command text);
create function cron.schedule(n text,sch text,c text) returns int language sql as $$ insert into cron.job(jobname,schedule,command) values(n,sch,c) returning jobid $$;
create function cron.unschedule(id int) returns boolean language sql as $$ delete from cron.job where jobid=id returning true $$;
create schema net; create table net.calls(id bigserial primary key,url text,headers jsonb);
create function net.http_post(url text,body jsonb,headers jsonb,timeout_milliseconds int) returns bigint language sql as $$ insert into net.calls(url,headers) values(url,headers) returning id $$;
create table newsletter_subscribers(id uuid primary key default gen_random_uuid(),email text,confirmed_at timestamptz,unsubscribed_at timestamptz);
create table employees(id uuid primary key default gen_random_uuid(),user_id uuid,name text,email text,role text,allowed_modules jsonb,created_at timestamptz default now());
create table form_submissions(id uuid primary key,email text,created_at timestamptz not null default now());
create table contacts(id uuid primary key,submission_id uuid,email text,name text,assigned_employee_id uuid,created_at timestamptz default now());
create table email_outbox(id uuid primary key default gen_random_uuid(),dedupe_key text unique,kind text,status text,submission_id uuid,reply_to text,to_email text,subject text,body_text text,provider_message_id text,sent_at timestamptz,last_error text);
insert into profiles values ('00000000-0000-0000-0000-000000000001','admin',true,'Admin','admin@example.com'),('00000000-0000-0000-0000-000000000002','staff',true,'Staff','staff@example.com'),('00000000-0000-0000-0000-000000000009','admin',true,null,'second@example.com');
-- Registered (auth) emails differ from profile emails, to prove the auth account is used.
insert into auth.users(id,email) values ('00000000-0000-0000-0000-000000000001','Admin.Account@Airfairtravel.com'),('00000000-0000-0000-0000-000000000002','staff.account@airfairtravel.com'),('00000000-0000-0000-0000-000000000009','second.admin@airfairtravel.com');
insert into employees(user_id,allowed_modules) values('00000000-0000-0000-0000-000000000002','{"clients":true,"email-inbox":false}');
-- Seeded sample team members like the live project (no account, @airfair.com).
insert into employees(name,email,role) values('Sarah Chen','sarah.chen@airfair.com','Senior Visa Consultant'),('Daniel Ong','daniel.ong@airfair.com','Office Administrator');
insert into contacts(id,email) values('00000000-0000-0000-0000-000000000003','customer@example.com');
`);
const migrations=['20261002100000_email_inbox.sql','20261002120000_email_inbox_short_reply_to.sql','20261002140000_email_inbox_provider_status.sql','20261002160000_email_inbox_sender_copy.sql','20261002180000_email_inbox_compose_recipients.sql','20261002200000_email_inbox_mailbox.sql','20261003100000_email_shared_mailboxes.sql','20261003120000_email_form_inquiries.sql','20261003140000_team_accounts.sql','20261003160000_team_section_access.sql','20261003180000_role_access_defaults.sql','20261003200000_section_permissions.sql','20261003220000_client_tags.sql','20261003240000_contacts_archive.sql','20261003260000_email_campaigns.sql','20261003280000_send_only_mailboxes.sql','20261003300000_campaign_cc_bcc.sql','20261004090000_protect_executable_settings.sql','20261004091000_preserve_inbound_thread_access.sql','20261004100000_guard_admin_employee_replacement.sql','20261004101000_require_verified_team_accounts.sql'];
for (const f of migrations)
  await db.exec(await readFile(new URL(`../supabase/migrations/${f}`,import.meta.url),'utf8'));
// Owner = server-side context (no signed-in user), like the service role in production.
const owner=()=>db.exec("reset role; set test.uid=''");
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
await owner();await db.exec(`update employees set custom_access=true, allowed_modules='{"clients":true,"email-inbox":true}' where user_id='00000000-0000-0000-0000-000000000002'`);await user(staff);
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
await owner();await db.exec(`update employees set custom_access=true, allowed_modules='{"clients":true,"email-inbox":false}' where user_id='00000000-0000-0000-0000-000000000002'`);await user(staff);
await assert.rejects(db.query('select inbox_compose_defaults()'),/access denied/);
await assert.rejects(queueWith('00000000-0000-0000-0000-000000000029',composed.conversation_id,[],[]),/access denied/);
await owner();await db.exec('set role anon');
await assert.rejects(db.query('select inbox_compose_defaults()'),/permission denied/);
await owner();await db.exec("update email_settings set inbox_sender_copy='cc'");
// Mailbox: folders, search, unread counts and per-user read state through inbox_list / inbox_folder_counts.
await owner();await db.exec(`update employees set custom_access=true, allowed_modules='{"clients":true,"email-inbox":true}' where user_id='00000000-0000-0000-0000-000000000002'`);
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
await owner();await db.exec(`update employees set custom_access=true, allowed_modules='{"clients":true,"email-inbox":false}' where user_id='00000000-0000-0000-0000-000000000002'`);await user(staff);
assert.equal((await list('all')).length,0);
assert.equal((await db.query('select inbox_folder_counts() c')).rows[0].c.inbox_unread,0);
await owner();await db.exec('set role anon');await assert.rejects(db.query("select * from inbox_list('all')"),/permission denied/);
await owner();await db.exec(`update employees set custom_access=true, allowed_modules='{"clients":true,"email-inbox":true}' where user_id='00000000-0000-0000-0000-000000000002'`);

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
// ---------------- Website inquiries land in Inbox ----------------
await owner();
const subA='00000000-0000-0000-0000-0000000000a1', subB='00000000-0000-0000-0000-0000000000b2';
await db.query("insert into form_submissions(id,email,created_at) values($1,'John.Smith@Example.com',now()-interval '1 minute'),($2,'nora@example.com',now()-interval '1 minute')",[subA,subB]);
await db.query("insert into contacts(id,email,name,submission_id) values('00000000-0000-0000-0000-0000000000c3','john.smith@example.com','john smith',$1)",[subA]);
// Same statement as form-submit: staff notification + client auto-reply.
const outboxPair=(sub,clientStatus)=>db.query(`insert into email_outbox(dedupe_key,kind,status,submission_id,reply_to,to_email,subject,body_text) values
  ($1,'staff_notification','pending',$3,'john.smith@example.com','admin@airfairtravel.com','New Visa inquiry: john smith','Name: john smith\nService: Visa'),
  ($2,'client_confirmation',$4,$3,'admin@airfairtravel.com','john.smith@example.com','We received your Visa inquiry','Thanks')
  on conflict (dedupe_key) do nothing`,[`form:${sub}:staff`,`form:${sub}:client`,sub,clientStatus]);
await outboxPair(subA,'pending');
const convA=(await rpc1('select * from email_conversations where submission_id=$1',[subA]));
assert.ok(convA,'conversation exists');assert.equal(convA.contact_id,'00000000-0000-0000-0000-0000000000c3','linked to the lead');
assert.equal(convA.subject,'We received your Visa inquiry','replies keep the client-facing subject');
const msgsA=(await db.query('select direction,from_email,subject,body_text,headers from email_messages where conversation_id=$1 order by created_at,id',[convA.id])).rows;
assert.deepEqual(msgsA.map(m=>m.direction),['incoming','outgoing'],'inquiry first, then the auto-reply');
assert.equal(msgsA[0].from_email,'john.smith@example.com');assert.equal(msgsA[0].subject,'New Visa inquiry: john smith');
assert.match(msgsA[0].body_text,/Service: Visa/);assert.equal(msgsA[0].headers['x-airfair-source'],'website-form');
assert.ok(convA.last_incoming_at,'counts as incoming');
// Duplicate submission insert does nothing (ON CONFLICT DO NOTHING never fires AFTER INSERT).
await outboxPair(subA,'pending');
assert.equal((await rpc1("select count(*)::int n from email_messages where conversation_id=$1 and direction='incoming'",[convA.id])).n,1);
// Auto-reply off/skipped: the inquiry still appears.
await outboxPair(subB,'skipped');
const convB=await rpc1('select * from email_conversations where submission_id=$1',[subB]);
assert.ok(convB,'created by the inquiry itself');assert.equal(convB.subject,'New Visa inquiry: john smith');
assert.equal((await rpc1("select count(*)::int n from email_messages where conversation_id=$1 and direction='incoming'",[convB.id])).n,1);
// Unread in Inbox for every user who can read the default mailbox, until each opens it.
for (const who of [admin,staff,second]) {
  await user(who);
  const row=(await list('inbox')).find(r=>r.id===convA.id);
  assert.ok(row,'in Inbox');assert.equal(row.unread,true);assert.equal(row.contact_name,'john smith');
  assert.ok((await db.query('select inbox_folder_counts() c')).rows[0].c.inbox_unread>=2);
}
await user(admin);await db.query('insert into email_read_state values($1,$2,now())',[convA.id,admin]);
assert.equal((await list('inbox')).find(r=>r.id===convA.id).unread,false);
await user(staff);assert.equal((await list('inbox')).find(r=>r.id===convA.id).unread,true,'read state is per user');
await owner();
// ---------------- Team: every member is an account ----------------
await owner();
assert.equal((await rpc1("select count(*)::int n from employees where email like '%@airfair.com'")).n,0,'sample employees removed');
const team=(await db.query('select p.id, count(e.id)::int n from profiles p left join employees e on e.user_id=p.id group by p.id')).rows;
assert.ok(team.every(t=>t.n===1),'exactly one team record per account');
assert.equal((await rpc1('select allowed_modules from employees where user_id=$1',[staff])).allowed_modules.clients,true,'existing staff access kept');
assert.equal((await rpc1('select name from employees where user_id=$1',[second])).name,'second@example.com','no full name: email used');
await assert.rejects(db.query("insert into employees(name,email) values('No Account','x@example.com')"),/null value|not-null/);
await assert.rejects(db.query('insert into employees(user_id,name) values($1,$2)',[staff,'Duplicate']),/duplicate|unique/);
// An invite creates the account's profile; the team record follows automatically and stays in sync.
const invited='00000000-0000-0000-0000-0000000000d4';
await db.query("insert into profiles(id,role,is_active,full_name,email) values($1,'none',true,'','new.person@airfairtravel.com')",[invited]);
let rec=await rpc1('select * from employees where user_id=$1',[invited]);
assert.equal(rec.name,'new.person@airfairtravel.com');assert.equal(rec.allowed_modules['email-inbox'],false,'staff inbox access still defaults off');
await db.query("update profiles set full_name='New Person', role='staff' where id=$1",[invited]);
assert.equal((await rpc1('select name from employees where user_id=$1',[invited])).name,'New Person');
await assert.rejects(db.query('update employees set user_id=$1 where user_id=$2',[second,invited]),/own account/);
await db.query('delete from profiles where id=$1',[invited]);
assert.equal((await rpc1('select count(*)::int n from employees where user_id=$1',[invited])).n,0,'removing an account removes its team record');
// ---------------- Section access (all roles) ----------------
await owner();
// Fixture: production's profiles access (select own-or-admin; updates governed by the migration's policy).
await db.exec("alter table profiles enable row level security; grant select, update on profiles to authenticated; alter table employees enable row level security; create policy employees_team_read on employees for select to authenticated using (true); grant select, insert, update on employees to authenticated;");
const acc = await import(new URL('../src/dashboard/access.js', import.meta.url));
for (const r of ['admin','editor','staff','none']) {
  assert.deepEqual((await rpc1('select role_sections($1) s',[r])).s, acc.ROLE_SECTIONS[r], `role_sections(${r}) matches access.js`);
  assert.deepEqual((await rpc1('select role_default_sections($1) s',[r])).s, acc.ROLE_DEFAULTS[r], `defaults(${r}) match access.js`);
}
const allowed=async(u,k)=>(await rpc1('select section_allowed($1,$2) ok',[u,k])).ok;
await db.exec("update employees set custom_access=false where user_id in ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000009')");
assert.equal(await allowed(admin,'team'),true);assert.equal(await allowed(admin,'settings'),true,'admin defaults: everything');
await db.query("update employees set custom_access=false where user_id=$1",[staff]);
assert.equal(await allowed(staff,'pipeline'),true);assert.equal(await allowed(staff,'email-inbox'),false,'staff default: no inbox');
await user(staff);assert.equal((await rpc1('select can_use_email_inbox() ok')).ok,false);await owner();
// Custom: add inbox for staff; never beyond the role (settings stays off); inbox needs clients.
await db.query(`update employees set custom_access=true, allowed_modules='{"clients":true,"email-inbox":true,"settings":true}' where user_id=$1`,[staff]);
assert.equal(await allowed(staff,'email-inbox'),true);assert.equal(await allowed(staff,'settings'),true,'any section can be granted to any role');
assert.equal(await allowed(staff,'pipeline'),false,'custom list replaces defaults');
await user(staff);assert.equal((await rpc1('select can_use_email_inbox() ok')).ok,true);await owner();
await db.query(`update employees set allowed_modules='{"email-inbox":true}' where user_id=$1`,[staff]);
assert.equal(await allowed(staff,'email-inbox'),false,'Email Inbox also needs Clients');
// Admins can be limited too: second admin without Email Inbox loses inbox data access.
await db.query(`update employees set custom_access=true, allowed_modules='{"clients":true,"pipeline":true}' where user_id=$1`,[second]);
assert.equal(await allowed(second,'team'),false);
await user(second);assert.equal((await rpc1('select can_use_email_inbox() ok')).ok,false);
assert.equal((await db.query('select id from email_conversations')).rows.length,0,'no inbox section, no inbox data');
// Team management needs Team access, even for an admin.
assert.equal((await db.query("update profiles set full_name='x' where id=$1 returning id",[staff])).rows.length,0,'admin without Team access cannot change accounts');
await user(admin);
assert.equal((await db.query("update profiles set full_name='Staff' where id=$1 returning id",[staff])).rows.length,1,'admin with Team access can');
await owner();
// Lockout guard: the last admin with Team access cannot lose it.
await assert.rejects(db.query(`update employees set custom_access=true, allowed_modules='{"clients":true}' where user_id=$1`,[admin]),/keep access to Team/);
await db.query(`update employees set custom_access=false where user_id in ($1,$2)`,[second,staff]);
await db.query(`update employees set custom_access=true, allowed_modules='{"clients":true}' where user_id=$1`,[admin]);
assert.equal(await allowed(admin,'team'),false,'fine while another admin keeps Team');
await db.query(`update employees set custom_access=false where user_id=$1`,[admin]);
await db.query(`update employees set custom_access=true, allowed_modules='{"clients":true,"email-inbox":true}' where user_id=$1`,[staff]);
// ---------------- Editable role defaults ----------------
await owner();
await db.query("update employees set custom_access=false where user_id=$1",[staff]);
await user(staff);
assert.equal((await db.query('select * from role_access_defaults')).rows.length,3,'everyone can read the defaults');
assert.equal((await db.query("update role_access_defaults set sections='{}' where role='staff' returning role")).rows.length,0,'staff cannot change defaults');
await user(admin);
// Admin turns Email Inbox (and Settings) on for all staff by default.
await db.query("update role_access_defaults set sections=$1 where role='staff'",[['clients','pipeline','email-inbox','settings']]);
assert.deepEqual((await rpc1("select sections from role_access_defaults where role='staff'")).sections,['clients','email-inbox','pipeline','settings'],'kept in the standard order; any section allowed');
await owner();assert.equal(await allowed(staff,'email-inbox'),true,'staff on defaults get the new default');
assert.equal(await allowed(staff,'forms'),false);
await user(staff);assert.equal((await rpc1('select can_use_email_inbox() ok')).ok,true);await user(admin);
// Custom people keep their own list.
await owner();await db.query(`update employees set custom_access=true, allowed_modules='{"clients":true,"forms":true}' where user_id=$1`,[staff]);
assert.equal(await allowed(staff,'email-inbox'),false);assert.equal(await allowed(staff,'forms'),true);await user(admin);
// Admin defaults cannot drop Team while every admin follows them.
await assert.rejects(db.query("update role_access_defaults set sections=$1 where role='admin'",[['clients']]),/keep access to Team/);
await db.query("update role_access_defaults set sections=$1 where role='staff'",[['clients','pipeline','forms','documents','bookings']]);
await owner();
await db.query(`update employees set custom_access=true, allowed_modules='{"clients":true,"email-inbox":true}' where user_id=$1`,[staff]);
// ---------------- Sections grant server permissions, for any role ----------------
await owner();
await db.exec(`alter table cms_documents enable row level security; alter table site_settings enable row level security;
  alter table email_templates enable row level security; alter table email_settings enable row level security;
  grant select, insert, update on cms_documents, site_settings, email_templates, email_settings to authenticated;
  insert into site_settings(id,value) values ('business', '{}');`);
const grant=(u,obj)=>db.query(`update employees set custom_access=true, allowed_modules=$2 where user_id=$1`,[u,JSON.stringify(obj)]);
await grant(staff,{clients:true,news:true,settings:true,"form-emails":true});
await user(staff);
await db.query("insert into cms_documents(kind,slug,title) values('news_article','staff-news','By staff')");
await assert.rejects(db.query("insert into cms_documents(kind,slug,title) values('page','staff-page','No')"),/row-level security/,'Pages not granted');
assert.equal((await db.query("update site_settings set value='{\"x\":1}' where id='business' returning id")).rows.length,1,'staff with Settings can save settings');
assert.equal((await db.query("select * from email_settings")).rows.length,1,'staff with Form Emails reads its settings');
await db.query("insert into email_templates(form_id,subject) values('f1','Hi')");
await owner();
// Editors are limited by their access too: an editor without News cannot edit news.
await db.query("update profiles set role='editor' where id=$1",[second]);
await grant(second,{clients:true,"edit-website":true});
await user(second);
await db.query("insert into cms_documents(kind,slug,title) values('page','editor-page','Ok')");
await assert.rejects(db.query("insert into cms_documents(kind,slug,title) values('news_article','editor-news','No')"),/row-level security/);
assert.equal((await db.query("update site_settings set value='{}' where id='business' returning id")).rows.length,0,'no Settings section');
await owner();
// Team access without admin role: manage staff, never escalate.
await grant(staff,{clients:true,team:true});
await db.exec("insert into profiles values ('00000000-0000-0000-0000-0000000000e5','staff',true,'Helper','helper@example.com')");
await user(staff);
assert.equal((await db.query("update profiles set full_name='Helper Two' where id='00000000-0000-0000-0000-0000000000e5' returning id")).rows.length,1,'Team access manages accounts');
await assert.rejects(db.query("update profiles set role='admin' where id='00000000-0000-0000-0000-0000000000e5'"),/Only an admin can make someone an admin/);
await assert.rejects(db.query("update profiles set role='admin' where id=$1",[staff]),/own role/);
await assert.rejects(db.query("update profiles set role='staff' where id=$1",[admin]),/Only an admin/);
await assert.rejects(db.query(`update employees set custom_access=true, allowed_modules='{"clients":true}' where user_id=$1`,[admin]),/admin's access/);
assert.equal((await db.query(`update employees set custom_access=true, allowed_modules='{"clients":true,"pipeline":true}' where user_id='00000000-0000-0000-0000-0000000000e5' returning id`)).rows.length,1,"can set a staff member's access");
await assert.rejects(db.query("update role_access_defaults set sections=$1 where role='admin'",[['clients','team']]),/admin defaults/);
assert.equal((await db.query("update role_access_defaults set sections=$1 where role='staff' returning role",[['clients','pipeline','forms','documents','bookings','settings']])).rows.length,1,'staff defaults may include Settings now');
assert.deepEqual((await rpc1("select sections from role_access_defaults where role='staff'")).sections,['clients','pipeline','forms','documents','bookings','settings']);
await user(admin);
assert.equal((await db.query("update profiles set role='admin' where id='00000000-0000-0000-0000-0000000000e5' returning id")).rows.length,1,'an admin can promote');
await owner();
await db.query("update role_access_defaults set sections=$1 where role='staff'",[['clients','pipeline','forms','documents','bookings']]);
await db.query("delete from profiles where id='00000000-0000-0000-0000-0000000000e5'");
await db.query("update profiles set role='admin' where id=$1",[second]);
await db.query("update employees set custom_access=false where user_id=$1",[second]);
await grant(staff,{clients:true,"email-inbox":true});
// ---------------- Client tags ----------------
await owner();
assert.equal((await rpc1('select count(*)::int n from client_tags')).n,12,'default tags');
const tagId=async name=>(await rpc1('select id from client_tags where name=$1',[name])).id;
const lostTag=await tagId('Lost'), vipTag=await tagId('VIP');
await db.exec("set role anon");await assert.rejects(db.query('select * from client_tags'),/permission denied/);await owner();
await db.query(`update employees set custom_access=true, allowed_modules='{"clients":true,"pipeline":true}' where user_id=$1`,[staff]);
await user(staff);
await db.query('insert into contact_tags(contact_id,tag_id) values($1,$2)',[contact,lostTag]);
const made=(await db.query("insert into client_tags(name,color) values('Student visa','blue') returning id")).rows[0];
await assert.rejects(db.query("insert into client_tags(name) values('  student VISA ')"),/duplicate|unique/,'names are unique, ignoring case and spaces');
assert.equal((await db.query('delete from client_tags where id=$1 returning id',[made.id])).rows.length,0,'only admins delete tags');
await owner();await db.query(`update employees set custom_access=true, allowed_modules='{"pipeline":true}' where user_id=$1`,[staff]);await user(staff);
await assert.rejects(db.query("insert into client_tags(name) values('No clients section')"),/row-level security/);
await user(admin);
assert.equal((await db.query('delete from client_tags where id=$1 returning id',[made.id])).rows.length,1);
await owner();
await db.query('insert into contact_tags(contact_id,tag_id) values($1,$2)',[contact,vipTag]);
assert.deepEqual((await db.query('select tag_id from contact_tags where contact_id=$1 order by tag_id',[contact])).rows.map(r=>r.tag_id).sort(),[lostTag,vipTag].sort());
await db.query('delete from client_tags where id=$1',[vipTag]);
assert.equal((await rpc1('select count(*)::int n from contact_tags where tag_id=$1',[vipTag])).n,0,'deleting a tag removes it from clients');
await db.query("insert into contacts(id,email,name) values('00000000-0000-0000-0000-0000000000f6','gone@example.com','Gone')");
await db.query("insert into contact_tags(contact_id,tag_id) values('00000000-0000-0000-0000-0000000000f6',$1)",[lostTag]);
await db.query("delete from contacts where id='00000000-0000-0000-0000-0000000000f6'");
assert.equal((await rpc1("select count(*)::int n from contact_tags where contact_id='00000000-0000-0000-0000-0000000000f6'")).n,0,'deleting a client removes its tags');
await db.query(`update employees set custom_access=true, allowed_modules='{"clients":true,"email-inbox":true}' where user_id=$1`,[staff]);
// Archive: kept and restorable; tags stay attached.
await owner();
await db.query('update contacts set archived_at=now() where id=$1',[contact]);
assert.ok((await rpc1('select archived_at from contacts where id=$1',[contact])).archived_at);
assert.ok((await rpc1('select count(*)::int n from contact_tags where contact_id=$1',[contact])).n>=1,'archiving keeps tags');
await db.query('update contacts set archived_at=null where id=$1',[contact]);
// ---------------- Bulk email campaigns ----------------
await owner();
assert.equal((await rpc1("select count(*)::int n from cron.job where jobname='email-campaign-worker'")).n,1,'worker scheduled');
assert.ok((await rpc1("select decrypted_secret s from vault.decrypted_secrets where name='campaign_worker_secret'")).s.length>=32,'worker secret generated');
await db.exec("update email_settings set sending_enabled=true, test_redirect_to=null");
const cid=i=>`00000000-0000-0000-0000-00000000c${String(i).padStart(3,'0')}`;
// Contacts: two share an address, one missing, one invalid, one subscribed, one unsubscribed.
await db.query(`insert into contacts(id,name,email) values ($1,'Ana Cruz','ana@example.com'),($2,'Ana Dup','ANA@example.com'),($3,'No Mail',null),
  ($4,'Bad Mail','not-an-email'),($5,'Sub Scriber','sub@example.com'),($6,'Un Sub','unsub@example.com'),($7,'Ben Lim','ben@example.com')`,[cid(1),cid(2),cid(3),cid(4),cid(5),cid(6),cid(7)]);
await db.exec(`insert into newsletter_subscribers(email,confirmed_at,unsubscribed_at) values ('sub@example.com',now(),null),('unsub@example.com',now(),now())`);
const all=[1,2,3,4,5,6,7].map(cid);
await user(staff);
const prev=async kind=>(await db.query('select * from campaign_preview_recipients($1,$2)',[all,kind])).rows;
const svc=await prev('service');
assert.deepEqual(svc.map(r=>[r.name,r.eligible,r.reason]),[['Ana Cruz',true,null],['Ana Dup',false,'Duplicate email address'],['No Mail',false,'No email address'],
  ['Bad Mail',false,'Invalid email address'],['Sub Scriber',true,null],['Un Sub',true,null],['Ben Lim',true,null]],'service: dedupe/missing/invalid; marketing unsubscribe does not apply');
const promo=await prev('promotional');
assert.deepEqual(promo.filter(r=>r.eligible).map(r=>r.name),['Sub Scriber'],'promotional: recorded consent only');
assert.equal(promo.find(r=>r.name==='Un Sub').reason,'Unsubscribed');assert.equal(promo.find(r=>r.name==='Ben Lim').reason,'No marketing consent');
// Create (idempotent per request key); the initiating user is recorded, no copies to them.
const key='00000000-0000-0000-0000-0000000000b1';
const create=(k,kind,drip='{}')=>db.query("select * from campaign_create($1,$2,$3,'Hello {{first_name}}','<p>Hi</p>','there',$4,$5)",[k,general.id,kind,all,drip]).then(r=>r.rows[0]);
const camp=await create(key,'service',JSON.stringify({enabled:true,batch_size:2,interval_minutes:60}));
assert.equal((await create(key,'service')).id,camp.id,'same request key: same campaign');
assert.equal(camp.created_by,staff);assert.equal(camp.reply_to,'inbox@reply.airfairtravel.com','reply-to is the shared inbox');
await owner();
const recips=(await db.query('select email,status,skip_reason from email_campaign_recipients where campaign_id=$1 order by seq',[camp.id])).rows;
assert.deepEqual(recips.filter(r=>r.status==='pending').map(r=>r.email),['ana@example.com','sub@example.com','unsub@example.com','ben@example.com']);
assert.equal(recips.filter(r=>r.status==='skipped').length,2,'missing and invalid recorded as skipped; duplicate merged');
assert.ok((await rpc1('select count(*)::int n from net.calls')).n>=1,'worker kicked after create');
// Claim: drip batch of 2, a second concurrent claim gets nothing, next batch waits the interval.
const claim=async(limit=20,at=null)=>(await db.query('select * from campaign_claim_jobs($1,coalesce($2::timestamptz,now()))',[limit,at])).rows;
const first=await claim();
assert.deepEqual(first.map(j=>j.email),['ana@example.com','sub@example.com']);assert.ok(first.every(j=>j.lease_token));
assert.equal((await claim()).length,0,'no double claim; next batch not due');
assert.equal((await rpc1('select status from email_campaigns where id=$1',[camp.id])).status,'processing');
// Results only from the lease holder; accepted vs delivered stay distinct.
await db.query("select campaign_job_result($1,$2,'accepted','re_ana')",[first[0].id,'00000000-0000-0000-0000-000000000000']);
assert.equal((await rpc1('select status from email_campaign_recipients where id=$1',[first[0].id])).status,'sending','wrong lease ignored');
await db.query("select campaign_job_result($1,$2,'accepted','re_ana')",[first[0].id,first[0].lease_token]);
await db.query("select campaign_job_result($1,$2,'retry',null,'503',now()+interval '3 hours')",[first[1].id,first[1].lease_token]);
assert.equal((await rpc1('select status from email_campaign_recipients where id=$1',[first[0].id])).status,'accepted');
const later=new Date(Date.now()+61*60000).toISOString();
// Eligibility rechecked right before sending: ben hard-bounced meanwhile.
await db.exec("insert into email_suppressions(email,reason) values('ben@example.com','hard_bounce')");
const batch2=await claim(20,later);
assert.deepEqual(batch2.map(j=>j.email),['unsub@example.com']);
assert.equal((await rpc1("select status,skip_reason from email_campaign_recipients where email='ben@example.com' and campaign_id=$1",[camp.id])).skip_reason,'Hard bounced');
await db.query("select campaign_job_result($1,$2,'accepted','re_unsub')",[batch2[0].id,batch2[0].lease_token]);
// Expired lease is reclaimed (same job → same idempotency key in the worker).
await db.query("update email_campaign_recipients set status='sending',locked_until=now()-interval '1 minute',lease_token=gen_random_uuid() where id=$1",[first[1].id]);
await db.query("update email_campaigns set next_batch_at=now()-interval '1 minute' where id=$1",[camp.id]);
const reclaimedJobs=await claim();
assert.deepEqual(reclaimedJobs.map(j=>j.id),[first[1].id]);assert.equal(reclaimedJobs[0].attempts,2);
await db.query("select campaign_job_result($1,$2,'accepted','re_sub')",[reclaimedJobs[0].id,reclaimedJobs[0].lease_token]);
assert.equal((await rpc1('select status from email_campaigns where id=$1',[camp.id])).status,'completed','finished when nothing is pending');
// Verified webhook events: delivered, permanent bounce → suppression, complaint; replays ignored.
await db.query("select campaign_provider_event('evt-d1','email.delivered','re_ana',array['ana@example.com'])");
assert.equal((await rpc1("select status from email_campaign_recipients where provider_id='re_ana'")).status,'delivered');
assert.equal((await rpc1("select campaign_provider_event('evt-d1','email.delivered','re_ana',array['ana@example.com']) ok")).ok,false,'replayed event ignored');
await db.query("select campaign_provider_event('evt-b1','email.bounced','re_unsub',array['unsub@example.com'],'Permanent','mailbox does not exist')");
assert.equal((await rpc1("select status from email_campaign_recipients where provider_id='re_unsub'")).status,'bounced');
assert.equal((await rpc1("select reason from email_suppressions where email='unsub@example.com'")).reason,'hard_bounce');
await db.query("select campaign_provider_event('evt-b2','email.bounced','re_none',array['temp@example.com'],'Temporary','full')");
assert.equal((await rpc1("select count(*)::int n from email_suppressions where email='temp@example.com'")).n,0,'temporary bounce not suppressed');
await db.query("select campaign_provider_event('evt-c1','email.complained','re_sub',array['sub@example.com'])");
assert.equal((await rpc1("select reason from email_suppressions where email='sub@example.com'")).reason,'complaint');
// Pause / resume / cancel; quota pause; unsubscribe link.
await db.exec("delete from email_suppressions");
await user(staff);
const c2=await create('00000000-0000-0000-0000-0000000000b2','service');
await db.query("select campaign_set_status($1,'pause')",[c2.id]);
await owner();
assert.equal((await claim()).filter(j=>j.campaign_id===c2.id).length,0,'paused: nothing starts');
await user(staff);await db.query("select campaign_set_status($1,'resume')",[c2.id]);await owner();
const c2jobs=(await claim(1)).filter(j=>j.campaign_id===c2.id);assert.equal(c2jobs.length,1);
await db.query("select campaign_job_result($1,$2,'requeue_pause',null,'Paused: provider sending quota reached')",[c2jobs[0].id,c2jobs[0].lease_token]);
const c2now=await rpc1('select status,status_reason from email_campaigns where id=$1',[c2.id]);
assert.equal(c2now.status,'paused');assert.match(c2now.status_reason,/quota/);
assert.equal((await rpc1('select status,attempts from email_campaign_recipients where id=$1',[c2jobs[0].id])).status,'pending','job put back');
await user(staff);await db.query("select campaign_set_status($1,'cancel')",[c2.id]);await owner();
assert.equal((await rpc1("select count(*)::int n from email_campaign_recipients where campaign_id=$1 and status in ('pending','retry')",[c2.id])).n,0,'cancel stops pending jobs');
assert.equal((await rpc1('select status from email_campaigns where id=$1',[c2.id])).status,'cancelled');
const tok=(await rpc1("select unsubscribe_token t from email_campaign_recipients where campaign_id=$1 and email='sub@example.com'",[c2.id])).t;
assert.equal((await rpc1('select campaign_unsubscribe($1) e',[tok])).e,'sub@example.com');
assert.ok((await rpc1("select unsubscribed_at from newsletter_subscribers where email='sub@example.com'")).unsubscribed_at,'marketing preference updated');
await user(staff);
assert.equal((await prev('promotional')).find(r=>r.name==='Sub Scriber').eligible,false,'unsubscribed → excluded from promotional');
assert.equal((await prev('service')).find(r=>r.name==='Sub Scriber').eligible,true,'service emails unaffected');
// Window check and permissions.
await owner();
assert.equal((await rpc1("select campaign_in_window(c,'2026-10-05T03:00:00Z') ok from (select (row(e.*)::email_campaigns) c from email_campaigns e limit 1) x")).ok,true,'no window: always');
await db.query("update email_campaigns set window_start='09:00',window_end='10:30',timezone='Asia/Manila' where id=$1",[camp.id]);
assert.equal((await rpc1("select campaign_in_window(e,'2026-10-05T01:30:00Z') ok from email_campaigns e where id=$1",[camp.id])).ok,true);
assert.equal((await rpc1("select campaign_in_window(e,'2026-10-05T04:00:00Z') ok from email_campaigns e where id=$1",[camp.id])).ok,false);
await db.query(`update employees set custom_access=true, allowed_modules='{"clients":true}' where user_id=$1`,[staff]);
await user(staff);
await assert.rejects(create('00000000-0000-0000-0000-0000000000b3','service'),/Not allowed/,'needs Email Inbox access too');
assert.equal((await db.query('select * from email_campaigns')).rows.length,0,'no campaign history without access');
await assert.rejects(db.query('select * from campaign_claim_jobs(1)'),/permission denied/,'worker functions are server-only');
await db.exec('set role anon');await assert.rejects(db.query("select campaign_unsubscribe('00000000-0000-0000-0000-000000000000')"),/permission denied/);
await owner();
await db.query(`update employees set custom_access=true, allowed_modules='{"clients":true,"email-inbox":true}' where user_id=$1`,[staff]);
await db.exec("update email_settings set sending_enabled=false");
// ---------------- Send-only mailboxes ----------------
await owner();
const adminBox=await rpc1("select * from email_mailboxes where address='admin@airfairtravel.com'");
assert.equal(adminBox.send_only,true);assert.equal(adminBox.status,'pending','seeded, not active until verified');
await user(admin);
assert.equal((await db.query('select can_send from inbox_my_mailboxes() where address=$1',['admin@airfairtravel.com'])).rows[0].can_send,false,'pending: not offered as From');
await owner();await db.query("update email_mailboxes set sending_verified_at=now() where id=$1",[adminBox.id]);await user(admin);
// Re-saving a send-only mailbox with proven sending makes it active; staff only with access.
const saved=await rpc1("select * from admin_save_mailbox($1,'Air Fair Admin','admin@airfairtravel.com',false,true)",[adminBox.id]);
assert.equal(saved.status,'active');
assert.equal((await db.query('select can_send from inbox_my_mailboxes() where address=$1',['admin@airfairtravel.com'])).rows[0].can_send,true,'admins can send from it');
await user(staff);assert.equal((await db.query('select id from inbox_my_mailboxes() where address=$1',['admin@airfairtravel.com'])).rows.length,0,'staff need access');
await user(admin);
// Switching to a full mailbox without proven receiving drops it back to pending.
assert.equal((await rpc1("select status from admin_save_mailbox($1,'Air Fair Admin','admin@airfairtravel.com',false,false)",[adminBox.id])).status,'pending');
assert.equal((await rpc1("select status from admin_save_mailbox($1,'Air Fair Admin','admin@airfairtravel.com',false,true)",[adminBox.id])).status,'active');
await owner();
// ---------------- Campaign CC/BCC ----------------
await owner();await db.exec("update email_settings set sending_enabled=true");
await db.query(`update employees set custom_access=true, allowed_modules='{"clients":true,"email-inbox":true}' where user_id=$1`,[staff]);
await user(staff);
const withCopies=(k,ccs,bccs)=>db.query("select * from campaign_create($1,$2,'service','Hi','<p>Hi</p>','there',$3,'{}'::jsonb,$4,$5)",[k,general.id,[cid(1),cid(7)],ccs,bccs]).then(r=>r.rows[0]);
const cc1=await withCopies('00000000-0000-0000-0000-0000000000d1',['Boss@AirfairTravel.com','boss@airfairtravel.com'],['boss@airfairtravel.com','audit@airfairtravel.com']);
assert.deepEqual(cc1.cc,['boss@airfairtravel.com'],'deduplicated, lower-cased');assert.deepEqual(cc1.bcc,['audit@airfairtravel.com'],'BCC never repeats CC');
await assert.rejects(withCopies('00000000-0000-0000-0000-0000000000d2',['not-an-email'],[]),/Invalid CC\/BCC/);
await assert.rejects(withCopies('00000000-0000-0000-0000-0000000000d3',[1,2,3,4,5,6].map(i=>`c${i}@x.com`),[]),/up to 5/);
await owner();
const ccJobs=(await db.query('select * from campaign_claim_jobs(20)')).rows.filter(j=>j.campaign_id===cc1.id);
assert.ok(ccJobs.length>0);assert.deepEqual(ccJobs[0].cc,['boss@airfairtravel.com']);assert.deepEqual(ccJobs[0].bcc,['audit@airfairtravel.com']);
await user(staff);await db.query("select campaign_set_status($1,'cancel')",[cc1.id]);await owner();
await db.exec("update email_settings set sending_enabled=false");
console.log('Inbox database checks passed: RLS, permissions, durable deduplication, thread matching, unassigned messages, queue idempotency, form auto-reply link and preserved staff/newsletter routing.');
// Phase 1: an external reply must not add a mailbox to private thread history.
await owner();
await grant(staff,{clients:true,'email-inbox':true});
const routeAddresses=(await db.query('select id,address from email_mailboxes where id in ($1,$2)',[visa.id,travel.id])).rows;
const visaAddress=routeAddresses.find(b=>b.id===visa.id).address;
const travelAddress=routeAddresses.find(b=>b.id===travel.id).address;
const privateThread=await rpc1("insert into email_conversations(subject,participant_email,mailbox_id) values('Private history','private@example.com',$1) returning *",[travel.id]);
await db.query("insert into email_messages(conversation_id,direction,from_email,to_email,subject,body_text,rfc_message_id,attachments) values($1,'incoming','private@example.com',$2,'Private','Confidential history','<private-history@example.com>',$3)",[privateThread.id,travelAddress,JSON.stringify([{path:'incoming/security/private.pdf',filename:'private.pdf'}])]);
for(const [index,tokens,references] of [[0,[privateThread.reply_token],[]],[1,[privateThread.reply_token.slice(0,48)],[]],[2,[],['<private-history@example.com>']]]) {
  await owner();
  const email={...incoming,id:'security-reply-'+index,from:'private@example.com',tokens,references,recipients:[visaAddress,travelAddress],message_id:'<security-reply-'+index+'@example.com>'};
  assert.equal(await accept('security-event-'+index,email),privateThread.id);
  assert.equal(await accept('security-event-'+index,email),privateThread.id,'delivery replay remains idempotent');
  assert.deepEqual((await db.query('select mailbox_id from email_conversation_mailboxes where conversation_id=$1',[privateThread.id])).rows.map(r=>r.mailbox_id),[travel.id]);
  assert.equal((await rpc1('select mailbox_id from email_messages where resend_id=$1',[email.id])).mailbox_id,travel.id,'reply stays in an authorized mailbox');
  await user(staff);
  assert.equal((await db.query('select id from email_conversations where id=$1',[privateThread.id])).rows.length,0);
  assert.equal((await db.query('select id from email_messages where conversation_id=$1',[privateThread.id])).rows.length,0);
  assert.equal((await rpc1("select can_read_email_attachment('incoming/security/private.pdf') ok")).ok,false);
}
await user(admin);
assert.equal((await db.query('select id from email_messages where conversation_id=$1',[privateThread.id])).rows.length,4,'authorized reader retains history and all replies');
console.log('Inbound isolation checks passed: full/short tokens and RFC references cannot widen mailbox access; retries, attachments and authorized readers remain correct.');
// Phase 1: delegated settings access must never grant script execution.
await owner();
await db.exec('grant delete on site_settings to authenticated');
await db.query("update employees set custom_access=true,allowed_modules='{\"settings\":true}' where user_id=$1",[staff]);
await user(admin);
await db.query("insert into site_settings(id,value,chat_widget_code) values ('security-script','{}','/* trusted admin widget */')");
await user(staff);
assert.equal((await db.query("update site_settings set value='{\"business_name\":\"Updated\"}' where id='security-script' returning id")).rows.length,1);
await assert.rejects(db.query("update site_settings set chat_widget_code='/* injected */' where id='security-script'"),/Only administrators/);
await assert.rejects(db.query("update site_settings set chat_widget_code=null where id='security-script'"),/Only administrators/);
await assert.rejects(db.query("insert into site_settings(id,chat_widget_code) values('injected','/* injected */')"),/Only administrators/);
await assert.rejects(db.query("insert into site_settings(id,chat_widget_code) values('security-script','/* injected */') on conflict(id) do update set chat_widget_code=excluded.chat_widget_code"),/Only administrators/);
await assert.rejects(db.query("delete from site_settings where id='security-script'"),/Only administrators/);
await db.query("insert into site_settings(id,value) values('safe-settings','{}')");
await db.query("delete from site_settings where id='safe-settings'");
await owner();
await db.query("update employees set allowed_modules='{\"form-emails\":true}' where user_id=$1",[staff]);
await user(staff);
await db.query("update site_settings set value='{}' where id='security-script'");
await assert.rejects(db.query("update site_settings set chat_widget_code='/* injected */' where id='security-script'"),/Only administrators/);
await user(admin);
await db.query("update site_settings set chat_widget_code='/* updated trusted widget */' where id='security-script'");
await db.query("delete from site_settings where id='security-script'");
console.log('Executable settings checks passed: Settings/Form Emails cannot insert, change, upsert or delete scripts; ordinary edits and admin changes work.');
// Phase 2: Team delegates cannot replace protected administrator records.
await owner(); await grant(staff,{team:true});
await db.exec('grant delete on employees to authenticated');
await db.query("update profiles set role='staff' where role='admin' and id<>$1",[admin]);
const savedAdminEmployee=await rpc1('select * from employees where user_id=$1',[admin]);
await user(staff);
await assert.rejects(db.query('delete from employees where user_id=$1',[admin]),/Only an admin/);
await assert.rejects(db.query("insert into employees(user_id,custom_access,allowed_modules) values($1,true,'{}') on conflict(user_id) do update set allowed_modules=excluded.allowed_modules",[admin]),/Only an admin/);
await user(admin);
await db.query('delete from employees where user_id=$1',[admin]);
await user(staff);
await assert.rejects(db.query("insert into employees(user_id,custom_access,allowed_modules) values($1,true,'{}')",[admin]),/Only an admin/,'missing admin record cannot be recreated by a delegate');
await user(admin);
await assert.rejects(db.query("insert into employees(user_id,custom_access,allowed_modules) values($1,true,'{}')",[admin]),/keep access to Team/,'INSERT cannot lock out the last administrator');
await db.query('insert into employees select * from jsonb_populate_record(null::employees,$1)',[JSON.stringify(savedAdminEmployee)]);
await user(staff);
assert.equal((await db.query("update employees set role='Consultant' where user_id=$1 returning id",[staff])).rows.length,1,'ordinary Team edits remain allowed');
console.log('Admin replacement checks passed: DELETE, INSERT, upsert and last-admin insertion are protected.');
// Trusted Auth state, not profile role or an old token, decides access.
await owner(); await grant(staff,{clients:true,'email-inbox':true,team:true,settings:true});
for (const account of [admin,staff]) {
  await owner();
  await db.query('update auth.users set email_confirmed_at=null where id=$1',[account]);
  await user(account);
  assert.equal((await rpc1('select auth_role() role')).role,'none');
  assert.equal((await rpc1('select is_admin() ok')).ok,false);
  assert.equal((await rpc1('select is_team() ok')).ok,false);
  assert.equal((await rpc1("select has_section('team') ok")).ok,false);
  assert.equal((await rpc1('select can_use_email_inbox() ok')).ok,false);
  assert.equal((await db.query('select id from email_conversations')).rows.length,0);
  assert.equal((await db.query("update site_settings set value='{}' returning id")).rows.length,0);
  await assert.rejects(db.query('select team_account_verified($1)',[admin]),/permission denied/,'private helper cannot enumerate account state');
  await owner();
  await db.query("update auth.users set email_confirmed_at=now(),banned_until=now()+interval '1 hour' where id=$1",[account]);
  await user(account);
  assert.equal((await rpc1('select auth_role() role')).role,'none','old session does not bypass an Auth ban');
  assert.equal((await rpc1("select has_section('team') ok")).ok,false);
  await owner();
  await db.query("update auth.users set banned_until=now()-interval '1 minute' where id=$1",[account]);
  await user(account);
  assert.equal((await rpc1('select auth_role() role')).role,account===admin?'admin':'staff');
  assert.equal((await rpc1("select has_section('team') ok")).ok,true);
}
console.log('Verified-account checks passed: unconfirmed and banned admin/staff sessions denied; confirmed accounts and expired bans work.');
await (await import('./test-private-sections.mjs')).testPrivateSections({ db, owner, user, grant, staff, admin, contact });
await (await import('./test-client-validation.mjs')).testClientValidation({ db, owner, user, grant, staff, contact });
await (await import('./test-upload-storage.mjs')).testUploadStorage({ db, owner, user, grant, staff, admin });
await (await import('./test-email-budgets.mjs')).testEmailBudgets({ db, owner, user, admin });
await db.close();
