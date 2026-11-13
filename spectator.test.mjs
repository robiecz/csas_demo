import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createDrawPlan,sampleDraw} from './public/timeline.js';
const motion={launchTurns:2,cruiseTurns:6,coastTurns:8,launchMs:1800,cruiseMs:2500,slowMs:12000,pauseMs:1000,extraTurns:2,extraMs:7000,nearSectors:.8};
const plan=createDrawPlan({id:'shared',winnerId:'b',winnerIndex:1,count:2,startRotation:0,startedAt:100700,dramatic:true,motion});
const snapshot={people:[{id:'a',name:'První Kolega'},{id:'b',name:'Druhý Kolega'}],winners:[{id:'b',name:'Druhý Kolega'}],revision:2,currentDraw:plan,rotation:plan.endRotation,lockedUntil:plan.revealAt+10000};
function element(){return {style:{setProperty(){}},classList:{toggle(){}},textContent:'',open:false,setAttribute(){},replaceChildren(){},append(){},addEventListener(){},showModal(){this.open=true},close(){this.open=false},getContext(){return new Proxy({measureText:()=>({width:100})},{get:(target,key)=>key in target?target[key]:()=>{},set:(target,key,value)=>(target[key]=value,true)})}}}
async function client(now){
 const elements=new Map(),clock={now};let counter=0;const frames=new Map();
 const sandbox={sampleDraw,Date:class extends Date{static now(){return clock.now}},document:{getElementById:id=>{if(!elements.has(id))elements.set(id,element());return elements.get(id)},createElement:element,querySelectorAll:()=>[],addEventListener(){},fullscreenEnabled:false,documentElement:{}},window:{},matchMedia:()=>({matches:false}),performance:{now:()=>clock.now},AbortSignal,requestAnimationFrame:fn=>{frames.set(++counter,fn);return counter},cancelAnimationFrame:id=>frames.delete(id),setTimeout:()=>++counter,clearTimeout(){},setInterval(){},innerWidth:1000,innerHeight:800,devicePixelRatio:1,fetch:async url=>({ok:url!=='/api/auth',json:async()=>url==='/api/auth'?{error:'Sign in required'}:{...structuredClone(snapshot),serverNow:clock.now}})};
 vm.createContext(sandbox);vm.runInContext(readFileSync('public/app.js','utf8').replace(/^import[^\n]+\n/,''),sandbox);await new Promise(resolve=>setImmediate(resolve));
 return {clock,receive(next){sandbox.next=next;vm.runInContext('applySnapshot(next)',sandbox)},view(){return JSON.parse(vm.runInContext("JSON.stringify({rotation,busy,highlightedId,highlightPulse,presenter:$('current-presenter').textContent,modal:$('winner-dialog').open})",sandbox))}};
}
test('dva klienti: připojení uprostřed, společné vyhlášení a společné pokračování',async()=>{
 const first=await client(100500),late=await client(110000);
 for(const now of [110000,plan.stoppedAt+1000,plan.revealAt+50]){
  first.clock.now=late.clock.now=now;first.receive(structuredClone(snapshot));late.receive(structuredClone(snapshot));assert.deepEqual(first.view(),late.view());
  if(now<plan.revealAt)assert.equal(first.view().presenter,'Ještě nebyl vybrán');
 }
 assert.equal(first.view().presenter,'Druhý Kolega');assert.equal(first.view().modal,true);
 const complete=structuredClone(snapshot);complete.revision++;complete.lockedUntil=0;complete.currentDraw.completedAt=plan.revealAt+50;
 first.receive(complete);late.receive(complete);assert.deepEqual(first.view(),late.view());assert.equal(late.view().modal,false);
 const reset={people:snapshot.people,winners:[],revision:complete.revision+1,currentDraw:null,rotation:0,lockedUntil:0};first.receive(reset);late.receive(reset);assert.equal(first.view().presenter,'Ještě nebyl vybrán');assert.equal(first.view().rotation,0);
});
