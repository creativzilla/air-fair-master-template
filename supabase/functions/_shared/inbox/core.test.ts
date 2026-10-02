import test from "node:test";
import assert from "node:assert/strict";
import { allowedOrigins, checkMailbox, copyRecipients, fromHeader, toBase64, verifyMailbox, corsHeaders, must, ProviderError, providerMessageId, sendKey, threadAddress,normalizeIncoming, receiveWebhook, resendClient, verifyWebhook, sendStoredMessage } from "./core.ts";
const secret = "whsec_" + btoa("local-testing-only-secret-32bytes!");
async function signed(raw: string, id = "event-1", time = Math.floor(Date.now()/1000)) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode("local-testing-only-secret-32bytes!"), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${id}.${time}.${raw}`));
  return new Headers({ "svix-id": id, "svix-timestamp": String(time), "svix-signature": "v1," + btoa(String.fromCharCode(...new Uint8Array(signature))) });
}
const email = { id: "email-1", from: "Customer <customer@example.com>", to: ["inbox@reply.airfairtravel.com"], text: "Hello", headers: {}, subject: "Help" };
test("raw signature verification rejects tampering, missing signatures and replays", async () => {
  const raw = '{ "type": "email.received" }';
  const headers = await signed(raw);
  assert.equal(await verifyWebhook(raw, headers, secret), "event-1");
  await assert.rejects(verifyWebhook(JSON.stringify(JSON.parse(raw)), headers, secret));
  await assert.rejects(verifyWebhook(raw, new Headers(), secret));
  await assert.rejects(verifyWebhook(raw, await signed(raw, "old", 1), secret));
});
test("API failures and missing content are not acknowledged; wrong domains ignored", async () => {
  const raw = JSON.stringify({ type: "email.received", data: { email_id: email.id } });
  let saved=0;
  const request = async () => new Request("https://local.test", { method: "POST", body: raw, headers: await signed(raw) });
  for (const getEmail of [async () => { throw Error("API down"); }, async () => ({ id: email.id })]) {
    const r=await receiveWebhook(await request(), { secret, getEmail, persist: async()=>{saved++;} });
    assert.equal(r.status,503);
  }
  assert.equal(saved,0);
  assert.equal(normalizeIncoming({ ...email, to:["inbox@reply.airfairtravel.com.attacker.test"] },email.id),null);
  const r=await receiveWebhook(await request(), {secret,getEmail:async()=>email,persist:async()=>{throw Error("database unavailable");}});
  assert.equal(r.status,503);
});
test("failures log stage and provider/database codes, never secrets, signatures or bodies",async()=>{
  const body="Private message body";
  const raw=JSON.stringify({type:"email.received",data:{email_id:email.id}});
  const logs:any[]=[];const log=(e:any)=>logs.push(e);
  const request=async()=>new Request("https://local.test",{method:"POST",body:raw,headers:await signed(raw)});
  const api=resendClient("re_secret_key",(async()=>new Response(JSON.stringify({statusCode:401,name:"restricted_api_key",message:"This API key is restricted to only send emails"}),{status:401})) as any);
  let r=await receiveWebhook(await request(),{secret,getEmail:id=>api(`/emails/receiving/${id}`),persist:async()=>{},log});
  assert.equal(r.status,503);
  assert.deepEqual(logs[0],{stage:"fetch_email",status:401,code:"restricted_api_key",message:"This API key is restricted to only send emails",event_id:"event-1",email_id:email.id});
  r=await receiveWebhook(await request(),{secret,getEmail:async()=>({...email,text:body}),log,
    persist:async()=>must({data:null,error:{code:"42501",message:"permission denied for function accept_inbound_email"}})});
  assert.equal(r.status,503);
  assert.equal(logs[1].stage,"persist");assert.equal(logs[1].code,"42501");
  r=await receiveWebhook(await request(),{secret,getEmail:async()=>({id:email.id,to:[]}),persist:async()=>{},log});
  assert.equal(logs[2].stage,"normalize");assert.match(logs[2].message,/missing: text, headers/);
  const sig=(await signed(raw)).get("svix-signature")!;
  for(const leak of [body,"re_secret_key",secret,sig,"customer@example.com"]) assert.ok(!JSON.stringify(logs).includes(leak),leak);
});
test("inbox-send CORS: listed origins echoed (extras trimmed), others get no allow-origin",()=>{
  const allowed=allowedOrigins(" https://preview.example.test/ ,http://127.0.0.1:5173");
  for(const o of ["https://airfairtravel.com","http://localhost:5173","https://preview.example.test","http://127.0.0.1:5173"])
    assert.equal(corsHeaders(o,allowed)["Access-Control-Allow-Origin"],o);
  const denied=corsHeaders("https://attacker.test",allowed);
  assert.equal(denied["Access-Control-Allow-Origin"],undefined);
  assert.match(denied["Access-Control-Allow-Headers"],/authorization/);
  assert.equal(denied.Vary,"Origin");
});
test("thread tokens and RFC references are extracted, HTML is never rendered",()=>{
  const token="a".repeat(64);
  const e=normalizeIncoming({...email,to:[`thread-${token}@reply.airfairtravel.com`],text:null,html:'<script>alert(1)</script>',headers:{"In-Reply-To":"<original@example.com>",References:"<first@example.com>"},attachments:[{filename:"a.pdf",download_url:"secret"}]},email.id)!;
  assert.deepEqual(e.tokens,[token.slice(0,48)],"legacy thread-<64> addresses still match");
  const short=threadAddress("b".repeat(64));
  assert.ok(short.split("@")[0].length<=64,"RFC 5321 local-part limit");
  assert.deepEqual(normalizeIncoming({...email,to:[short]},email.id)!.tokens,["b".repeat(48)]);
  assert.deepEqual(e.references,["<original@example.com>","<first@example.com>"]);
  assert.ok(!e.text.includes("<script>"));
  assert.deepEqual(e.attachments,[{filename:"a.pdf",content_type:null}]);
});

function senderFake(settings:any={sending_enabled:true,test_redirect_to:"test@example.com"},mailbox:any={status:"active"}) {
  const message:any={id:"m1",conversation_id:"c1",status:"queued",first_attempt_at:null,lease_token:null,body_text:"Hi",subject:"Hello",resend_id:null};
  let locked=false;
  const db:any={
    storage:{from:()=>({download:async(path:string)=>path.endsWith("missing")?{data:null,error:{message:"not found"}}:{data:new Blob([`file:${path}`]),error:null}})},
    rpc:async()=> {if(locked || message.rfc_message_id) return {data:[],error:null}; locked=true; message.lease_token="lease"; message.first_attempt_at ||= new Date().toISOString();return {data:[{...message}],error:null};},
    from:(table:string)=>{
      let patch:any;
      const q:any={select:()=>q,eq:()=>q,neq:()=>q,in:()=>q,order:()=>q,limit:()=>q,update:(p:any)=>{patch=p;return q;},single:()=>q,
        then:(resolve:any)=>{
          if(patch){Object.assign(message,patch);if(patch.locked_until===null)locked=false;return Promise.resolve(resolve({data:[{id:message.id}],error:null}));}
          const data=table==="email_settings"?settings:table==="email_mailboxes"?mailbox:table==="email_conversations"?{participant_email:"customer@example.com",reply_token:"a".repeat(64)}:[];
          return Promise.resolve(resolve({data,error:null}));
        }};return q;
    }};
  return {db,message};
}
test("concurrent sends and retries reuse the frozen payload/key, redirect test mail, store actual Message-ID",async()=>{
  const {db,message}=senderFake();let posts=0;const accepted=new Map();let loseResponse=true;
  const api:any=async(path:string,payload:any,key:string)=>{
    if(path==="/emails") {posts++;if(!accepted.has(key))accepted.set(key,JSON.stringify(payload));else assert.equal(accepted.get(key),JSON.stringify(payload));
      assert.deepEqual(payload.to,["test@example.com"]);assert.match(payload.reply_to[0],/^t-[a-f0-9]{48}@/);
      if(loseResponse){loseResponse=false;throw Error("lost response after acceptance");}return {id:"resend-actual"};}
    return {message_id:"<actual@provider.example>"};
  };
  await Promise.all([sendStoredMessage(db,"m1",api),sendStoredMessage(db,"m1",api)]);
  assert.equal(posts,1);assert.equal(message.status,"retry");
  await sendStoredMessage(db,"m1",api);
  assert.equal(accepted.size,1);assert.equal(message.status,"sent");assert.equal(message.rfc_message_id,"<actual@provider.example>");
});
test("unknown sends outside the provider idempotency window never resend",async()=>{
  const {db,message}=senderFake();message.first_attempt_at=new Date(Date.now()-25*3600000).toISOString();
  let calls=0;await sendStoredMessage(db,"m1",async()=>{calls++;return {};});
  assert.equal(calls,0);assert.equal(message.status,"unknown");
});

test("422 rejection: actual Resend message saved (addresses redacted); retry rebuilds a valid payload with one send",async()=>{
  const {db,message}=senderFake();
  // The saved message as it exists in production: frozen payload with the 71-char reply-to.
  Object.assign(message,{status:"retry",first_attempt_at:new Date().toISOString(),last_error:"Email provider request failed (422 validation_error)",
    send_payload:{from:"x",to:["test@example.com"],reply_to:["thread-"+"a".repeat(64)+"@reply.airfairtravel.com"],subject:"Hello",text:"Hi",headers:{}}});
  const logs:any[]=[];const keys:string[]=[];let reject=true;
  const api:any=async(path:string,payload:any,key:string)=>{
    if(path!=="/emails") return {message_id:"<actual@provider.example>"};
    keys.push(key);assert.ok(payload.reply_to[0].split("@")[0].length<=64);
    if(reject){reject=false;throw new ProviderError(422,"validation_error","Invalid `to` field: bad@x.test");}
    return {id:"resend-ok"};
  };
  await sendStoredMessage(db,"m1",api,e=>logs.push(e));
  assert.equal(message.status,"retry");
  assert.equal(message.last_error,"Email provider request failed (422 validation_error): Invalid `to` field: [address]");
  assert.equal(logs[0].stage,"send");assert.equal(logs[0].status,422);assert.ok(!JSON.stringify(logs).includes("bad@x.test"));
  assert.match(message.send_payload.reply_to[0],/^t-a{48}@reply\.airfairtravel\.com$/);
  await sendStoredMessage(db,"m1",api,e=>logs.push(e));
  assert.equal(message.status,"sent");assert.equal(message.resend_id,"resend-ok");
  assert.equal(keys[0],keys[1],"same rebuilt payload keeps its key");
  assert.equal(keys.length,2);
});
test("send key ignores jsonb key order and changes only with the payload",async()=>{
  const a={to:["x@example.com"],headers:{References:"<a>","In-Reply-To":"<a>"},subject:"s"};
  const b={subject:"s",headers:{"In-Reply-To":"<a>",References:"<a>"},to:["x@example.com"]};
  assert.equal(await sendKey("m1",a),await sendKey("m1",b));
  assert.notEqual(await sendKey("m1",a),await sendKey("m1",{...a,subject:"t"}));
});

test("Message-ID: bracketed or bare provider values are stored; missing ones are pending, not errors, and refresh never resends",async()=>{
  assert.equal(providerMessageId("<a@ses.example>"),"<a@ses.example>");
  assert.equal(providerMessageId("a@ses.example"),"<a@ses.example>");
  assert.equal(providerMessageId(null),null);assert.equal(providerMessageId("not an id"),null);
  const {db,message}=senderFake();let posts=0;let known=false;
  const api:any=async(path:string)=>{
    if(path==="/emails"){posts++;return {id:"resend-1"};}
    assert.equal(path,"/emails/resend-1");
    return known?{message_id:"010601a0-x@ap-northeast-1.amazonses.com",last_event:"delivered"}:{message_id:null,last_event:"sent"};
  };
  assert.equal((await sendStoredMessage(db,"m1",api,()=>{})).status,"sent");
  assert.equal(message.status,"sent");assert.equal(message.resend_id,"resend-1");
  assert.equal(message.last_error,null,"accepted email is not shown as failed");
  assert.equal(message.rfc_message_id,undefined);assert.equal(message.provider_event,"sent");
  known=true;
  const refreshed=await sendStoredMessage(db,"m1",api,()=>{});
  assert.equal(refreshed.provider_event,"delivered");
  assert.equal(message.rfc_message_id,"<010601a0-x@ap-northeast-1.amazonses.com>");
  assert.equal(message.provider_event,"delivered");assert.equal(message.status,"sent");
  assert.equal(posts,1,"refreshing an accepted email never sends again");
});
test("incoming To list is deduplicated",()=>{
  const e=normalizeIncoming({...email,to:["Inbox <inbox@reply.airfairtravel.com>"],received_for:["inbox@reply.airfairtravel.com"],cc:["INBOX@reply.airfairtravel.com"]},email.id)!;
  assert.equal(e.to,"inbox@reply.airfairtravel.com");
});

test("copy recipients: deduplicated across To, CC and BCC, case-insensitive, invalid entries dropped",()=>{
  assert.deepEqual(copyRecipients("client@example.com","Staff@Airfairtravel.com, client@example.com",""),{cc:["staff@airfairtravel.com"]});
  assert.deepEqual(copyRecipients("client@example.com","staff@airfairtravel.com","STAFF@airfairtravel.com, other@airfairtravel.com, not-an-email"),
    {cc:["staff@airfairtravel.com"],bcc:["other@airfairtravel.com"]});
  assert.deepEqual(copyRecipients("staff@airfairtravel.com","staff@airfairtravel.com","staff@airfairtravel.com"),{},"sender emailing themselves gets no extra copy");
  assert.deepEqual(copyRecipients("client@example.com",null,null),{});
});
test("send payload uses the copy stored at queue time: CC, BCC, off; test mode sends only to the test address",async()=>{
  const live={sending_enabled:true,test_redirect_to:null};
  for(const [stored,expected] of [[{copy_mode:"cc",cc_email:"staff@airfairtravel.com"},{cc:["staff@airfairtravel.com"]}],
    [{copy_mode:"bcc",bcc_email:"staff@airfairtravel.com"},{bcc:["staff@airfairtravel.com"]}],[{copy_mode:"off"},{}]] as any[]){
    const {db,message}=senderFake(live);Object.assign(message,stored);let sent:any;
    await sendStoredMessage(db,"m1",(async(path:string,payload:any)=>{if(path==="/emails"){sent=payload;return {id:"r1"};}return {message_id:"<x@y>"};}) as any,()=>{});
    assert.deepEqual(sent.to,["customer@example.com"]);assert.deepEqual(sent.cc,expected.cc);assert.deepEqual(sent.bcc,expected.bcc);
    assert.match(sent.reply_to[0],/^t-a{48}@reply\.airfairtravel\.com$/,"thread Reply-To unchanged");
  }
  const {db,message}=senderFake();Object.assign(message,{copy_mode:"cc",cc_email:"staff@airfairtravel.com"});let sent:any;
  await sendStoredMessage(db,"m1",(async(path:string,payload:any)=>{if(path==="/emails"){sent=payload;return {id:"r1"};}return {};}) as any,()=>{});
  assert.deepEqual(sent.to,["test@example.com"]);assert.equal(sent.cc,undefined);assert.equal(sent.bcc,undefined);
});
test("retry by another admin after settings change keeps original sender, recipients and key; refresh never sends",async()=>{
  const settings:any={sending_enabled:true,test_redirect_to:null,inbox_sender_copy:"cc"};
  const {db,message}=senderFake(settings);
  Object.assign(message,{sender_user_id:"admin-1",sender_name:"First Admin",sender_email:"first@airfairtravel.com",copy_mode:"cc",cc_email:"first@airfairtravel.com"});
  const posts:any[]=[];let lose=true;
  const api:any=async(path:string,payload:any,key:string)=>{
    if(path!=="/emails") return {message_id:"<m@ses>",last_event:"delivered"};
    posts.push({payload,key});if(lose){lose=false;throw Error("lost response");}return {id:"r1"};
  };
  await sendStoredMessage(db,"m1",api,()=>{});
  settings.inbox_sender_copy="bcc"; // an admin changes the setting, then a different admin retries
  await sendStoredMessage(db,"m1",api,()=>{});
  assert.equal(posts.length,2);assert.equal(posts[0].key,posts[1].key);
  assert.deepEqual(posts[1].payload.cc,["first@airfairtravel.com"]);assert.equal(posts[1].payload.bcc,undefined);
  assert.equal(message.sender_user_id,"admin-1");assert.equal(message.sender_email,"first@airfairtravel.com");
  await sendStoredMessage(db,"m1",api,()=>{});
  assert.equal(posts.length,2,"status refresh never sends");
});
test("client Reply All with the CC'd staff member: one dashboard message in the thread, staff CC recorded",()=>{
  const token="c".repeat(48);
  const e=normalizeIncoming({...email,to:[`t-${token}@reply.airfairtravel.com`],cc:["Staff <staff@airfairtravel.com>",`t-${token}@reply.airfairtravel.com`],headers:{"In-Reply-To":"<orig@ses>"}},email.id)!;
  assert.equal(e.to,`t-${token}@reply.airfairtravel.com`);assert.deepEqual(e.tokens,[token]);
  assert.equal(e.cc,"staff@airfairtravel.com");assert.deepEqual(e.references,["<orig@ses>"]);
});

test("Compose/Reply preview equals the send payload: automatic sender CC plus manual CC/BCC, deduplicated",async()=>{
  const { finalRecipients, recipientProblem } = await import("../../../../src/dashboard/inboxRecipients.js");
  const shown=finalRecipients({to:"Client@Example.com",mode:"cc",senderEmail:"Staff@Airfairtravel.com",
    cc:["partner@example.com","STAFF@airfairtravel.com","client@example.com"],bcc:["audit@airfairtravel.com","partner@example.com"]});
  assert.deepEqual(shown.cc,["staff@airfairtravel.com","partner@example.com"]);
  assert.deepEqual(shown.bcc,["audit@airfairtravel.com"]);
  assert.deepEqual(shown.ccChips[0],{address:"staff@airfairtravel.com",auto:true});
  assert.equal(recipientProblem("bad",shown),"Enter a valid email address.");
  assert.match(recipientProblem("client@example.com",shown),/already in To/);
  assert.match(recipientProblem("Partner@example.com",shown),/already a recipient/);
  // Stored as the server stores them, then sent: identical recipients (reply and compose share the path).
  for(const reply of [false,true]){
    const {db,message}=senderFake({sending_enabled:true,test_redirect_to:null});
    Object.assign(message,{copy_mode:"cc",cc_email:shown.cc.join(", "),bcc_email:shown.bcc.join(", ")});
    let sent:any;
    await sendStoredMessage(db,"m1",(async(path:string,payload:any)=>{if(path==="/emails"){sent=payload;return {id:"r"};}return {};}) as any,()=>{});
    assert.deepEqual(sent.to,["customer@example.com"]);
    assert.deepEqual({cc:sent.cc,bcc:sent.bcc},copyRecipients("customer@example.com",message.cc_email,message.bcc_email),reply?"reply":"compose");
    assert.deepEqual(sent.cc,shown.cc);assert.deepEqual(sent.bcc,shown.bcc);
  }
  const bccMode=finalRecipients({to:"c@example.com",mode:"bcc",senderEmail:"s@airfairtravel.com",cc:["x@example.com"],bcc:[]});
  assert.deepEqual(bccMode.cc,["x@example.com"]);assert.deepEqual(bccMode.bcc,["s@airfairtravel.com"]);assert.equal(bccMode.bccChips[0].auto,true);
  const off=finalRecipients({to:"c@example.com",mode:"off",senderEmail:"s@airfairtravel.com",cc:[],bcc:[]});
  assert.deepEqual([off.cc,off.bcc],[[],[]]);
});

test("attachments: saved payload keeps references; Resend gets base64 content; retry reuses key; storage failure never sends",async()=>{
  const {db,message}=senderFake({sending_enabled:true,test_redirect_to:null});
  Object.assign(message,{attachments:[{path:"outgoing/u1/k1/0-quote.pdf",filename:"quote.pdf",size:10},{filename:"ignored-incoming.pdf"}]});
  const posts:any[]=[];let lose=true;
  const api:any=async(path:string,payload:any,key:string)=>{
    if(path!=="/emails") return {message_id:"<m@ses>"};
    posts.push({payload,key});if(lose){lose=false;throw Error("lost response");}return {id:"r1"};
  };
  await sendStoredMessage(db,"m1",api,()=>{});
  await sendStoredMessage(db,"m1",api,()=>{});
  assert.equal(posts.length,2);assert.equal(posts[0].key,posts[1].key,"same key across retries");
  assert.deepEqual(posts[1].payload.attachments,[{filename:"quote.pdf",content:btoa("file:outgoing/u1/k1/0-quote.pdf")}]);
  assert.deepEqual(message.send_payload.attachments,[{filename:"quote.pdf",storage_path:"outgoing/u1/k1/0-quote.pdf"}],"no file content in the database");
  assert.equal(message.status,"sent");
  const fail=senderFake({sending_enabled:true,test_redirect_to:null});let sent=0;
  Object.assign(fail.message,{attachments:[{path:"outgoing/u1/k2/0-missing",filename:"x.pdf"}]});
  await sendStoredMessage(fail.db,"m1",(async(path:string)=>{if(path==="/emails")sent++;return {id:"r"};}) as any,()=>{});
  assert.equal(sent,0);assert.equal(fail.message.status,"retry");assert.match(fail.message.last_error,/attachment/);
  assert.equal(toBase64(new Uint8Array(70000).fill(65)),btoa("A".repeat(70000)),"large files encode in chunks");
});
test("mailbox helpers: Reply All recipients, attachment limits, list times",async()=>{
  const { replyAllCc, attachmentProblem, rowTime } = await import("../../../../src/dashboard/inboxRecipients.js");
  const incoming={to_email:"t-abc@reply.airfairtravel.com",cc_email:"Partner@Example.com, staff@airfairtravel.com, client@example.com"};
  assert.deepEqual(replyAllCc(incoming,{to:"client@example.com",self:"staff@airfairtravel.com"}),["partner@example.com"]);
  assert.deepEqual(replyAllCc({to_email:"client@example.com",cc_email:"other.staff@airfairtravel.com, no-reply@airfairtravel.com"},{to:"client@example.com",self:"me@airfairtravel.com"}),["other.staff@airfairtravel.com"]);
  assert.deepEqual(replyAllCc({to_email:"t-x@reply.airfairtravel.com",cc_email:null},{to:"c@example.com"}),[],"no Reply all when nobody else is on the message");
  const f=(name:string,size=10)=>({name,size});
  assert.equal(attachmentProblem([],[f("a.pdf"),f("b.jpg")]),"");
  assert.match(attachmentProblem([],[f("run.EXE")]),/can't be emailed/);
  assert.match(attachmentProblem([f("1"),f("2"),f("3"),f("4")],[f("5"),f("6")]),/up to 5/);
  assert.match(attachmentProblem([],[f("big.pdf",11*1024*1024)]),/10 MB/);
  const now=new Date(2026,9,3,15,0);
  assert.match(rowTime(new Date(2026,9,3,9,5).toISOString(),now),/9:05/);
  assert.doesNotMatch(rowTime(new Date(2026,0,2).toISOString(),now),/2026|26/);
  assert.match(rowTime(new Date(2025,0,2).toISOString(),now),/25/);
});

test("shared mailboxes: inbound keeps every provider recipient for routing; managed-domain mail accepted; probe token extracted",()=>{
  const e=normalizeIncoming({...email,to:["Visa Team <visa@airfairtravel.com>"],cc:["travel@airfairtravel.com"],received_for:["visa@reply.airfairtravel.com"],
    headers:{"X-Airfair-Mailbox-Verify":"A".repeat(64)}},email.id)!;
  assert.deepEqual(e.recipients,["visa@airfairtravel.com","travel@airfairtravel.com","visa@reply.airfairtravel.com"]);
  assert.equal(e.to,"visa@airfairtravel.com");assert.equal(e.cc,"travel@airfairtravel.com");
  assert.equal(e.verify_token,"a".repeat(64));
  assert.equal(normalizeIncoming({...email,to:["x@other.test"],received_for:[]},email.id),null,"not ours");
  assert.equal(normalizeIncoming({...email,headers:{"x-airfair-mailbox-verify":"short"}},email.id)!.verify_token,undefined);
});
test("From header: mailbox name and address; legacy messages keep the original sender",()=>{
  assert.equal(fromHeader({from_email:"visa@airfairtravel.com",from_name:"Visa"}),"Visa <visa@airfairtravel.com>");
  assert.equal(fromHeader({from_email:"info@airfairtravel.com",from_name:"Air Fair, Info"}),'"Air Fair, Info" <info@airfairtravel.com>');
  assert.equal(fromHeader({from_email:"no-reply@airfairtravel.com",from_name:null}),"Air Fair Travel & Immigration <no-reply@airfairtravel.com>");
  assert.equal(fromHeader({from_email:"no-reply@airfairtravel.com",from_name:"Air Fair Travel & Immigration"}),"Air Fair Travel & Immigration <no-reply@airfairtravel.com>");
});
test("send uses the message's mailbox as From with the thread Reply-To; a disabled mailbox never sends",async()=>{
  const {db,message}=senderFake({sending_enabled:true,test_redirect_to:null});
  Object.assign(message,{mailbox_id:"mb-visa",from_email:"visa@airfairtravel.com",from_name:"Visa"});
  let sent:any;
  await sendStoredMessage(db,"m1",(async(path:string,payload:any)=>{if(path==="/emails"){sent=payload;return {id:"r"};}return {};}) as any,()=>{});
  assert.equal(sent.from,"Visa <visa@airfairtravel.com>");assert.match(sent.reply_to[0],/^t-a{48}@reply\.airfairtravel\.com$/);
  const off=senderFake({sending_enabled:true,test_redirect_to:null},{status:"disabled"});let posts=0;
  Object.assign(off.message,{mailbox_id:"mb-visa",from_email:"visa@airfairtravel.com",from_name:"Visa"});
  await sendStoredMessage(off.db,"m1",(async(path:string)=>{if(path==="/emails")posts++;return {id:"r"};}) as any,()=>{});
  assert.equal(posts,0);assert.equal(off.message.status,"retry");assert.match(off.message.last_error,/not active/);
});

function mailboxFake(box:any,probe:any=null){
  const state:any={box:{...box},probe,upserts:[] as any[]};
  const q=(table:string)=>{let patch:any=null;const filters:any={};
    const api:any={select:()=>api,eq:(k:string,v:any)=>{filters[k]=v;return api;},update:(p:any)=>{patch=p;return api;},
      upsert:async(row:any)=>{state.upserts.push(row);state.probe=row;return {data:null,error:null};},
      single:async()=>{if(table==="email_mailboxes"){if(patch&&(!filters.status||filters.status===state.box.status))Object.assign(state.box,patch);return {data:{...state.box},error:null};}return {data:null,error:null};},
      maybeSingle:async()=>({data:state.probe,error:null})};return api;};
  return {db:{from:q},state};
}
const domains=(over:any={})=>({data:[{name:"airfairtravel.com",status:"verified",capabilities:{sending:"enabled",receiving:"disabled"}},
  {name:"reply.airfairtravel.com",status:"verified",capabilities:{sending:"disabled",receiving:"enabled"}}].map((d:any)=>d.name===over.name?{...d,...over.patch}:d)});
const visaBox={id:"mb1",name:"Visa",address:"visa@airfairtravel.com",receiving_address:"visa@reply.airfairtravel.com",status:"pending"};
test("Verify Setup: checks the Resend domain, sends a probe from the mailbox to itself, never marks Active itself",async()=>{
  const {db,state}=mailboxFake(visaBox);const calls:any[]=[];
  const api:any=async(path:string,body:any,key:string)=>{calls.push({path,body,key});return path==="/domains"?domains():{id:"probe-1"};};
  const r=await verifyMailbox(db,api,"mb1","f".repeat(64),new Date("2026-10-03T10:00:00Z"));
  assert.equal(r.status,"pending","Active only after the probe comes back");assert.equal(r.probe_sent,true);
  assert.equal(calls[1].path,"/emails");assert.equal(calls[1].body.from,"Visa <visa@airfairtravel.com>");assert.deepEqual(calls[1].body.to,["visa@airfairtravel.com"]);
  assert.equal(calls[1].body.headers["X-Airfair-Mailbox-Verify"],"f".repeat(64));
  assert.notEqual(state.upserts[0].token_hash,"f".repeat(64),"only the hash is stored");assert.equal(state.upserts[0].token_hash.length,64);
  assert.ok(state.box.sending_verified_at);assert.match(state.box.status_detail,/visa@reply\.airfairtravel\.com/);
});
test("Verify Setup failures: unverified domain, provider refusal; restricted key falls back to the probe; active stays active",async()=>{
  let f=mailboxFake(visaBox);
  let r=await verifyMailbox(f.db,(async(path:string)=>path==="/domains"?domains({name:"airfairtravel.com",patch:{status:"pending"}}):{id:"x"}) as any,"mb1");
  assert.equal(r.status,"setup_failed");assert.match(r.detail,/not verified for sending/);
  f=mailboxFake(visaBox);
  r=await verifyMailbox(f.db,(async(path:string)=>{if(path==="/domains")return domains();throw new ProviderError(403,"validation_error","The airfairtravel.com domain is not verified");}) as any,"mb1");
  assert.equal(r.status,"setup_failed");assert.match(r.detail,/did not accept a test email/);
  f=mailboxFake(visaBox);let probed=0;
  r=await verifyMailbox(f.db,(async(path:string)=>{if(path==="/domains")throw new ProviderError(401,"restricted_api_key","restricted");probed++;return {id:"x"};}) as any,"mb1");
  assert.equal(probed,1);assert.equal(r.status,"pending");assert.match(r.detail,/cannot read domain status/);
  f=mailboxFake({...visaBox,status:"active"});
  r=await verifyMailbox(f.db,(async(path:string)=>path==="/domains"?domains({name:"airfairtravel.com",patch:{status:"failed"}}):{id:"x"}) as any,"mb1");
  assert.equal(r.status,"active");assert.match(r.detail,/Re-check failed/);
  f=mailboxFake({...visaBox,status:"disabled"});
  r=await verifyMailbox(f.db,(async()=>{throw Error("must not call provider");}) as any,"mb1");
  assert.equal(r.status,"disabled");
});
test("a probe that never arrives becomes Setup Failed after the wait; a recent one stays pending",async()=>{
  const sent="2026-10-03T10:00:00Z";
  let f=mailboxFake(visaBox,{sent_at:sent,confirmed_at:null});
  assert.equal((await checkMailbox(f.db,"mb1",new Date("2026-10-03T10:05:00Z"))).status,"pending");
  const out=await checkMailbox(f.db,"mb1",new Date("2026-10-03T10:20:00Z"));
  assert.equal(out.status,"setup_failed");assert.match(out.status_detail,/forwards a copy to visa@reply\.airfairtravel\.com/);
  f=mailboxFake({...visaBox,status:"active"},{sent_at:sent,confirmed_at:"2026-10-03T10:01:00Z"});
  assert.equal((await checkMailbox(f.db,"mb1",new Date("2026-10-04T00:00:00Z"))).status,"active");
});

test("From selector: only active sendable mailboxes; replies default to the receiving mailbox",async()=>{
  const { pickFromMailbox } = await import("../../../../src/dashboard/inboxRecipients.js");
  const boxes=[{id:"g",is_default:true,can_send:true,status:"active"},{id:"v",can_send:true,status:"active"},
    {id:"t",can_send:false,status:"active"},{id:"i",can_send:true,status:"disabled"},{id:"p",can_send:true,status:"pending"}];
  const r=pickFromMailbox(boxes,"v");
  assert.deepEqual(r.sendable.map((b:any)=>b.id),["g","v"]);assert.equal(r.initial,"v");
  assert.equal(pickFromMailbox(boxes,"t").initial,"g","cannot send from the receiving mailbox: default instead");
  assert.equal(pickFromMailbox(boxes,null).initial,"g");
  assert.equal(pickFromMailbox([{id:"t",can_send:false,status:"active"}],"t").initial,"");
});
