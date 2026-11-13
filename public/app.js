import {sampleDraw} from '/timeline.js';
const currentSlug=decodeURIComponent(location.pathname.replace(/^\/+|\/+$/g,''));
const $=id=>document.getElementById(id),TAU=Math.PI*2;
// Design Colours from the supplied palette.
const palette=['#0072EF','#009B9C','#00AB2E','#007F5F','#00516D','#7D2277','#FF3475','#FF4D00'];
const maleColours=palette.slice(0,5),femaleColours=palette.slice(5);
const normalizeName=name=>name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLocaleLowerCase('cs').replace(/\s+/g,' ');
const femaleFirstNames=new Set(['magdalena','veronika','daniela','kristyna','jana','eva','petra','lucie','lenka','katerina','tereza','monika','martina','michaela','barbora','anna','hana','zuzana','ivana','pavla','jitka','helena','eliska','adela','simona','sarka','vendula','natalie','nikola','andrea','marie']);
const colleagueColours={
 'tomas minka':palette[0],'martin rosa':palette[1],'roman maly':palette[2],
 'magdalena rebic':palette[6],'jakub bocek':palette[4],'veronika buch nemcova':palette[5],
 'daniela peskova':palette[7],'josef dvorak':palette[3],'petr michalik':palette[0],
 'kristyna ruzickova':palette[6],'kristyna zvakova':palette[5],'jan kanovsky':palette[1],'radek pavlas':palette[2]
};
function personColour(person){
 const name=normalizeName(person.name);
 if(colleagueColours[name])return colleagueColours[name];
 const pool=femaleFirstNames.has(name.split(' ')[0])||/ova$/.test(name)?femaleColours:maleColours;
 let hash=0;for(const char of name)hash=(Math.imul(hash,31)+char.codePointAt(0))>>>0;
 return pool[hash%pool.length];
}
function colourText(hex){
 const rgb=hex.slice(1).match(/../g).map(v=>parseInt(v,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);
 const light=.2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2];
 return (light+.05)/.05>=1.05/(light+.05)?'#11141B':'#FFFFFF';
}
let unlockTimer,lastDrawId,highlightedId=null,highlightPulse=0;
let clockOffset=0,bestClockRtt=Infinity,lastClockSync=0,sharedFrame=0,shownDrawId=null,phaseKey='',requestingSpin=false,refreshing=false;
const serverNow=()=>Date.now()+clockOffset;
let state={people:[],winners:[],revision:0},rotation=0,busy=false,auth='',audio,on=true,lastTick=-1;
let audioMaster,celebrationBuffer,celebrationLoading,celebrationSource;
const canvas=$('wheel'),ctx=canvas.getContext('2d');
const bulbs=[],lampColours=['#168CFF','#00CED1','#29E45A','#B951CC','#FF4B88','#FF8B30','#FFDD78','#21D7AC'];
let lampFrame='';
const lampLayer=document.createElement('div');lampLayer.className='bulb-ring';lampLayer.setAttribute('aria-hidden','true');
for(let i=0;i<64;i++){
 const lamp=document.createElement('span'),angle=i*TAU/64;
 lamp.className='bulb';lamp.style.left=(50+49*Math.sin(angle))+'%';lamp.style.top=(50-49*Math.cos(angle))+'%';
 lamp.style.setProperty('--lamp',lampColours[i%lampColours.length]);lampLayer.append(lamp);bulbs.push(lamp);
}
canvas.parentElement?.append(lampLayer);
function updateBulbs(){
 const plan=state.currentDraw,now=serverNow();
 const flashing=!!plan&&!plan.completedAt&&now>=plan.startedAt&&now<plan.revealAt&&!matchMedia('(prefers-reduced-motion: reduce)').matches;
 const step=flashing?Math.floor((now-plan.startedAt)/450):-1,key=(plan?.id||'idle')+':'+step;
 if(key===lampFrame)return;lampFrame=key;
 let seed=2166136261;for(const character of plan?.id||'idle')seed=Math.imul(seed^character.charCodeAt(0),16777619);
 bulbs.forEach((lamp,i)=>{
  let hash=(seed^Math.imul(i+1,374761393)^Math.imul(step+1,668265263))>>>0;
  hash=Math.imul(hash^(hash>>>13),1274126177)>>>0;hash=(hash^(hash>>>16))>>>0;
  const power=flashing?(hash%100<35?.18:.7+(hash%31)/30):.85;
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
  {transformOrigin:'0 0',transform:`translate(${before.left-after.left}px,${before.top-after.top}px) scale(${before.width/after.width},${before.height/after.height})`},
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
$('animals-enabled').disabled=busy||locked;
if(typeof CustomEvent==='function')document.dispatchEvent(new CustomEvent('wheel-state',{detail:{busy,enabled:!!state.animalsEnabled,plan:state.currentDraw,offset:clockOffset}}));
$('spin-label').textContent=busy||locked?'Level Up':!available.length&&state.people.length?'HOTOVO':'ROZTOČIT';
const spinHint=busy||locked?'Probíhá losování.':!state.people.length?'Přidej účastníky v administraci.':!available.length?'Všichni již byli vybráni. Vrať kolegy do hry v administraci.':'Roztočit kolo';
$('spin').setAttribute('aria-label',spinHint);$('spin').title=spinHint;$('status').textContent=spinHint;

$('admin-list').replaceChildren();state.people.forEach((p,i)=>{const row=personRow(p,i,won.has(p.id)),button=document.createElement('button');button.textContent='×';button.setAttribute('aria-label','Odebrat '+p.name);button.disabled=busy;button.onclick=async()=>{try{applySnapshot(await api('remove',{id:p.id}))}catch(e){$('admin-error').textContent=e.message}};row.append(button);$('admin-list').append(row)});draw()}
function shadeColour(hex,amount){
 const target=amount>0?255:0,weight=Math.abs(amount);
 return '#'+hex.slice(1).match(/../g).map(part=>Math.round(parseInt(part,16)*(1-weight)+target*weight).toString(16).padStart(2,'0')).join('');
}
function sectorSurface(colour,radius){
 const surface=ctx.createRadialGradient(0,0,60,0,0,radius);
 surface.addColorStop(0,shadeColour(colour,-.22));
 surface.addColorStop(.32,shadeColour(colour,.18));
 surface.addColorStop(.68,colour);
 surface.addColorStop(1,shadeColour(colour,-.26));
 return surface;
}
function drawRimStuds(count){
 if(!count)return;
 const radius=Math.min(8,TAU/count*573*.22);
 for(let i=0;i<count;i++){
  const angle=i*TAU/count-Math.PI/2,x=Math.cos(angle)*573,y=Math.sin(angle)*573;
  ctx.save();ctx.shadowColor='#000b';ctx.shadowBlur=4;ctx.shadowOffsetY=2;
  ctx.beginPath();ctx.arc(x,y,radius+2,0,TAU);ctx.fillStyle='#121922';ctx.fill();
  ctx.shadowBlur=0;ctx.shadowOffsetY=0;
  const cap=ctx.createRadialGradient(x-radius*.3,y-radius*.35,.1,x,y,radius);
  cap.addColorStop(0,'#b2c0cb');cap.addColorStop(.35,'#637684');cap.addColorStop(1,'#283640');
  ctx.beginPath();ctx.arc(x,y,radius,0,TAU);ctx.fillStyle=cap;ctx.fill();
  ctx.lineWidth=1;ctx.strokeStyle='#dbe8ef66';ctx.stroke();ctx.restore();
 }
}
function draw(){updateBulbs();const size=1200,c=600,r=598,n=state.people.length;ctx.clearRect(0,0,size,size);ctx.save();ctx.translate(c,c);ctx.rotate(rotation);const won=new Set(visibleWinners().map(w=>w.id));if(!n){ctx.fillStyle='#262a38';ctx.beginPath();ctx.arc(0,0,r,0,TAU);ctx.fill();for(let i=0;i<12;i++){ctx.beginPath();ctx.moveTo(0,0);ctx.arc(0,0,r,i*TAU/12,(i+1)*TAU/12);ctx.fillStyle=i%2?'#303442':'#393746';ctx.fill()}}state.people.forEach((p,i)=>{const start=i*TAU/n- Math.PI/2,end=(i+1)*TAU/n-Math.PI/2;ctx.beginPath();ctx.moveTo(0,0);ctx.arc(0,0,r,start,end);ctx.closePath();ctx.fillStyle=sectorSurface(won.has(p.id)?'#323541':personColour(p),r);ctx.fill();if(highlightedId){
 ctx.save();
 if(p.id===highlightedId){
  ctx.fillStyle='#fff1bd';ctx.globalAlpha=.18+highlightPulse*.38;ctx.fill();ctx.globalAlpha=1;
  ctx.strokeStyle='#fff3c9';ctx.lineWidth=5+highlightPulse*6;ctx.shadowColor='#ffd389';ctx.shadowBlur=18+highlightPulse*42;ctx.stroke();
 }else{ctx.fillStyle='#080b13';ctx.globalAlpha=.42;ctx.fill()}
 ctx.restore();
}ctx.strokeStyle='#ffffff28';ctx.lineWidth=2;ctx.stroke();ctx.save();ctx.rotate((start+end)/2);ctx.fillStyle='#FFFFFF';ctx.strokeStyle='rgba(8,12,23,.75)';ctx.lineWidth=3.5;ctx.lineJoin='round';ctx.shadowColor='rgba(0,0,0,.75)';ctx.shadowBlur=5;ctx.shadowOffsetY=2;ctx.textAlign='right';ctx.textBaseline='middle';const font=Math.max(11,Math.min(33,650/n));ctx.font=`650 ${font}px -apple-system, sans-serif`;let label=p.name;while(ctx.measureText(label).width>410&&label.length>3)label=label.slice(0,-2)+'…';ctx.strokeText(label,535,0);ctx.fillText(label,535,0);ctx.restore()});drawRimStuds(n);ctx.restore()}
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
 if(cue===0){[1047,1319,1568,2093].forEach((freq,i)=>tone(freq,.12,'triangle',.045,i*.065));return}
 const root=[0,1047,1319,1568][cue];
 tone(root,.30,'sine',.095);
 tone(root*2,.22,'sine',.035,.015);
 tone(root*1.5,.18,'triangle',.035,.07);
 tone(root*2,.16,'sine',.03,.14);
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
 if(busy)sharedFrame=requestAnimationFrame(runSharedFrame);
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


