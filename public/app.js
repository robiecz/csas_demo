import {renderWheel,personColour,palette} from '/wheel-renderer.js';
import {sampleDraw} from '/timeline.js';
const currentSlug=decodeURIComponent(location.pathname.replace(/^\/+|\/+$/g,''));
const $=id=>document.getElementById(id),TAU=Math.PI*2;
function colourText(hex){
 const rgb=hex.slice(1).match(/../g).map(v=>parseInt(v,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);
 const light=.2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2];
 return (light+.05)/.05>=1.05/(light+.05)?'#11141B':'#FFFFFF';
}
let unlockTimer,lastDrawId,highlightedId=null,highlightPulse=0;
let clockOffset=0,bestClockRtt=Infinity,lastClockSync=0,sharedFrame=0,shownDrawId=null,phaseKey='',requestingSpin=false,refreshing=false;
const serverNow=()=>Date.now()+clockOffset;
const adminEmailRows=new Map();let adminEmailOrder=null;
let state={people:[],winners:[],revision:0},rotation=0,busy=false,auth='',audio,on=true,lastTick=-1;
let audioMaster,celebrationBuffer,celebrationLoading,celebrationSource;
const canvas=$('wheel'),ctx=canvas.getContext('2d');
const bulbs=[],lampColours=['#168CFF','#00CED1','#29E45A','#B951CC','#FF4B88','#FF8B30','#FFDD78','#21D7AC'];
let lampFrame='';
const lampLayer=document.createElement('div');lampLayer.className='bulb-ring welcome';lampLayer.setAttribute('aria-hidden','true');
for(let i=0;i<64;i++){
 const lamp=document.createElement('span'),angle=i*TAU/64;
 lamp.className='bulb';lamp.style.left=(50+49*Math.sin(angle))+'%';lamp.style.top=(50-49*Math.cos(angle))+'%';
 lamp.style.setProperty('--lamp',lampColours[i%lampColours.length]);lampLayer.append(lamp);bulbs.push(lamp);
}
canvas.parentElement?.append(lampLayer);
setTimeout(()=>lampLayer.classList.toggle('welcome',false),3000);
function updateBulbs(){
 const plan=state.currentDraw,now=serverNow();
 const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
 const celebrating=!!plan&&!plan.completedAt&&!reduced&&now>=plan.stoppedAt&&now<plan.revealAt+5000;
 const flashing=!!plan&&!plan.completedAt&&now>=plan.startedAt&&now<plan.revealAt&&!reduced;
 lampLayer.classList.toggle('celebrating',celebrating);
 if(flashing)lampLayer.classList.toggle('welcome',false);
 const step=celebrating?Math.floor((now-plan.stoppedAt)/450):flashing?Math.floor((now-plan.startedAt)/450):-1,key=(plan?.id||'idle')+':'+(celebrating?'winner:':'spin:')+step;
 if(key===lampFrame)return;lampFrame=key;
 let seed=2166136261;for(const character of plan?.id||'idle')seed=Math.imul(seed^character.charCodeAt(0),16777619);
 bulbs.forEach((lamp,i)=>{
  let hash=(seed^Math.imul(i+1,374761393)^Math.imul(step+1,668265263))>>>0;
  hash=Math.imul(hash^(hash>>>13),1274126177)>>>0;hash=(hash^(hash>>>16))>>>0;
  const power=celebrating?(step%4===0?1.8:(Math.floor(i/4)+step)%2?1.5:.25):flashing?(hash%100<35?.18:.7+(hash%31)/30):.85;
  lamp.style.opacity=String(Math.min(1,power));lamp.style.setProperty('--lamp-power',String(power));
 });
}

async function api(path,data){
 const sent=Date.now();
 const res=await fetch('/api/'+path+(currentSlug?'?set='+encodeURIComponent(currentSlug):''),{method:data?'POST':'GET',cache:'no-store',signal:AbortSignal.timeout(12000),headers:{'Content-Type':'application/json',...(auth?{Authorization:auth}:{})},...(data?{body:JSON.stringify({...data,revision:state.revision})}:{})});
 const result=await res.json(),received=Date.now(),rtt=received-sent;
 if(Number.isFinite(result.serverNow)&&(rtt<=bestClockRtt||received-lastClockSync>60000)){clockOffset=result.serverNow-(sent+received)/2;bestClockRtt=rtt;lastClockSync=received}
 if(!res.ok)throw Error(result.error||'Server není dostupný.');return result;
}
function visibleWinners(){const plan=state.currentDraw;return plan&&!plan.completedAt&&serverNow()<plan.revealAt?state.winners.filter(w=>w.id!==plan.winnerId):state.winners}

