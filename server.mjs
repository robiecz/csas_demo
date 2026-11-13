import http from 'node:http';
import {readFileSync} from 'node:fs';
import {load,save} from './store.mjs';
import {resolveSet,manageSets} from './sets.mjs';
import {createDrawPlan} from './public/timeline.js';
import {randomInt,randomUUID,timingSafeEqual,createHash,createHmac} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('.',import.meta.url));
const password=process.env.ADMIN_PASSWORD;

const ADMIN_COOKIE='kolo_admin',ADMIN_AGE=365*24*60*60;
function safeEqual(a,b){return timingSafeEqual(createHash('sha256').update(a).digest(),createHash('sha256').update(b).digest())}
function signSession(expires){return createHmac('sha256',password).update('kolo-admin:'+expires).digest('hex')}
function authorized(req){
 if(!password)return false;
 const expected='Basic '+Buffer.from('admin:'+password).toString('base64');
 if(safeEqual(req.headers.authorization||'',expected))return true;
 const token=(req.headers.cookie||'').split(';').map(v=>v.trim()).find(v=>v.startsWith(ADMIN_COOKIE+'='))?.slice(ADMIN_COOKIE.length+1);
 if(!token)return false;const [expires,signature]=token.split('.');
 return /^\d+$/.test(expires)&&Number(expires)>Date.now()&&signature&&safeEqual(signature,signSession(expires));
}
function rememberAdmin(req,res){
 const expires=String(Date.now()+ADMIN_AGE*1000),secure=process.env.VERCEL||req.headers['x-forwarded-proto']==='https';
 res.setHeader('Set-Cookie',ADMIN_COOKIE+'='+expires+'.'+signSession(expires)+'; Max-Age='+ADMIN_AGE+'; Path=/; HttpOnly; SameSite=Strict'+(secure?'; Secure':''));
}

