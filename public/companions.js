export const companionKinds=['dog','cat','toddler','llama','snake','parrot','lizard'];
// Legacy draws picked the fourth seeded random value, after side and position.
export function animalKindForDraw(plan){
 if(companionKinds.includes(plan?.animalKind))return plan.animalKind;
 if(!plan?.id)return null;
 let hash=2166136261;for(const c of plan.id)hash=Math.imul(hash^c.charCodeAt(0),16777619);
 let value;for(let i=0;i<4;i++){hash=(hash+0x6D2B79F5)|0;let t=Math.imul(hash^(hash>>>15),1|hash);t^=t+Math.imul(t^(t>>>7),61|t);value=((t^(t>>>14))>>>0)/4294967296}
 return companionKinds[Math.floor(value*6)];
}
