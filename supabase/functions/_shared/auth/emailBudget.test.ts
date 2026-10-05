import test from 'node:test';
import assert from 'node:assert/strict';
import {budgetedEmailFetch,throttleEmailAction} from './emailBudget.ts';
import {resendClient} from '../inbox/core.ts';
import {resendSender,classify} from '../campaigns/worker.ts';
import {createResendMailer} from '../forms/resend.ts';

test('all send adapters honor budget denial with safe retry/pause behavior',async()=>{
  let calls=0;
  const send=budgetedEmailFetch({rpc:async()=>({data:false})},(async()=>{calls++;return new Response();}) as typeof fetch);
  await assert.rejects(resendClient('local-key',send)('/emails',{to:['a@example.com']},'stable'),(e:any)=>e.code==='app_email_budget_exceeded');
  const campaign=await resendSender('local-key',send)({to:['a@example.com']},'stable');
  assert.equal(classify(campaign,1,new Date()).outcome,'requeue_pause');
  const form=await createResendMailer('local-key',send).send({from:'a@example.com',to:'b@example.com',replyTo:null,subject:'Test',html:'test',text:'test',tags:{}},'stable');
  assert.ok(!form.ok && form.budgetBlocked);assert.equal(calls,0);
});

test('all recipient copies consume the shared budget; retries keep provider idempotency keys',async()=>{
  const reservations:number[]=[];const sent:RequestInit[]=[];
  const send=budgetedEmailFetch({rpc:async(_name:string,args:any)=>{reservations.push(args.p_recipients);return {data:true};}},
    (async(_url:any,init:any)=>{sent.push(init);return new Response('{}');}) as typeof fetch);
  const init={method:'POST',headers:{'Idempotency-Key':'stable'},body:JSON.stringify({to:['a@example.com'],cc:['b@example.com'],bcc:['c@example.com']})};
  await send('https://api.resend.com/emails',init);await send('https://api.resend.com/emails',init);
  assert.deepEqual(reservations,[3,3]);assert.equal(sent[0],init);assert.equal(sent[1],init);
});
test('budget exhaustion, database failures and unsupported payloads never call provider',async()=>{
  for(const result of [{data:false},{data:null,error:{message:'private'}},{data:null}]) {
    let calls=0;
    const send=budgetedEmailFetch({rpc:async()=>result},(async()=>{calls++;return new Response();}) as typeof fetch);
    const response=await send('https://api.resend.com/emails',{method:'POST',body:JSON.stringify({to:['a@example.com']})});
    assert.ok([429,503].includes(response.status));assert.equal(calls,0);assert.ok(!(await response.text()).includes('private'));
  }
  let calls=0;const send=budgetedEmailFetch({rpc:async()=>{throw Error('private');}},(async()=>{calls++;return new Response();}) as typeof fetch);
  for(const body of ['{}','[]','invalid',JSON.stringify({to:'a@example.com,b@example.com'})]) {
    assert.equal((await send('https://api.resend.com/emails',{method:'POST',body})).status,503);
  }
  assert.equal((await send('https://api.resend.com/emails/batch',{method:'POST',body:'[]'})).status,503);
  assert.equal(calls,0);
});
test('provider status lookups remain available without consuming send budget',async()=>{
  let calls=0;const send=budgetedEmailFetch({rpc:async()=>{throw Error('must not reserve');}},(async()=>{calls++;return new Response('{}');}) as typeof fetch);
  assert.equal((await send('https://api.resend.com/emails/example',{method:'GET'})).status,200);assert.equal(calls,1);
});
test('manual action throttles are user scoped and fail closed',async()=>{
  let args:any;
  await throttleEmailAction({rpc:async(_n:string,a:any)=>{args=a;return {data:true};}},'user1','inbox',600,30);
  assert.equal(args.p_key_hash,'user1');assert.equal(args.p_max,30);
  await assert.rejects(throttleEmailAction({rpc:async()=>({data:false})},'user1','inbox',600,30),(e:any)=>e.status===429);
  await assert.rejects(throttleEmailAction({rpc:async()=>({error:{}})},'user1','inbox',600,30),(e:any)=>e.status===503);
});
