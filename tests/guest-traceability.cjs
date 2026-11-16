const fs = require('node:fs'), vm = require('node:vm'), assert = require('node:assert/strict');
const order = (id, lot, product) => {const r=[]; r[0]=id; r[18]=lot; r[3]=product; return r;};
const production = (id, lot, units, pe, date='05/11/2026') => [date,'Turno privado',id,'SKU privado',units,99,pe,'Pigmento privado',lot];
let email = '', rows = [production('OF1','PT A',1,'PE A'), production('OF1','PT A',1,'PE A'),
  production('OF1','PT A',0,'PE RECHAZADO'), production('OF2','PT B',2,'PE B'), production('OF1','PT B',1,'PE CRUZADO')];
let orders = [order('OF1','PT A','Pieza A'),order('OF2','PT B','Pieza B')];
const sheet = get => ({getDataRange:()=>({getValues:()=>[['header'],...get()]})});
const c = vm.createContext({Set, JSON, safeStr_:v=>String(v||'').trim(), numberOrZero_:v=>Number(v)||0,
  hardwareSpreadsheet_:()=>({getSheetByName:n=>n==='Ordenes Fabricacion'?sheet(()=>orders):sheet(()=>rows)}),
  MANUFACTURING_ORDERS:{ordersSheet:'Ordenes Fabricacion',productionSheet:'Fabricaciones OF'},
  formatManufacturingOrderDate_:v=>v,
  Session:{getActiveUser:()=>({getEmail:()=>email})},
  HtmlService:{XFrameOptionsMode:{ALLOWALL:1},createTemplateFromFile:name=>({name,evaluate(){return this;},setTitle(){return this;},setXFrameOptionsMode(){return this;}})}
});
vm.runInContext(fs.readFileSync('LotsWebApp.gs','utf8'),c);
const read = ref => JSON.parse(JSON.stringify(c.readGuestTraceability_(ref)));
assert.deepEqual(read('PT A'),[{date:'05/11/2026',peLot:'PE A',ptLot:'PT A',product:'Pieza A'}]);
assert.deepEqual(read('PT B'),[{date:'05/11/2026',peLot:'PE B',ptLot:'PT B',product:'Pieza B'}]);
rows.push(production('OF1','PT A',1,'PE ULTIMO','06/11/2026'));
rows.push(production('OF1','PT A',1,'PE ANTIGUO','31/10/2026'));
rows.push(production('OF1','PT A',0,'PE RECHAZADO POSTERIOR','07/11/2026'));
assert.deepEqual(read('PT A'),[{date:'06/11/2026',peLot:'PE ULTIMO',ptLot:'PT A',product:'Pieza A'}]);
rows.push(production('OF1','PT A',1,'PE ULTIMO DEL DIA','06/11/2026'));
assert.deepEqual(read('PT A'),[{date:'06/11/2026',peLot:'PE ULTIMO DEL DIA',ptLot:'PT A',product:'Pieza A'}]);
for (const ref of ['OF1','PT','unknown','', 'x'.repeat(201)]) assert.deepEqual(read(ref),[]);
assert.equal(c.doGet({parameter:{lote:'PT A'}}).name,'GuestTraceabilityPage');
assert.equal(c.doGet({pathInfo:'lote/PT%20A',parameter:{}}).name,'GuestTraceabilityPage');
assert.equal(c.doGet({queryString:'lote/PT%20A',parameter:{}}).name,'GuestTraceabilityPage');
assert.equal(c.doGet({parameter:{'lote/PT A':''}}).name,'GuestTraceabilityPage');
assert.equal(c.traceabilityReference_({parameter:{'lote/PT A':''}}),'PT A');
assert.equal(c.traceabilityReference_({parameter:{'lote/PT%20A':''}}),'PT A');
assert.equal(c.traceabilityReference_({pathInfo:'lote/PT%20A'}),'PT A');
assert.equal(c.traceabilityReference_({pathInfo:'lote/%broken'}),'');
assert.throws(()=>c.getTraceabilityRecord?.('PT A') || c.assertLotsWebAppAccess_(),/Acceso restringido/);
assert.equal(c.doGet({parameter:{modo:'pesaje',lote:'PT A'}}).name,'PlantWeightPage');
assert.throws(()=>c.doGet({parameter:{modo:'config-qr'}}),/Acceso restringido/);
email='external@example.com'; assert.equal(c.doGet({parameter:{lote:'PT A'}}).name,'GuestTraceabilityPage');
email='mauro@rotoformas.com'; assert.equal(c.doGet({parameter:{lote:'PT A'}}).name,'LotsWebAppPage');
assert.equal(c.doGet({parameter:{modo:'config-qr'}}).name,'ShortLinksSettings');
assert.equal(c.doGet({parameter:{lote:'PT A'}}).initialTraceabilityReference,'PT A');
assert.equal(c.doGet({pathInfo:'lote/PT%20A',parameter:{}}).initialTraceabilityReference,'PT A');
orders.push(order('OF3','PT A','Ambiguo')); assert.deepEqual(read('PT A'),[]);
orders.pop(); orders[0][2]='SKU A';
const imageCache=new Map(); let imageCalls=0, imageUrl='https://cdn.example.com/pieza.jpg';
c.CacheService={getScriptCache:()=>({get:k=>imageCache.get(k)??null,put:(k,v)=>imageCache.set(k,v)})};
c.getColIndex_=(headers,pattern)=>headers.findIndex(h=>new RegExp(pattern,'i').test(h));
c.hardwareSpreadsheet_=()=>({getSheetByName:n=>n==='Ordenes Fabricacion'?sheet(()=>orders):
  {getDataRange:()=>({getValues:()=>[['SKU Holded','productId Holded','productId Padre'],['SKU A','b'.repeat(24),'a'.repeat(24)]]})}});
c.holdedV2Request_=(method,path)=>{imageCalls++;assert.equal(method,'get');assert.equal(path,'/products/'+ 'a'.repeat(24)+'/image');return {sizes:{medium:{url:imageUrl}},privateCost:999};};
assert.equal(c.readGuestProductImage_('PT A'),imageUrl);
assert.equal(c.readGuestProductImage_('PT A'),imageUrl);assert.equal(imageCalls,1);
for(const unsafe of ['javascript:alert(1)','https://user:secret@example.com/image','https://api.holded.com/private','https://example.com/" onerror="bad']){
  imageCache.clear(); imageUrl=unsafe;assert.equal(c.readGuestProductImage_('PT A'),'');
}
assert.equal(c.readGuestProductImage_('OF1'),'');
c.holdedV2Request_=()=>{throw Error('401 secret');};imageCache.clear();assert.equal(c.readGuestProductImage_('PT A'),'');
console.log('PASS: guest allowlist of four fields; accepted production only; deduplication; lot isolation; no OF lookup; ambiguous/invalid lots denied; company/guest/plant routes.');
console.log('PASS: only newest date/last same-day entry; later rejected rows excluded; Holded parent photo; image caching; unsafe URLs blocked; API failure does not disclose details.');
