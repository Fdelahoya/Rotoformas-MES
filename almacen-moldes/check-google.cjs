const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),crypto=require('node:crypto'),path=require('node:path');
const dir=path.join(__dirname,'google');
function fixture(){
 let email='',throwIdentity=false,data='',writes=0,copies=0,reads=0,locks=0,failCopy=false;
 const props={WAREHOUSE_DATA_FILE_ID:'fictional-file',WAREHOUSE_ADMIN_USERS:'["admin@example.test"]',WAREHOUSE_PLANT_USERS:'["plant@example.test"]'};
 const state={version:1,owners:[{id:'owner',name:'Cliente ficticio',abbr:'CLI'}],types:[{id:'type',name:'Depósito ficticio',abbr:'DEP'}],locations:[{id:'l1',e:1,m:1,n:1,code:'E1M1N1'},{id:'l2',e:1,m:2,n:1,code:'E1M2N1'}],molds:[{id:'mold-unique-001',owner:'owner',type:'type',code:'CLI-DEP-001',name:'Molde ficticio',location:'',destination:'',status:'Pendiente de ubicar'}],moves:[]};
 data=JSON.stringify({revision:7,state,audit:[],updatedAt:'2026-01-01T00:00:00Z',updatedBy:'admin@example.test'});
 const file={getId:()=> 'fictional-file',getBlob:()=>{reads++;return {getDataAsString:()=>data}},setContent:s=>{writes++;data=s},makeCopy:()=>{if(failCopy)throw Error('No se pudo crear respaldo');copies++}};
 const ctx=vm.createContext({Set,Date,JSON,console,Session:{getActiveUser:()=>({getEmail:()=>{if(throwIdentity)throw Error('No identity');return email}}),getEffectiveUser:()=>{throw Error('No usar propietario como visitante')}},Utilities:{getUuid:()=>crypto.randomUUID(),newBlob:s=>({getBytes:()=>Buffer.from(s)})},PropertiesService:{getScriptProperties:()=>({getProperty:k=>props[k],setProperty:(k,v)=>{props[k]=v}})},DriveApp:{getFileById:id=>{assert.equal(id,'fictional-file');return file},createFile:(_,s)=>{writes++;data=s;return file}},MimeType:{PLAIN_TEXT:'text/plain'},LockService:{getScriptLock:()=>({waitLock:()=>{assert.equal(locks,0);locks++},releaseLock:()=>locks--})}});
 vm.runInContext(fs.readFileSync(path.join(dir,'Model.gs'),'utf8')+'\n'+fs.readFileSync(path.join(dir,'Backend.gs'),'utf8'),ctx);
 const call=(fn,...args)=>{ctx.args=JSON.parse(JSON.stringify(args));return vm.runInContext(fn+'(...args)',ctx)};
 return {call,props,state,login:e=>email=e,identityUnavailable:()=>throwIdentity=true,failCopy:()=>failCopy=true,corrupt:()=>data='broken',db:()=>JSON.parse(data),stats:()=>({writes,copies,reads,locks}),raw:()=>data};
}
const entry={mold:'mold-unique-001',kind:'Entrada',location:'E1M1N1',person:'Responsable escrito a mano',notes:'Inventario ficticio'};
{
 // Google puede devolver las propiedades de los objetos en otro orden.
 const reorder=value=>Array.isArray(value)?value.map(reorder):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).reverse().map(k=>[k,reorder(value[k])])):value;
 const emptyHistory=fixture();emptyHistory.login('admin@example.test');const first=reorder(emptyHistory.state);
 first.locations.push({id:'shelf2',code:'E2M1N1',e:2,m:1,n:1});
 assert.equal(emptyHistory.call('warehousePutState',first,7,false).state.locations.length,3);
 const f=fixture();f.login('admin@example.test');
 f.call('warehouseRecordMovement',entry,7);
 const next=reorder(f.db().state),existing=structuredClone(next.locations);
 for(let m=1;m<=11;m++)for(let n=1;n<=3;n++)next.locations.push({id:`e2-${m}-${n}`,code:`E2M${m}N${n}`,e:2,m,n});
 const result=f.call('warehousePutState',next,8,false);
 assert.equal(result.state.locations.length,35);
 assert.deepEqual(f.db().state.locations.slice(0,2),existing);
 assert.equal(result.state.moves.length,1);
 for(const tamper of [s=>s.locations[0].id='replacement',s=>s.locations.pop(),s=>s.locations[0].extra=true,s=>s.owners[0].name='Modificado',s=>s.moves[0].person='Otro responsable']){
  const forged=reorder(f.db().state),before=f.raw();tamper(forged);
  assert.throws(()=>f.call('warehousePutState',forged,9,false),/catálogos|historial/);assert.equal(f.raw(),before);
 }
}
{
 const f=fixture(),r=f.call('warehouseGetState');assert.equal(r.access.role,'consulta');assert.equal(r.state.molds[0].id,'mold-unique-001');assert.equal(r.state.molds[0].location,'');
 for(const identity of ['', 'unlisted@example.test','plant@example.test.evil']){
  f.login(identity);const before=f.raw(),stats=f.stats();
  for(const [fn,args] of [['warehouseRecordMovement',[entry,7]],['warehousePutState',[f.state,7,false]],['warehousePutState',[f.state,7,true]],['warehouseRestoreBackup',[f.state,7]],['warehouseExportBackup',[]]])assert.throws(()=>f.call(fn,...args),/autorizada/);
  assert.equal(f.raw(),before);assert.equal(f.stats().writes,stats.writes);assert.equal(f.stats().reads,stats.reads);assert.equal(f.stats().locks,0);
 }
 f.identityUnavailable();assert.equal(f.call('warehouseGetState').access.canMove,false);assert.throws(()=>f.call('warehouseRecordMovement',entry,7),/planta autorizada/);
}
{
 const f=fixture();f.login('PLANT@example.test');
 const r=f.call('warehouseRecordMovement',{...entry,actor:'admin@example.test',actorRole:'administracion',actorVerified:true,at:'1900-01-01',id:'fake',role:'administracion'},7);
 assert.equal(r.state.molds[0].location,'E1M1N1');const m=r.state.moves[0];
 assert.equal(m.actor,'plant@example.test');assert.equal(m.actorRole,'planta');assert.equal(m.actorVerified,true);assert.equal(m.person,entry.person);assert.notEqual(m.id,'fake');assert.ok(m.at.startsWith(new Date().getUTCFullYear().toString()));
 const before=f.raw();assert.throws(()=>f.call('warehouseRecordMovement',entry,7),/Otra persona/);assert.equal(f.raw(),before);
 assert.throws(()=>f.call('warehouseRestoreBackup',f.state,8),/administración/);assert.throws(()=>f.call('warehousePutState',f.state,8,true),/administración/);assert.throws(()=>f.call('warehousePutState',f.state,8,false),/administración/);assert.throws(()=>f.call('warehouseExportBackup'),/administración/);
 f.call('warehouseRecordMovement',{...entry,kind:'Traslado',location:'E1M2N1'},8);
 assert.equal(f.db().state.molds[0].id,'mold-unique-001');assert.equal(f.db().state.molds[0].location,'E1M2N1');
 f.call('warehouseRecordMovement',{...entry,kind:'Salida',destination:'Máquina ficticia',status:'En producción'},9);
 f.call('warehouseRecordMovement',entry,10);assert.equal(f.db().state.moves[3].from,'Máquina ficticia');assert.equal(f.stats().writes,4);
 f.login('');const publicView=f.call('warehouseGetState');assert.equal(publicView.state.molds[0].location,'E1M1N1');assert.equal(publicView.state.moves[0].actor,'');assert.equal(publicView.state.moves[0].person,'');assert.equal(publicView.audit.length,0);assert.equal(f.db().state.moves[0].actor,'plant@example.test');
 f.login('plant@example.test');f.props.WAREHOUSE_PLANT_USERS='[]';const beforeRevoked=f.raw();assert.throws(()=>f.call('warehouseRecordMovement',{...entry,kind:'Traslado',location:'E1M2N1'},11),/autorizada/);assert.equal(f.raw(),beforeRevoked);
}
{
 const f=fixture();f.login('admin@example.test');const metadata=structuredClone(f.state);metadata.molds[0].name='Referencia editada';f.call('warehousePutState',metadata,7,false);assert.equal(f.db().state.molds[0].name,'Referencia editada');
 const bypass=structuredClone(metadata);bypass.molds[0].location='E1M1N1';bypass.molds[0].status='Almacenado';assert.throws(()=>f.call('warehousePutState',bypass,8,false),/ubicación/);
 const forged=structuredClone(metadata);forged.moves.push({id:'fake',mold:'mold-unique-001',code:'CLI-DEP-001',kind:'Entrada',from:'Ninguna',to:'E1M1N1',at:new Date().toISOString(),person:'Persona',notes:'',actor:'plant@example.test',actorVerified:true});assert.throws(()=>f.call('warehousePutState',forged,8,false),/historial/);
 const restored=f.call('warehouseRestoreBackup',forged,8);assert.equal(f.stats().copies,1);assert.equal(restored.state.moves[0].actorVerified,false);assert.equal(forged.moves[0].actorVerified,true,'no modificar la copia recibida');assert.equal(restored.audit.at(-1).kind,'restore');assert.equal(restored.audit.at(-1).actor,'admin@example.test');assert.equal(restored.audit.at(-1).actorVerified,true);
 assert.equal(f.call('warehouseExportBackup').moves.length,1);
 const before=f.raw();assert.throws(()=>f.call('warehouseRestoreBackup',f.state,8),/Otra persona/);assert.equal(f.raw(),before);assert.equal(f.stats().copies,1);
 f.failCopy();assert.throws(()=>f.call('warehouseRestoreBackup',f.state,9),/respaldo/);assert.equal(f.raw(),before);
 f.corrupt();assert.throws(()=>f.call('warehouseGetState'));assert.equal(f.stats().locks,0);
}
{
 for(const config of [undefined,'[invalid]','"plant@example.test"','["plant@example.test",null]']){const f=fixture();f.login('plant@example.test');f.props.WAREHOUSE_PLANT_USERS=config;assert.equal(f.call('warehouseGetState').access.canMove,false);assert.throws(()=>f.call('warehouseRecordMovement',entry,7),/autorizada/)}
 const f=fixture();delete f.props.WAREHOUSE_ADMIN_USERS;f.login('admin@example.test');assert.throws(()=>f.call('warehouseRestoreBackup',f.state,7),/administración/);
}
{
 const f=fixture();delete f.props.WAREHOUSE_ADMIN_USERS;delete f.props.WAREHOUSE_PLANT_USERS;
 f.props.WAREHOUSE_PLANT_DOMAIN='rotoformas.com';f.props.WAREHOUSE_ADMIN_DOMAIN='rotoformas.com';
 for(const email of ['', 'user@rotoformas.com.evil','user@evilrotoformas.com','user@sub.rotoformas.com','user@example.test']){f.login(email);assert.equal(f.call('warehouseGetState').access.canMove,false);assert.throws(()=>f.call('warehouseRecordMovement',entry,7),/autorizada/);assert.throws(()=>f.call('warehouseRestoreBackup',f.state,7),/administración/);}
 f.login('OPERARIO@ROTOFORMAS.COM');assert.equal(f.call('warehouseGetState').access.canAdmin,true);f.call('warehouseRecordMovement',entry,7);assert.equal(f.db().state.moves[0].actor,'operario@rotoformas.com');f.call('warehouseRestoreBackup',f.state,8);assert.equal(f.stats().copies,1);
 f.props.WAREHOUSE_ADMIN_DOMAIN='';assert.equal(f.call('warehouseGetState').access.canMove,true);assert.equal(f.call('warehouseGetState').access.canAdmin,false);assert.throws(()=>f.call('warehouseRestoreBackup',f.state,9),/administración/);
 for(const domain of ['*.rotoformas.com','@rotoformas.com','rotoformas.com/other','rotoformas..com']){f.props.WAREHOUSE_PLANT_DOMAIN=domain;assert.equal(f.call('warehouseGetState').access.canMove,false);}
 f.props.WAREHOUSE_PLANT_DOMAIN='rotoformas.com';f.props.WAREHOUSE_ADMIN_DOMAIN='rotoformas.com';f.identityUnavailable();assert.equal(f.call('warehouseGetState').access.canAdmin,false);
}
const js=fs.readFileSync(path.join(dir,'Client.html'),'utf8').replace(/^<script>\s*/, '').replace(/\s*<\/script>$/, '');new vm.Script(js);
assert.ok(!js.includes('localStorage'));assert.ok(js.includes("rpc('warehouseRecordMovement',values,revision)"));assert.ok(js.includes("restore?'warehouseRestoreBackup':'warehousePutState'"));assert.ok(js.includes('Identidad acreditada'));assert.ok(js.includes('actorVerified===true'));
const manifest=JSON.parse(fs.readFileSync(path.join(dir,'appsscript.json')));assert.equal(manifest.webapp.access,'ANYONE_ANONYMOUS');assert.equal(manifest.webapp.executeAs,'USER_DEPLOYING');
console.log('Almacén: consulta pública; denegación de toda escritura anónima/no autorizada; movimientos de planta calculados en servidor; administración y restauración restringidas; identidad acreditada separada; historial importado sin acreditar; concurrencia y respaldo comprobados con datos ficticios.');
