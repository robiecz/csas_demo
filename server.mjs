import http from 'node:http';
import {readFileSync} from 'node:fs';
import {load,save} from './store.mjs';
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

const assets={'/':['index.html','text/html; charset=utf-8'],'/app.js':['app.js','text/javascript; charset=utf-8'],'/style.css':['style.css','text/css; charset=utf-8']};
export async function handler(req,res){
 const reply=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data))};
 try{
 const path=new URL(req.url,'http://localhost').pathname;
 if(path.startsWith('/api/')){
 if(!password)return reply(503,{error:'Administrace zatím nemá nastavené heslo.'});
 let state=await load();let lockedUntil=state.lockedUntil||0;
 if(req.method==='GET'&&path==='/api/state')return reply(200,{...state,lockedUntil});
 if(!(req.method==='POST'&&['/api/spin','/api/complete'].includes(path))&&!authorized(req))return reply(401,{error:'Nesprávné heslo administrátora.'});
 if(req.method==='GET'&&path==='/api/auth'){rememberAdmin(req,res);return reply(200,{ok:true})}
 if(req.method!=='POST')return reply(405,{error:'Nepodporovaná metoda.'});
 if(req.headers.origin&&req.headers.origin!==`http://${req.headers.host}`&&req.headers.origin!==`https://${req.headers.host}`)return reply(403,{error:'Neplatný původ požadavku.'});
 let body='';for await(const chunk of req){body+=chunk;if(body.length>100000)return reply(413,{error:'Příliš mnoho dat.'})}const data=req.body&&typeof req.body==='object'?req.body:JSON.parse(typeof req.body==='string'?req.body:(body||'{}'));
 if(path!=='/api/complete'&&Date.now()<lockedUntil)return reply(409,{error:'Probíhá losování. Vyčkej na vyhlášení.'});
 if(data.revision!==state.revision)return reply(409,{error:'Seznam se změnil. Obnov stránku a zkus to znovu.'});
 let next=structuredClone(state);
 if(path==='/api/logout'){res.setHeader('Set-Cookie',ADMIN_COOKIE+'=; Max-Age=0; Path=/; HttpOnly; SameSite=Strict'+(process.env.VERCEL?'; Secure':''));return reply(200,{ok:true})}
 if(path==='/api/complete'){
 if(!data.winnerId||next.winners.at(-1)?.id!==data.winnerId)return reply(409,{error:'Mezitím proběhlo jiné losování. Obnov stránku.'});
 next.lockedUntil=0;lockedUntil=0;await save(next,state.revision);state=next;
 }else if(path==='/api/add'){
 const names=String(data.names||'').split(/\n/).map(n=>n.trim().replace(/\s+/g,' ')).filter(Boolean);
 if(!names.length||names.some(n=>n.length>80||!/^\p{L}[\p{L}\p{M}'’.-]*(?: [\p{L}\p{M}'’.-]+)+$/u.test(n)))return reply(400,{error:'Zadej jméno a příjmení, každého na samostatný řádek (max. 80 znaků).'});
 for(const name of names)if(!next.people.some(p=>p.name.toLocaleLowerCase('cs')===name.toLocaleLowerCase('cs')))next.people.push({id:randomUUID(),name});
 if(next.people.length>300)return reply(400,{error:'Maximum je 300 účastníků.'});await save(next,state.revision);state=next;
 }else if(path==='/api/remove'){next.people=next.people.filter(p=>p.id!==data.id);await save(next,state.revision);state=next}
 else if(path==='/api/reset'){next.winners=[];await save(next,state.revision);state=next}
 else if(path==='/api/spin'){
 const available=next.people.filter(p=>!next.winners.some(w=>w.id===p.id));if(!available.length)return reply(400,{error:'Všichni už vyhráli. Resetuj losování.'});
 const winner=available[randomInt(available.length)];const dramatic=available.length>1&&randomInt(100)<45;
 next.winners.push({...winner,at:new Date().toISOString()});next.lockedUntil=Date.now()+(dramatic?26000:18500);lockedUntil=next.lockedUntil;await save(next,state.revision);state=next;
 return reply(200,{state:{...state,lockedUntil},winner,dramatic});
 }else return reply(404,{error:'Nenalezeno.'});
 return reply(200,{...state,lockedUntil});
 }
 const asset=assets[path];if(req.method!=='GET'||!asset){res.writeHead(404);return res.end('Nenalezeno')}
 res.writeHead(200,{'Content-Type':asset[1],'X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'",'Cache-Control':'no-cache'});res.end(readFileSync(root+'public/'+asset[0]));
 }catch(e){console.error(e.message);reply(e.status||500,{error:e.status?e.message:'Požadavek se nepodařilo dokončit.'})}
}
export const server=http.createServer(handler);
if(process.argv[1]===fileURLToPath(import.meta.url))server.listen(Number(process.env.PORT||3080),process.env.HOST||'127.0.0.1',()=>console.log('Kolo štěstí: http://localhost:'+(process.env.PORT||3080))); 
