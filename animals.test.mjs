import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {animalKindForDraw} from './public/companions.js';
test('zvířátka: jedna postavička, různé strany a činnosti, vypnutí a mobil',()=>{
 const stage={style:{setProperty(){}},dataset:{},setAttribute(){}};
 let listener,timer,now=1000,reduced=false;
 const context=vm.createContext({animalKindForDraw,document:{createElement:()=>stage,body:{append(){}},addEventListener:(name,fn)=>listener=fn,querySelector:()=>({offsetWidth:760})},window:{addEventListener(){}},Date:{now:()=>now},innerWidth:1920,innerHeight:1080,matchMedia:()=>({matches:reduced}),setInterval:fn=>timer=fn});
 vm.runInContext(readFileSync('public/animals.js','utf8').replace(/^import[^\n]+\n/,''),context);
 const detail={busy:true,enabled:true,plan:{id:'test-draw',startedAt:1000},offset:0};
 const kinds=new Set(),actions=new Set(),sides=new Set();
 for(let i=0;i<600;i++){
  now=1000;const draw={...detail,plan:{...detail.plan,id:'draw-'+i}};listener({detail:draw});assert.equal(stage.hidden,false);
  assert.equal((stage.innerHTML.match(/<svg /g)||[]).length,1);
  const [,kind,action]=stage.innerHTML.match(/little-animal (dog|cat|toddler|llama|snake|parrot) action-(\w+)/);
  kinds.add(kind);actions.add(action);sides.add(stage.dataset.side);
  const left=parseFloat(stage.style.left),width=parseFloat(stage.style.width);
  assert.ok(left>=24&&left+width<=1896);
  assert.ok(left+width<580||left>1340,'postavička nezasahuje do kola');
  const unchanged=stage.innerHTML,position=[stage.style.left,stage.style.top,stage.style.width];
  for(const elapsed of [250,6800,13600,30000,60000]){
   now=1000+elapsed;timer();listener({detail:draw});
   assert.equal(stage.innerHTML,unchanged,'stejné zvířátko po celou dobu točení');
   assert.deepEqual([stage.style.left,stage.style.top,stage.style.width],position,'stále na stejném místě');
  }
 }
 for(const kind of ['dog','cat','toddler','llama','snake','parrot']){
  listener({detail:{...detail,plan:{...detail.plan,id:'server-'+kind,animalKind:kind}}});
  assert.ok(stage.innerHTML.includes('little-animal '+kind+' '),'server určuje stejnou postavičku pro všechny diváky');
 }
 assert.equal(kinds.size,6);assert.equal(actions.size,22);assert.equal(sides.size,2);
 listener({detail:{...detail,enabled:false}});assert.equal(stage.hidden,true);
 listener({detail:{...detail,busy:false}});assert.equal(stage.hidden,true);
 context.innerWidth=800;listener({detail});assert.equal(stage.hidden,true);
 context.innerWidth=1920;reduced=true;listener({detail});assert.equal(stage.hidden,true);
});
