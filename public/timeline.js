const TAU=Math.PI*2;
const normalize=angle=>((angle%TAU)+TAU)%TAU;
export function createDrawPlan({id,winnerId,winnerIndex,count,startRotation=0,startedAt,dramatic,motion}){
 const phases=[];let from=startRotation,elapsed=0;
 const add=(to,duration,easing,kind='spinning')=>{phases.push({from,to,start:elapsed,duration,easing,kind});from=to;elapsed+=duration};
 add(from+TAU*motion.launchTurns,motion.launchMs,'accelerate');
 add(from+TAU*motion.cruiseTurns,motion.cruiseMs,'linear');
 // Keep old saved plans compatible; new draws may land anywhere inside the sector.
 const fraction=Number.isFinite(motion.landingFraction)?Math.max(.015,Math.min(.985,motion.landingFraction)):.5;
 const sector=TAU/count,target=normalize(TAU-(winnerIndex+fraction)*sector);
 const finishLanding=(landing,duration,easing)=>{
  if(!Number.isFinite(motion.landingFraction)){add(landing,duration,easing);return}
  const approach=sector*(motion.approachSectors||.6);
  // A long coast followed by a very slow final nudge across the sector boundary.
  add(landing-approach,duration,'coast');
  const overshoot=motion.rock?Math.min(sector*.075,sector*fraction*.65):0;
  add(landing+overshoot,motion.creepMs||3800,'creep');
  if(overshoot)add(landing,motion.settleMs||1100,'settle','settling');
 };
 const landing=from+TAU*motion.coastTurns+normalize(target-normalize(from));
 if(dramatic){
  const teaseTarget=Number.isInteger(motion.teaseIndex)
   ?normalize(TAU-(motion.teaseIndex+.5+(motion.teaseOffset||0))*TAU/count)
   :normalize(target-TAU/count*motion.nearSectors);
  const teaseLanding=from+TAU*motion.coastTurns+normalize(teaseTarget-normalize(from));
  add(teaseLanding,motion.slowMs,'coast');
  add(from,motion.pauseMs,'linear','pause');
  finishLanding(from+TAU*motion.extraTurns+normalize(target-normalize(from)),motion.extraMs,'finish');
 }
 else finishLanding(landing,motion.slowMs,'coast');
 const stoppedAt=startedAt+elapsed;
 return {id,winnerId,startedAt,stoppedAt,revealAt:stoppedAt+2700,endRotation:normalize(from),phases,completedAt:null};
}
export function sampleDraw(plan,now){
 if(now<plan.startedAt)return {angle:plan.phases[0].from,phase:'waiting',pulse:0};
 const elapsed=now-plan.startedAt;
 for(const part of plan.phases){
  if(elapsed<part.start+part.duration){
   const p=Math.max(0,Math.min(1,(elapsed-part.start)/part.duration));
   const ease=part.easing==='accelerate'?p*p:part.easing==='coast'?1-(1-p)**3.6:part.easing==='finish'?1-(1-p)**3:part.easing==='creep'?(1-Math.cos(Math.PI*p))/2:part.easing==='settle'?1-Math.exp(-5*p)*Math.cos(p*Math.PI*2)*(1-p):p;
   return {angle:part.from+(part.to-part.from)*ease,phase:'spinning',pulse:0,kind:part.kind};
  }
 }
 if(now<plan.revealAt&&!plan.completedAt){const p=(now-plan.stoppedAt)/(plan.revealAt-plan.stoppedAt);return {angle:plan.endRotation,phase:'highlight',pulse:.5-.5*Math.cos(p*TAU*3)}}
 return {angle:plan.endRotation,phase:plan.completedAt?'complete':'revealed',pulse:.6};
}

