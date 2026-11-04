const fs = require('node:fs'), vm = require('node:vm'), assert = require('node:assert/strict');
const props = new Map(), cache = new Map();
let sheetsOpened = 0;
const jobs = [['headers']], quality = [['headers'], [new Date(), 'Operario', 'OF1', 'Lote A', 'SKU', 'Producto', 1, 8.8, 8.8, 0, 0, 'CONFORME']];
const sheet = {
  getLastRow: () => jobs.length,
  getDataRange: () => ({getValues: () => jobs.map(r => [...r])}),
  getRange: (r, c) => ({setValue: v => {jobs[r-1][c-1] = v;}, setValues: values => values[0].forEach((v,i) => {jobs[r-1][c+i-1]=v;})}),
  appendRow: r => jobs.push(r), setFrozenRows() {}
};
const ss = {getSheetByName: name => name === 'Pesajes calidad' ? {getDataRange: () => ({getValues: () => quality})} : sheet};
const c = vm.createContext({Date, Number, JSON,
  PropertiesService: {getScriptProperties: () => ({getProperty: key => props.get(key)})},
  CacheService: {getScriptCache: () => ({get: key => cache.get(key), put: (key,value) => cache.set(key,value)})},
  Utilities: {formatDate: () => '04/11/2026 10:00'},
  Session: {getActiveUser: () => ({getEmail: () => ''}), getScriptTimeZone: () => 'Europe/Madrid'},
  LockService: {getScriptLock: () => ({waitLock() {}, releaseLock() {}}),
    getDocumentLock: () => ({waitLock() {}, releaseLock() {}})},
  SpreadsheetApp: {openById: () => {sheetsOpened++; return ss;}},
  ContentService: {MimeType: {JSON:'json'}, createTextOutput: text => ({text, setMimeType() {return this;}})}
});
const all = fs.readdirSync('.').filter(f => f.endsWith('.gs')).map(f => fs.readFileSync(f,'utf8')).join('\n');
vm.runInContext(all,c);
const intentionallyPublic = new Set(['doGet','doPost','onOpen','normalizarSoloFechaString','getPlantWeightOrders',
  'getPlantScaleWeight','recordPlantManufacturingPieceWeight','queuePlantLabelJob','getPlantLabelJobStatus']);
