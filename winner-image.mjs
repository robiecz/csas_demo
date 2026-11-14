import {createCanvas,GlobalFonts} from '@napi-rs/canvas';
import {createRequire} from 'node:module';
import {renderWheel} from './public/wheel-renderer.js';
const require=createRequire(import.meta.url);
GlobalFonts.registerFromPath(require.resolve('@fontsource/noto-sans/files/noto-sans-latin-600-normal.woff2'),'Noto Sans');
GlobalFonts.registerFromPath(require.resolve('@fontsource/noto-sans/files/noto-sans-latin-ext-600-normal.woff2'),'Noto Sans');
export function renderWinnerImage(job){
 const canvas=createCanvas(1400,1660),ctx=canvas.getContext('2d');
 ctx.fillStyle='#10121a';ctx.fillRect(0,0,1400,1660);
 ctx.textAlign='center';ctx.fillStyle='#ffd69f';ctx.font='600 28px "Noto Sans"';ctx.fillText(job.setName,700,65,1240);
 const wheel=createCanvas(1200,1200);renderWheel(wheel.getContext('2d'),{people:job.people,winners:job.winners,rotation:job.rotation,highlightedId:job.winner.id,highlightPulse:.6});
 ctx.save();ctx.beginPath();ctx.arc(700,740,600,0,Math.PI*2);ctx.clip();ctx.drawImage(wheel,100,140);ctx.restore();
 // Match the wheel's outer bulbs, fixed gold pointer and center hub.
 ctx.lineWidth=21;ctx.strokeStyle='#292b36';ctx.beginPath();ctx.arc(700,740,611,0,Math.PI*2);ctx.stroke();
 const lamps=['#168CFF','#00CED1','#29E45A','#B951CC','#FF4B88','#FF8B30','#FFDD78','#21D7AC'];
 for(let i=0;i<64;i++){const a=i*Math.PI/32;ctx.beginPath();ctx.arc(700+611*Math.cos(a),740+611*Math.sin(a),4.5,0,Math.PI*2);ctx.shadowColor=lamps[i%8];ctx.shadowBlur=13;ctx.fillStyle=lamps[i%8];ctx.fill()}ctx.shadowBlur=0;
 ctx.fillStyle='#ffe0a6';ctx.beginPath();ctx.moveTo(678,105);ctx.lineTo(722,105);ctx.lineTo(722,155);ctx.lineTo(700,228);ctx.lineTo(678,155);ctx.closePath();ctx.fill();
 ctx.beginPath();ctx.arc(700,740,129,0,Math.PI*2);ctx.fillStyle='#171923';ctx.fill();ctx.strokeStyle='#d7ad76';ctx.lineWidth=17;ctx.stroke();
 ctx.fillStyle='#ffd69f';ctx.font='600 23px "Noto Sans"';ctx.fillText('LEVEL UP',700,734);ctx.fillText('DEMO',700,770);
 ctx.fillStyle='#ffbf79';ctx.font='600 25px "Noto Sans"';ctx.fillText('VÍTĚZ KOLA',700,1440);
 let font=74;while(font>24){ctx.font='600 '+font+'px "Noto Sans"';if(ctx.measureText(job.winner.name).width<=1240)break;font--}
 ctx.fillStyle='#fff7e9';ctx.fillText(job.winner.name,700,1550);
 return canvas.toBuffer('image/png');
}
