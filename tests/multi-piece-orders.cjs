const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
class Sheet {
  constructor(name,rows=[]){this.name=name;this.rows=rows;this.maxColumns=26;this.writes=0;}
  getLastRow(){return this.rows.length;}
  getLastColumn(){return Math.max(0,...this.rows.map(r=>r.length));}
  getMaxColumns(){return this.maxColumns;}
  insertColumnsAfter(n,more){this.maxColumns+=more;}
  setFrozenRows(){}
  getDataRange(){return {getValues:()=>this.rows.map(r=>r.slice())};}
  getRange(row,col,height=1,width=1){const self=this;return {
    getValues(){return Array.from({length:height},(_,i)=>Array.from({length:width},(_,j)=>self.rows[row-1+i]?.[col-1+j]??''));},
    setValues(values){self.writes++;values.forEach((r,i)=>{self.rows[row-1+i]||=[];r.forEach((v,j)=>self.rows[row-1+i][col-1+j]=v)});return this;},
    setValue(v){return this.setValues([[v]])},setFontWeight(){return this}
  }}
  appendRow(row){this.rows.push(row);this.writes++;}
  deleteRow(row){this.rows.splice(row-1,1);}
}
const sheets=new Map(),ss={getSheetByName:n=>sheets.get(n)||null,insertSheet:n=>{const s=new Sheet(n);sheets.set(n,s);return s}};
let locked=false;
const lock={waitLock(){assert(!locked,'nested document lock');locked=true},releaseLock(){locked=false}};
const norm=v=>String(v??'').trim().toLowerCase();
const c=vm.createContext({console,Date,Map,Set,Number,JSON,
  safeStr_:v=>String(v??'').trim(),normalizeKey_:norm,numberOrZero_:v=>Number(v)||0,
  SpreadsheetApp:{getActiveSpreadsheet:()=>ss},LockService:{getDocumentLock:()=>lock,getScriptLock:()=>lock},
  Session:{getActiveUser:()=>({getEmail:()=> 'test@example.test'}),getScriptTimeZone:()=> 'Europe/Madrid'},
  Utilities:{formatDate:(date,tz,fmt)=>fmt==='MMyyyy'?'112026':date instanceof Date?date.toISOString().slice(0,10):String(date)},
  formatLotsDate_:v=>v?new Date(v).toISOString():'',assertLotsWebAppAccess_:()=>{},
  LOTS_APP:{activeSheet:'Lotes activos'},CONFIG:{productMasterSheet:'master'}});
for(const f of ['MultiPieceOrders.gs','ManufacturingOrders.gs','PigmentOrders.gs','HardwareBridge.gs'])vm.runInContext(fs.readFileSync(f,'utf8'),c);
c.readPremiumManufacturingClients_=()=>[];
const catalog=[{sku:'CODO 90',product:'Codo 90°'},{sku:'TRAMO',product:'Tramo recto'}];
c.readManufacturingOrderCatalog_=()=>catalog;
c.readManufacturingTheoreticalWeight_=(ss,sku)=>sku==='CODO 90'?8:12;
c.readRecycledSkuList_=()=>new Set();
c.readMesRecipes_=()=>({'codo 90':[{componentSku:'PE NATURAL',quantity:8}],tramo:[{componentSku:'PE NATURAL',quantity:12}]});
const detail={id:'SALE208',docNumber:'SO260208',contact:'CLIENT',contactName:'Cliente <prueba>',status:0,
  products:[{line_id:'L1',sku:'CODO 90',units:2,desc:'Verde'},{line_id:'L2',sku:'CODO 90',units:2,desc:'Amarillo'},
    {line_id:'L3',sku:'TRAMO',units:2},{line_id:'L4',sku:'ACCESORIO COMPRADO',units:5}]};
