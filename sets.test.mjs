import {test} from 'node:test';import assert from 'node:assert/strict';import {mkdtempSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';import {Readable} from 'node:stream';
test('sady: izolace, vytvoření, editace názvu a jmen, URL, souběh a odstranění',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'sets-'));process.env.DATA_DIR=dir;process.env.ADMIN_PASSWORD='test';const {server}=await import('./server.mjs?sets');
 async function req(path,body,auth=true){return new Promise(resolve=>{const r=Readable.from(body?[JSON.stringify(body)]:[]);Object.assign(r,{url:path,method:body?'POST':'GET',headers:{host:'localhost',...(auth?{authorization:'Basic '+Buffer.from('admin:test').toString('base64')}:{})}});let status;server.emit('request',r,{setHeader(){},writeHead(s){status=s},end(text){resolve({status,data:path.startsWith('/api/')?JSON.parse(text):text})}})})}
 try{
 assert.equal((await req('/api/sets',null,false)).status,401);
 let root=(await req('/api/add',{revision:0,names:'Původní Kolega'})).data;
 let list=(await req('/api/sets')).data;
 let a=await req('/api/sets/save',{name:'Nová sada',slug:'novasada',names:'První Kolega\nDruhý Kolega',registryRevision:list.revision});assert.equal(a.status,200);
 list=(await req('/api/sets')).data;const setA=a.data.set;
 assert.equal((await req('/api/sets/save',{name:'Kolize',slug:'novasada',names:'',registryRevision:list.revision})).status,409);
 const b=await req('/api/sets/save',{name:'Jiná sada',slug:'jiná',names:'Třetí Kolega',registryRevision:list.revision});assert.equal(b.status,400);
 assert.equal((await req('/api/sets/save',{name:'Druhá sada',slug:'druha',names:'test\ntest2\ntest3',registryRevision:list.revision})).status,200);
 assert.deepEqual((await req('/api/state?set=druha')).data.people.map(p=>p.name),['test','test2','test3']);
 let state=(await req('/api/state?set=novasada',null,false)).data;assert.equal(state.people.length,2);assert.equal((await req('/api/state')).data.people[0].id,root.people[0].id);
 const draw=(await req('/api/spin?set=novasada',{revision:state.revision},false)).data;
 assert.equal((await req('/api/state?set=druha')).data.winners.length,0);
 list=(await req('/api/sets')).data;
 assert.equal((await req('/api/sets/save',{id:setA.id,name:'Změna',slug:'nova',names:'Nový Kolega',setRevision:draw.state.revision,registryRevision:list.revision})).status,409);
 const realNow=Date.now;try{Date.now=()=>draw.state.currentDraw.revealAt+1;state=(await req('/api/complete?set=novasada',{revision:draw.state.revision,winnerId:draw.winner.id},false)).data}finally{Date.now=realNow}
 const edited=await req('/api/sets/save',{id:setA.id,name:'Nový název',slug:'upravenasada',names:draw.winner.name+'\nNový Kolega',setRevision:state.revision,registryRevision:list.revision});assert.equal(edited.status,200);
 assert.equal((await req('/api/state?set=novasada')).status,404);state=(await req('/api/state?set=upravenasada')).data;assert.equal(state.winners[0].id,draw.winner.id);assert.equal(state.people.length,2);assert.equal(state.set.name,'Nový název');
 list=(await req('/api/sets')).data;assert.equal((await req('/api/sets/delete',{id:setA.id,registryRevision:list.revision})).status,200);assert.equal((await req('/api/state?set=upravenasada')).status,404);assert.equal((await req('/api/state')).data.people[0].id,root.people[0].id);
 assert.equal((await req('/novasada')).status,200);assert.equal((await req('/sets-ui.js')).status,200);
 }finally{rmSync(dir,{recursive:true,force:true})}
});
