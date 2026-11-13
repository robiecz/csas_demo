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
