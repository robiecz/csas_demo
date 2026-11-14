import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
test('obnova dat nepřepíše rozepsaný e-mail, neztratí fokus a ponechá novější úpravu při ukládání',async()=>{
 const elements=new Map();let replacements=0,resolveSave,rejectSave;
 const element=()=>({value:'',disabled:false,children:[],classList:{toggle(){}},setAttribute(){},append(...children){this.children.push(...children)},replaceChildren(...children){this.children=children;replacements++},reportValidity:()=>true,focus(){context.document.activeElement=this}});
 const context=vm.createContext({Map,Set,Date,document:{activeElement:null,createElement:element},state:{people:[{id:'a',name:'První Kolega'},{id:'b',name:'Druhý Kolega',email:'saved@example.cz'}],lockedUntil:0},busy:false,serverNow:()=>1000,personRow:element,$:id=>{if(!elements.has(id))elements.set(id,element());return elements.get(id)},api:()=>new Promise((resolve,reject)=>{resolveSave=resolve;rejectSave=reject}),applySnapshot(next){context.state=next;render()}});
 const source=readFileSync('public/app.js','utf8');
 vm.runInContext('const adminEmailRows=new Map();let adminEmailOrder=null;'+source.slice(source.indexOf('function renderAdminEmails'),source.indexOf('function pointerDeflection')),context);
 const render=()=>vm.runInContext('renderAdminEmails(new Set(),false)',context);
 render();const list=elements.get('admin-list'),first=list.children[0],email=first.children[0],save=first.children[1],second=list.children[1].children[0];
 assert.equal(second.value,'saved@example.cz');context.document.activeElement=email;
 for(const text of ['tom','tomas@','tomas@example.cz']){email.value=text;email.oninput();context.state=structuredClone(context.state);render();assert.equal(list.children[0],first);assert.equal(list.children[0].children[0],email);assert.equal(email.value,text);assert.equal(context.document.activeElement,email)}
 assert.equal(replacements,1,'polling neodpojuje vstupní pole');
 context.document.activeElement=null;render();assert.equal(email.value,'tomas@example.cz','rozepsaný text přežije i odchod z pole');
 const saving=save.onclick();render();assert.equal(save.disabled,true);
 email.value='novy@example.cz';email.oninput();
 const saved=structuredClone(context.state);saved.people[0].email='tomas@example.cz';resolveSave(saved);await saving;
 assert.equal(email.value,'novy@example.cz','pozdní odpověď nesmaže novější text');
 const failing=save.onclick();rejectSave(Error('Spojení přerušeno'));await failing;render();assert.equal(email.value,'novy@example.cz');assert.equal(elements.get('admin-error').textContent,'Spojení přerušeno');
 const success=save.onclick();const next=structuredClone(context.state);next.people[0].email=email.value;resolveSave(next);await success;render();assert.equal(email.value,'novy@example.cz');assert.equal(save.disabled,false);
 context.state.people[0].email='remote@example.cz';render();assert.equal(email.value,'remote@example.cz','uložená pole dál přebírají změny ze serveru');
});