let guarded = 0;
for(const match of all.matchAll(/^function (\w+)\([^\n]*\) \{\s*([^\n]*)/gm)) {
  const [,name,first] = match;
  if(name.endsWith('_') || intentionallyPublic.has(name)) continue;
  assert.equal(first.trim(), 'assertLotsWebAppAccess_();', `${name} needs explicit authorization`);
  assert.throws(() => c[name](), /Acceso restringido/, name);
  guarded++;
}
assert.throws(() => c.queuePlantLabelJob('OF1',1), /deshabilitada/);
assert.throws(() => c.recordPlantManufacturingPieceWeight({}), /operario/);
assert.throws(() => c.recordPlantManufacturingPieceWeight({operator:'Operario'}), /orden de fabricación/);
assert.equal(sheetsOpened,0);
assert.equal(typeof c.openPlantStationSession,'undefined');
assert.equal(typeof c.assertPlantStation_,'undefined');
// The public station saves a valid measurement without a password. Only in-memory sheets are used.
const savedMeasurements=[];
const oldEnsure=c.ensureManufacturingOrderSheets_, oldRead=c.readManufacturingOrders_;
const oldTheory=c.readManufacturingTheoreticalWeight_, oldQuality=c.getManufacturingQualityData_;
const oldDate=c.formatLotsDate_;
c.SpreadsheetApp.getActiveSpreadsheet=()=>ss;
c.ensureManufacturingOrderSheets_=()=>({orders:{},production:{},quality:{
  getDataRange:()=>({getValues:()=>[['headers'],...savedMeasurements]}),
  appendRow:row=>savedMeasurements.push(row)}});
c.readManufacturingOrders_=()=>[{id:'OF-SAVE',sku:'SKU',product:'Producto',finishedLot:'Lote A'}];
c.readManufacturingTheoreticalWeight_=()=>8.8;
c.getManufacturingQualityData_=()=>({measured:savedMeasurements.length});
c.formatLotsDate_=()=> 'now';
assert.throws(()=>c.recordPlantManufacturingPieceWeight({operator:'Operario',orderId:'OF-SAVE',actualWeight:0}),/mayor que cero/);
assert.throws(()=>c.recordPlantManufacturingPieceWeight({operator:'Operario',orderId:'MISSING',actualWeight:8.8}),/No encuentro/);
assert.equal(savedMeasurements.length,0);
const saved=c.recordPlantManufacturingPieceWeight({operator:'  Operario\nTurno  ',orderId:'OF-SAVE',actualWeight:'8,8',notes:'Control'});
assert.equal(saved.ok,true); assert.equal(saved.pieceNumber,1);
assert.equal(savedMeasurements.length,1);
assert.equal(savedMeasurements[0][1],'Operario Turno');
assert.equal(savedMeasurements[0][8],8.8);
assert.equal(savedMeasurements[0][11],'CONFORME');
assert.equal(savedMeasurements[0][12],'Control');
c.ensureManufacturingOrderSheets_=oldEnsure; c.readManufacturingOrders_=oldRead;
c.readManufacturingTheoreticalWeight_=oldTheory; c.getManufacturingQualityData_=oldQuality;
c.formatLotsDate_=oldDate;
props.set('RPI_BRIDGE_TOKEN','b'.repeat(64));
const post = data => JSON.parse(c.doPost({postData:{contents:JSON.stringify(data)}}).text);
assert.equal(post({action:'sync',token:'wrong'}).ok,false);
const request = {protocolVersion:2,action:'sync',token:'b'.repeat(64),capabilities:{print:false,laser:false},sample:{stable:true,weight:8.8,measuredAt:Date.now()}};
assert.equal(post(request).job,null);
assert.equal(sheetsOpened,0);
assert.equal(c.getPlantScaleWeight().ok,false);
props.set('RPI_SCALE_ENABLED','true');
assert.equal(post(request).ok,true);
assert.equal(c.getPlantScaleWeight().weight,'8.800');
for(const sample of [
  {stable:false,weight:8.8,measuredAt:Date.now()}, {stable:'true',weight:8.8,measuredAt:Date.now()},
  {stable:true,weight:8.8,measuredAt:Date.now()-7000}, {stable:true,weight:8.8,measuredAt:Date.now()+7000},
  {stable:true,weight:0.1,measuredAt:Date.now()}, {stable:true,weight:100000,measuredAt:Date.now()},
  {stable:true,weight:'8.8',measuredAt:Date.now()}, {stable:true,weight:8.8}
]) {post({...request,sample}); assert.equal(c.getPlantScaleWeight().ok,false,JSON.stringify(sample));}
cache.set('ROTOFORMAS_SCALE_SAMPLE_V1','broken JSON'); assert.equal(c.getPlantScaleWeight().ok,false);
assert.equal(post({...request,protocolVersion:1}).ok,false);
assert.equal(sheetsOpened,0, 'telemetry never opens Sheets');
props.set('HOLDED_SPREADSHEET_ID','test'); props.set('RPI_PRINT_ENABLED','true');
const first = c.queuePlantLabelJob('OF1',1), again = c.queuePlantLabelJob('OF1',1);
assert.equal(first.jobId,again.jobId); assert.equal(again.existing,true); assert.equal(jobs.length,2);
assert.equal(first.url,vm.runInContext('HARDWARE.qrBase',c)+'?lote=Lote%20A');
const before = sheetsOpened;
assert.equal(post(request).job,null); assert.equal(sheetsOpened,before,'client must also enable output');
// Enabling laser later must not add V1 to an already-created print-only job.
props.set('RPI_LASER_ENABLED','true');
const enabled = {...request,capabilities:{print:true,laser:true}};
const delivered = post(enabled).job;
assert.equal(delivered.outputs.print,true); assert.equal(delivered.outputs.laser,false);
assert.equal(delivered.url,first.url);
assert.equal(post(enabled).job,null,'ENVIADO jobs are never automatically redelivered');
const result = post({...enabled, results:[{jobId:first.jobId,print:'INCIERTO',laser:'DESHABILITADO'}]});
assert.equal(result.ack[0],first.jobId);
assert.equal(c.getPlantLabelJobStatus(first.jobId).manualAllowed,false);
quality.push([new Date(), 'Operario', 'OF1', 'Lote A', 'SKU', 'Producto', 2, 8.8, 8.8, 0, 0, 'CONFORME']);
const second = c.queuePlantLabelJob('OF1',2);
const withLaser = post(enabled).job;
assert.equal(withLaser.jobId,second.jobId); assert.equal(withLaser.outputs.laser,true);
assert.equal(withLaser.url,first.url);
const legacy = [...jobs[1]]; legacy[0]='legacy'; legacy[1]=new Date(); legacy[10]='PENDIENTE'; legacy[15]=''; jobs.push(legacy);
const stale = [...jobs[1]]; stale[0]='stale'; stale[1]=new Date(Date.now()-16*60*1000); stale[10]='PENDIENTE'; jobs.push(stale);
assert.equal(post(enabled).job,null,'legacy and stale pending jobs require human reconciliation');
props.set('RPI_PRINT_ENABLED','false');
assert.equal(post(enabled).job,null,'server output kill switch wins over client');
assert.throws(() => c.queuePlantLabelJob('OF1',2), /deshabilitada/);
props.set('RPI_PRINT_ENABLED','true');
quality[2][11]='NO CONFORME';
assert.throws(() => c.queuePlantLabelJob('OF1',2), /no conforme/);
quality[2][11]='CONFORME'; quality[2][0]=new Date(Date.now()-16*60*1000);
assert.throws(() => c.queuePlantLabelJob('OF1',2), /15 minutos/);
assert.equal(c.getPlantLabelJobStatus('missing').found,false);
c.SpreadsheetApp.getActiveSpreadsheet = () => ss;
c.readManufacturingOrders_ = () => [{id:'OF1',status:'ABIERTA',sku:'SKU'},{id:'CLOSED',status:'CERRADA'}];
c.getManufacturingQualityData_ = () => ({measured:2,measurements:[{measuredBy:'private',notes:'private'}]});
c.readManufacturingTheoreticalWeight_ = () => 8.8; c.formatLotsDate_ = () => 'now';
const projection = c.getPlantWeightOrders();
assert.equal(projection.orders.length,1);
assert.equal(JSON.stringify(projection.orders[0].quality),'{"measured":2}');
console.log(`PASS: ${guarded} administrative entry points deny anonymous calls; password-free station saving, measurement validation, freshness, telemetry isolation, idempotence, phase gates and exact QR.`);
