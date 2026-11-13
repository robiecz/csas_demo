import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Readable} from 'node:stream';
import {createHmac} from 'node:crypto';
test('365denní přihlášení a okamžité další losování',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'kolo-session-'));process.env.ADMIN_PASSWORD='session-test';process.env.DATA_DIR=dir;
 const {server}=await import('./server.mjs?session-flow');
 async function request(path,body,extra={}){return new Promise(resolve=>{const req=Readable.from(body?[JSON.stringify(body)]:[]);Object.assign(req,{method:body?'POST':'GET',url:path,headers:{host:'localhost',...extra}});let status;const headers={};server.emit('request',req,{setHeader(k,v){headers[k]=v},writeHead(s){status=s},end(text){resolve({status,headers,data:JSON.parse(text)})}})})}
 try{
 const login=await request('/api/auth',null,{authorization:'Basic '+Buffer.from('admin:session-test').toString('base64'),'x-forwarded-proto':'https'});assert.equal(login.status,200);
 const cookie=login.headers['Set-Cookie'];assert.match(cookie,/Max-Age=31536000/);assert.match(cookie,/HttpOnly/);assert.match(cookie,/SameSite=Strict/);assert.match(cookie,/Secure/);assert.ok(!cookie.includes('session-test'));
 const session={cookie:cookie.split(';')[0]};let s=(await request('/api/add',{revision:0,names:'Testovací Kolega\nDruhý Kolega'},session)).data;assert.equal(s.people.length,2);
 assert.equal((await request('/api/reset',{revision:s.revision},{cookie:session.cookie+'bad'})).status,401);
 const expires=String(Date.now()-1000),signature=createHmac('sha256','session-test').update('kolo-admin:'+expires).digest('hex');assert.equal((await request('/api/auth',null,{cookie:'kolo_admin='+expires+'.'+signature})).status,401);
 const first=(await request('/api/spin',{revision:s.revision})).data;s=first.state;
 const spectator=await request('/api/state');assert.ok(Number.isFinite(spectator.data.serverNow));assert.deepEqual(spectator.data.currentDraw,first.state.currentDraw);assert.ok(first.state.currentDraw.revealAt>first.state.currentDraw.startedAt);
 assert.equal((await request('/api/spin',{revision:s.revision})).status,409);
 assert.equal((await request('/api/complete',{revision:s.revision,winnerId:'wrong'})).status,409);
 assert.equal((await request('/api/complete',{revision:s.revision,winnerId:first.winner.id})).status,409);
 const realNow=Date.now;try{Date.now=()=>first.state.currentDraw.revealAt+1;s=(await request('/api/complete',{revision:s.revision,winnerId:first.winner.id})).data}finally{Date.now=realNow}assert.equal(s.lockedUntil,0);
 const second=await request('/api/spin',{revision:s.revision});assert.equal(second.status,200);assert.notEqual(first.winner.id,second.data.winner.id);
 assert.equal((await request('/api/complete',{revision:second.data.state.revision,winnerId:first.winner.id})).status,409);
 }finally{rmSync(dir,{recursive:true,force:true})}
});
