import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {validatePublicEnv,securityHeaders} from './security-config.mjs';
import configFactory from '../vite.config.js';
test('prerender leaves a failed client build error intact',async()=>{
  const plugin=configFactory({mode:'production'}).plugins.find(p=>p.name==='air-fair-prerender');
  plugin.configResolved({build:{ssr:false},root:'/unused-build-root'});
  plugin.buildEnd(new Error('original build failure'));
  // Must not attempt to copy a nonexistent index.html and mask the original error.
  await plugin.closeBundle();
});
test('browser environment refuses private or unreviewed variables without echoing values',()=>{
  for(const env of [{VITE_RESEND_API_KEY:'do-not-print'},{VITE_SUPABASE_ANON_KEY:'sb_secret_do-not-print'},
    {VITE_SUPABASE_ANON_KEY:`a.${Buffer.from(JSON.stringify({role:'service_role'})).toString('base64url')}.b`}]) {
    assert.throws(()=>validatePublicEnv(env),e=>!e.message.includes('do-not-print'));
  }
  validatePublicEnv({VITE_SUPABASE_ANON_KEY:'sb_publishable_example',VITE_SITE_URL:'https://example.test',SUPABASE_SERVICE_ROLE_KEY:'server-only'});
  validatePublicEnv({VITE_SUPABASE_ANON_KEY:`a.${Buffer.from(JSON.stringify({role:'anon'})).toString('base64url')}.b`});
});
test('hosting headers match the development baseline and do not replace app routes',async()=>{
  const vercel=JSON.parse(await readFile(new URL('../vercel.json',import.meta.url),'utf8'));
  assert.deepEqual(Object.fromEntries(vercel.headers[0].headers.map(h=>[h.key,h.value])),securityHeaders);
  assert.ok(vercel.rewrites.some(r=>r.source==='/dashboard'&&r.destination==='/app'));
  const netlify=await readFile(new URL('../public/_headers',import.meta.url),'utf8');
  for(const [key,value] of Object.entries(securityHeaders))assert.ok(netlify.includes(`${key}: ${value}`));
});
