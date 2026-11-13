const TAU=Math.PI*2;
const normalize=angle=>((angle%TAU)+TAU)%TAU;
export function createDrawPlan({id,winnerId,winnerIndex,count,startRotation=0,startedAt,dramatic,motion}){
 const phases=[];let from=startRotation,elapsed=0;
 const add=(to,duration,easing,kind='spinning')=>{phases.push({from,to,start:elapsed,duration,easing,kind});from=to;elapsed+=duration};
 add(from+TAU*motion.launchTurns,motion.launchMs,'accelerate');
 add(from+TAU*motion.cruiseTurns,motion.cruiseMs,'linear');
 const target=normalize(TAU-(winnerIndex+.5)*TAU/count);
 const landing=from+TAU*motion.coastTurns+normalize(target-normalize(from));
 if(dramatic){add(landing-TAU/count*motion.nearSectors,motion.slowMs,'coast');add(from,motion.pauseMs,'linear','pause');add(landing+TAU*motion.extraTurns,motion.extraMs,'finish')}
 else add(landing,motion.slowMs,'coast');
 const stoppedAt=startedAt+elapsed;
 return {id,winnerId,startedAt,stoppedAt,revealAt:stoppedAt+2700,endRotation:normalize(from),phases,completedAt:null};
}
export function sampleDraw(plan,now){
 if(now<plan.startedAt)return {angle:plan.phases[0].from,phase:'waiting',pulse:0};
 const elapsed=now-plan.startedAt;
 for(const part of plan.phases){
  if(elapsed<part.start+part.duration){
   const p=Math.max(0,Math.min(1,(elapsed-part.start)/part.duration));
   const ease=part.easing==='accelerate'?p*p:part.easing==='coast'?1-(1-p)**3.6:part.easing==='finish'?1-(1-p)**3:p;
   return {angle:part.from+(part.to-part.from)*ease,phase:'spinning',pulse:0,kind:part.kind};
  }
 }
 if(now<plan.revealAt&&!plan.completedAt){const p=(now-plan.stoppedAt)/(plan.revealAt-plan.stoppedAt);return {angle:plan.endRotation,phase:'highlight',pulse:.5-.5*Math.cos(p*TAU*3)}}
 return {angle:plan.endRotation,phase:plan.completedAt?'complete':'revealed',pulse:.6};
}

