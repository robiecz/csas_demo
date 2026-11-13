import {animalKindForDraw} from './companions.js';
// Small SVG companions share the draw's clock, so spectators see the same visitor.
const stage=document.createElement('div');
stage.id='animal-stage';stage.hidden=true;stage.setAttribute('aria-hidden','true');
document.body.append(stage);
let snapshot=null,lastKey='';
function random(seed){let hash=2166136261;for(const c of seed)hash=Math.imul(hash^c.charCodeAt(0),16777619);return()=>{hash=(hash+0x6D2B79F5)|0;let t=Math.imul(hash^(hash>>>15),1|hash);t^=t+Math.imul(t^(t>>>7),61|t);return((t^(t>>>14))>>>0)/4294967296}}
function animalSvg(kind,action){
 if(!['dog','cat'].includes(kind))return guestSvg(kind,action);
 const cat=kind==='cat';
 return `<svg viewBox="0 0 240 220" xmlns="http://www.w3.org/2000/svg" class="little-animal ${kind} action-${action}">
 <defs>
  <linearGradient id="fur" x2=".7" y2="1"><stop stop-color="${cat?'#a9b0cf':'#e2c8a6'}"/><stop offset="1" stop-color="${cat?'#606c91':'#9e785a'}"/></linearGradient>
  <linearGradient id="chest" x2=".2" y2="1"><stop stop-color="${cat?'#e0e3ef':'#fff0d7'}"/><stop offset="1" stop-color="${cat?'#aeb8d2':'#c7a98a'}"/></linearGradient>
  <radialGradient id="ground"><stop stop-color="#000" stop-opacity=".55"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
 </defs>
 <ellipse cx="121" cy="196" rx="100" ry="15" fill="url(#ground)"/>
 <g class="animal-breathe">
  <g class="animal-tail" fill="none" stroke="url(#fur)" stroke-width="19" stroke-linecap="round">
   <path d="${cat?'M160 151C211 170 226 103 199 94':'M167 153Q207 142 197 111'}"/>
  </g>
  <path d="M78 111C91 91 139 95 157 117C176 137 183 165 170 179C153 193 88 185 77 172C65 154 65 132 78 111Z" fill="url(#fur)" stroke="#ffffff18" stroke-width="1.5"/>
  <path d="M88 124Q113 116 122 140L121 178Q100 190 84 177Z" fill="url(#chest)"/>
  <g class="animal-backleg"><path d="M148 150Q177 148 177 177L183 185Q182 194 165 191L142 184Q133 170 148 150" fill="url(#fur)"/><path d="M166 185l1 5m7-5 1 5" stroke="#3b304540" stroke-linecap="round"/></g>
  <path d="M84 151L80 183Q74 194 94 194Q107 195 105 183L109 150" fill="url(#chest)"/>
  <g class="animal-frontpaw"><path d="M112 149L112 183Q105 194 124 194Q138 195 133 183L136 149" fill="url(#chest)"/><path d="M119 187v5m7-5v5" stroke="#3b304550" stroke-linecap="round"/></g>
  <g class="animal-head">
   ${cat?'<path d="M62 91L55 42Q73 40 88 67L110 64Q126 42 139 47L137 99Z" fill="url(#fur)" stroke="#ffffff20"/><path d="M62 51L67 78L80 68M128 56L118 71L132 79" fill="#d59da6"/>':'<g class="animal-ear"><path d="M65 71Q36 65 39 104Q40 128 58 117L79 88" fill="#856047"/><path d="M126 73Q155 72 152 105Q147 130 131 110L116 85" fill="#856047"/></g>'}
   <path d="M61 85C65 57 119 55 136 82C153 114 127 139 100 140C72 141 50 119 61 85" fill="url(#fur)" stroke="#ffffff1c" stroke-width="1.5"/>
   ${cat?'<path d="M88 67l5 15m7-16 2 16m8-13-1 13" stroke="#485578" stroke-width="4" stroke-linecap="round"/>':'<path d="M92 65Q101 59 109 65L111 103L92 105Z" fill="#f0dcc0"/>'}
   <g class="animal-eyes"><ellipse cx="78" cy="101" rx="4" ry="5.5" fill="#182033"/><ellipse cx="122" cy="101" rx="4" ry="5.5" fill="#182033"/><circle cx="79" cy="99" r="1.3" fill="#fff"/><circle cx="123" cy="99" r="1.3" fill="#fff"/></g>
   <ellipse cx="89" cy="118" rx="14" ry="10" fill="url(#chest)"/><ellipse cx="110" cy="118" rx="14" ry="10" fill="url(#chest)"/>
   <path d="M94 111Q100 107 106 111Q106 117 100 119Q94 117 94 111" fill="${cat?'#c48e9b':'#30323d'}"/>
   <path d="M100 119v5m0-1q-6 6-11 0m11 0q6 6 11 0" fill="none" stroke="#574d60" stroke-width="1.5" stroke-linecap="round"/>
   <ellipse class="animal-yawn" cx="100" cy="129" rx="10" ry="12" fill="#3a293a"/>
   <path class="animal-tongue" d="M95 126Q100 123 106 126L105 137Q100 142 96 137Z" fill="#e99ca9"/>
   ${cat?'<path d="M76 117l-22-4m23 11-24 3m70-10 22-4m-23 11 24 3" stroke="#d8daeb" stroke-width="1.2" stroke-linecap="round" opacity=".8"/>':''}
  </g>
  <path d="M80 138Q100 149 124 138" fill="none" stroke="${cat?'#ae9bbf':'#64aba5'}" stroke-width="5"/>
  <circle cx="105" cy="145" r="4" fill="#edc980"/>
 </g>
 <g class="animal-sniff" fill="none" stroke="#adbcc6" stroke-width="1.4" stroke-linecap="round"><path d="M57 168q-10-8-1-16"/><path d="M45 179q-12-9-3-19"/></g>
 <g class="animal-spark" fill="#e0c6a4"><path d="M182 58l2 6 6 2-6 2-2 6-2-6-6-2 6-2Z"/><circle cx="196" cy="83" r="2"/></g>
 </svg>`;
}

