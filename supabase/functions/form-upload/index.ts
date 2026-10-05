import { createClient } from 'npm:@supabase/supabase-js@2';
import { handleUpload } from '../_shared/forms/uploads.ts';
import { publicFailure } from '../_shared/auth/http.ts';
import { sha256Hex } from '../_shared/forms/tokens.ts';
import { allowedOrigins } from '../_shared/inbox/core.ts';
import type { FormSchema } from '../_shared/forms/schema.ts';

const serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const db=createClient(Deno.env.get('SUPABASE_URL')!,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
const salt=Deno.env.get('RATE_LIMIT_SALT') || serviceKey;
const origins=allowedOrigins(Deno.env.get('EXTRA_ALLOWED_ORIGINS'));
const configuredLimit=Number(Deno.env.get('FORM_UPLOADS_PER_DAY') || 300);
const globalDailyLimit=Number.isInteger(configuredLimit) && configuredLimit>0 ? Math.min(configuredLimit,10000) : 300;

Deno.serve(async req=>{
  const origin=req.headers.get('origin')||'';
  const headers={ 'Content-Type':'application/json', Vary:'Origin',
    'Access-Control-Allow-Methods':'POST, OPTIONS',
    'Access-Control-Allow-Headers':'authorization, apikey, x-client-info, content-type, x-form-key, x-field-name, x-file-name',
    ...(origins.has(origin)?{'Access-Control-Allow-Origin':origin}:{}),
  };
  const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers});
  if(req.method==='OPTIONS') return json({ok:true});
  if(req.method!=='POST') return json({error:'Method not allowed.'},405);
  try {
    const uploaded=await handleUpload(req,{
      globalDailyLimit,
      hash:value=>sha256Hex(`${salt}:${value}`),
      async hit(bucket,key,seconds,max) {
        const {data,error}=await db.rpc('rate_limit_hit',{p_bucket:bucket,p_key_hash:key,p_window_seconds:seconds,p_max:max});
        if(error) throw new Error('Upload limiter unavailable');
        return data===true;
      },
      async form(key) {
        const {data,error}=await db.from('cms_published').select('content').eq('kind','form').eq('slug',key).maybeSingle();
        if(error) throw new Error('Form unavailable');
        return data ? data.content as FormSchema : null;
      },
      async save(path,bytes,type) {
        const {error}=await db.storage.from('form-attachments').upload(path,bytes,{contentType:type,upsert:false});
        if(error) throw new Error('Storage unavailable');
      },
    });
    return json(uploaded);
  } catch(error) {
    const failure=publicFailure(error,'Could not upload the file. Please try again.');
    return json(failure.body,failure.status);
  }
});
