const TAU=Math.PI*2;
// Design Colours from the supplied palette.
export const palette=['#0072EF','#009B9C','#00AB2E','#007F5F','#00516D','#7D2277','#FF3475','#FF4D00'];
const maleColours=palette.slice(0,5),femaleColours=palette.slice(5);
const normalizeName=name=>name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLocaleLowerCase('cs').replace(/\s+/g,' ');
const femaleFirstNames=new Set(['magdalena','veronika','daniela','kristyna','jana','eva','petra','lucie','lenka','katerina','tereza','monika','martina','michaela','barbora','anna','hana','zuzana','ivana','pavla','jitka','helena','eliska','adela','simona','sarka','vendula','natalie','nikola','andrea','marie']);
const colleagueColours={
 'tomas minka':palette[0],'martin rosa':palette[1],'roman maly':palette[2],
 'magdalena rebic':palette[6],'jakub bocek':palette[4],'veronika buch nemcova':palette[5],
 'daniela peskova':palette[7],'josef dvorak':palette[3],'petr michalik':palette[0],
 'kristyna ruzickova':palette[6],'kristyna zvakova':palette[5],'jan kanovsky':palette[1],'radek pavlas':palette[2]
};
export function personColour(person){
 const name=normalizeName(person.name);
 if(colleagueColours[name])return colleagueColours[name];
 const pool=femaleFirstNames.has(name.split(' ')[0])||/ova$/.test(name)?femaleColours:maleColours;
 let hash=0;for(const char of name)hash=(Math.imul(hash,31)+char.codePointAt(0))>>>0;
 return pool[hash%pool.length];
}
function shadeColour(hex,amount){
 const target=amount>0?255:0,weight=Math.abs(amount);
 return '#'+hex.slice(1).match(/../g).map(part=>Math.round(parseInt(part,16)*(1-weight)+target*weight).toString(16).padStart(2,'0')).join('');
}
function sectorSurface(ctx,colour,radius){
 const surface=ctx.createRadialGradient(0,0,60,0,0,radius);
 surface.addColorStop(0,shadeColour(colour,-.22));
 surface.addColorStop(.32,shadeColour(colour,.18));
 surface.addColorStop(.68,colour);
 surface.addColorStop(1,shadeColour(colour,-.26));
 return surface;
}
function drawRimStuds(ctx,count){
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
export function renderWheel(ctx,{people,winners=[],rotation=0,highlightedId=null,highlightPulse=0}){const state={people};const size=1200,c=600,r=598,n=state.people.length;ctx.clearRect(0,0,size,size);ctx.save();ctx.translate(c,c);ctx.rotate(rotation);const won=new Set(winners.map(w=>w.id));if(!n){ctx.fillStyle='#262a38';ctx.beginPath();ctx.arc(0,0,r,0,TAU);ctx.fill();for(let i=0;i<12;i++){ctx.beginPath();ctx.moveTo(0,0);ctx.arc(0,0,r,i*TAU/12,(i+1)*TAU/12);ctx.fillStyle=i%2?'#303442':'#393746';ctx.fill()}}state.people.forEach((p,i)=>{const start=i*TAU/n- Math.PI/2,end=(i+1)*TAU/n-Math.PI/2;ctx.beginPath();ctx.moveTo(0,0);ctx.arc(0,0,r,start,end);ctx.closePath();ctx.fillStyle=sectorSurface(ctx,won.has(p.id)?'#323541':personColour(p),r);ctx.fill();if(highlightedId){
 ctx.save();
 if(p.id===highlightedId){
  ctx.fillStyle='#fff1bd';ctx.globalAlpha=.18+highlightPulse*.38;ctx.fill();ctx.globalAlpha=1;
  ctx.strokeStyle='#fff3c9';ctx.lineWidth=5+highlightPulse*6;ctx.shadowColor='#ffd389';ctx.shadowBlur=18+highlightPulse*42;ctx.stroke();
 }else{ctx.fillStyle='#080b13';ctx.globalAlpha=.42;ctx.fill()}
 ctx.restore();
}ctx.strokeStyle='#ffffff28';ctx.lineWidth=2;ctx.stroke();ctx.save();ctx.rotate((start+end)/2);ctx.fillStyle='#FFFFFF';ctx.strokeStyle='rgba(8,12,23,.75)';ctx.lineWidth=3.5;ctx.lineJoin='round';ctx.shadowColor='rgba(0,0,0,.75)';ctx.shadowBlur=5;ctx.shadowOffsetY=2;ctx.textAlign='right';ctx.textBaseline='middle';const font=Math.max(11,Math.min(33,650/n));ctx.font=`650 ${font}px "Noto Sans", -apple-system, sans-serif`;let label=p.name;while(ctx.measureText(label).width>410&&label.length>3)label=label.slice(0,-2)+'…';ctx.strokeText(label,535,0);ctx.fillText(label,535,0);ctx.restore()});drawRimStuds(ctx,n);ctx.restore()}
