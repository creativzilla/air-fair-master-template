// Exercise the real build hook in an isolated checkout, preserving working dist.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {build,loadEnv} from 'vite';
import {FALLBACK_DOCS} from '../src/lib/cmsFallback.js';
const original=process.cwd(),root=fs.mkdtempSync(path.join(os.tmpdir(),'airfair-full-build-'));
for(const directory of ['src','public'])fs.cpSync(path.join(original,directory),path.join(root,directory),{recursive:true});
fs.cpSync(path.join(original,'supabase/functions/_shared'),path.join(root,'supabase/functions/_shared'),{recursive:true});
fs.mkdirSync(path.join(root,'scripts'));
for(const file of ['prerender.mjs','security-config.mjs'])fs.copyFileSync(path.join(original,'scripts',file),path.join(root,'scripts',file));
for(const file of ['index.html','package.json','vite.config.js','postcss.config.js'])fs.copyFileSync(path.join(original,file),path.join(root,file));
fs.symlinkSync(path.join(original,'node_modules'),path.join(root,'node_modules'),'junction');
// Only reviewed public build variables are needed; no env files are copied.
Object.assign(process.env,loadEnv('production',original,'VITE_'));
globalThis.fetch=async input=>{
  const url=new URL(String(input));
  if(url.pathname==='/rest/v1/cms_published')return new Response(JSON.stringify(FALLBACK_DOCS));
  if(url.pathname==='/rest/v1/site_settings')return new Response(JSON.stringify([{business_name:'Air Fair Travel & Immigration'}]));
  throw new Error('External request blocked by offline build validation');
};
process.chdir(root);
try{
  await build({root,logLevel:'warn'});
  const dist=path.join(root,'dist');
  for(const file of ['index.html','app.html','news.html','travel-tours.html','sitemap.xml','_headers'])assert.ok(fs.existsSync(path.join(dist,file)),file);
  assert.ok(fs.readFileSync(path.join(dist,'index.html'),'utf8').includes('class="travel-site"'),'homepage prerender completed');
  assert.ok(!fs.readFileSync(path.join(dist,'app.html'),'utf8').includes('class="travel-site"'),'app shell remains unrendered');
  console.log(`Full offline production build and prerender passed: ${dist}`);
}finally{process.chdir(original);}
