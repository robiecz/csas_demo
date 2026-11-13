const TAU=Math.PI*2;
const normalize=angle=>((angle%TAU)+TAU)%TAU;
// Reduced rotational model: inertia J=1, elastic torque -k*x,
// viscous drag -b*v and Coulomb friction opposing the motion.
// References: ETH Zurich, Implementation Issues for the Virtual Spring §2.2;
// Butikov, Torsion Spring Oscillator with Dry Friction, eqs. (1)–(3).
export function simulateDetent({displacement,stiffness=22,damping=3.6,friction=.045}){
 const dt=1/240,stepMs=1000/60,samples=[displacement];
 let x=displacement,v=0,rest=false;
 for(let step=1;step<=240*8;step++){
  if(!rest){
   const force=-stiffness*x;
   if(Math.abs(v)<.003&&Math.abs(force)<=friction){rest=true;v=0}
   else{
    const direction=Math.abs(v)>.00001?Math.sign(v):Math.sign(force);
    const acceleration=force-damping*v-friction*direction;
    v+=acceleration*dt;x+=v*dt;
   }
  }
  if(step%4===0){samples.push(x);if(rest)break}
 }
 // Static friction leaves a tiny dead zone. Translate the equilibrium so that
 // the resting position is exactly the already selected point in the sector.
 const residual=samples.at(-1),start=samples[0];
 const scale=start/(start-residual);
 return {samples:samples.map(value=>Number(((value-residual)*scale).toFixed(7))),stepMs};
}
function frictionProgress(p,drag){
 if(drag<.0001)return 2*p-p*p;
 const end=Math.exp(-drag);
 return (1-Math.exp(-drag*p)-drag*p*end)/(1-end-drag*end);
}
export function createDrawPlan({id,winnerId,winnerIndex,count,startRotation=0,startedAt,dramatic,motion}){
 const phases=[];let from=startRotation,elapsed=0;
 const add=(to,duration,easing,kind='spinning',extra={})=>{phases.push({from,to,start:elapsed,duration,easing,kind,...extra});from=to;elapsed+=duration};
 const cruiseSpeed=TAU*motion.cruiseTurns/(motion.cruiseMs/1000);
 add(from+(motion.physicsVersion===1?cruiseSpeed*motion.launchMs/2000:TAU*motion.launchTurns),motion.launchMs,'accelerate');
 add(from+TAU*motion.cruiseTurns,motion.cruiseMs,'linear');
 // Keep old saved plans compatible; new draws may land anywhere inside the sector.
 const fraction=Number.isFinite(motion.landingFraction)?Math.max(.015,Math.min(.985,motion.landingFraction)):.5;
 const sector=TAU/count,target=normalize(TAU-(winnerIndex+fraction)*sector);
 let incomingSpeed=cruiseSpeed;
 const physicalCoast=(landing,duration)=>{
  const distance=landing-from;
  const seconds=Math.max(duration/1000,2*distance/incomingSpeed*1.001);
  const ratio=incomingSpeed*seconds/distance;
  let lo=.00001,hi=64;
  for(let i=0;i<48;i++){
   const drag=(lo+hi)/2,e=Math.exp(-drag);
   const candidate=drag*(1-e)/(1-e-drag*e);
   if(candidate<ratio)lo=drag;else hi=drag;
  }
  add(landing,seconds*1000,'friction','spinning',{drag:(lo+hi)/2});
 };
 const finishLanding=(landing,duration,easing)=>{
  if(motion.physicsVersion===1){
   if(motion.finalNudge===false){physicalCoast(landing,duration);return}
   // Slow to the loaded side of the last sector boundary, then release the
   // elastic latch. Its energy produces the forward overshoot and recoil.
   const offset=-(1-fraction+.035);
   physicalCoast(landing+offset*sector,duration);
   const response=simulateDetent({displacement:offset,stiffness:motion.stiffness,damping:motion.damping,friction:motion.friction});
   const samples=response.samples.map(x=>Number((landing+x*sector).toFixed(9)));
   samples[0]=from;samples[samples.length-1]=landing;
   add(landing,(samples.length-1)*response.stepMs,'detent','settling',{samples,stepMs:response.stepMs});
   return;
  }
  if(!Number.isFinite(motion.landingFraction)){add(landing,duration,easing);return}
  // Most draws finish in one uninterrupted deceleration, with no forced restart.
  if(motion.finalNudge===false){add(landing,duration,'glide');return}
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
  const finalLanding=from+TAU*motion.extraTurns+normalize(target-normalize(from));
  if(motion.physicsVersion===1){
   // A theatrical restart remains optional, but starts from zero velocity.
   incomingSpeed=3.2;const launchMs=900;
   add(from+incomingSpeed*launchMs/2000,launchMs,'accelerate');
  }
  finishLanding(finalLanding,motion.extraMs,'finish');
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
   if(part.easing==='detent'){
    const at=p*(part.samples.length-1),index=Math.min(part.samples.length-2,Math.floor(at)),mix=at-index;
    return {angle:part.samples[index]+(part.samples[index+1]-part.samples[index])*mix,phase:'spinning',pulse:0,kind:part.kind};
   }
   const ease=part.easing==='friction'?frictionProgress(p,part.drag):part.easing==='accelerate'?p*p:part.easing==='coast'?1-(1-p)**3.6:part.easing==='finish'?1-(1-p)**3:part.easing==='glide'?1-(1-p)**2.4:part.easing==='creep'?(1-Math.cos(Math.PI*p))/2:part.easing==='settle'?1-Math.exp(-5*p)*Math.cos(p*Math.PI*2)*(1-p):p;
   return {angle:part.from+(part.to-part.from)*ease,phase:'spinning',pulse:0,kind:part.kind};
  }
 }
 if(now<plan.revealAt&&!plan.completedAt){const p=(now-plan.stoppedAt)/(plan.revealAt-plan.stoppedAt);return {angle:plan.endRotation,phase:'highlight',pulse:.5-.5*Math.cos(p*TAU*3)}}
 return {angle:plan.endRotation,phase:plan.completedAt?'complete':'revealed',pulse:.6};
}

