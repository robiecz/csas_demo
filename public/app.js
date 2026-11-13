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
let state={people:[],winners:[],revision:0},rotation=0,busy=false,auth='',audio,on=true,lastTick=-1;
const canvas=$('wheel'),ctx=canvas.getContext('2d');
async function api(path,data){const res=await fetch('/api/'+path,{method:data?'POST':'GET',headers:{'Content-Type':'application/json',...(auth?{Authorization:auth}:{})},...(data?{body:JSON.stringify({...data,revision:state.revision})}:{})});const result=await res.json();if(!res.ok)throw Error(result.error||'Server není dostupný.');return result}
function toast(msg){$('toast').textContent=msg;$('toast').style.display='block';setTimeout(()=>$('toast').style.display='none',6000)}
function initials(name){return name.split(' ').map(s=>s[0]).slice(0,2).join('')}
function personRow(p,i,won=false){const row=document.createElement('div');row.className='person'+(won?' won':'');const avatar=document.createElement('span');avatar.className='avatar';avatar.textContent=initials(p.name);const colour=personColour(p);avatar.style.setProperty('--avatar',colour);avatar.style.setProperty('--ink',colourText(colour));const name=document.createElement('span');name.className='person-name';name.textContent=p.name;row.append(avatar,name);return row}
function render(){const won=new Set(state.winners.map(w=>w.id)),available=state.people.filter(p=>!won.has(p.id));$('won-count').textContent=state.winners.length;const currentPresenter=state.winners.at(-1);
$('current-presenter').textContent=currentPresenter?currentPresenter.name:'Ještě nebyl vybrán';
$('current-presenter').classList.toggle('is-empty',!currentPresenter);
$('history').replaceChildren();state.winners.slice().reverse().forEach((p,i)=>{const row=personRow(p,i);const n=document.createElement('span');n.className='number';n.textContent='#'+(state.winners.length-i);row.append(n);$('history').append(row)});if(!state.winners.length){const p=document.createElement('p');p.className='history-empty';p.textContent='První vítěz už čeká na svůj okamžik. Možná to budeš ty.';$('history').append(p)}const locked=Date.now()<(state.lockedUntil||0);
$('spin').disabled=busy||!available.length||locked;
$('spin').classList.toggle('is-spinning',busy);
$('spin-label').textContent=busy||locked?'LOSUJI…':!available.length&&state.people.length?'HOTOVO':'ROZTOČIT';
const spinHint=busy||locked?'Probíhá losování.':!state.people.length?'Přidej účastníky v administraci.':!available.length?'Všichni již byli vybráni. Vrať kolegy do hry v administraci.':'Roztočit kolo';
$('spin').setAttribute('aria-label',spinHint);$('spin').title=spinHint;$('status').textContent=spinHint;

$('admin-list').replaceChildren();state.people.forEach((p,i)=>{const row=personRow(p,i,won.has(p.id)),button=document.createElement('button');button.textContent='×';button.setAttribute('aria-label','Odebrat '+p.name);button.disabled=busy;button.onclick=async()=>{try{state=await api('remove',{id:p.id});render()}catch(e){$('admin-error').textContent=e.message}};row.append(button);$('admin-list').append(row)});draw()}
function draw(){const size=1200,c=600,r=598,n=state.people.length;ctx.clearRect(0,0,size,size);ctx.save();ctx.translate(c,c);ctx.rotate(rotation);const won=new Set(state.winners.map(w=>w.id));if(!n){ctx.fillStyle='#262a38';ctx.beginPath();ctx.arc(0,0,r,0,TAU);ctx.fill();for(let i=0;i<12;i++){ctx.beginPath();ctx.moveTo(0,0);ctx.arc(0,0,r,i*TAU/12,(i+1)*TAU/12);ctx.fillStyle=i%2?'#303442':'#393746';ctx.fill()}}state.people.forEach((p,i)=>{const start=i*TAU/n- Math.PI/2,end=(i+1)*TAU/n-Math.PI/2;ctx.beginPath();ctx.moveTo(0,0);ctx.arc(0,0,r,start,end);ctx.closePath();ctx.fillStyle=won.has(p.id)?'#323541':personColour(p);ctx.fill();ctx.strokeStyle='#17192355';ctx.lineWidth=2;ctx.stroke();ctx.save();ctx.rotate((start+end)/2);ctx.fillStyle=won.has(p.id)?'#717582':colourText(personColour(p));ctx.textAlign='right';ctx.textBaseline='middle';const font=Math.max(11,Math.min(33,650/n));ctx.font=`650 ${font}px -apple-system, sans-serif`;let label=p.name;while(ctx.measureText(label).width>410&&label.length>3)label=label.slice(0,-2)+'…';ctx.fillText(label,535,0);ctx.restore()});ctx.restore()}
function tone(freq,duration=.035,type='sine',volume=.07,delay=0){if(!on||!audio)return;const t=audio.currentTime+delay,o=audio.createOscillator(),g=audio.createGain();o.type=type;o.frequency.setValueAtTime(freq,t);g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(volume,t+.005);g.gain.exponentialRampToValueAtTime(.0001,t+duration);o.connect(g);g.connect(audio.destination);o.start(t);o.stop(t+duration)}
function tick(){const sector=Math.floor(rotation/(TAU/Math.max(1,state.people.length)));if(sector!==lastTick){lastTick=sector;tone(1100+Math.random()*200,.035,'triangle',.055)}}
function animate(from,to,duration,easing){return new Promise(resolve=>{const start=performance.now();function frame(now){const p=Math.min(1,(now-start)/duration);rotation=from+(to-from)*easing(p);draw();tick();if(p<1)requestAnimationFrame(frame);else resolve()}requestAnimationFrame(frame)})}
$('spin').onclick=async()=>{if(busy)return;busy=true;render();try{audio??=new (window.AudioContext||window.webkitAudioContext)();await audio.resume();const result=await api('spin',{}),index=state.people.findIndex(p=>p.id===result.winner.id),n=state.people.length;const finalAngle=(TAU-(index+.5)*TAU/n)%TAU;const end=rotation+TAU*6+((finalAngle-rotation%TAU+TAU)%TAU);const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;if(reduced){rotation=end;draw()}else if(result.dramatic){const near=end-TAU/n*.7;await animate(rotation,near,7800,p=>1-Math.pow(1-p,4));$('status').textContent='Ještě není rozhodnuto…';await animate(near,end,2300,p=>p*p*(3-2*p))}else await animate(rotation,end,9000,p=>1-Math.pow(1-p,4));state=result.state;render();$('winner-name').textContent=result.winner.name;$('winner-dialog').showModal();[523,659,784,1047,1319].forEach((f,i)=>tone(f,.65,'triangle',.12,i*.12));if(!reduced)confetti();}catch(e){toast(e.message);try{state=await api('state')}catch{}}finally{busy=false;render()}};
$('continue').onclick=()=>{$('winner-dialog').close();render()};
$('admin').onclick=()=>{if(busy)return;$('admin-error').textContent='';$('admin-dialog').showModal()};document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>$(b.dataset.close).close());
$('login-form').onsubmit=async e=>{e.preventDefault();try{auth='Basic '+btoa('admin:'+unescape(encodeURIComponent($('password').value)));await api('auth');$('password').value='';$('login-form').hidden=true;$('admin-panel').hidden=false;render()}catch(error){auth='';$('admin-error').textContent=error.message}};
$('add-form').onsubmit=async e=>{e.preventDefault();try{state=await api('add',{names:$('names').value});$('names').value='';$('admin-error').textContent='';render()}catch(error){$('admin-error').textContent=error.message}};
$('reset').onclick=async()=>{
 if(!confirm('Vrátit všechny kolegy do hry? Dosavadní výběry se vymažou a všichni budou znovu ve hře.'))return;
 const button=$('reset'),message=$('reset-status');
 button.disabled=true;button.textContent='Vracím kolegy do hry…';
 $('admin-error').textContent='';message.style.color='';message.textContent='Probíhá vrácení kolegů do hry…';
 try{
  state=await api('reset',{});rotation=0;render();
  message.style.color='#b8d8ab';message.textContent='✓ Hotovo! Všichni kolegové jsou zpět ve hře.';
 }catch(e){
  message.textContent='';$('admin-error').textContent='Vrácení kolegů do hry se nepovedlo: '+e.message;
 }finally{button.disabled=false;button.textContent='↺ Vrátit všechny kolegy do hry'}
};
$('sound').onclick=()=>{on=!on;$('sound').setAttribute('aria-pressed',String(on));$('sound').innerHTML=on?'♫ <span>Zvuk zapnutý</span>':'♪ <span>Zvuk vypnutý</span>'};$('fullscreen').onclick=async()=>{cancelAutoFullscreen();try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen()}catch{toast('Prohlížeč nepodporuje režim celé obrazovky.')}};
function cancelAutoFullscreen(){
 document.removeEventListener('click',autoFullscreenOnInteraction,true);
 document.removeEventListener('keydown',autoFullscreenOnInteraction,true);
}
async function enterAutoFullscreen(){
 if(document.fullscreenElement){cancelAutoFullscreen();return}
 if(!document.fullscreenEnabled||!document.documentElement.requestFullscreen){cancelAutoFullscreen();return}
 try{await document.documentElement.requestFullscreen();cancelAutoFullscreen()}catch{/* Browsers may require a click; keep the first-interaction fallback. */}
}
function autoFullscreenOnInteraction(event){
 if(!event.isTrusted)return;
 if(event.type==='keydown'&&!['Enter',' '].includes(event.key))return;
 cancelAutoFullscreen();
 if(event.target.closest?.('#fullscreen'))return;
 void enterAutoFullscreen();
}
document.addEventListener('click',autoFullscreenOnInteraction,true);
document.addEventListener('keydown',autoFullscreenOnInteraction,true);
void enterAutoFullscreen();
function confetti(){const el=$('confetti'),c=el.getContext('2d'),w=el.width=innerWidth*devicePixelRatio,h=el.height=innerHeight*devicePixelRatio,particles=Array.from({length:180},()=>({x:w/2,y:h*.4,vx:(Math.random()-.5)*24*devicePixelRatio,vy:(-Math.random()*17-3)*devicePixelRatio,size:(Math.random()*6+3)*devicePixelRatio,color:palette[Math.floor(Math.random()*8)],a:Math.random()*6}));const start=performance.now();let last=start;function frame(now){const dt=Math.min(2,(now-last)/16.67);last=now;c.clearRect(0,0,w,h);particles.forEach(p=>{p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=.17*devicePixelRatio*dt;p.a+=.07*dt;c.save();c.translate(p.x,p.y);c.rotate(p.a);c.fillStyle=p.color;c.fillRect(-p.size/2,-p.size/2,p.size,p.size*.5);c.restore()});if(now-start<5500)requestAnimationFrame(frame);else c.clearRect(0,0,w,h)}requestAnimationFrame(frame)}
async function refresh(){if(busy)return;try{state=await api('state');render()}catch(e){$('status').textContent='Spojení se serverem není dostupné.';$('spin').disabled=true}}refresh();setInterval(()=>{if(!document.hidden)refresh()},30000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh()});
