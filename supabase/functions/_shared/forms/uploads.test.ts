import test from 'node:test';
import assert from 'node:assert/strict';
import { handleUpload, matchesFileFormat, readUpload, type UploadDeps } from './uploads.ts';

const pdf=new TextEncoder().encode('%PDF-1.7\nexample\n%%EOF');
function request(body: BodyInit = pdf, headers: Record<string,string> = {}) {
  return new Request('https://local.test/form-upload',{method:'POST',headers:{
    'x-form-key':'studio-apply','x-field-name':'passport','x-file-name':'passport.pdf','content-type':'application/pdf',...headers,
  },body});
}
function fixture() {
  const saved: Array<{path:string,bytes:Uint8Array,type:string}>=[];
  const hits: string[]=[];
  const deps: UploadDeps={globalDailyLimit:300,hash:async()=> 'hashed-ip',
    hit:async(bucket,key)=>{hits.push(`${bucket}:${key}`);return true;},
    form:async()=>({fields:[{name:'passport',type:'file',file:{accept:['.pdf'],maxMB:2}}]}),
    save:async(path,bytes,type)=>{saved.push({path,bytes,type});},
  };
  return {deps,saved,hits};
}

test('upload broker checks published rules and stores canonical metadata at random paths',async()=>{
  const {deps,saved,hits}=fixture();
  const first=await handleUpload(request(),deps), second=await handleUpload(request(),deps);
  assert.match(first.path,/^submissions\/\d{4}-\d{2}\/[a-f0-9-]{36}-attachment.pdf$/);
  assert.notEqual(first.path,second.path); assert.equal(first.size,pdf.length);
  assert.equal(first.type,'application/pdf'); assert.deepEqual(saved[0].bytes,pdf);
  assert.deepEqual(hits.slice(0,3),['upload_ip_10m:hashed-ip','upload_ip_day:hashed-ip','upload_global_day:all']);
});

test('upload rejects missing fields, unsafe names, mismatched types and disguised executables',async()=>{
  const {deps,saved}=fixture();
  for (const headers of [
    {'x-field-name':'not-a-field'}, {'x-form-key':'unknown'}, {'x-file-name':'shell.exe'},
    {'x-file-name':'..%2Fpassport.pdf'}, {'x-file-name':'file.pdf%3Aevil'},
    {'x-file-name':'bad%00.pdf'}, {'x-file-name':'%'}, {'content-type':'text/html'},
  ]) {
    const d={...deps,form:async(key:string)=>key==='unknown'?null:deps.form(key)};
    await assert.rejects(handleUpload(request(pdf,headers),d));
  }
  await assert.rejects(handleUpload(request('<html><script>bad()</script>'),deps),/contents do not match/);
  await assert.rejects(handleUpload(request('MZ executable'),deps),/contents do not match/);
  assert.equal(saved.length,0);
});

test('field limits and global size cap reject uploads before Storage writes',async()=>{
  const {deps,saved}=fixture();
  await assert.rejects(handleUpload(request(pdf,{'content-length':String(2*1024*1024+1)}),deps),/too large/);
  await assert.rejects(handleUpload(request(new Uint8Array(2*1024*1024+1)),deps),/too large/);
  await assert.rejects(handleUpload(request(''),deps),/empty/);
  await assert.rejects(handleUpload(request(pdf,{'x-file-name':'photo.jpg','content-type':'image/jpeg'}),deps),/isn't allowed/);
  assert.equal(saved.length,0);
});

test('streamed bodies are capped without trusting Content-Length and cancelled on overflow',async()=>{
  let cancelled=false;
  const body=new ReadableStream({start(c){c.enqueue(new Uint8Array(9));},cancel(){cancelled=true;}});
  const req=new Request('http://local.test',{method:'POST',body,duplex:'half',headers:{'content-length':'1'}} as RequestInit);
  await assert.rejects(readUpload(req,8),/too large/); assert.equal(cancelled,true);
});

test('per-connection and global quotas stop before reading or saving files; limiter failures fail closed',async()=>{
  for (const denied of ['upload_ip_10m','upload_ip_day','upload_global_day']) {
    const {deps,saved}=fixture(); let read=false;
    deps.form=async()=>{read=true;return null;}; deps.hit=async bucket=>bucket!==denied;
    await assert.rejects(handleUpload(request(),deps),e=>(e as {status?:number}).status===429);
    assert.equal(read,false); assert.equal(saved.length,0);
  }
  const {deps,saved}=fixture(); deps.hit=async()=>{throw new Error('database down');};
  await assert.rejects(handleUpload(request(),deps),/database down/); assert.equal(saved.length,0);
});

test('format signatures allow supported formats and reject SVG, HTML and arbitrary ZIP files',()=>{
  assert.equal(matchesFileFormat(pdf,'pdf'),true);
  assert.equal(matchesFileFormat(new Uint8Array([255,216,255,224]),'jpg'),true);
  assert.equal(matchesFileFormat(new Uint8Array([137,80,78,71,13,10,26,10]),'png'),true);
  assert.equal(matchesFileFormat(new TextEncoder().encode('RIFF0000WEBP'),'webp'),true);
  const heic=new TextEncoder().encode('0000ftypmif10000heic');
  new DataView(heic.buffer).setUint32(0,heic.length);
  assert.equal(matchesFileFormat(heic,'heic'),true);
  assert.equal(matchesFileFormat(new Uint8Array([208,207,17,224,161,177,26,225]),'doc'),true);
  for(const ext of ['pdf','png','jpg','webp','heic','doc','docx','svg']) {
    assert.equal(matchesFileFormat(new TextEncoder().encode('<svg onload="bad()"/>'),ext),false);
    assert.equal(matchesFileFormat(new Uint8Array([80,75,3,4,0,0]),ext),false);
  }
});

test('DOCX directory inspection allows document archives and rejects macros, encryption and corrupt offsets',()=>{
  const zip=(names:string[])=>{
    const entries=names.map(name=>{
      const n=new TextEncoder().encode(name),b=new Uint8Array(46+n.length),v=new DataView(b.buffer);
      v.setUint32(0,0x02014b50,true); v.setUint16(28,n.length,true); b.set(n,46);return b;
    });
    const size=entries.reduce((n,b)=>n+b.length,0),b=new Uint8Array(4+size+22),v=new DataView(b.buffer);
    v.setUint32(0,0x04034b50,true);let pos=4;for(const e of entries){b.set(e,pos);pos+=e.length;}
    v.setUint32(pos,0x06054b50,true);v.setUint16(pos+8,names.length,true);v.setUint16(pos+10,names.length,true);
    v.setUint32(pos+12,size,true);v.setUint32(pos+16,4,true);return b;
  };
  const names=['[Content_Types].xml','word/document.xml'];
  assert.equal(matchesFileFormat(zip(names),'docx'),true);
  assert.equal(matchesFileFormat(zip([...names,'word/vbaProject.bin']),'docx'),false);
  const encrypted=zip(names);encrypted[12]=1;assert.equal(matchesFileFormat(encrypted,'docx'),false);
  const corrupt=zip(names);corrupt[corrupt.length-6]=255;assert.equal(matchesFileFormat(corrupt,'docx'),false);
});
