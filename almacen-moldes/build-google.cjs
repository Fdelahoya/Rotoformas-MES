const fs=require('node:fs'),path=require('node:path');
const root=__dirname,out=path.join(root,'google');
fs.mkdirSync(out,{recursive:true});
const read=n=>fs.readFileSync(path.join(root,'dist',n),'utf8');
let model=read('model.js');
fs.writeFileSync(path.join(out,'Model.gs'),model.replace('globalThis.crypto.randomUUID()','Utilities.getUuid()').replace(/if\(typeof module[^\n]+\n?/g,''));
fs.writeFileSync(path.join(out,'ModelClient.html'),'<script>\n'+model+'\n</script>');
fs.writeFileSync(path.join(out,'Styles.html'),'<style>\n'+read('style.css')+'\n</style>');
let app=read('app.js');
function replace(from,to){if(!app.includes(from))throw Error('No se encuentra la sección: '+from.slice(0,70));app=app.replace(from,to)}
replace("const KEY='rotoformas-almacen-moldes-v1';let state=Model.empty(),page='Inicio',query='',saveBlocked=false;","let state=Model.empty(),page='Inicio',query='',revision=0,currentEmail='',busy=false,currentAccess={canMove:false,canAdmin:false,role:'consulta'},audit=[];");
app=app.replace(/^try\{const saved=localStorage[^\n]+\n/m,'');
replace("function persist(next){if(saveBlocked)throw Error('El almacenamiento está bloqueado para proteger los datos anteriores.');Model.validate(next);try{localStorage.setItem(KEY,JSON.stringify(next));}catch(e){throw Error('No se pudo guardar. Comprueba el espacio disponible y exporta una copia.');}state=next;render();}",`function rpc(name,...args){return new Promise((resolve,reject)=>google.script.run.withSuccessHandler(resolve).withFailureHandler(e=>reject(new Error(e.message||String(e))))[name](...args))}
function accept(result){state=Model.validate(result.state);revision=result.revision;currentEmail=result.email;currentAccess=result.access||{canMove:false,canAdmin:false,role:'consulta'};audit=result.audit||[];$('identity').textContent='Inventario compartido · '+(currentAccess.canAdmin?'Administración':currentAccess.canMove?'Planta autorizada':'Consulta pública')+(currentEmail?' · '+currentEmail:'');render()}
async function persist(next,restore=false){if(!currentAccess.canAdmin)throw Error('Se requiere acceso de administración.');if(busy)throw Error('Hay otro guardado en curso. Espera un momento.');Model.validate(next);busy=true;try{accept(await rpc(restore?'warehouseRestoreBackup':'warehousePutState',next,revision));}finally{busy=false}}
async function refresh(){if(busy)return;try{accept(await rpc('warehouseGetState'));toast('Inventario actualizado');}catch(e){alert(e.message)}}`);
replace('function mutate(fn){const next=structuredClone(state);fn(next);persist(next)}','async function mutate(fn){const next=structuredClone(state);fn(next);await persist(next)}');
replace("$('form').onsubmit=e=>{e.preventDefault();try{fn(Object.fromEntries(new FormData(e.target)));$('modal').close();toast('Guardado correctamente');}catch(err){$('error').textContent=err.message}};", "$('form').onsubmit=async e=>{e.preventDefault();const button=e.target.querySelector('button[type=submit]');button.disabled=true;try{await fn(Object.fromEntries(new FormData(e.target)));$('modal').close();toast('Guardado correctamente');}catch(err){$('error').textContent=err.message}finally{button.disabled=false}};");
replace('function modal(title,html,fn){',"function modal(title,html,fn){$('form').querySelector('button[type=submit]').hidden=false;");
replace('function moldForm(id){',"function moldForm(id){if(!currentAccess.canAdmin){showMoldDetails(id);return;}");
replace('v=>mutate(s=>Model.move(s,v))','v=>recordMovement(v)');
replace('movementNeedsMold();return','movementNeedsMold(currentAccess.canAdmin);return');
replace("label('Persona responsable','person'","label('Responsable declarado (escrito a mano)','person'");
replace(' bind();',' bind();applyAccessUI();');
replace('<section class="panel"><div class="toolbar"><h2>Prepara tu almacén','<section class="panel" data-admin-panel><div class="toolbar"><h2>Prepara tu almacén');
replace("Esta primera versión guarda el inventario únicamente en el navegador y dispositivo actuales. No tiene sincronización entre equipos. Evita usar una ventana privada para el inventario.","La consulta del inventario es pública. Registrar movimientos requiere una cuenta de planta autorizada; configurar fichas y restaurar copias requiere administración. Los cambios se guardan en Google Drive y son compartidos. Pulsa Actualizar inventario para ver los últimos cambios de otras personas.");
replace('Importar una copia sustituye el inventario actual en este navegador. Antes de hacerlo, exporta una copia de seguridad.','Importar una copia sustituye el inventario compartido para todas las personas. Antes de hacerlo, exporta una copia de seguridad.');
replace('Se sustituirán los datos actuales por','Se sustituirá el inventario compartido de todos los usuarios por');
replace("persist(next);toast('Copia importada correctamente')","await persist(next,true);toast('Copia importada correctamente')");
replace("movementsTable(rows){return table(['Fecha','Molde','Movimiento','Origen','Destino','Responsable','Notas']", "movementsTable(rows){return table(['Fecha','Molde','Movimiento','Origen','Destino','Responsable declarado','Identidad acreditada','Notas']");
replace('<td>${esc(v.person)}</td><td>${esc(v.notes)}</td>','<td>${esc(v.person||\'No disponible en consulta pública\')}</td><td>${esc(v.actorVerified===true?v.actor:\'Sin acreditar (histórico/importado o consulta pública)\')}</td><td>${esc(v.notes)}</td>');
replace("function backup(){download('almacen-moldes-'+new Date().toISOString().slice(0,10)+'.json',JSON.stringify(state,null,2),'application/json')}","async function backup(){try{const full=await rpc('warehouseExportBackup');download('almacen-moldes-'+new Date().toISOString().slice(0,10)+'.json',JSON.stringify(full,null,2),'application/json')}catch(e){alert(e.message)}}");
replace("$('backup').onclick=backup;render();",`$('backup').onclick=backup;$('refresh').onclick=refresh;
$('content').innerHTML='<section class="panel"><p>Cargando inventario compartido…</p></section>';
rpc('warehouseGetState').then(accept).catch(e=>{$('content').innerHTML='<section class="panel"><h2>No se pudo cargar el inventario</h2><p>'+esc(e.message)+'</p><p>Vuelve a cargar la página. Si el problema continúa, contacta con la persona responsable del almacén.</p></section>'});`);
fs.writeFileSync(path.join(out,'Client.html'),'<script>\n'+app+'\n'+read('access-client.js')+'\n</script>');
let html=read('index.html').replace('<link rel="stylesheet" href="style.css">',"<?!= include_('Styles'); ?><?!= embedded ? include_('EmbeddedStyles') : '' ?>");
html=html.replace('<body>','<body class="<?= embedded ? \'embedded\' : \'\' ?>">');
html=html.replace('<button id="backup">Exportar copia</button>','<div class="actions"><button id="refresh">Actualizar inventario</button><button id="backup" hidden>Exportar copia</button></div>');
html=html.replace('Guardado en este navegador · Los datos no se comparten entre dispositivos. Exporta una copia para conservarlos.','<span id="identity">Cargando permisos e inventario compartido…</span><p id="access-help" hidden>Para registrar cambios, inicia sesión en Google con una cuenta autorizada y pulsa Actualizar inventario. Si Google no acredita tu identidad, se mantiene solo la consulta. <a href="https://accounts.google.com/" target="_blank" rel="noopener noreferrer">Abrir cuenta de Google</a></p>');
html=html.replace('<script src="model.js"></script><script src="app.js"></script>',"<?!= include_('ModelClient'); ?><?!= include_('Client'); ?>");
fs.writeFileSync(path.join(out,'Index.html'),html);
fs.writeFileSync(path.join(out,'.claspignore'),'**/*\n!appsscript.json\n!*.gs\n!*.html\n');
fs.writeFileSync(path.join(out,'EmbeddedStyles.html'),`<style>
.embedded aside{position:static;width:fit-content;max-width:100%;padding:0 6px;background:#1c1c1c;border-radius:8px 8px 0 0}
.embedded .brand,.embedded .subbrand,.embedded .aside-note{display:none}
.embedded nav{display:flex;gap:0;overflow-x:auto;max-width:100%}
.embedded nav button{flex:none;white-space:nowrap;padding:8px 11px;font-size:14px;border:0;border-radius:8px 8px 0 0;color:#fff;background:transparent}
.embedded nav button:hover{background:#333;color:#fff}
.embedded nav button.active,.embedded nav button.active:hover{background:#fff;color:#1c1c1c}
.embedded main{margin:0 auto;padding:20px 16px;max-width:1040px}
.embedded header{margin-bottom:18px}.embedded header .eyebrow{display:none}
.embedded h1{font-size:22px}.embedded footer{margin-top:20px}
@media(max-width:600px){.embedded header{flex-wrap:wrap}.embedded main{padding:16px 10px}}
</style>`);
console.log('Versión Google preparada en google/. Acceso público y vista integrada en MES.');
