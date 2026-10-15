import {build} from 'vite';
import react from '@vitejs/plugin-react';
import configFactory from '../vite.config.js';
import path from 'node:path';
import os from 'node:os';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
const label=process.argv[2]||'current';
if(!/^[a-z0-9-]+$/.test(label))throw Error('Invalid build label');
const output=path.join(os.tmpdir(),`airfair-upgrade-${label}`);
const config=configFactory({mode:'production'});
await build({...config,configFile:false,logLevel:'warn',plugins:config.plugins.filter(p=>p?.name!=='air-fair-prerender'),
  build:{...config.build,outDir:output,emptyOutDir:false}});
const ssr=path.join(output,'ssr');
await build({configFile:false,plugins:[react()],logLevel:'warn',ssr:{noExternal:true},
  build:{ssr:'src/entry-server.jsx',outDir:ssr,emptyOutDir:false}});
const {render}=await import(pathToFileURL(path.join(ssr,'entry-server.js')).href);
for(const route of ['/','/news','/travel-tours','/philippine-immigration-services','/visa-assistance/japan','/missing-page']) {
  const html=render(route);assert.ok(html.length>500,route);assert.ok(!html.includes('[object Object]'),route);
}
console.log(`Client build, SSR build and six route renders passed: ${output}`);
