const fs=require('fs'),vm=require('vm'),assert=require('assert');
const ctx={console:{log(){}},Set,PropertiesService:{getScriptProperties:()=>props},assertLotsWebAppAccess_:()=>{},Utilities:{sleep(){}},LockService:{getScriptLock:()=>({waitLock(){},releaseLock(){}})},migrationProductionDecimal_:v=>v==null?null:String(v),migrationProductionNumber_:v=>v==null?null:Number(String(v).replace(",","."))};
let data={},calls=[],live={},serial=0;
const props={getProperty:k=>data[k]??null,setProperty:(k,v)=>{data[k]=v;}};
ctx.holdedV2Request_=(method,path,payload)=>{calls.push({method,path}); if(method==='get')return live[path.split('/').pop()]; if(method==='delete'){delete live[path.split('/').pop()];return {}}; const id=(++serial).toString(16).padStart(24,'a');live[id]={...payload,id};return{id};};
vm.createContext(ctx);vm.runInContext(fs.readFileSync('MigrationEntretenium.gs','utf8'),ctx);
const skus=vm.runInContext('ENT_MIGRATION_SKUS',ctx);
const details=[];for(let i=0;i<20;i+=2){const id=(i+100).toString(16).padStart(24,'0');const variants=skus.slice(i,i+2).map((sku,j)=>({sku,id:id.slice(0,22)+(j+10),stock:sku==='PANEL-N'?15:sku==='PANEL-M'?-6:0,weight:10,price:'20',cost:'5',purchase_price:'3'}));details.push({id,sku:variants[0].sku,kind:'variants',tags:['ET'],variants,stock:variants.reduce((s,v)=>s+v.stock,0),stocks:variants.map(v=>({variant_id:v.id,stock:v.stock,warehouse_id:'WH'})),for_sale:true,for_purchase:true});}
function setup(ds=details){data={ENT_PREVIEW_COUNT:'1',ENT_PREVIEW_0:JSON.stringify({details:ds})};live=Object.fromEntries(ds.map(p=>[p.id,JSON.parse(JSON.stringify(p))]));calls=[];serial=0;}
setup();ctx.migrateEntreteniumToLots();let journal=JSON.parse(data.ENT_MIGRATION_JOURNAL);assert.equal(journal.created.length,20);assert.equal(journal.status,'PRODUCTS_VERIFIED');assert.equal(journal.created.find(r=>r.sku==='PANEL-M').stock,-6);assert.throws(()=>ctx.migrateEntreteniumToLots(),/diario/);
setup();live[details[9].id].variants[0].stock=99;assert.throws(()=>ctx.migrateEntreteniumToLots(),/cambiado/);assert(!calls.some(c=>c.method!=='get'));
setup();const bad=JSON.parse(JSON.stringify(details));bad[0].variants[0].sku='NOT AUTHORIZED';assert.throws(()=>ctx.entBuildPlan_({details:bad}),/autorizada/);
setup();const original=ctx.holdedV2Request_;ctx.holdedV2Request_=(m,p,b)=>{if(m==='post')throw Error('network');return original(m,p,b)};assert.throws(()=>ctx.migrateEntreteniumToLots(),/network/);journal=JSON.parse(data.ENT_MIGRATION_JOURNAL);assert.equal(journal.status,'STOPPED');assert.equal(journal.deleted.length,1);assert.throws(()=>ctx.migrateEntreteniumToLots(),/diario/);
console.log('PASS: 20 SKU, negative stock preservation, stale data, allowlist, partial failure journal, duplicate protection');

ctx.holdedV2Request_=original;setup();
const originalPost=ctx.holdedV2Request_;
let failedOnce=false;
ctx.holdedV2Request_=(m,p,b)=>{
 const result=originalPost(m,p,b);
 if(m==='get' && result && result.kind==='lots'){
   result.price=String(result.price).replace('.',',');
   if(!failedOnce){failedOnce=true;throw Error('verification interrupted');}
 }
 return result;
};
assert.throws(()=>ctx.migrateEntreteniumToLots(),/interrupted/);
ctx.resumeEntreteniumMigration();
assert.equal(JSON.parse(data.ENT_MIGRATION_JOURNAL).created.length,20);
assert.equal(calls.filter(c=>c.method==='delete').length,10);
assert.equal(calls.filter(c=>c.method==='post').length,20);
console.log('PASS: decimal-comma responses and recovery without repeated deletion or creation');
