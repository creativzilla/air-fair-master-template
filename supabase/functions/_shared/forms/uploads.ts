import { RequestError } from '../auth/http.ts';
import { fileProblem, inputFields, normalizeSchema, type FormSchema } from './schema.ts';

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const TYPES: Record<string, string> = {
  pdf:'application/pdf', jpg:'image/jpeg', jpeg:'image/jpeg', png:'image/png', webp:'image/webp',
  heic:'image/heic', doc:'application/msword',
  docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

// Bounded binary reader: Content-Length alone is not a size check.
export async function readUpload(req: Request, maxBytes: number): Promise<Uint8Array> {
  if (Number(req.headers.get('content-length')) > maxBytes) throw new RequestError('File is too large.', 413);
  const reader = req.body?.getReader();
  if (!reader) throw new RequestError('Choose a file to upload.');
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    for (;;) {
      const {done,value} = await reader.read(); if (done) break;
      size += value.byteLength;
      if (size > maxBytes) { await reader.cancel(); throw new RequestError('File is too large.', 413); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  if (!size) throw new RequestError('The file is empty.');
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk,offset); offset += chunk.byteLength; }
  return bytes;
}

// Format signatures reject disguised HTML/executables. They are not a malware scan.
export function matchesFileFormat(bytes: Uint8Array, ext: string): boolean {
  const starts = (...prefix: number[]) => prefix.every((b,i)=>bytes[i]===b);
  const ascii = (start: number, end: number) => new TextDecoder().decode(bytes.subarray(start,end));
  if (ext === 'pdf') return ascii(0,5)==='%PDF-' && bytes.length >= 8;
  if (ext === 'jpg' || ext === 'jpeg') return starts(0xff,0xd8,0xff);
  if (ext === 'png') return starts(137,80,78,71,13,10,26,10);
  if (ext === 'webp') return ascii(0,4)==='RIFF' && ascii(8,12)==='WEBP';
  if (ext === 'heic') {
    if (bytes.length<16 || ascii(4,8)!=='ftyp') return false;
    const size=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength).getUint32(0);
    if (size<16 || size>bytes.length || size>1024) return false;
    const brands=['heic','heix','hevc','hevx'];
    if (brands.includes(ascii(8,12))) return true;
    // HEIC files may use the generic mif1 brand with a HEIC-compatible brand.
    for(let pos=16;pos+4<=size;pos+=4) if(brands.includes(ascii(pos,pos+4))) return true;
    return false;
  }
  if (ext === 'doc') return starts(0xd0,0xcf,0x11,0xe0,0xa1,0xb1,0x1a,0xe1);
  if (ext === 'docx') {
    if (!starts(0x50,0x4b,3,4)) return false;
    // Inspect ZIP directory names without decompressing untrusted archive data.
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let end = -1;
    for (let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--) {
      if (view.getUint32(i,true)===0x06054b50 && i+22+view.getUint16(i+20,true)===bytes.length) { end=i; break; }
    }
    if (end<0 || view.getUint16(end+4,true)!==0 || view.getUint16(end+6,true)!==0) return false;
    const count=view.getUint16(end+10,true), size=view.getUint32(end+12,true);
    let pos=view.getUint32(end+16,true); const limit=pos+size; const names=new Set<string>();
    if (count>2048 || limit!==end) return false;
    for (let i=0;i<count;i++) {
      if (pos+46>limit || view.getUint32(pos,true)!==0x02014b50 || (view.getUint16(pos+8,true)&1)) return false;
      const len=view.getUint16(pos+28,true), extra=view.getUint16(pos+30,true), comment=view.getUint16(pos+32,true);
      if (pos+46+len+extra+comment>limit) return false;
      const name=ascii(pos+46,pos+46+len);
      if (/vbaProject\.bin$/i.test(name) || name.includes('..') || name.includes('\\')) return false;
      names.add(name); pos+=46+len+extra+comment;
    }
    return pos===limit && names.has('[Content_Types].xml') && names.has('word/document.xml');
  }
  return false;
}

export interface UploadDeps {
  hash(value: string): Promise<string>;
  hit(bucket: string, key: string, seconds: number, max: number): Promise<boolean>;
  form(key: string): Promise<FormSchema | null>;
  save(path: string, bytes: Uint8Array, type: string): Promise<void>;
  globalDailyLimit: number;
}

export async function handleUpload(req: Request, deps: UploadDeps) {
  const ip=(req.headers.get('x-forwarded-for')||'').split(',')[0].trim() || req.headers.get('x-real-ip') || 'unknown';
  const key=await deps.hash(`upload-ip:${ip}`);
  // Count attempts before reading bodies or querying form definitions. The global
  // ceiling still holds if requests come from many addresses or spoofed headers.
  if (!(await deps.hit('upload_ip_10m',key,600,10)) ||
      !(await deps.hit('upload_ip_day',key,86400,30)) ||
      !(await deps.hit('upload_global_day','all',86400,deps.globalDailyLimit))) {
    throw new RequestError('Upload limit reached. Please try again later or contact us directly.',429);
  }
  const formKey=req.headers.get('x-form-key')||'', fieldName=req.headers.get('x-field-name')||'';
  let name='';
  try { name=decodeURIComponent(req.headers.get('x-file-name')||''); } catch { throw new RequestError('Invalid file name.'); }
  if (!/^[a-zA-Z0-9_-]{1,120}$/.test(formKey) || !/^[a-zA-Z0-9_]{1,64}$/.test(fieldName)) throw new RequestError('Invalid form field.');
  if (!name || name.length>255 || /[\u0000-\u001f\u007f/:\\]/.test(name)) throw new RequestError('Invalid file name.');
  const ext=name.split('.').pop()?.toLowerCase()||'', type=TYPES[ext];
  const declared=(req.headers.get('content-type')||'').split(';')[0].trim().toLowerCase();
  if (!type || (declared && declared!=='application/octet-stream' && declared!==type)) throw new RequestError('This file type is not allowed.');
  const schema=await deps.form(formKey);
  const field=schema && inputFields(normalizeSchema(schema)).find(f=>f.name===fieldName && f.type==='file');
  if (!field) throw new RequestError('This upload field is not available. Please reload the form.');
  const maxMB=Number(field.file?.maxMB ?? 10);
  const maxBytes=Math.min(MAX_UPLOAD_BYTES, Number.isFinite(maxMB) && maxMB>0 ? Math.floor(maxMB*1024*1024) : MAX_UPLOAD_BYTES);
  const problem=fileProblem(field,{name,type});
  if (problem) throw new RequestError(problem);
  const bytes=await readUpload(req,maxBytes);
  if (!matchesFileFormat(bytes,ext)) throw new RequestError('The file contents do not match its type. Please choose another file.');
  const path=`submissions/${new Date().toISOString().slice(0,7)}/${crypto.randomUUID()}-attachment.${ext}`;
  await deps.save(path,bytes,type);
  return {path,size:bytes.byteLength,type};
}
