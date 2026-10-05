// Optional local browser check. Set PLAYWRIGHT_MODULE to a local Playwright import.
// Only the temporary built site is served; outside traffic is blocked.
import {createServer} from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {loadEnv} from 'vite';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE);
const label=process.argv[2];if(!/^[a-z0-9-]+$/.test(label))throw Error('Invalid label');
const root=path.join(os.tmpdir(),`airfair-upgrade-${label}`);
const mime={'.js':'text/javascript','.css':'text/css','.html':'text/html','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.woff2':'font/woff2'};
const server=createServer(async(req,res)=>{
  const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  const target=path.resolve(root,`.${name}`);
  if(target!==root&&!target.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
  try{const data=await fs.readFile(target);res.setHeader('Content-Type',mime[path.extname(target)]||'application/octet-stream');res.end(data);}
  catch{res.setHeader('Content-Type','text/html');res.end(await fs.readFile(path.join(root,'index.html')));}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base=`http://127.0.0.1:${server.address().port}`;
let browser;
try{
  browser=await chromium.launch({channel:'msedge',headless:true});
  const context=await browser.newContext({reducedMotion:'reduce'});
  await context.route('**/*',route=>new URL(route.request().url()).origin===base?route.continue():route.abort());
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const result={};
  for(const width of [1280,390])for(const route of ['/','/news','/travel-tours','/dashboard','/missing-page']){
    await page.setViewportSize({width,height:900});await page.goto(base+route,{waitUntil:'networkidle'});
    await page.addStyleTag({content:'*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}'});
    await page.evaluate(()=>document.fonts.ready);
    assert.ok((await page.locator('#root').innerText()).length>20,route);
    const key=`${width}-${route.replace(/\//g,'_')||'home'}`;
    result[key]=await page.evaluate(()=>[...document.querySelectorAll('#root h1,#root h2,#root button,#root input,#root select,#root nav,#root main')].slice(0,100).map(e=>{
      const s=getComputedStyle(e),r=e.getBoundingClientRect();return {tag:e.tagName,text:(e.textContent||'').slice(0,60),
        class:e.className,x:Math.round(r.x),y:Math.round(r.y),width:Math.round(r.width),height:Math.round(r.height),
        fontSize:s.fontSize,lineHeight:s.lineHeight,padding:s.padding,border:s.border,borderRadius:s.borderRadius,
        color:s.color,background:s.backgroundColor,boxShadow:s.boxShadow,display:s.display};
    }));
    await page.screenshot({path:path.join(root,`${key}.png`),animations:'disabled'});
  }
  // Navigate through the client router and back, not only direct route loads.
  await page.setViewportSize({width:1280,height:900});
  await page.goto(base+'/');await page.locator('a[href="/news"]').first().click();
  await page.waitForURL('**/news');await page.goBack();await page.waitForURL(base+'/');
  // Authenticated UI fixtures are synthetic; no real account or customer data.
  const env=loadEnv('production',process.cwd(),'VITE_');
  const storageKey=`sb-${new URL(env.VITE_SUPABASE_URL).hostname.split('.')[0]}-auth-token`;
  const user={id:'00000000-0000-4000-8000-000000000001',email:'admin@example.test',email_confirmed_at:'2026-01-01T00:00:00Z',app_metadata:{},user_metadata:{},aud:'authenticated'};
  const payload=Buffer.from(JSON.stringify({sub:user.id,exp:Math.floor(Date.now()/1000)+3600,role:'authenticated'})).toString('base64url');
  const session={access_token:`eyJhbGciOiJIUzI1NiJ9.${payload}.local-test`,refresh_token:'local-test',expires_at:Math.floor(Date.now()/1000)+3600,expires_in:3600,token_type:'bearer',user};
  const admin=await browser.newContext({viewport:{width:1280,height:900},reducedMotion:'reduce'});
  await admin.addInitScript(({storageKey,session})=>localStorage.setItem(storageKey,JSON.stringify(session)),{storageKey,session});
  await admin.route('**/*',route=>{
    const request=route.request(),url=new URL(request.url());
    if(url.origin===base)return route.continue();
    if(url.pathname==='/auth/v1/user')return route.fulfill({json:user});
    if(url.pathname.startsWith('/rest/v1/')){
      const table=url.pathname.split('/').pop();
      const rows=table==='profiles'?[{...user,full_name:'Test Admin',role:'admin',is_active:true}]:
        table==='contacts'?[{id:'00000000-0000-4000-8000-000000000002',name:'Test Client',email:'client@example.test',category:'Visa',status:'New Lead',amount:0,is_archived:false}]:
        table==='pipeline_stages'?[{id:1,name:'New Lead',sort_order:0},{id:2,name:'Contacted',sort_order:1}]:[];
      return route.fulfill({json:url.pathname.includes('/rpc/')?true:request.headers().accept?.includes('vnd.pgrst.object')?(rows[0]||null):rows});
    }
    return route.abort();
  });
  const dashboard=await admin.newPage();dashboard.on('pageerror',e=>errors.push(e.message));
  await dashboard.goto(base+'/dashboard',{waitUntil:'networkidle'});
  for(const section of ['Clients','Pipeline','Settings']){
    await dashboard.getByRole('button',{name:section,exact:true}).first().click();
    await dashboard.waitForTimeout(100);
    await dashboard.addStyleTag({content:'*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}'});
    result[`admin-${section}`]=await dashboard.evaluate(()=>[...document.querySelectorAll('#root button,#root input,#root select,#root h1,#root h2,#root th,#root td')].map(e=>{
      const s=getComputedStyle(e),r=e.getBoundingClientRect();return {tag:e.tagName,text:(e.textContent||'').slice(0,80),x:Math.round(r.x),y:Math.round(r.y),width:Math.round(r.width),height:Math.round(r.height),fontSize:s.fontSize,lineHeight:s.lineHeight,padding:s.padding,border:s.border,borderRadius:s.borderRadius,background:s.backgroundColor,display:s.display};
    }));
    await dashboard.screenshot({path:path.join(root,`admin-${section}.png`),animations:'disabled'});
  }
  assert.deepEqual(errors,[]);
  await fs.writeFile(path.join(root,'browser-styles.json'),JSON.stringify(result,null,2));
  console.log(`Browser checks passed: ten desktop/mobile route renders, navigation/back, three synthetic dashboard views, no runtime errors. Snapshots: ${root}`);
}finally{await browser?.close();await new Promise(r=>server.close(r));}