const materials=[{id:'PE',sku:'PE NATURAL',kind:'lots',lots:[{id:'A',sku:'PE A'},{id:'B',sku:'PE B'}]}];
c.holdedRequest_=(method,path)=>path==='/products'?materials:path.includes('?sort')?[detail]:detail;
let lotAttempts=[],failSku='TRAMO';
c.createFinishedProductLot_=(id,sku)=>{
  lotAttempts.push([id,sku]);if(sku===failSku)throw Error('Holded temporal');
  const o=c.selectManufacturingOrderLine_(c.readManufacturingOrders_(sheets.get('Ordenes Fabricacion'),sheets.get('Fabricaciones OF')),id,sku);
  return {finishedLot:o.finishedLot,action:'LOTE_CREADO'};
};
const proposals=c.getPremiumSalesOrderProposals().proposals;
assert.equal(proposals.length,1);assert.equal(proposals[0].lines.length,2);assert.equal(proposals[0].lines[0].quantity,4);
assert.match(proposals[0].lines[0].description,/Verde.*Amarillo/);
const input={salesOrderId:'SALE208',fingerprint:proposals[0].fingerprint,reference:'Parque Norte',targetDate:'2026-11-15'};
assert.throws(()=>c.createManufacturingOrderFromSalesOrder({...input,fingerprint:'stale'}),/han cambiado/);
const created=c.createManufacturingOrderFromSalesOrder(input),id=created.id;
assert.equal(created.lineCount,2);assert.equal(created.lotCreated,false);
const orderSheet=sheets.get('Ordenes Fabricacion'),production=sheets.get('Fabricaciones OF'),quality=sheets.get('Pesajes calidad');
assert.equal(orderSheet.rows.length,3);assert.equal(orderSheet.rows[1].length,32);assert.equal(orderSheet.rows[1][0],orderSheet.rows[2][0]);
assert.notEqual(orderSheet.rows[1][18],orderSheet.rows[2][18]);
assert.equal(orderSheet.rows[1][30],'LISTO');assert.equal(orderSheet.rows[2][30],'ERROR');
assert.deepEqual([...c.readImportedSalesOrderLineIds_(orderSheet)].sort(),['L1','L2','L3']);
assert.equal(c.getPremiumSalesOrderProposals().proposals.length,0);
assert.throws(()=>c.createManufacturingOrderFromSalesOrder(input),/ya tiene una OF/);assert.equal(orderSheet.rows.length,3);
assert.throws(()=>c.recordPlantManufacturingPieceWeight({orderId:id,operator:'Emilio',actualWeight:8}),/Selecciona el modelo/);
assert.throws(()=>c.recordPlantManufacturingPieceWeight({orderId:id,sku:'OTRO',operator:'Emilio',actualWeight:8}),/No encuentro/);
assert.throws(()=>c.recordPlantManufacturingPieceWeight({orderId:id,sku:'TRAMO',operator:'Emilio',actualWeight:12}),/pendiente/);
assert.throws(()=>c.recordPlantManufacturingPieceWeight({orderId:id,sku:'CODO 90',operator:'Emilio',actualWeight:8}),/Materias primas pendientes/);assert.equal(quality.rows.length,1);
failSku='';c.ensureManufacturingOrderFinishedLot(id,'TRAMO');assert.equal(orderSheet.rows[2][30],'LISTO');
assert.equal(orderSheet.rows.length,3);
c.setOrderPigment({orderId:id,sku:'CODO 90',mode:'OFF',peProductId:'PE',peLotId:'A'});
c.setOrderPigment({orderId:id,sku:'TRAMO',mode:'OFF',peProductId:'PE',peLotId:'B'});
assert.equal(orderSheet.rows[1][26],'A');assert.equal(orderSheet.rows[2][26],'B');
const before=orderSheet.writes;
assert.throws(()=>c.setOrderPigment({orderId:id,mode:'OFF',peProductId:'PE',peLotId:'B'}),/Selecciona el modelo/);
assert.equal(orderSheet.writes,before);
const originalWait=lock.waitLock;lock.waitLock=()=>{orderSheet.rows[1][26]=''};
assert.throws(()=>c.recordPlantManufacturingPieceWeight({orderId:id,sku:'CODO 90',operator:'Emilio',actualWeight:8}),/Materias primas pendientes/);assert.equal(quality.rows.length,1);lock.waitLock=originalWait;orderSheet.rows[1][26]='A';
const a=c.recordPlantManufacturingPieceWeight({orderId:id,sku:'CODO 90',operator:'Emilio',actualWeight:'8,1'});
const b=c.recordPlantManufacturingPieceWeight({orderId:id,sku:'TRAMO',operator:'Emilio',actualWeight:12});
assert.equal(a.theoreticalWeight,8);assert.equal(b.theoreticalWeight,12);assert.equal(a.pieceNumber,1);assert.equal(b.pieceNumber,2);
assert.equal(a.quality.measured,1);assert.equal(b.quality.measured,1);assert.notEqual(a.finishedLot,b.finishedLot);
// Hardware remains compatible with its existing OF|Pnumber identity and validates the selected SKU.
c.hardwareEnabled_=()=>true;c.hardwareSpreadsheet_=()=>ss;c.hardwareQrUrl_=lot=>'https://qr.example.test/'+encodeURIComponent(lot);
const ja=c.queuePlantLabelJob(id,a.pieceNumber,a.sku),jb=c.queuePlantLabelJob(id,b.pieceNumber,b.sku);
assert.notEqual(ja.jobId,jb.jobId);assert.notEqual(ja.url,jb.url);
assert.equal(c.queuePlantLabelJob(id,b.pieceNumber,b.sku).existing,true);
assert.throws(()=>c.queuePlantLabelJob(id,a.pieceNumber,b.sku),/modelo seleccionado/);
assert.equal(sheets.get('Trabajos equipos').rows.length,3);assert.equal(quality.rows.length,3);
const p=[{sku:'CODO 90',units:2,materialSku:'PE NATURAL',realWeight:16},{sku:'TRAMO',units:1,materialSku:'PE NATURAL',realWeight:12}];
c.syncManufacturingOrdersForShift_(ss,p,'2026-11-09','Mañana');
assert.equal(production.rows.length,3);assert.equal(production.rows[1][19],'A');assert.equal(production.rows[2][19],'B');
let lines=c.readManufacturingOrders_(orderSheet,production);
assert.equal(lines.find(o=>o.sku==='CODO 90').producedQuantity,2);assert.equal(lines.find(o=>o.sku==='TRAMO').producedQuantity,1);
assert.equal(c.getManufacturingOrdersData().summary.total,1);
const da=c.getManufacturingOrderDetail(id,'CODO 90'),db=c.getManufacturingOrderDetail(id,'TRAMO');
assert.equal(da.quality.measurements.length,1);assert.equal(db.quality.measurements.length,1);
assert.equal(da.productions.length,1);assert.equal(db.productions[0].sku,'TRAMO');
assert.equal(c.getTraceabilityRecord(id).selection,true);
assert.equal(c.getTraceabilityRecord(a.finishedLot).productions[0].sku,'CODO 90');
assert.equal(c.getTraceabilityRecord(b.finishedLot).quality.measurements[0].pieceNumber,2);
// Retrying a shift must recover each SKU's own snapshot, even though the OF number is shared.
c.setOrderPigment({orderId:id,sku:'CODO 90',mode:'OFF',peProductId:'PE',peLotId:'B'});
c.setOrderPigment({orderId:id,sku:'TRAMO',mode:'OFF',peProductId:'PE',peLotId:'A'});
c.syncManufacturingOrdersForShift_(ss,p,'2026-11-09','Mañana');
assert.equal(production.rows[1][19],'A');assert.equal(production.rows[2][19],'B');
assert.equal(c.readManufacturingOrders_(orderSheet,production).find(o=>o.sku==='CODO 90').producedQuantity,2);
// The public list exposes counts, never measurement details or author emails.
const publicRows=c.getPlantWeightOrders().orders;
assert.equal(publicRows.length,2);assert.equal(publicRows[0].reference,'Parque Norte');
assert.equal(publicRows[0].quality.measurements,undefined);assert.equal(publicRows[0].createdBy,undefined);
// Shared header edits preserve sibling quantities, recipes and all issued lots.
const originalLots=orderSheet.rows.slice(1).map(r=>r[18]);
c.updateManufacturingOrder(id,{lineSku:'TRAMO',sku:'TRAMO',product:'Tramo recto',targetQuantity:3,status:'ABIERTA',reference:'Parque Sur',targetDate:'2026-11-16',color:'Blanco',notes:'Instrucción'});
assert.equal(orderSheet.rows[1][4],4);assert.equal(orderSheet.rows[2][4],3);
assert(orderSheet.rows.slice(1).every(r=>r[28]==='Parque Sur'));assert.deepEqual(orderSheet.rows.slice(1).map(r=>r[18]),originalLots);
assert.throws(()=>c.updateManufacturingOrder(id,{lineSku:'TRAMO',sku:'OTRO'}),/no se puede cambiar/);
// Legacy single-product OF can still be accessed by ID with no SKU argument.
const legacy=orderSheet.rows[1].slice(0,28);legacy[0]='OF-2026-0099';legacy[18]='LOTE-ANTIGUO';legacy[15]='OLD';legacy[16]='OLD-LINE';orderSheet.appendRow(legacy);
const old=c.recordPlantManufacturingPieceWeight({orderId:legacy[0],operator:'Emilio',actualWeight:8});assert.equal(old.finishedLot,'LOTE-ANTIGUO');
assert.equal(c.getTraceabilityRecord('LOTE-ANTIGUO').order.id,legacy[0]);
// Same SKU in two open OFs never silently chooses the first.
const oldLength=production.rows.length;
assert.throws(()=>c.syncManufacturingOrdersForShift_(ss,p,'2026-11-10','Mañana'),/varias OF/);
assert.equal(production.rows.length,oldLength);
console.log('PASS: grouped creation, repeated SKU/colors, duplicate/stale import guards, partial lot retry, material isolation, per-model weights/traceability, unique hardware jobs, exact retry snapshots, shared header, legacy QR and ambiguous production guard.');
