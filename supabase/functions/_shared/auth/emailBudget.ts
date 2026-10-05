import { RequestError } from './http.ts';

// Every attempt is charged, even an idempotent retry or provider failure. Never
// release a reservation after an ambiguous timeout: the provider may have sent.
export function budgetedEmailFetch(db: any, fetcher: typeof fetch = fetch): typeof fetch {
  return async (input,init) => {
    const url=new URL(input instanceof Request ? input.url : String(input));
    const method=(init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
    if(url.origin==='https://api.resend.com' && method==='POST' && url.pathname.startsWith('/emails')) {
      const denied=(name:string,status:number)=>new Response(JSON.stringify({name,message:
        name==='app_email_budget_exceeded'?'Application email budget reached. Sending is deferred.':'Email budget check unavailable. Sending is deferred.'}),{status,headers:{'Content-Type':'application/json'}});
      // Fail closed if a new sender introduces batch/unknown formats.
      if(url.pathname!=='/emails' || typeof init?.body!=='string') return denied('app_email_budget_unavailable',503);
      let count=0;
      try {
        const body=JSON.parse(init.body);
        for(const key of ['to','cc','bcc']) {
          const values=body[key]==null?[]:Array.isArray(body[key])?body[key]:[body[key]];
          if(values.some((v:unknown)=>typeof v!=='string'||!v.trim()||/[\r\n,;]/.test(v))) throw new Error();
          count+=values.length;
        }
        if(count<1||count>100) throw new Error();
      } catch { return denied('app_email_budget_unavailable',503); }
      try {
        const {data,error}=await db.rpc('reserve_email_budget',{p_recipients:count});
        if(error || typeof data!=='boolean') return denied('app_email_budget_unavailable',503);
        if(!data) return denied('app_email_budget_exceeded',429);
      } catch { return denied('app_email_budget_unavailable',503); }
    }
    return fetcher(input,init);
  };
}

export async function throttleEmailAction(db:any, userId:string, action:string, seconds:number, max:number) {
  const {data,error}=await db.rpc('rate_limit_hit',{p_bucket:`email_action_${action}`,p_key_hash:userId,p_window_seconds:seconds,p_max:max});
  if(error || typeof data!=='boolean') throw new RequestError('Email request limit could not be checked. Please retry.',503);
  if(!data) throw new RequestError('Too many email requests. Please try again later.',429);
}
