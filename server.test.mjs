import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Readable} from 'node:stream';
test('autorizace, validace, losování, souběh, reset a persistence',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'kolo-test-'));process.env.ADMIN_PASSWORD='test-only';process.env.DATA_DIR=dir;
 let server=(await import('./server.mjs?first')).server;
 async function request(path,body,auth=true){return new Promise(resolve=>{const req=Readable.from(body?[JSON.stringify(body)]:[]);req.method=body?'POST':'GET';req.url=path;req.headers={host:'localhost',...(auth?{authorization:'Basic '+Buffer.from('admin:test-only').toString('base64')}:{})};let status;server.emit('request',req,{writeHead(s){status=s},end(text){resolve({status,data:path.startsWith('/api/')?JSON.parse(text):text})}})})}
 try{
 assert.equal((await request('/')).status,200);assert.equal((await request('/api/reset',{},false)).status,401);assert.equal((await request('/api/add',{revision:0,names:'Testovací Jméno'},false)).status,401);assert.equal((await request('/api/remove',{revision:0,id:'example'},false)).status,401);
 let {data:s}=await request('/api/add',{revision:0,names:'Tomáš Minka\nJana Nováková\nTomáš Minka'});assert.equal(s.people.length,2);
 assert.equal((await request('/api/settings',{revision:s.revision,animalsEnabled:true},false)).status,401);
 assert.equal((await request('/api/settings',{revision:s.revision,animalsEnabled:'yes'})).status,400);
 s=(await request('/api/settings',{revision:s.revision,animalsEnabled:true})).data;assert.equal(s.animalsEnabled,true);
 assert.equal((await request('/api/state',null,false)).data.animalsEnabled,true);
 assert.equal((await request('/animals.js')).status,200);
 assert.equal((await request('/api/add',{revision:s.revision,names:'<script>alert(1)</script>'})).status,400);
 let {data:spin,status}=await request('/api/spin',{revision:s.revision},false);assert.equal(status,200);assert.ok(s.people.some(p=>p.id===spin.winner.id));assert.equal(spin.state.winners.length,1);const firstAnimal=spin.state.currentDraw.animalKind;assert.ok(firstAnimal);
 assert.equal((await request('/api/spin',{revision:spin.state.revision})).status,409);
 server=(await import('./server.mjs?restart')).server;s=(await request('/api/state')).data;assert.equal(s.winners[0].id,spin.winner.id);assert.equal(s.animalsEnabled,true);
 const {readFileSync,writeFileSync}=await import('node:fs');const disk=JSON.parse(readFileSync(join(dir,'state.json')));disk.lockedUntil=0;writeFileSync(join(dir,'state.json'),JSON.stringify(disk));
 spin=(await request('/api/spin',{revision:s.revision})).data;assert.equal(spin.state.winners.length,2);assert.notEqual(spin.state.currentDraw.animalKind,firstAnimal);assert.notEqual(spin.state.winners[0].id,spin.state.winners[1].id);
 server=(await import('./server.mjs?restart2')).server;s=(await request('/api/state')).data;{const disk=JSON.parse(readFileSync(join(dir,'state.json')));disk.lockedUntil=0;writeFileSync(join(dir,'state.json'),JSON.stringify(disk));}assert.equal((await request('/api/spin',{revision:s.revision})).status,400);
 assert.equal((await request('/api/reset',{revision:0})).status,409);s=(await request('/api/reset',{revision:s.revision})).data;assert.equal(s.winners.length,0);assert.equal(s.people.length,2);
 let previous=s.lastAnimalKind;
 for(let i=0;i<60;i++){
  const result=await request('/api/spin',{revision:s.revision},false);assert.equal(result.status,200);
  const kind=result.data.state.currentDraw.animalKind;assert.ok(['dog','cat','toddler','llama','snake','parrot'].includes(kind));assert.notEqual(kind,previous,'postavičky se neopakují ani po resetu');
  assert.equal((await request('/api/state',null,false)).data.currentDraw.animalKind,kind);
  previous=kind;const disk=JSON.parse(readFileSync(join(dir,'state.json')));disk.lockedUntil=0;writeFileSync(join(dir,'state.json'),JSON.stringify(disk));
  s=(await request('/api/reset',{revision:disk.revision})).data;assert.equal(s.lastAnimalKind,kind);
 }

 s=(await request('/api/remove',{revision:s.revision,id:s.people[0].id})).data;assert.equal(s.people.length,1);
 }finally{rmSync(dir,{recursive:true,force:true})}
});

