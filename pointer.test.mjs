import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const src=readFileSync('public/app.js','utf8');const c=vm.createContext({TAU:Math.PI*2});vm.runInContext(src.slice(src.indexOf('function pointerDeflection('),src.indexOf('function updateRubberPointer(')),c);
const bend=(angle,speed,count)=>{Object.assign(c,{angle,speed,count});return vm.runInContext('pointerDeflection(angle,speed,count)',c)};
test('šipka reaguje na každý kolík, pruží po kontaktu a respektuje zpětný pohyb',()=>{
 for(const count of [1,2,13,64,300]){
  const contact=Math.min(.05,Math.PI*2/count*.32);
  assert.ok(bend(0,1,count)>0);
  assert.ok(Math.abs(bend(0,1,count)+bend(0,-1,count))<1e-9);
  assert.ok(Math.abs(bend(Math.PI*2/count,1,count)-bend(0,1,count))<1e-9);
  assert.equal(bend(contact*1.1,0,count),0);
  for(let angle=-.2;angle<.2;angle+=.001)assert.ok(Math.abs(bend(angle,.2,count))<=1);
 }
 assert.ok(bend(.18,1,1)<0,'po uvolnění krátký pružný překmit');
 assert.equal(bend(0,1,0),0);
});
