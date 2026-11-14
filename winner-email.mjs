import {randomUUID,timingSafeEqual,createHash} from 'node:crypto';
import {load,save} from './store.mjs';
export const EMAIL_SUBJECT='Demo Level Up se blíží - nezapomeň se připravit';
const scope=id=>'email-'+id;
export const validDrawId=id=>/^[a-f0-9-]{36}$/.test(String(id));
export async function prepareWinnerEmail(state,set){
 const plan=state.currentDraw,winner=state.winners.find(w=>w.id===plan?.winnerId);
 if(!winner?.email)return;
 const job={revision:0,status:'pending',token:randomUUID(),createdAt:Date.now(),drawId:plan.id,revealAt:plan.revealAt,winner,people:state.people.map(({id,name})=>({id,name})),winners:state.winners.filter(w=>w.id!==winner.id).map(({id})=>({id})),rotation:plan.endRotation,setName:set.name};
 await save(job,0,scope(plan.id));
}
export async function winnerEmailStatus(id){
 if(!validDrawId(id))return {status:'none'};
 const job=await load(scope(id));
 if(job.status==='pending'&&Date.now()>Math.max(job.createdAt+30000,job.leaseUntil||0))return {status:'failed',message:'Odeslání nebylo potvrzeno. Zkus ho znovu.'};
 return {status:job.status||'none',...(job.status==='failed'?{message:job.message}:{})};
}
export async function sendWinnerEmail(id,fetcher=fetch){
 if(!validDrawId(id))return {status:'none'};
 let job=await load(scope(id));
 if(!job.drawId||job.status==='scheduled')return {status:job.status||'none'};
 if(Date.now()-job.createdAt>23*3600000)return {status:'failed',message:'Automatické opakování již není dostupné.'};
 // A short persistent lease prevents concurrent spectators sending the same job.
 if(job.leaseUntil>Date.now())return {status:'pending'};
 job.leaseUntil=Date.now()+30000;
 try{await save(job,job.revision,scope(id))}catch(e){if(e.status===409)return {status:'pending'};throw e}
 try{
  if(!process.env.RESEND_API_KEY)throw Error('Resend není připojený.');
  const domain=process.env.RESEND_EMAIL_DOMAIN||'minka.cz';
  if(!/^[a-z0-9.-]+$/i.test(domain))throw Error('Neplatná odesílací doména.');
  const image='https://demo.minka.cz/api/winner-image?draw='+id+'&token='+job.token;
  const payload={from:'Level Up demo <demo@'+domain+'>',to:[job.winner.email],subject:EMAIL_SUBJECT,html:'<!doctype html><html><body style="margin:0;padding:0;background:#10121a"><img src="'+image+'" alt="Vítězné kolo: '+job.winner.name.replace(/[&<>"']/g,'')+'" width="800" style="display:block;width:100%;max-width:800px;height:auto;margin:0 auto;border:0"></body></html>',text:''};
  if(job.revealAt+2000>Date.now())payload.scheduled_at=new Date(job.revealAt+2000).toISOString();
  // Keep retries byte-for-byte identical, including the scheduled time.
  job.payload??=payload;await save(job,job.revision,scope(id));
  const response=await fetcher('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+process.env.RESEND_API_KEY,'Content-Type':'application/json','Idempotency-Key':'wheel-winner/'+id},body:JSON.stringify(job.payload),signal:AbortSignal.timeout(12000)});
  const data=await response.json();
  if(!response.ok||!data.id)throw Error(response.status===429?'Dosažen limit Resendu. Zkus odeslání později.':'Resend zprávu nepřijal (HTTP '+response.status+').');
  job.status='scheduled';job.providerId=data.id;delete job.message;
 }catch(e){job.status='failed';job.message=e.message==='Resend není připojený.'||e.message.startsWith('Resend zprávu')||e.message.startsWith('Dosažen limit')?e.message:'Odeslání se nepodařilo. Zkus ho znovu.'}
 job.leaseUntil=0;await save(job,job.revision,scope(id));return {status:job.status,...(job.message?{message:job.message}:{})};
}
export async function winnerImage(id,token){
 if(!validDrawId(id)||typeof token!=='string')return null;
 const job=await load(scope(id));
 const hash=value=>createHash('sha256').update(value).digest();
 if(!job.token||!timingSafeEqual(hash(token),hash(job.token))||Date.now()<job.revealAt)return null;
 const {renderWinnerImage}=await import('./winner-image.mjs');return renderWinnerImage(job);
}
