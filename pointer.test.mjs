import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {createDrawPlan,sampleDraw} from './public/timeline.js';
const src=readFileSync('public/app.js','utf8');const c=vm.createContext({TAU:Math.PI*2,sampleDraw});vm.runInContext(src.slice(src.indexOf('function pointerDeflection('),src.indexOf('function updateRubberPointer(')),c);
const bend=(angle,speed,count)=>{Object.assign(c,{angle,speed,count});return vm.runInContext('pointerDeflection(angle,speed,count)',c)};
test('šipka reaguje na každý kolík, pruží po kontaktu a respektuje zpětný pohyb',()=>{
 for(const count of [1,2,13,64,300]){
  const contact=Math.min(.05,Math.PI*2/count*.32);
  assert.ok(bend(0,1,count)>0);
  assert.ok(Math.abs(bend(0,1,count)+bend(0,-1,count))<1e-9);
  assert.ok(Math.abs(bend(Math.PI*2/count,1,count)-bend(0,1,count))<1e-9);
  assert.equal(bend(contact*1.1,0,count),0);
  for(let angle=-.2;angle<.2;angle+=.001)assert.ok(Math.abs(bend(angle,.2,count))<=1);
 }
 assert.ok(bend(.18,1,1)<0,'po uvolnění krátký pružný překmit');
 assert.equal(bend(0,1,0),0);
});

test('po zastavení šipka ukazuje vyhlášenou výseč i při zastavení těsně u hranice',()=>{
 const TAU=Math.PI*2;
 for(const count of [2,13,64,300])for(const fraction of [.015,.5,.985]){
  const plan=createDrawPlan({id:'pointer-regression',winnerId:'tom',winnerIndex:count-1,count,startedAt:1000,dramatic:false,motion:{launchTurns:2,cruiseTurns:6,coastTurns:8,launchMs:1800,cruiseMs:2500,slowMs:12000,physicsVersion:1,landingFraction:fraction,finalNudge:false}});
  Object.assign(c,{plan,count,angle:plan.endRotation});
  for(const now of [plan.stoppedAt,plan.stoppedAt+24,plan.revealAt,plan.revealAt+5000]){
   c.now=now;assert.equal(vm.runInContext('pointerBendForDraw(plan,now,angle,count)',c),0,'klidová šipka je vždy rovná');
  }
  const visualIndex=Math.floor((((TAU-plan.endRotation)%TAU+TAU)%TAU)/(TAU/count));assert.equal(visualIndex,count-1);
 }
 for(const count of [1,13,300])for(const angle of [-.02,0,.02])assert.equal(bend(angle,0,count),0,'ani kontakt na hranici nesmí ohnout stojící šipku');
});
