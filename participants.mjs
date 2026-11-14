export function emailAddress(value){
 const email=String(value??'').trim();
 if(email&&(email.length>254||! /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?\.[A-Za-z]{2,}$/.test(email)||email.includes('..')))throw Object.assign(Error('Zadej platnou e-mailovou adresu.'),{status:400});
 return email;
}
export function parseParticipants(input){
 const rows=String(input||'').split(/\n/).map(row=>row.trim()).filter(Boolean);
 if(rows.length>300)throw Object.assign(Error('Maximum je 300 účastníků.'),{status:400});
 const result=new Map();
 for(const row of rows){
  const parts=row.split(';');const name=parts[0].trim().replace(/\s+/g,' ');
  if(parts.length>2||name.length>80||!/^\p{L}[\p{L}\p{M}\p{N} '’.-]*$/u.test(name))throw Object.assign(Error('Každý řádek: Jméno Příjmení; email@example.cz. E-mail je nepovinný, jméno má nejvýše 80 znaků.'),{status:400});
  result.set(name.toLocaleLowerCase('cs'),{name,...(parts.length===2?{email:emailAddress(parts[1])}:{})});
 }
 return [...result.values()];
}
