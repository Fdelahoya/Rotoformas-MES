'use strict';
const Model = (() => {
 const empty=()=>({version:1,owners:[],types:[],locations:[],molds:[],moves:[]});
 const uid=()=>Utilities.getUuid();
 const locCode=(e,m,n)=>`E${e}M${m}N${n}`;
 const nextCode=(s,o,t)=>{const prefix=`${o.abbr}-${t.abbr}-`;let n=1;while(s.molds.some(m=>m.code===prefix+String(n).padStart(3,'0')))n++;return prefix+String(n).padStart(3,'0')};
 function move(s,v){
  const mold=s.molds.find(m=>m.id===v.mold);if(!mold)throw Error('Selecciona un molde válido.');
  if(!v.person?.trim())throw Error('Indica la persona responsable.');
  if(!['Entrada','Salida','Traslado'].includes(v.kind))throw Error('Movimiento no válido.');
  const target=s.locations.find(l=>l.code===v.location);
  if(v.kind!=='Salida'&&!target)throw Error('Selecciona una ubicación válida.');
  if(v.kind==='Entrada'&&mold.location)throw Error('El molde ya está en el almacén. Registra un traslado o una salida.');
  if(v.kind!=='Entrada'&&!mold.location)throw Error('El molde no está ubicado en el almacén. Registra primero una entrada.');
  if(v.kind==='Traslado'&&mold.location===v.location)throw Error('Selecciona una ubicación diferente a la actual.');
  if(v.kind==='Salida'&&(!v.destination?.trim()||!['En producción','En mantenimiento','Fuera del almacén'].includes(v.status)))throw Error('Indica el destino y el estado de la salida.');
  const dest=v.kind==='Salida'?v.destination.trim():target.code;
  s.moves.push({id:uid(),mold:mold.id,code:mold.code,kind:v.kind,from:mold.location||mold.destination||'Sin ubicación',to:dest,at:new Date().toISOString(),person:v.person.trim(),notes:v.notes?.trim()||''});
  mold.location=v.kind==='Salida'?'':target.code;mold.destination=v.kind==='Salida'?dest:'';mold.status=v.kind==='Salida'?v.status:'Almacenado';
 }
 function validate(s){
  if(s?.version!==1||!['owners','types','locations','molds','moves'].every(k=>Array.isArray(s[k])))throw Error('La copia no tiene el formato de esta herramienta.');
  const unique=(a,k)=>new Set(a.map(x=>x[k])).size===a.length;
  for(const k of ['owners','types','locations','molds','moves']){if(s[k].some(x=>!x||typeof x!=='object'||typeof x.id!=='string')||!unique(s[k],'id'))throw Error('La copia contiene registros inválidos o repetidos.');}
  for(const k of ['owners','types'])if(s[k].some(x=>typeof x.name!=='string'||!x.name.trim()||!/^[A-Z0-9]{2,8}$/.test(x.abbr))||!unique(s[k],'abbr'))throw Error('Catálogo inválido.');
  if(s.locations.some(l=>![l.e,l.m,l.n].every(v=>Number.isInteger(v)&&v>0&&v<=999)||l.code!==locCode(l.e,l.m,l.n))||!unique(s.locations,'code'))throw Error('Ubicaciones inválidas.');
  const statuses=['Pendiente de ubicar','Almacenado','En producción','En mantenimiento','Fuera del almacén'];
  if(!unique(s.molds,'code')||s.molds.some(m=>typeof m.code!=='string'||!s.owners.some(o=>o.id===m.owner)||!s.types.some(t=>t.id===m.type)||!statuses.includes(m.status)||typeof m.name!=='string'||(m.location&&!s.locations.some(l=>l.code===m.location))||(m.status==='Almacenado'?!m.location:!!m.location)))throw Error('Moldes o ubicaciones incoherentes.');
  if(s.moves.some(v=>!s.molds.some(m=>m.id===v.mold)||!['Entrada','Salida','Traslado'].includes(v.kind)||!Number.isFinite(Date.parse(v.at))||!['code','from','to','person','notes'].every(k=>typeof v[k]==='string')))throw Error('Historial inválido.');
  return s;
 }
 return {empty,uid,locCode,nextCode,move,validate};
})();