// Each visitor has its own silhouette and movements, all on the shared draw clock.
const companionActions={dog:['sniff','paw','groom','scratch','yawn','wag'],cat:['sniff','paw','groom','scratch','yawn','wag'],toddler:['clap','wave','bounce','peek'],llama:['chew','ears','look','prance'],snake:['slither','tongue','sway','coil'],parrot:['flap','preen','bob','dance']};
function guestSvg(kind,action){
 const eyes='<g class="guest-eyes"><circle cx="92" cy="76" r="4"/><circle cx="122" cy="76" r="4"/><circle cx="93" cy="75" r="1.2" fill="white"/><circle cx="123" cy="75" r="1.2" fill="white"/></g>';
 let body='';
 if(kind==='toddler')body=`<g class="guest-body"><ellipse cx="108" cy="145" rx="42" ry="40" fill="#7a9ed7"/><path d="M78 167L66 184Q64 198 86 195L105 174M126 169L141 191Q161 201 165 187L145 166" fill="#f2bd9e" stroke="#ffd9ba" stroke-width="3"/><g class="guest-arm left"><path d="M78 125Q47 120 47 93" fill="none" stroke="#f2bd9e" stroke-width="17" stroke-linecap="round"/><circle cx="47" cy="89" r="11" fill="#ffd3b5"/></g><g class="guest-arm right"><path d="M139 125Q168 118 169 91" fill="none" stroke="#f2bd9e" stroke-width="17" stroke-linecap="round"/><circle cx="169" cy="87" r="11" fill="#ffd3b5"/></g><g class="guest-head"><circle cx="62" cy="75" r="10" fill="#efb095"/><circle cx="151" cy="75" r="10" fill="#efb095"/><ellipse cx="107" cy="72" rx="45" ry="43" fill="url(#guest-skin)"/><path d="M100 34Q84 11 110 18Q134 22 116 36" fill="none" stroke="#b98653" stroke-width="6" stroke-linecap="round"/>${eyes}<ellipse cx="79" cy="89" rx="9" ry="5" fill="#ef9c92"/><ellipse cx="135" cy="89" rx="9" ry="5" fill="#ef9c92"/><path d="M96 93Q108 108 121 93" fill="#703e4b"/><path d="M103 99h10" stroke="#fff" stroke-width="3"/></g><path d="M97 135l11 14 11-14" fill="none" stroke="#e5eeff" stroke-width="4"/></g>`;
 if(kind==='llama')body=`<g class="guest-body"><g class="guest-legs" stroke="#d6bda6" stroke-width="15" stroke-linecap="round"><path d="M96 153v35m31-35v35m28-35 6 35"/></g><ellipse cx="132" cy="141" rx="51" ry="29" fill="url(#guest-wool)"/><path d="M87 144L78 86Q94 75 109 91L112 145" fill="url(#guest-wool)"/><path d="M172 130q30-17 24 1" fill="none" stroke="#d6bda6" stroke-width="11" stroke-linecap="round"/><g class="guest-head"><g class="guest-ears"><path d="M75 58Q50 0 69 14L90 54M104 54Q109 1 121 14L118 64" fill="#ecd9c0" stroke="#b6a08d" stroke-width="3"/><path d="M72 28l8 22m35-22-5 23" stroke="#d39eaa" stroke-width="5" stroke-linecap="round"/></g><ellipse cx="98" cy="72" rx="34" ry="31" fill="url(#guest-wool)"/>${eyes}<ellipse class="guest-muzzle" cx="107" cy="91" rx="24" ry="15" fill="#bba99a"/><path d="M102 86l5 5 5-5m-5 5v7" fill="none" stroke="#51454c" stroke-width="2"/></g><path d="M113 123h43v32h-43z" fill="#967bb5"/><path d="M115 130l10 12 10-12 10 12 10-12" fill="none" stroke="#edc981" stroke-width="4"/></g>`;
 if(kind==='snake')body=`<g class="guest-body"><g class="guest-coil"><ellipse cx="119" cy="179" rx="77" ry="20" fill="#426a62" stroke="#8bb396" stroke-width="4"/><ellipse cx="120" cy="163" rx="58" ry="19" fill="#6c9d80" stroke="#a0c7a1" stroke-width="4"/><path d="M150 166Q92 153 119 127Q151 100 122 88" fill="none" stroke="#80b18c" stroke-width="29" stroke-linecap="round"/><path d="M150 170Q101 154 127 127" fill="none" stroke="#d0d5a4" stroke-width="9" stroke-linecap="round"/></g><g class="guest-head"><ellipse cx="110" cy="77" rx="38" ry="28" fill="url(#guest-scales)"/>${eyes}<path d="M85 89Q108 103 133 88" fill="none" stroke="#38584e" stroke-width="2"/><path class="guest-tongue" d="M107 99v24m0 0-7 7m7-7 7 7" fill="none" stroke="#ef8eab" stroke-width="3" stroke-linecap="round"/><path d="M99 58l8 6 8-6" fill="none" stroke="#a5d3ab" stroke-width="3"/></g></g>`;
 if(kind==='parrot')body=`<g class="guest-body"><path d="M99 142l-7 53 25-18 17 19-4-56" fill="#5aa6b0"/><path d="M93 158v23m34-23v23" stroke="#b6a593" stroke-width="7"/><path d="M74 185h75" stroke="#9c7a62" stroke-width="7" stroke-linecap="round"/><ellipse cx="111" cy="123" rx="43" ry="48" fill="url(#guest-feathers)"/><path d="M91 108Q75 147 109 162Q141 151 132 110" fill="#c9d897"/><g class="guest-wing left"><path d="M79 102Q45 106 61 154Q74 169 96 145Z" fill="#459c90" stroke="#8ec5aa" stroke-width="2"/><path d="M69 127l13 19m-15-8 10 15" stroke="#387981" stroke-width="3"/></g><g class="guest-wing right"><path d="M137 101Q171 107 156 152L133 144Z" fill="#459c90" stroke="#8ec5aa" stroke-width="2"/></g><g class="guest-head"><path d="M94 44Q90 20 104 36Q115 14 119 40Q138 27 134 49" fill="#c5d696"/><ellipse cx="110" cy="69" rx="36" ry="34" fill="url(#guest-feathers)"/><ellipse cx="97" cy="70" rx="14" ry="17" fill="#e4e8c7"/><ellipse cx="126" cy="70" rx="12" ry="16" fill="#e4e8c7"/>${eyes}<path d="M105 80Q128 73 122 100L109 109Q114 91 105 80" fill="#e8bc77" stroke="#aa7953" stroke-width="2"/></g></g>`;
 return `<svg viewBox="0 0 240 220" xmlns="http://www.w3.org/2000/svg" class="little-animal ${kind} action-${action}"><defs><radialGradient id="guest-skin"><stop stop-color="#ffddbc"/><stop offset="1" stop-color="#dfa38c"/></radialGradient><linearGradient id="guest-wool" x2=".7" y2="1"><stop stop-color="#fff0d8"/><stop offset="1" stop-color="#bcab9a"/></linearGradient><linearGradient id="guest-scales" x2=".6" y2="1"><stop stop-color="#add0a0"/><stop offset="1" stop-color="#528876"/></linearGradient><linearGradient id="guest-feathers" x2=".8" y2="1"><stop stop-color="#a3d4a0"/><stop offset="1" stop-color="#3b8b88"/></linearGradient><radialGradient id="guest-ground"><stop stop-color="#000" stop-opacity=".6"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient></defs><ellipse cx="120" cy="198" rx="100" ry="15" fill="url(#guest-ground)"/>${body}</svg>`;
}

