import {createServer} from 'vite';
import configFactory from '../vite.config.js';
import assert from 'node:assert/strict';
const config=configFactory({mode:'development'});
const server=await createServer({...config,configFile:false,server:{...config.server,port:0},logLevel:'error'});
try {
  await server.listen();
  const base=server.resolvedUrls.local[0];
  assert.ok(['127.0.0.1','::1'].includes(server.httpServer.address().address),'server binds loopback only');
  const response=await fetch(base,{headers:{Origin:'https://untrusted.example'}});
  assert.equal(response.status,200);
  assert.equal(response.headers.get('access-control-allow-origin'),null);
  assert.equal(response.headers.get('x-content-type-options'),'nosniff');
  for(const target of ['/.env','/.env.production','/.git/config']) {
    const blocked=await fetch(new URL(target,base));assert.ok([403,404].includes(blocked.status),target);
  }
  const module=await fetch(new URL('/src/main.jsx',base));assert.equal(module.status,200);
  const source=await module.text();
  const dependency=source.match(/['"]([^'"]*\/\.vite\/deps\/react[^'"]+)['"]/);
  assert.ok(dependency,'React dependency is present in transformed entry');
  const optimized=await fetch(new URL(dependency[1],base));assert.equal(optimized.status,200);
  console.log('Dev security checks passed: loopback binding, headers, CORS, sensitive paths, entry and React dependency serving.');
} finally {await server.close();}
