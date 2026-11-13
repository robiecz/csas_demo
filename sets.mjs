import {load,save,emptyState,saveSetAndRegistry} from './store.mjs';
import {randomUUID} from 'node:crypto';
const fail=(status,message)=>{const e=Error(message);e.status=status;throw e};
export async function registry(){const r=await load('registry');return {revision:r.revision,sets:r.sets||[],defaultName:r.defaultName||'Level Up DEMO kolo'}}
export async function resolveSet(slug){
 if(!slug){const r=await registry();return {id:'default',name:r.defaultName,slug:''}}
 const r=await registry(),set=r.sets.find(s=>!s.deletedAt&&s.slug===slug);if(!set)fail(404,'Tato sada neexistuje nebo byla odstraněna.');return set;
}
function namesList(input){const names=String(input||'').split(/\n/).map(n=>n.trim().replace(/\s+/g,' ')).filter(Boolean);if(names.length>300||names.some(n=>n.length>80||!/^\p{L}[\p{L}\p{M}'’.-]*(?: [\p{L}\p{M}'’.-]+)+$/u.test(n)))fail(400,'Zadej jméno a příjmení na každý řádek, nejvýše 300 osob a 80 znaků na jméno.');return [...new Map(names.map(n=>[n.toLocaleLowerCase('cs'),n])).values()]}
export function slugify(value){return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,70)}
export async function manageSets(path,data={}){
 const r=await registry(),active=r.sets.filter(s=>!s.deletedAt);
 if(path==='/api/sets')return {revision:r.revision,sets:[{id:'default',slug:'',name:r.defaultName},...active]};
 if(data.registryRevision!==r.revision)fail(409,'Seznam sad se změnil. Obnov seznam a zkus to znovu.');
 const existing=data.id==='default'?{id:'default',slug:'',name:r.defaultName}:active.find(s=>s.id===data.id);
 if(path==='/api/sets/delete'){
  if(!existing)fail(404,'Sada neexistuje.');if(existing.id==='default')fail(400,'Výchozí sadu nelze odstranit.');
  const state=await load(existing.id);if(Date.now()<(state.lockedUntil||0))fail(409,'V této sadě právě probíhá losování.');
  r.sets=r.sets.map(s=>s.id===existing.id?{...s,deletedAt:Date.now()}:s);await saveSetAndRegistry(state,state.revision,existing.id,r,r.revision);return {ok:true};
 }
 if(path!=='/api/sets/save')fail(404,'Nenalezeno.');
 const name=String(data.name||'').trim();if(!name||name.length>80)fail(400,'Název sady musí mít 1 až 80 znaků.');
 if(data.id&&!existing)fail(404,'Sada neexistuje.');
 const slug=existing?.id==='default'?'':String(data.slug||slugify(name));
 if((!slug&&existing?.id!=='default')||(slug&&!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))||slug.length>70||['api','public','admin'].includes(slug))fail(400,'Adresa smí obsahovat malá písmena bez diakritiky, čísla a pomlčky.');
 if(active.some(s=>s.slug===slug&&s.id!==existing?.id))fail(409,'Tuto adresu už používá jiná sada.');
 if(!existing&&active.length>=100)fail(400,'Maximum je 100 sad.');
 const names=namesList(data.names),id=existing?.id||randomUUID(),scope=id==='default'?undefined:id;
 const state=existing?await load(scope):emptyState();
 if(Date.now()<(state.lockedUntil||0))fail(409,'V této sadě právě probíhá losování. Počkej na dokončení.');
 if(existing&&data.setRevision!==state.revision)fail(409,'Jména nebo výsledky se změnily. Otevři úpravu znovu.');
 const byName=new Map(state.people.map(p=>[p.name.toLocaleLowerCase('cs'),p]));
 const people=names.map(name=>({...byName.get(name.toLocaleLowerCase('cs')),id:byName.get(name.toLocaleLowerCase('cs'))?.id||randomUUID(),name}));
 const changed=JSON.stringify(people)!==JSON.stringify(state.people);
 const next={...state,people};if(changed){next.currentDraw=null;next.rotation=0;next.lockedUntil=0}
 const set={id,slug,name,createdAt:existing?.createdAt||Date.now()};
 if(id==='default')r.defaultName=name;else r.sets=existing?r.sets.map(s=>s.id===id?set:s):[...r.sets,set];
 await saveSetAndRegistry(next,state.revision,scope,r,r.revision);return {ok:true,set};
}