function update(){
 if(!snapshot?.busy||!snapshot.enabled||!snapshot.plan||snapshot.plan.completedAt||innerWidth<1100||matchMedia('(prefers-reduced-motion: reduce)').matches){stage.hidden=true;lastKey='';return}
 const now=Date.now()+snapshot.offset,elapsed=Math.max(0,now-snapshot.plan.startedAt);
 const key=snapshot.plan.id;if(key===lastKey)return;lastKey=key;
 const widthOfWheel=document.querySelector('.wheel-wrap').offsetWidth;
 const gap=(innerWidth-widthOfWheel)/2;
 const gaps=[gap,gap],rng=random(key);
 let side=rng()<.5?0:1;if(gaps[side]<140)side=1-side;
 if(gaps[side]<140){stage.hidden=true;return}
 const width=Math.min(310,gaps[side]-48),x=24+rng()*Math.max(0,gaps[side]-width-48);
 const top=Math.max(24,Math.min(innerHeight-width-24,innerHeight*(.28+rng()*.4)));
 rng(); // Keep action selection independent of the server-selected kind.
 const kind=animalKindForDraw(snapshot.plan),actions=companionActions[kind];
 const action=actions[Math.floor(rng()*actions.length)];
 stage.innerHTML='<div class="animal-reveal"><div class="animal-emerge">'+animalSvg(kind,action)+'</div></div>';stage.dataset.side=String(side);
 stage.style.width=width+'px';stage.style.left=(side===0?x:innerWidth-x-width)+'px';stage.style.top=top+'px';
 stage.style.setProperty('--animal-delay',-elapsed/1000+'s');
 stage.style.setProperty('--emerge-delay',-Math.min(elapsed,1400)/1000+'s');stage.hidden=false;
}
document.addEventListener('wheel-state',event=>{snapshot=event.detail;update()});
window.addEventListener('resize',()=>{lastKey='';update()});
setInterval(update,250);