function toast(msg){$('toast').textContent=msg;$('toast').style.display='block';setTimeout(()=>$('toast').style.display='none',6000)}
function initials(name){return name.split(' ').map(s=>s[0]).slice(0,2).join('')}
function personRow(p,i,won=false){const row=document.createElement('div');row.className='person'+(won?' won':'');const avatar=document.createElement('span');avatar.className='avatar';avatar.textContent=initials(p.name);const colour=personColour(p);avatar.style.setProperty('--avatar',colour);avatar.style.setProperty('--ink',colourText(colour));const name=document.createElement('span');name.className='person-name';name.textContent=p.name;row.append(avatar,name);return row}
let wheelPositionAnimation;
function setDrawFocus(active){
 const root=document.documentElement;
 if(root.classList.contains('draw-focus')===active)return;
 const wheel=document.querySelector?.('.wheel-wrap');
 const before=wheel?.getBoundingClientRect();
 wheelPositionAnimation?.cancel();
 root.classList.toggle('draw-focus',active);
 if(!wheel?.animate||!before||matchMedia('(prefers-reduced-motion: reduce)').matches)return;
 const after=wheel.getBoundingClientRect();
 if(!after.width||!after.height)return;
 wheelPositionAnimation=wheel.animate([
  {transformOrigin:'0 0',transform:`translate(${before.left-after.left}px,${before.top-after.top}px) scale(${before.width/after.width})`},
  {transformOrigin:'0 0',transform:'none'}
 ],{duration:220,easing:'cubic-bezier(.2,.8,.2,1)'});
}
function render(){const won=new Set(visibleWinners().map(w=>w.id)),available=state.people.filter(p=>!won.has(p.id));const currentPresenter=visibleWinners().at(-1);
$('current-presenter').textContent=currentPresenter?currentPresenter.name:'Ještě nebyl vybrán';
$('current-presenter').classList.toggle('is-empty',!currentPresenter);
const locked=serverNow()<(state.lockedUntil||0);
clearTimeout(unlockTimer);
if(locked)unlockTimer=setTimeout(render,Math.min(2147483647,Math.max(0,state.lockedUntil-serverNow())+30));
$('spin').disabled=busy||!available.length||locked;
$('spin').classList.toggle('is-spinning',busy);
setDrawFocus(busy);
$('animals-enabled').checked=!!state.animalsEnabled;
$('only-lizard').checked=!!state.onlyLizard;
$('only-lizard').disabled=busy||locked;
$('animals-enabled').disabled=busy||locked;
if(typeof CustomEvent==='function')document.dispatchEvent(new CustomEvent('wheel-state',{detail:{busy,enabled:!!state.animalsEnabled,plan:state.currentDraw,offset:clockOffset}}));
const drawSetName=state.set?.name||'Výchozí sada';
$('spin-label').textContent=busy||locked?drawSetName:!available.length&&state.people.length?'HOTOVO':'ROZTOČIT';
$('spin-label').style.setProperty('--set-label-size',Math.max(8,Math.min(18,70/Math.sqrt(Math.max(1,drawSetName.length))))+'px');
const spinHint=busy||locked?'Probíhá losování.':!state.people.length?'Přidej účastníky v administraci.':!available.length?'Všichni již byli vybráni. Vrať kolegy do hry v administraci.':'Roztočit kolo';
$('spin').setAttribute('aria-label',spinHint);$('spin').title=spinHint;$('status').textContent=spinHint;

const mail=state.emailStatus||{status:'none'};$('email-status').textContent=mail.status==='scheduled'?'✓ Zpráva výherci byla předána Resendu k odeslání po vyhlášení.':mail.status==='failed'?(mail.message||'Zprávu se nepodařilo odeslat.') :mail.status==='pending'?'Připravuji zprávu výherci…':'';$('email-retry').hidden=mail.status!=='failed';renderAdminEmails(won,busy||locked);draw()}
function renderAdminEmails(won,locked){
 const order=state.people.map(p=>p.id),ids=new Set(order);
 for(const id of adminEmailRows.keys())if(!ids.has(id))adminEmailRows.delete(id);
 const rows=state.people.map((person,i)=>{
  let entry=adminEmailRows.get(person.id);
  if(!entry){
   const row=personRow(person,i,won.has(person.id)),email=document.createElement('input'),saveButton=document.createElement('button'),removeButton=document.createElement('button');
   email.type='email';email.placeholder='E-mail (nepovinný)';email.setAttribute('aria-label','E-mail: '+person.name);
   saveButton.type='button';saveButton.textContent='Uložit e-mail';removeButton.type='button';removeButton.textContent='×';removeButton.setAttribute('aria-label','Odebrat '+person.name);
   entry={row,email,saveButton,removeButton,dirty:false,saving:false};
   email.oninput=()=>{entry.dirty=true};
   saveButton.onclick=async()=>{
    if(entry.saving||!email.reportValidity())return;
    const submitted=email.value;entry.saving=true;saveButton.disabled=true;
    try{
     const next=await api('person-email',{id:person.id,email:submitted});
     if(email.value===submitted)entry.dirty=false;
     applySnapshot(next);$('admin-error').textContent='';
    }catch(e){$('admin-error').textContent=e.message}
    finally{entry.saving=false;saveButton.disabled=busy||serverNow()<(state.lockedUntil||0)}
   };
   removeButton.onclick=async()=>{try{applySnapshot(await api('remove',{id:person.id}))}catch(e){$('admin-error').textContent=e.message}};
   row.append(email,saveButton,removeButton);adminEmailRows.set(person.id,entry);
  }
  // Polling updates saved values, but never discards a draft or replaces its input.
  if(!entry.dirty&&document.activeElement!==entry.email)entry.email.value=person.email||'';
  entry.row.classList.toggle('won',won.has(person.id));entry.email.disabled=locked;entry.saveButton.disabled=locked||entry.saving;entry.removeButton.disabled=locked;
  return entry.row;
 });
 const key=order.join(',');
 if(key!==adminEmailOrder){
  const active=document.activeElement;
  $('admin-list').replaceChildren(...rows);adminEmailOrder=key;
  if([...adminEmailRows.values()].some(entry=>entry.email===active))active.focus();
 }
}
function pointerDeflection(angle,speed,count){
 if(!count||Math.abs(speed)<.002)return 0;
 const sector=TAU/count,distance=Math.atan2(Math.sin(angle*count),Math.cos(angle*count))/count;
 const contact=Math.min(.05,sector*.32),direction=speed<-.002?-1:1,along=distance*direction;
 if(Math.abs(distance)<=contact)return direction*Math.sin((along+contact)/(2*contact)*Math.PI/2);
 if(Math.abs(speed)<.002||along<contact)return 0;
 const elapsed=(along-contact)/Math.abs(speed);
 return elapsed<.5?direction*Math.exp(-elapsed*11)*Math.cos(elapsed*26):0;
}
function pointerBendForDraw(plan,now,angle,count,reduced=false){
 if(reduced||!plan||plan.completedAt||now<plan.startedAt||now>=plan.stoppedAt)return 0;
 const a=sampleDraw(plan,now).angle,b=sampleDraw(plan,now-24).angle;
 const speed=Math.atan2(Math.sin(a-b),Math.cos(a-b))/.024;
 // Relax the rubber before highlighting the result. The resting tip must
 // always coincide with the exact radial axis used to select the winner.
 const t=Math.min(1,Math.max(0,(plan.stoppedAt-now)/180));
 return pointerDeflection(angle,speed,count)*15*t*t*(3-2*t);
}
function updateRubberPointer(){
 const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
 const bend=pointerBendForDraw(state.currentDraw,serverNow(),rotation,state.people.length,reduced);
 const tip=18+bend,control=18+bend*.48;
 // Only the flexible lower section bends; the top remains clamped in place.
 $('pointer-flex-face').setAttribute('d',`M1 1H35V18Q${control+9} 36 ${tip} 52Q${control-9} 36 1 18Z`);
 $('pointer-flex-edge').setAttribute('d',`M18 4H33V17Q${control+8} 35 ${tip} 49Q${control} 33 18 17Z`);
}
function draw(){updateBulbs();updateRubberPointer();renderWheel(ctx,{people:state.people,winners:visibleWinners(),rotation,highlightedId,highlightPulse})}
function tone(freq,duration=.035,type='sine',volume=.07,delay=0){if(!on||!audio||audio.state!=='running')return;const t=audio.currentTime+delay,o=audio.createOscillator(),g=audio.createGain();o.type=type;o.frequency.setValueAtTime(freq,t);g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(volume,t+.005);g.gain.exponentialRampToValueAtTime(.0001,t+duration);o.connect(g);g.connect(audioMaster||audio.destination);o.start(t);o.stop(t+duration)}
// Short slot-machine-style win cues follow the three sector flashes.
let highlightSoundDrawId=null,highlightSoundCue=-1;
function playHighlightSound(plan,now){
 const duration=plan.revealAt-plan.stoppedAt,elapsed=now-plan.stoppedAt;
 if(duration<=0||elapsed<0||elapsed>=duration)return;
 if(highlightSoundDrawId!==plan.id){highlightSoundDrawId=plan.id;highlightSoundCue=-1}
 const moments=[0,duration/6,duration/2,duration*5/6];
 let cue=-1;for(let i=0;i<moments.length;i++)if(elapsed>=moments[i])cue=i;
 if(cue<=highlightSoundCue)return;highlightSoundCue=cue;
 // A late spectator hears upcoming flashes, never a backlog of missed sounds.
 if(!on||!audio||audio.state!=='running'||elapsed-moments[cue]>180)return;
 if(cue===0){[523,659,784,1047,1319,1568].forEach((freq,i)=>tone(freq,.20,'triangle',.065,i*.045));return}
 const chord=[[523,659,784],[659,784,1047],[784,1047,1319]][cue-1];
 // Rising major-chord inversions, a warm bass and sparkling bell accents.
 tone(131,.38,'triangle',.065);
 chord.forEach((freq,i)=>tone(freq,.40-i*.025,'triangle',.065,i*.018));
 tone(chord[2]*2,.20,'sine',.055,.12);
 tone(chord[2]*3,.16,'sine',.03,.22);
}
function tick(){const sector=Math.floor(rotation/(TAU/Math.max(1,state.people.length)));if(sector!==lastTick){lastTick=sector;tone(1100+Math.random()*200,.035,'triangle',.055)}}
function prepareCelebration(){
 if(celebrationBuffer)return Promise.resolve(celebrationBuffer);
 if(!celebrationLoading)celebrationLoading=import('/celebration-audio.js')
  .then(module=>Uint8Array.from(atob(module.default.split(',')[1]),character=>character.charCodeAt(0)).buffer)
  .then(bytes=>audio.decodeAudioData(bytes)).then(buffer=>(celebrationBuffer=buffer))
  .catch(()=>{celebrationLoading=null;return null});
 return celebrationLoading;
}
function stopCelebration(){if(celebrationSource){try{celebrationSource.stop()}catch{}celebrationSource=null}}
function celebrateWinner(){
 if(!on||!audio||audio.state!=='running')return;
 stopCelebration();
 // A rising major fanfare sits above the voice-free stereo hall applause.
 [[523,0,.14],[659,.14,.14],[784,.28,.2],[1047,.52,.85],[1319,.52,.85],[1568,.52,.85]]
  .forEach(([frequency,delay,duration])=>tone(frequency,duration,'triangle',.075,delay));
 const play=buffer=>{
  if(!buffer||!on||!$('winner-dialog').open||audio.state!=='running')return;
  const source=audio.createBufferSource();source.buffer=buffer;source.connect(audioMaster||audio.destination);
  celebrationSource=source;source.onended=()=>{source.disconnect();if(celebrationSource===source)celebrationSource=null};source.start();
 };
 if(celebrationBuffer)play(celebrationBuffer);else void prepareCelebration().then(play);
}
function unlockAudio(){
 try{const Audio=window.AudioContext||window.webkitAudioContext;if(Audio){audio??=new Audio();if(!audioMaster){audioMaster=audio.createGain();audioMaster.connect(audio.destination)}audioMaster.gain.value=on?1:0;void audio.resume().catch(()=>{});void prepareCelebration()}}catch{}
}
function applySnapshot(next){
 if(next.revision<state.revision)return;
 state=next;if(state.set){document.title=state.set.name+' · DEMO kolo';const caption=document.getElementById('set-caption');if(caption)caption.remove();if(state.set.slug){const label=document.createElement('p');label.id='set-caption';label.className='caption';label.textContent=state.set.name;document.querySelector('.intro')?.prepend(label)}}cancelAnimationFrame(sharedFrame);phaseKey='';
 if(!state.currentDraw){busy=false;rotation=state.rotation||0;highlightedId=null;highlightPulse=0;shownDrawId=null;stopCelebration();if($('winner-dialog').open)$('winner-dialog').close();render();return}
 runSharedFrame();
}
function runSharedFrame(){
 const plan=state.currentDraw;if(!plan)return;
 const view=sampleDraw(plan,serverNow());const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;rotation=reduced&&['waiting','spinning'].includes(view.phase)?plan.phases[0].from:view.angle;
 busy=['waiting','spinning','highlight'].includes(view.phase);
 highlightedId=['highlight','revealed'].includes(view.phase)?plan.winnerId:null;highlightPulse=reduced?.6:view.pulse;
 $('spin-label').style.animationDelay=busy?(-Math.max(0,serverNow()-plan.startedAt)/1000)+'s':'';
 const key=plan.id+':'+view.phase;
 if(key!==phaseKey){phaseKey=key;render()}
 draw();if(view.phase==='spinning')tick();
 if(view.phase==='highlight')playHighlightSound(plan,serverNow());
 if(view.phase==='revealed'&&!plan.completedAt){
  lastDrawId=plan.winnerId;
  if(shownDrawId!==plan.id){
   shownDrawId=plan.id;const winner=state.winners.find(w=>w.id===plan.winnerId);
   if(winner){$('winner-name').textContent=winner.name;if(!$('winner-dialog').open)$('winner-dialog').showModal()}
   if(serverNow()-plan.revealAt<5500){celebrateWinner();if(!matchMedia('(prefers-reduced-motion: reduce)').matches)confetti()}
  }
 }else if(view.phase==='complete'&&$('winner-dialog').open){$('winner-dialog').close()}
 const lampCelebration=!plan.completedAt&&serverNow()>=plan.stoppedAt&&serverNow()<plan.revealAt+5000&&!reduced;
 if(busy||lampCelebration)sharedFrame=requestAnimationFrame(runSharedFrame);
}
$('spin').onclick=async()=>{
 if(busy||requestingSpin)return;requestingSpin=true;busy=true;highlightedId=null;highlightPulse=0;render();unlockAudio();
 try{const result=await api('spin',{});applySnapshot(result.state)}
 catch(e){toast(e.message);try{applySnapshot(await api('state'))}catch{busy=false;render()}}
 finally{requestingSpin=false}
};
$('continue').onclick=async()=>{
 const button=$('continue');if(button.disabled)return;
 button.disabled=true;button.textContent='Připravuji další losování…';
 try{
  applySnapshot(await api('complete',{winnerId:lastDrawId}));
  stopCelebration();$('winner-dialog').close();render();
 }catch(e){
  toast('Další losování se nepodařilo připravit: '+e.message);
  try{applySnapshot(await api('state'))}catch{}
 }finally{button.disabled=false;button.textContent='Pokračovat v losování ↗'}
};
$('admin').onclick=()=>{if(busy)return;$('admin-error').textContent='';$('admin-dialog').showModal()};document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>$(b.dataset.close).close());
$('login-form').onsubmit=async e=>{e.preventDefault();try{auth='Basic '+btoa('admin:'+unescape(encodeURIComponent($('password').value)));await api('auth');auth='';$('password').value='';$('login-form').hidden=true;$('admin-panel').hidden=false;document.dispatchEvent(new Event('admin-ready'));render()}catch(error){auth='';$('admin-error').textContent=error.message}};
$('add-form').onsubmit=async e=>{e.preventDefault();try{state=await api('add',{names:$('names').value});$('names').value='';$('admin-error').textContent='';render()}catch(error){$('admin-error').textContent=error.message}};
$('reset').onclick=async()=>{
 if(!confirm('Vrátit všechny kolegy do hry? Dosavadní výběry se vymažou a všichni budou znovu ve hře.'))return;
 const button=$('reset'),message=$('reset-status');
 button.disabled=true;button.textContent='Vracím kolegy do hry…';
 $('admin-error').textContent='';message.style.color='';message.textContent='Probíhá vrácení kolegů do hry…';
 try{
  applySnapshot(await api('reset',{}));
  message.style.color='#b8d8ab';message.textContent='✓ Hotovo! Všichni kolegové jsou zpět ve hře.';
 }catch(e){
  message.textContent='';$('admin-error').textContent='Vrácení kolegů do hry se nepovedlo: '+e.message;
 }finally{button.disabled=false;button.textContent='↺ Vrátit všechny kolegy do hry'}
};
$('only-lizard').onchange=async()=>{
 const toggle=$('only-lizard'),message=$('animals-status'),enabled=toggle.checked;
 toggle.disabled=true;message.textContent='Ukládám…';
 try{applySnapshot(await api('settings',{onlyLizard:enabled}));message.textContent=enabled?'Při každém točení se objeví ještěr.':'Zvířátka se opět náhodně střídají.'}
 catch(error){toggle.checked=!!state.onlyLizard;message.textContent=error.message}
 finally{toggle.disabled=busy||serverNow()<(state.lockedUntil||0)}
};
$('animals-enabled').onchange=async()=>{
 const toggle=$('animals-enabled'),message=$('animals-status'),enabled=toggle.checked;toggle.disabled=true;message.textContent='Ukládám…';
 try{applySnapshot(await api('settings',{animalsEnabled:enabled}));message.textContent=enabled?'Zvířátka jsou zapnutá.':'Zvířátka jsou vypnutá.'}
 catch(error){toggle.checked=!!state.animalsEnabled;message.textContent=error.message}
 finally{toggle.disabled=busy||serverNow()<(state.lockedUntil||0)}
};
$('sound').onclick=()=>{on=!on;if(on)unlockAudio();else{if(audioMaster)audioMaster.gain.value=0;stopCelebration()}$('sound').setAttribute('aria-pressed',String(on));$('sound').innerHTML=on?'♫ <span>Zvuk zapnutý</span>':'♪ <span>Zvuk vypnutý</span>'};$('fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen()}catch{toast('Prohlížeč nepodporuje režim celé obrazovky.')}};
async function enterAutoFullscreen(){
 if(document.fullscreenElement||!document.fullscreenEnabled||!document.documentElement.requestFullscreen)return;
 try{await document.documentElement.requestFullscreen()}catch{/* Standard browsers may refuse fullscreen without user activation. */}
}
void enterAutoFullscreen();
function confetti(){
 const el=$('confetti'),c=el.getContext('2d'),w=el.width=innerWidth*devicePixelRatio,h=el.height=innerHeight*devicePixelRatio;
 try{el.showPopover?.()}catch{}
 if(!el.showPopover)$('winner-dialog').append(el);
 const particles=Array.from({length:540},(_,i)=>{
  const side=i%2,delay=i<180?0:i<360?.65:1.3;
  return {side,delay,vx:(side?-1:1)*(.25+Math.random()*.65),vy:-.7-Math.random()*.8,gravity:.85+Math.random()*.3,size:(Math.random()*6+4)*devicePixelRatio,color:palette[i%palette.length],a:Math.random()*6,spin:(Math.random()-.5)*14};
 });
 const start=performance.now();
 function frame(now){
  const time=(now-start)/1000;c.clearRect(0,0,w,h);
  for(const p of particles){const t=time-p.delay;if(t<0)continue;const x=(p.side?w:0)+p.vx*w*t*.55,y=h*.85+p.vy*h*t*.65+.5*p.gravity*h*t*t*.45;
   c.save();c.translate(x,y);c.rotate(p.a+p.spin*t);c.fillStyle=p.color;c.globalAlpha=Math.min(1,Math.max(0,7-time));c.fillRect(-p.size/2,-p.size/2,p.size,p.size*.55);c.restore();
  }
  if(time<7&&$('winner-dialog').open)requestAnimationFrame(frame);else{c.clearRect(0,0,w,h);try{el.hidePopover?.()}catch{}}
 }
 requestAnimationFrame(frame);
}
async function refresh(){
 if(refreshing||requestingSpin)return;refreshing=true;
 try{applySnapshot(await api('state'))}
 catch(e){$('status').textContent='Spojení se serverem není dostupné.';if(!busy)$('spin').disabled=true}
 finally{refreshing=false}
}
void refresh();setInterval(()=>{if(!document.hidden)void refresh()},2500);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)void refresh()});

// Restore the device's HttpOnly administrator session without storing the password in JavaScript.
async function restoreAdminSession(){try{await api('auth');$('login-form').hidden=true;$('admin-panel').hidden=false;document.dispatchEvent(new Event('admin-ready'))}catch{}}
void restoreAdminSession();



$('email-retry').onclick=async()=>{const button=$('email-retry');button.disabled=true;try{const value=await api('email-retry',{drawId:state.currentDraw.id});state.emailStatus=value.emailStatus;render()}catch(e){$('admin-error').textContent=e.message}finally{button.disabled=false}};