const assets={'/celebration-audio.js':['celebration-audio.js','text/javascript; charset=utf-8'],'/sets-ui.js':['sets-ui.js','text/javascript; charset=utf-8'],'/timeline.js':['timeline.js','text/javascript; charset=utf-8'],'/favicon.svg':['favicon.svg','image/svg+xml'],'/':['index.html','text/html; charset=utf-8'],'/app.js':['app.js','text/javascript; charset=utf-8'],'/style.css':['style.css','text/css; charset=utf-8']};
export async function handler(req,res){
 let selectedSet;
 const reply=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify({...data,...(data.people?{set:selectedSet}:{}),serverNow:Date.now()}))};
 try{
 const url=new URL(req.url,'http://localhost'),path=url.pathname;
 if(path.startsWith('/api/')){
 if(!password)return reply(503,{error:'Administrace zatím nemá nastavené heslo.'});
 if(path==='/api/sets'||path.startsWith('/api/sets/')){
 if(!authorized(req))return reply(401,{error:'Přihlas se do administrace.'});
 if(req.method==='GET'&&path==='/api/sets')return reply(200,await manageSets(path));
 if(req.method!=='POST'||path==='/api/sets')return reply(405,{error:'Nepodporovaná metoda.'});
 if(req.headers.origin&&req.headers.origin!==`https://${req.headers.host}`&&req.headers.origin!==`http://${req.headers.host}`)return reply(403,{error:'Neplatný původ požadavku.'});
 let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>100000)return reply(413,{error:'Příliš mnoho dat.'})}
 const body=req.body&&typeof req.body==='object'?req.body:JSON.parse(typeof req.body==='string'?req.body:(raw||'{}'));
 return reply(200,await manageSets(path,body));
 }
 selectedSet=await resolveSet(url.searchParams.get('set')||'');
 const scope=selectedSet.id==='default'?undefined:selectedSet.id;
 const saveSet=(next,revision)=>save(next,revision,scope);
 let state=await load(scope);let lockedUntil=state.lockedUntil||0;
 if(req.method==='GET'&&path==='/api/state')return reply(200,{...state,lockedUntil});
 if(!(req.method==='POST'&&['/api/spin','/api/complete'].includes(path))&&!authorized(req))return reply(401,{error:'Nesprávné heslo administrátora.'});
 if(req.method==='GET'&&path==='/api/auth'){rememberAdmin(req,res);return reply(200,{ok:true})}
 if(req.method!=='POST')return reply(405,{error:'Nepodporovaná metoda.'});
 if(req.headers.origin&&req.headers.origin!==`http://${req.headers.host}`&&req.headers.origin!==`https://${req.headers.host}`)return reply(403,{error:'Neplatný původ požadavku.'});
 let body='';for await(const chunk of req){body+=chunk;if(body.length>100000)return reply(413,{error:'Příliš mnoho dat.'})}const data=req.body&&typeof req.body==='object'?req.body:JSON.parse(typeof req.body==='string'?req.body:(body||'{}'));
 if(path==='/api/complete'&&state.currentDraw?.completedAt&&state.currentDraw.winnerId===data.winnerId)return reply(200,{...state,lockedUntil});
 if(path!=='/api/complete'&&Date.now()<lockedUntil)return reply(409,{error:'Probíhá losování. Vyčkej na vyhlášení.'});
 if(data.revision!==state.revision)return reply(409,{error:'Seznam se změnil. Obnov stránku a zkus to znovu.'});
 let next=structuredClone(state);
 if(path==='/api/logout'){res.setHeader('Set-Cookie',ADMIN_COOKIE+'=; Max-Age=0; Path=/; HttpOnly; SameSite=Strict'+(process.env.VERCEL?'; Secure':''));return reply(200,{ok:true})}
 if(path==='/api/complete'){
 if(!data.winnerId||next.winners.at(-1)?.id!==data.winnerId)return reply(409,{error:'Mezitím proběhlo jiné losování. Obnov stránku.'});
 if(next.currentDraw&&Date.now()<next.currentDraw.revealAt)return reply(409,{error:'Ještě probíhá vyhlášení. Za okamžik můžeš pokračovat.'});
 next.lockedUntil=0;if(next.currentDraw)next.currentDraw.completedAt=Date.now();lockedUntil=0;await saveSet(next,state.revision);state=next;
 }else if(path==='/api/add'){
 const names=String(data.names||'').split(/\n/).map(n=>n.trim().replace(/\s+/g,' ')).filter(Boolean);
 if(!names.length||names.some(n=>n.length>80||!/^\p{L}[\p{L}\p{M}\p{N} '’.-]*$/u.test(n)))return reply(400,{error:'Zadej jméno nebo název na samostatný řádek (max. 80 znaků), použij písmena, čísla, mezery, tečky, pomlčky nebo apostrofy.'});
 for(const name of names)if(!next.people.some(p=>p.name.toLocaleLowerCase('cs')===name.toLocaleLowerCase('cs')))next.people.push({id:randomUUID(),name});
 if(next.people.length>300)return reply(400,{error:'Maximum je 300 účastníků.'});await saveSet(next,state.revision);state=next;
 }else if(path==='/api/remove'){next.people=next.people.filter(p=>p.id!==data.id);await saveSet(next,state.revision);state=next}
 else if(path==='/api/reset'){next.winners=[];next.currentDraw=null;next.rotation=0;await saveSet(next,state.revision);state=next}
 else if(path==='/api/spin'){
 const available=next.people.filter(p=>!next.winners.some(w=>w.id===p.id));if(!available.length)return reply(400,{error:'Všichni už vyhráli. Resetuj losování.'});
 // Fresh unbiased Fisher–Yates shuffle using OS-backed cryptographic randomness.
 for(let i=available.length-1;i>0;i--){const k=randomInt(i+1);[available[i],available[k]]=[available[k],available[i]]}
 const winner=available[0];const winnerIndex=next.people.findIndex(p=>p.id===winner.id);const dramatic=available.length>1&&randomInt(100)<45;
 const motion={
  launchTurns:randomInt(1,4),cruiseTurns:randomInt(4,10),coastTurns:randomInt(5,12),
  launchMs:randomInt(1400,2101),cruiseMs:randomInt(1800,3001),slowMs:randomInt(9000,13501),
  pauseMs:randomInt(650,1501),extraTurns:randomInt(1,3),extraMs:randomInt(5000,7801),
  nearSectors:randomInt(60,141)/100,
  // The suspense stop is independent of the winning sector.
  teaseIndex:next.people.length>1?randomInt(next.people.length-1):0,
  teaseOffset:randomInt(-20,21)/100
 };
 if(motion.teaseIndex>=winnerIndex&&next.people.length>1)motion.teaseIndex++;
 const plan=createDrawPlan({id:randomUUID(),winnerId:winner.id,winnerIndex,count:next.people.length,startRotation:next.rotation||0,startedAt:Date.now()+700,dramatic,motion});
 next.currentDraw=plan;next.rotation=plan.endRotation;
 next.winners.push({...winner,at:new Date().toISOString()});next.lockedUntil=plan.revealAt+10000;lockedUntil=next.lockedUntil;await saveSet(next,state.revision);state=next;
 return reply(200,{state:{...state,lockedUntil,set:selectedSet},winner,dramatic,motion});
 }else return reply(404,{error:'Nenalezeno.'});
 return reply(200,{...state,lockedUntil});
 }
 const asset=assets[path]||(/^\/[a-z0-9-]+\/?$/.test(path)?assets['/']:null);if(req.method!=='GET'||!asset){res.writeHead(404);return res.end('Nenalezeno')}
 res.writeHead(200,{'Content-Type':asset[1],'X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'",'Cache-Control':'no-cache'});res.end(readFileSync(root+'public/'+asset[0]));
 }catch(e){console.error(e.message);reply(e.status||500,{error:e.status?e.message:'Požadavek se nepodařilo dokončit.'})}
}
export const server=http.createServer(handler);
if(process.argv[1]===fileURLToPath(import.meta.url))server.listen(Number(process.env.PORT||3080),process.env.HOST||'127.0.0.1',()=>console.log('Kolo štěstí: http://localhost:'+(process.env.PORT||3080))); 


