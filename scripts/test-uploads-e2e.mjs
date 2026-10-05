// Real Deno functions + Supabase SDK, local fake Storage/database/email only.
import {spawn} from 'node:child_process';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
import {createClient} from '@supabase/supabase-js';
import {createFake} from './form-function-e2e/fake-supabase.cjs';

const {server,state}=createFake();
await new Promise(r=>server.listen(54397,'127.0.0.1',r));
let child,exited,checks=0,uploaded;
async function stop(){if(child){child.kill();await exited;child=null;}}
async function start(fn){
  await stop(); let started=false,failed;
  child=spawn(process.env.DENO_BIN||'deno',['run','--no-lock','--node-modules-dir=none',
    '--allow-net=127.0.0.1,localhost,0.0.0.0:8000','--allow-env','--allow-read',
    `--preload=${resolve('scripts/form-function-e2e/preload.ts')}`,resolve(`supabase/functions/${fn}/index.ts`)],{
      env:{...process.env,SUPABASE_URL:'http://127.0.0.1:54397',SUPABASE_SERVICE_ROLE_KEY:'local-service',
        SUPABASE_ANON_KEY:'local-anon',RATE_LIMIT_SALT:'local-salt',FORM_UPLOADS_PER_DAY:'12',
        RESEND_API_KEY:'local-resend',LOCAL_RESEND_SINK:'http://127.0.0.1:54397/resend/emails'},
    });
  exited=new Promise(r=>child.once('exit',r));child.once('error',e=>{failed=e;});
  const observe=data=>{if(String(data).includes('Listening on'))started=true;};
  child.stdout.on('data',observe);child.stderr.on('data',observe);
  for(let i=0;i<100&&!started&&!failed;i++)await new Promise(r=>setTimeout(r,100));
  assert.ok(started,`${fn} could not start: ${failed?.message||'timeout'}`);
}
const check=(condition,message)=>{assert.ok(condition,message);checks++;};
const pdf=new TextEncoder().encode('%PDF-1.7\nlocal upload fixture\n%%EOF');
const headers={'content-type':'application/pdf','x-file-name':'passport.pdf','x-form-key':'studio-apply','x-field-name':'passport',Origin:'https://airfairtravel.com'};
const upload=(body=pdf,extra={})=>fetch('http://127.0.0.1:8000',{method:'POST',headers:{...headers,...extra},body});
try {
  await start('form-upload');
  // Same SDK invoke/raw File transport used by the frontend.
  const sdk=createClient('http://127.0.0.1:8000','local-anon',{auth:{persistSession:false}});
  const result=await sdk.functions.invoke('form-upload',{body:new File([pdf],'passport.pdf',{type:'application/pdf'}),headers});
  const uploadError=result.error ? await result.error.context?.text() : '';
  check(!result.error,`SDK file upload succeeds: ${uploadError || result.error?.message || ''}`);uploaded=result.data;
  check(uploaded.type==='application/pdf'&&uploaded.size===pdf.length,'server metadata returned');
  check(Buffer.from(state.storage[uploaded.path].bytes).equals(Buffer.from(pdf)),'SDK sends exact binary bytes');
  check(/^submissions\/\d{4}-\d{2}\/[a-f0-9-]{36}-attachment.pdf$/.test(uploaded.path),'server chooses safe path');
  const preflight=await fetch('http://127.0.0.1:8000',{method:'OPTIONS',headers:{Origin:'https://airfairtravel.com'}});
  check(preflight.headers.get('access-control-allow-origin')==='https://airfairtravel.com','known origin allowed');
  check(preflight.headers.get('access-control-allow-headers').includes('x-file-name'),'upload headers allowed');
  const foreign=await fetch('http://127.0.0.1:8000',{method:'OPTIONS',headers:{Origin:'https://foreign.test'}});
  check(!foreign.headers.get('access-control-allow-origin'),'foreign origin gets no CORS permission');
  check((await fetch('http://127.0.0.1:8000')).status===405,'GET denied');
  check((await upload('MZ disguised executable')).status===400,'disguised executable denied');
  check((await upload(pdf,{'x-file-name':'payload.svg','content-type':'image/svg+xml'})).status===400,'SVG denied');
  check((await upload(pdf,{'x-field-name':'clientName'})).status===400,'non-file field denied');
  check((await upload(pdf,{'x-form-key':'unknown-form'})).status===400,'unpublished form denied');
  check((await upload(new Uint8Array(2*1024*1024+1))).status===413,'published file limit enforced');
  state.storageFailure=true;
  const failed=await upload();check(failed.status===500,'storage failure reported');
  check((await failed.json()).error==='Could not upload the file. Please try again.','internal storage details hidden');
  state.storageFailure=false;
  state.tables.rate_limit_events=[];
  for(let i=0;i<10;i++)check((await upload('invalid',{'x-forwarded-for':'198.51.100.1'})).status===400,'attempt within connection quota');
  check((await upload(pdf,{'x-forwarded-for':'198.51.100.1'})).status===429,'connection quota blocks further uploads');
  check((await upload('invalid',{'x-forwarded-for':'198.51.100.2'})).status===400,'second connection counted');
  check((await upload('invalid',{'x-forwarded-for':'198.51.100.3'})).status===400,'third connection counted');
  check((await upload(pdf,{'x-forwarded-for':'198.51.100.4'})).status===429,'global ceiling blocks distributed attempts');
  check(Object.keys(state.storage).length===1,'denied attempts never write files');

  await start('form-submit');
  const submission={id:crypto.randomUUID(),form_type:'visa_japan',form_key:'studio-apply',source_page:'/visa-assistance/japan',
    name:'Ana Cruz',email:'ana@example.com',phone:'',raw_data:{clientName:'Ana Cruz',contactEmail:'ana@example.com',service:'visa',passport:'passport.pdf'},
    attachments:[{field:'passport',name:'passport.pdf',...uploaded}]};
  const reply=await fetch('http://127.0.0.1:8000',{method:'POST',headers:{'content-type':'application/json'},
    body:JSON.stringify({action:'submit_form',submission,guard:{company_website:'',elapsed_ms:6000}})});
  check(reply.status===200,'normal form accepts broker attachment');
  check(state.tables.form_submissions.length===1,'submission saved');
  check(state.tables.form_submissions[0].attachments[0].path===uploaded.path,'stored attachment path preserved');
  console.log(`${checks} upload endpoint checks passed; all file and email traffic stayed local.`);
} finally {await stop();await new Promise(r=>server.close(r));}
