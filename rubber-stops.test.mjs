import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync('public/app.js','utf8');
const context=vm.createContext({});vm.runInContext(source.slice(source.indexOf('function rubberStopBend('),source.indexOf('function drawRubberStops(')),context);
const bend=(a,s)=>{context.a=a;context.s=s;return vm.runInContext('rubberStopBend(a,s)',context)};
test('gumové kolíčky se ohýbají v kontaktu a pružně vrací i při zpětném pohybu',()=>{
 assert.equal(bend(-.1,1),0);
 assert.ok(bend(0,1)<0);assert.ok(bend(.042,1)<-.99);
 assert.ok(bend(.042+.13,1)>0,'pružný návrat přes klidovou polohu');
 assert.equal(bend(.8,1),0);
 for(const angle of [-.06,-.03,0,.03,.06,.17]){
  assert.ok(Math.abs(bend(angle,1)+bend(-angle,-1))<1e-9);
  assert.ok(Math.abs(bend(angle+Math.PI*8,1)-bend(angle,1))<1e-9);
 }
 assert.equal(bend(.2,0),0);
 for(const speed of [-10,-1,-.01,0,.01,1,10])for(let a=-Math.PI;a<Math.PI;a+=.01)assert.ok(Math.abs(bend(a,speed))<=1.000001);
});
