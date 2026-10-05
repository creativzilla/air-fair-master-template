// Real Edge Functions, local fake services only. No production credentials.
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
import { createFake } from './form-function-e2e/fake-supabase.cjs';

const { server, state } = createFake();
await new Promise(r => server.listen(54398, '127.0.0.1', r));
let count = 0;
try {
  for (const fn of ['admin-users','inbox-send','mailbox-verify','campaign-worker']) {
    let started = false, launchError;
    const child = spawn(process.env.DENO_BIN || 'deno', ['run','--no-lock','--node-modules-dir=none',
      ...(fn === 'campaign-worker' ? ['--config', resolve('supabase/functions/campaign-worker/deno.json')] : []),
      '--allow-net=127.0.0.1,localhost,0.0.0.0:8000','--allow-env','--allow-read',
      `--preload=${resolve('scripts/form-function-e2e/preload.ts')}`,resolve(`supabase/functions/${fn}/index.ts`)], {
      env: { ...process.env, SUPABASE_URL:'http://127.0.0.1:54398', SUPABASE_ANON_KEY:'local-anon',
        SUPABASE_SERVICE_ROLE_KEY:'local-service', RESEND_API_KEY:'local-provider',
        LOCAL_RESEND_SINK:'http://127.0.0.1:54398/resend/emails' },
    });
    const exited = new Promise(r => child.once('exit', r));
    child.once('error', e => { launchError = e; });
    const observe = data => { if (String(data).includes('Listening on')) started = true; };
    child.stdout.on('data', observe); child.stderr.on('data', observe);
    const check = (condition, message) => { assert.ok(condition, `${fn}: ${message}`); count++; };
    const call = (body, token = 'admin-token', origin = 'https://airfairtravel.com') => fetch('http://127.0.0.1:8000', {
      method:'POST',headers:{'Content-Type':'application/json',Origin:origin,Authorization:`Bearer ${token}`},
      body:typeof body === 'string' ? body : JSON.stringify(body),
    });
    try {
      for (let i=0;i<100 && !started && !launchError;i++) await new Promise(r=>setTimeout(r,100));
      assert.ok(started, `${fn} did not start: ${launchError?.message || 'timeout'}`);
      const preflight = origin => fetch('http://127.0.0.1:8000',{method:'OPTIONS',headers:{Origin:origin}});
      check((await preflight('https://airfairtravel.com')).headers.get('access-control-allow-origin')==='https://airfairtravel.com','known origin');
      check((await preflight('https://untrusted.example')).headers.get('access-control-allow-origin')===null,'untrusted origin receives no CORS grant');
      check((await fetch('http://127.0.0.1:8000')).status===405,'GET rejected');
      for (const value of ['null','[]','{bad']) check((await call(value)).status===400,'malformed/non-object JSON rejected');
      check((await call(JSON.stringify({padding:'x'.repeat(310000)}))).status===413,'oversized body rejected');
      if (fn==='admin-users') {
        check((await call({action:'list'},'invalid')).status===401,'invalid token');
        check((await call({action:'deactivate',userId:'-'.repeat(36)})).status===400,'invalid target ID');
        const failed=await call({action:'list'}); // fake Auth deliberately lacks admin list API
        check(failed.status===500,'provider failure handled');
        check((await failed.json()).error==='Could not complete user management. Please retry.','provider details hidden');
      } else if (fn==='inbox-send') {
        check((await call({request_key:'invalid'})).status===400,'invalid request ID');
        check((await call({},'invalid')).status===401,'invalid token');
      } else if (fn==='mailbox-verify') {
        check((await call({action:'verify',mailbox_id:'-'.repeat(36)})).status===400,'invalid mailbox ID');
        check((await call({},'staff-token')).status===403,'staff cannot verify mailboxes');
      } else {
        check((await call({action:'test',mailbox_id:'invalid'})).status===400,'invalid mailbox ID');
        check((await call({action:'run'})).status===403,'worker secret required');
      }
    } finally {
      child.kill();
      if (!launchError) await exited;
    }
  }
  assert.equal(state.resendCalls.length,0,'denied requests never send mail');
  console.log(`${count} security endpoint checks passed; no emails sent.`);
} finally { await new Promise(r => server.close(r)); }
