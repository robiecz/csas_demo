import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Readable} from 'node:stream';
import {parseParticipants} from './participants.mjs';
import {prepareWinnerEmail,sendWinnerEmail,winnerImage,winnerEmailStatus,EMAIL_SUBJECT} from './winner-email.mjs';
import {load,save} from './store.mjs';
import {randomUUID} from 'node:crypto';
test('e-maily: validace, ochrana adres, odesílání jednou, opakování, neměnný obrázek',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'wheel-email-'));process.env.DATA_DIR=dir;process.env.ADMIN_PASSWORD='test-mail';process.env.RESEND_API_KEY='fake-test-only';process.env.RESEND_EMAIL_DOMAIN='minka.cz';
 try{
 assert.deepEqual(parseParticipants('Tomáš Minka; tomas@example.cz\nJana Nováková'),[{name:'Tomáš Minka',email:'tomas@example.cz'},{name:'Jana Nováková'}]);
 for(const input of ['Tom; nope','Tom; a@b.cz; x','Tom; x@example.cz\rBcc: a@b.cz'])assert.throws(()=>parseParticipants(input));
 const {manageSets}=await import('./sets.mjs');
 const created=await manageSets('/api/sets/save',{name:'E-maily',slug:'email-test',names:'Jana Nováková; jana@example.cz',registryRevision:0});
 let saved=await load(created.set.id);assert.equal(saved.people[0].email,'jana@example.cz');
 await manageSets('/api/sets/save',{id:created.set.id,name:'E-maily',slug:'email-test',names:'Jana Nováková',registryRevision:1,setRevision:saved.revision});
 saved=await load(created.set.id);assert.equal(saved.people[0].email,'jana@example.cz','úprava názvu sady e-mail nesmaže');
 const person={id:'p1',name:'Tomáš Minka',email:'tomas@example.cz'},id=randomUUID();
 const state={people:[person,{id:'p2',name:'Jana Nováková'}],winners:[person],currentDraw:{id,winnerId:person.id,revealAt:Date.now()+60000,endRotation:Math.PI*1.5}};
 await prepareWinnerEmail(state,{name:'Testovací sada'});
 let calls=0,body,headers;
 const mock=async(url,opts)=>{calls++;assert.equal(url,'https://api.resend.com/emails');body=JSON.parse(opts.body);headers=opts.headers;return {ok:true,json:async()=>({id:'provider-test'})}};
 await Promise.all([sendWinnerEmail(id,mock),sendWinnerEmail(id,mock)]);
 assert.equal(calls,1);assert.equal(body.subject,EMAIL_SUBJECT);assert.equal(body.from,'Level Up demo <demo@minka.cz>');assert.deepEqual(body.to,[person.email]);assert.ok(body.scheduled_at);assert.equal(headers['Idempotency-Key'],'wheel-winner/'+id);assert.equal((body.html.match(/<img /g)||[]).length,1);assert.ok(!body.html.includes('<p>'));assert.equal(body.text,'');
 await sendWinnerEmail(id,mock);assert.equal(calls,1);
 let job=await load('email-'+id);assert.equal(await winnerImage(id,job.token),null,'neodhalí výherce před vyhlášením');
 job.revealAt=Date.now()-10;await save(job,job.revision,'email-'+id);
 assert.equal(await winnerImage(id,'wrong'),null);assert.equal(await winnerImage('../state',job.token),null);
 const image=await winnerImage(id,job.token);assert.equal(image.subarray(1,4).toString(),'PNG');assert.ok(image.length>10000);
 const id2=randomUUID();state.currentDraw.id=id2;state.currentDraw.revealAt=Date.now()-1;await prepareWinnerEmail(state,{name:'Retry'});
 const fail=await sendWinnerEmail(id2,async()=>({ok:false,status:429,json:async()=>({})}));assert.equal(fail.status,'failed');assert.equal((await winnerEmailStatus(id2)).status,'failed');
 await sendWinnerEmail(id2,mock);assert.equal(calls,2);assert.equal((await winnerEmailStatus(id2)).status,'scheduled');
 // Real request handler, with network mocked: email only for saved winner, never supplied by a visitor.
 const nativeFetch=globalThis.fetch;globalThis.fetch=mock;
 try{
  const {handler}=await import('./server.mjs?email-test');
  async function request(path,data,auth=true){return new Promise(resolve=>{const req=Readable.from(data?[JSON.stringify(data)]:[]);req.method=data?'POST':'GET';req.url=path;req.headers={host:'localhost',...(auth?{authorization:'Basic '+Buffer.from('admin:test-mail').toString('base64')}:{})};let status;handler(req,{writeHead(s){status=s},end(value){resolve({status,data:JSON.parse(value)})}})})}
  let r=await request('/api/add',{revision:0,names:'Tomáš Minka; tomas@example.cz'});assert.equal(r.status,200);let s=r.data;assert.equal(s.people[0].email,person.email);
  assert.equal((await request('/api/person-email',{revision:s.revision,id:s.people[0].id,email:'x@a.cz'},false)).status,401);
  assert.ok(!JSON.stringify((await request('/api/state',null,false)).data).includes('tomas@example.cz'));
  r=await request('/api/spin',{revision:s.revision},false);assert.equal(r.status,200);assert.ok(!JSON.stringify(r.data).includes('tomas@example.cz'));assert.equal(body.to[0],person.email);
  s=(await request('/api/state')).data;assert.equal(s.emailStatus.status,'scheduled');assert.equal((await request('/api/email-retry',{revision:s.revision,drawId:s.currentDraw.id},false)).status,401);
  const disk=JSON.parse(readFileSync(join(dir,'state.json')));disk.lockedUntil=0;writeFileSync(join(dir,'state.json'),JSON.stringify(disk));
  const edited=await request('/api/person-email',{revision:s.revision,id:s.people[0].id,email:'new@example.cz'});assert.equal(edited.status,200);assert.equal(edited.data.people[0].email,'new@example.cz');assert.equal((await load('email-'+s.currentDraw.id)).winner.email,person.email,'původní zpráva zachová původní adresu');
 }finally{globalThis.fetch=nativeFetch}
 }finally{rmSync(dir,{recursive:true,force:true});delete process.env.RESEND_API_KEY}
});
