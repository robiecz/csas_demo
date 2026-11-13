import {readFileSync,writeFileSync,renameSync,mkdirSync,existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const key='kolo-stesti:state:v1';
const redisUrl=()=>process.env.UPSTASH_REDIS_REST_URL||process.env.KV_REST_API_URL;
const redisToken=()=>process.env.UPSTASH_REDIS_REST_TOKEN||process.env.KV_REST_API_TOKEN;
export const emptyState=()=>({people:[],winners:[],revision:0,lockedUntil:0});
async function redis(...command){const response=await fetch(redisUrl(),{method:'POST',headers:{Authorization:`Bearer ${redisToken()}`,'Content-Type':'application/json'},body:JSON.stringify(command)});const data=await response.json();if(!response.ok||data.error)throw Error('Datové úložiště není dostupné.');return data.result}
function localFile(scope){if(process.env.VERCEL)throw Error('Na Vercelu musí být připojeno úložiště Upstash Redis.');const dir=process.env.DATA_DIR||fileURLToPath(new URL('./data',import.meta.url));mkdirSync(dir,{recursive:true});return dir+(scope?'/state-'+scope+'.json':'/state.json')}
export async function load(scope){if(redisUrl()){const value=await redis('GET',scope?key+':'+scope:key);return value?JSON.parse(value):emptyState()}const file=localFile(scope);return existsSync(file)?JSON.parse(readFileSync(file,'utf8')):emptyState()}
export async function save(next,revision,scope){next.revision=revision+1;if(redisUrl()){const script="local v=redis.call('GET',KEYS[1]); local rev=0; if v then rev=cjson.decode(v).revision end; if rev~=tonumber(ARGV[1]) then return 0 end; redis.call('SET',KEYS[1],ARGV[2]); return 1";if(await redis('EVAL',script,1,scope?key+':'+scope:key,revision,JSON.stringify(next))!==1){const e=Error('Seznam se změnil. Obnov stránku a zkus to znovu.');e.status=409;throw e}}else{const file=localFile(scope),current=existsSync(file)?JSON.parse(readFileSync(file,'utf8')):emptyState();if(current.revision!==revision){const e=Error('Seznam se změnil. Obnov stránku.');e.status=409;throw e}writeFileSync(file+'.tmp',JSON.stringify(next));renameSync(file+'.tmp',file)}}


export async function saveSetAndRegistry(next,setRevision,scope,index,indexRevision){
 next.revision=setRevision+1;index.revision=indexRevision+1;
 if(redisUrl()){
  const script="local a=redis.call('GET',KEYS[1]); local b=redis.call('GET',KEYS[2]); local ar=0; local br=0; if a then ar=cjson.decode(a).revision end; if b then br=cjson.decode(b).revision end; if ar~=tonumber(ARGV[1]) or br~=tonumber(ARGV[2]) then return 0 end; redis.call('SET',KEYS[1],ARGV[3]); redis.call('SET',KEYS[2],ARGV[4]); return 1";
  if(await redis('EVAL',script,2,scope?key+':'+scope:key,key+':registry',setRevision,indexRevision,JSON.stringify(next),JSON.stringify(index))!==1){const e=Error('Sada se mezitím změnila. Otevři úpravu znovu.');e.status=409;throw e}
 }else{
  const file=localFile(scope),registryFile=localFile('registry');
  const readRev=p=>existsSync(p)?JSON.parse(readFileSync(p,'utf8')).revision:0;
  if(readRev(file)!==setRevision||readRev(registryFile)!==indexRevision){const e=Error('Sada se mezitím změnila. Otevři úpravu znovu.');e.status=409;throw e}
  writeFileSync(file+'.tmp',JSON.stringify(next));writeFileSync(registryFile+'.tmp',JSON.stringify(index));renameSync(file+'.tmp',file);renameSync(registryFile+'.tmp',registryFile);
 }
}
