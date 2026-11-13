// Small SVG companions share the draw's clock, so spectators see the same visitor.
const stage=document.createElement('div');
stage.id='animal-stage';stage.hidden=true;stage.setAttribute('aria-hidden','true');
document.body.append(stage);
let snapshot=null,lastKey='';
function random(seed){let hash=2166136261;for(const c of seed)hash=Math.imul(hash^c.charCodeAt(0),16777619);return()=>{hash=(hash+0x6D2B79F5)|0;let t=Math.imul(hash^(hash>>>15),1|hash);t^=t+Math.imul(t^(t>>>7),61|t);return((t^(t>>>14))>>>0)/4294967296}}
function animalSvg(kind,action){
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
 const kind=rng()<.5?'dog':'cat',actions=['sniff','paw','groom','scratch','yawn','wag'];
 const action=actions[Math.floor(rng()*actions.length)];
 stage.innerHTML='<div class="animal-reveal"><div class="animal-emerge">'+animalSvg(kind,action)+'</div></div>';stage.dataset.side=String(side);
 stage.style.width=width+'px';stage.style.left=(side===0?x:innerWidth-x-width)+'px';stage.style.top=top+'px';
 stage.style.setProperty('--animal-delay',-elapsed/1000+'s');
 stage.style.setProperty('--emerge-delay',-Math.min(elapsed,1400)/1000+'s');stage.hidden=false;
}
document.addEventListener('wheel-state',event=>{snapshot=event.detail;update()});
window.addEventListener('resize',()=>{lastKey='';update()});
setInterval(update,250);
