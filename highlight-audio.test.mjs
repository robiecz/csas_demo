import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync('public/app.js','utf8');
const excerpt=source.slice(source.indexOf('let highlightSoundDrawId='),source.indexOf('function tick(){'));
const plan={id:'draw-a',stoppedAt:10000,revealAt:12700};
function player(){const calls=[];const context=vm.createContext({on:true,audio:{state:'running'},tone:(...args)=>calls.push(args)});vm.runInContext(excerpt,context);return {calls,context,play(now,p=plan){context.plan=p;context.now=now;vm.runInContext('playHighlightSound(plan,now)',context)}}}
test('výherní zvuk sleduje začátek zvýraznění a tři vrcholy blikání bez opakování',()=>{
 const p=player();p.play(9999);assert.equal(p.calls.length,0);
 for(const now of [10000,10450,11350,12250]){const before=p.calls.length;p.play(now);assert.equal(p.calls.length,before+4);for(let i=0;i<5;i++)p.play(now+10);assert.equal(p.calls.length,before+4)}
 p.play(12700);assert.equal(p.calls.length,16);
 p.play(10000,{...plan,id:'draw-b'});assert.equal(p.calls.length,20);
});
test('pozdější divák neslyší staré zvuky; vypnutí a blokace zvuku respektovány',()=>{
 const p=player();p.play(11000);assert.equal(p.calls.length,0);p.play(11350);assert.equal(p.calls.length,4);
 p.context.on=false;p.play(12250);assert.equal(p.calls.length,4);p.context.on=true;p.play(12260);assert.equal(p.calls.length,4);
 const blocked=player();blocked.context.audio.state='suspended';blocked.play(10000);assert.equal(blocked.calls.length,0);
});
