// Capacidades de interfaz. Cada operación vuelve a comprobar los permisos en servidor.
async function recordMovement(values){
 if(!currentAccess.canMove)throw Error('Se requiere una cuenta de planta autorizada.');
 if(busy)throw Error('Hay otro guardado en curso.');
 busy=true;
 try{accept(await rpc('warehouseRecordMovement',values,revision))}finally{busy=false}
}
function showMoldDetails(id){
 const m=state.molds.find(x=>x.id===id);if(!m)return;
 const fields=[['Código',m.code],['Identificador único',m.id],['Propietario',ownerName(m)],['Tipo',typeName(m)],['Referencia',m.name],['Ubicación actual',m.location||m.destination||m.status],['Largo (mm)',m.length],['Ancho (mm)',m.width],['Alto (mm)',m.height],['Peso (kg)',m.weight],['Material',m.material],['Piezas',m.pieces],['Observaciones',m.notes]];
 modal('Ficha del molde · Consulta',fields.map(([k,v])=>`<p><b>${esc(k)}:</b> ${esc(v==null||v===''?'Pendiente':v)}</p>`).join(''),()=>{throw Error('Ficha de solo consulta.');});
 $('form').querySelector('button[type=submit]').hidden=true;
}
function applyAccessUI(){
 const adminActions=['owner','type','location','mold','backup'];
 document.querySelectorAll('[data-action]').forEach(b=>{
  if(adminActions.includes(b.dataset.action))b.hidden=!currentAccess.canAdmin;
  if(b.dataset.action==='move')b.hidden=!currentAccess.canMove;
 });
 document.querySelectorAll('[data-move]').forEach(b=>b.hidden=!currentAccess.canMove);
 document.querySelectorAll('[data-edit]').forEach(b=>b.textContent=currentAccess.canAdmin?'Ver / editar':'Ver ficha');
 document.querySelectorAll('[data-admin-panel]').forEach(b=>b.hidden=!currentAccess.canAdmin);
 $('backup').hidden=!currentAccess.canAdmin;
 if($('access-help'))$('access-help').hidden=currentAccess.canMove;
 if($('restore'))$('restore').closest('label').hidden=!currentAccess.canAdmin;
 if(page==='Copias y ayuda'&&currentAccess.canAdmin&&audit.length){
  const section=document.createElement('section');section.className='panel';
  const kinds={restore:'Restauración de copia',movement:'Movimiento',administration:'Administración'};
  section.innerHTML='<h2>Últimas operaciones acreditadas</h2>'+table(['Fecha','Operación','Cuenta acreditada','Rol'],audit.slice(-10).reverse().map(a=>`<tr><td>${esc(a.at)}</td><td>${esc(kinds[a.kind]||a.kind)}</td><td>${esc(a.actor)}</td><td>${esc(a.role)}</td></tr>`));
  $('content').appendChild(section);
 }
}
