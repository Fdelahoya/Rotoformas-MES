const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync(__dirname+'/../ManufacturingOrders.gs','utf8');
let rows=[[]], writes=0,locked=false;
const order={id:'OF5',sku:'A',finishedLot:'LOT',targetQuantity:2,status:'ABIERTA',lotState:'LISTO'};
const quality={getDataRange:()=>({getValues:()=>rows}),appendRow:r=>{assert(locked);writes++;rows.push(r)}};
const ctx=vm.createContext({Map,Set,Date,console,
 safeStr_:v=>String(v??'').trim(),normalizeKey_:v=>String(v??'').trim().toUpperCase(),numberOrZero_:v=>Number(v)||0,
 SpreadsheetApp:{getActiveSpreadsheet:()=>({})},LockService:{getDocumentLock:()=>({waitLock(){locked=true},releaseLock(){locked=false}})},
 formatLotsDate_:()=>'',manufacturingMaterialsState_:()=>({ready:true})});
vm.runInContext(source,ctx);
const baseReader=ctx.readManufacturingOrders_.toString();
Object.assign(ctx,{ensureManufacturingOrderSheets_:()=>({quality}),readManufacturingOrders_:()=>[order],
 selectManufacturingOrderLine_:()=>order,assertManufacturingMaterialsReady_:()=>{},readManufacturingTheoreticalWeight_:()=>100,
 getManufacturingQualityData_:()=>({})});
function row(piece,result='CONFORME',sku='A',lot='LOT',id='OF5'){const r=[];r[2]=id;r[3]=lot;r[4]=sku;r[6]=piece;r[11]=result;return r}
rows=[[],row(1),row(2,'ALERTA'),row(3,'NO CONFORME'),row(1),row(4,'CONFORME','B'),row(5,'CONFORME','A','OTHER'),row(6,'CONFORME','A','LOT','OF4'),row(7,'')];
let counts=ctx.withManufacturingAcceptedCounts_([order],quality);
assert.equal(counts[0].producedQuantity,2);assert.equal(counts[0].acceptedWeightQuantity,2);
assert.equal(counts[0].pendingQuantity,0);assert.equal(counts[0].progress,100);
assert.equal(order.producedQuantity,undefined,'source order stays unmodified');
rows.push(row(9));counts=ctx.withManufacturingAcceptedCounts_([order],quality);
assert.equal(counts[0].producedQuantity,2,'historic excess capped');
assert.equal(counts[0].acceptedWeightQuantity,3,'history preserved');
assert.throws(()=>ctx.recordManufacturingPieceWeight_({orderId:'OF5',actualWeight:100},'operator'),/Objetivo alcanzado/);
assert.equal(writes,0);assert.equal(locked,false);
rows=[[],row(1,'NO CONFORME')];
ctx.recordManufacturingPieceWeight_({orderId:'OF5',actualWeight:100},'operator');
ctx.recordManufacturingPieceWeight_({orderId:'OF5',actualWeight:104},'operator');
assert.equal(writes,2,'conforming and alert accepted up to objective');
assert.throws(()=>ctx.recordManufacturingPieceWeight_({orderId:'OF5',actualWeight:100},'operator'),/Objetivo alcanzado/);
assert.equal(writes,2,'later request cannot exceed objective');
ctx.recordManufacturingPieceWeight_({orderId:'OF5',actualWeight:110},'operator');
assert.equal(writes,3,'rejected weight remains traceable');
assert.equal(ctx.withManufacturingAcceptedCounts_([order],quality)[0].producedQuantity,2);
assert.equal(locked,false);
for(const name of ['getManufacturingOrdersData','getManufacturingOrderDetail','getPlantWeightOrders','getTraceabilityRecord'])
 assert(ctx[name].toString().includes('withManufacturingAcceptedCounts_'),'view wired '+name);
assert(!baseReader.includes('withManufacturingAcceptedCounts_'),'shift/stock allocation unchanged');
console.log('OK: accepted/rejected, duplicates, OF/SKU/lot isolation, historic cap, atomic save limit and all four views');
