import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createDrawPlan,sampleDraw} from './public/timeline.js';
const TAU=Math.PI*2;
const motion={launchTurns:2,cruiseTurns:6,coastTurns:8,launchMs:1800,cruiseMs:2500,slowMs:12000,pauseMs:1000,extraTurns:2,extraMs:7000,nearSectors:.8};
test('pozdější divák vidí ve stejném čase stejnou fázi i úhel',()=>{
 for(const dramatic of [false,true])for(const count of [1,2,13,300]){
  const plan=createDrawPlan({id:'draw-1',winnerId:'winner',winnerIndex:count-1,count,startRotation:1.7,startedAt:100000,dramatic,motion});
  const lateCopy=JSON.parse(JSON.stringify(plan));
  for(const offset of [-200,0,700,2300,10000,plan.stoppedAt-plan.startedAt,plan.revealAt-plan.startedAt-1,plan.revealAt-plan.startedAt,50000]){
   assert.deepEqual(sampleDraw(plan,plan.startedAt+offset),sampleDraw(lateCopy,plan.startedAt+offset));
  }
  assert.equal(sampleDraw(plan,plan.startedAt-1).phase,'waiting');
  assert.equal(sampleDraw(plan,plan.stoppedAt).phase,'highlight');
  assert.equal(sampleDraw(plan,plan.revealAt-1).phase,'highlight');
  assert.equal(sampleDraw(plan,plan.revealAt).phase,'revealed');
  const angle=((TAU-plan.endRotation)%TAU+TAU)%TAU;assert.ok(Math.abs(angle-(count-.5)*TAU/count)<1e-9);
  plan.completedAt=plan.revealAt+50;assert.equal(sampleDraw(plan,plan.revealAt+100).phase,'complete');
 }
});


test('mezizastavení je nezávislé na výherci a dotočení jde vždy vpřed',()=>{
 const count=13;
 const sector=angle=>Math.floor((((TAU-angle)%TAU+TAU)%TAU)/(TAU/count));
 for(let winnerIndex=0;winnerIndex<count;winnerIndex++){
  const stops=new Set();
  for(let teaseIndex=0;teaseIndex<count;teaseIndex++){
   if(teaseIndex===winnerIndex)continue;
   for(const teaseOffset of [-.2,0,.2]){
    const plan=createDrawPlan({id:'independent',winnerId:'winner',winnerIndex,count,startRotation:1.7,startedAt:1000,dramatic:true,motion:{...motion,teaseIndex,teaseOffset}});
    const pause=plan.phases.find(p=>p.kind==='pause');
    assert.equal(sector(pause.to),teaseIndex);stops.add(sector(pause.to));
    assert.equal(sector(plan.endRotation),winnerIndex);
    for(const phase of plan.phases)assert.ok(phase.to>=phase.from);
    assert.deepEqual(sampleDraw(plan,plan.startedAt+pause.start+10),sampleDraw(JSON.parse(JSON.stringify(plan)),plan.startedAt+pause.start+10));
   }
  }
  assert.equal(stops.size,count-1);
 }
});

test('mechanický dojezd: náhodné místo v celé výseči a pomalé zhoupnutí zůstávají na výherci',()=>{
 const normalize=a=>((a%TAU)+TAU)%TAU;
 for(const count of [1,2,13,300])for(const winnerIndex of [0,count-1])for(const fraction of [.015,.04,.25,.5,.75,.96,.985])for(const dramatic of [false,true])for(const rock of [false,true]){
  const plan=createDrawPlan({id:'mechanical',winnerId:'win',winnerIndex,count,startRotation:2,startedAt:1000,dramatic,motion:{...motion,landingFraction:fraction,approachSectors:1.15,creepMs:4500,settleMs:1200,rock}});
  const coordinate=normalize(TAU-plan.endRotation)/(TAU/count);
  assert.ok(Math.abs(coordinate-(winnerIndex+fraction))<1e-9);
  const creep=plan.phases.find(p=>p.easing==='creep');assert.equal(creep.duration,4500);assert.ok(creep.to>creep.from);
  for(let i=0;i<plan.phases.length-1;i++){const a=plan.phases[i],b=plan.phases[i+1];assert.equal(a.to,b.from);assert.equal(a.start+a.duration,b.start)}
  const settle=plan.phases.find(p=>p.easing==='settle');assert.equal(!!settle,rock);
  if(settle)for(let t=0;t<=1200;t+=25){const view=sampleDraw(plan,plan.startedAt+settle.start+t);const index=Math.floor(normalize(TAU-view.angle)/(TAU/count));assert.equal(index,winnerIndex)}
  assert.equal(sampleDraw(plan,plan.stoppedAt).phase,'highlight');
  assert.deepEqual(sampleDraw(plan,plan.stoppedAt-500),sampleDraw(JSON.parse(JSON.stringify(plan)),plan.stoppedAt-500));
 }
});

test('přímý dojezd se po zastavení znovu nerozjíždí; napínavé varianty jsou volitelné',()=>{
 for(const dramatic of [false,true])for(const finalNudge of [false,true]){
  const plan=createDrawPlan({id:'variants',winnerId:'winner',winnerIndex:5,count:13,startRotation:1,startedAt:1000,dramatic,motion:{...motion,landingFraction:.96,finalNudge,rock:true}});
  assert.equal(plan.phases.some(p=>p.kind==='pause'),dramatic);
  assert.equal(plan.phases.some(p=>p.easing==='creep'),finalNudge);
  if(!dramatic&&!finalNudge){
   assert.equal(plan.phases.length,3);
   const coast=plan.phases.at(-1);let previous=-Infinity;
   for(let t=0;t<coast.duration;t+=20){const angle=sampleDraw(plan,plan.startedAt+coast.start+t).angle;assert.ok(angle>previous);previous=angle}
   assert.equal(sampleDraw(plan,plan.stoppedAt).phase,'highlight');
   assert.equal(sampleDraw(plan,plan.stoppedAt+1000).phase,'highlight');
  }
  const sector=Math.floor((((TAU-plan.endRotation)%TAU+TAU)%TAU)/(TAU/13));assert.equal(sector,5);
 }
});
