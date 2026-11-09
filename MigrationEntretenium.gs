/** Migración acotada a los 20 SKU autorizados de Entretenium. */
const ENT_MIGRATION_SKUS = ['BOCA SALIDA','CODO 30','CODO 90','PANEL','TOBOGAN ENT',
  'TOBOGAN INF','TOBOGAN SAL','TOBOGAN SUP','TRAMO R','TUBO T']
  .reduce((all, base) => all.concat([base+'-N',base+'-M']), []);

/** Solo GET en Holded; guarda una copia privada en propiedades del proyecto. */
function previewMigrationEntretenium() {
  assertLotsWebAppAccess_();
  if (PropertiesService.getScriptProperties().getProperty('ENT_MIGRATION_JOURNAL'))
    throw new Error('Existe un registro de ejecución. No sobrescribir la copia previa.');
  const norm = v => String(v || '').trim().replace(/\s+/g,' ').toUpperCase();
  const catalog = holdedRequest_('get','/products');
  if (!Array.isArray(catalog)) throw new Error('Catálogo no válido');
  const parents = catalog.filter(p => ENT_MIGRATION_SKUS.includes(norm(p.sku)) ||
    (p.variants || []).some(v => ENT_MIGRATION_SKUS.includes(norm(v.sku))));
  const details = parents.map(p => holdedV2Request_('get','/products/'+encodeURIComponent(p.id)));
  const rows = [];
  details.forEach(p => {
    const variants = p.kind === 'variants' ? p.variants || [] : [p];
    variants.forEach(v => {
      if (!ENT_MIGRATION_SKUS.includes(norm(v.sku))) return;
      rows.push({sku:v.sku,parentId:p.id,id:v.id,kind:p.kind,stock:v.stock,
        weight:v.weight == null ? p.weight : v.weight,
        stocks:(p.stocks||[]).filter(s => p.kind !== 'variants' || s.variant_id === v.id),
        special:{rates:p.rates,attributes:p.attributes,pack_items:p.pack_items,
          sales_rates:v.sales_rates,options:v.options,category_fields:v.category_fields,
          factory_code:v.factory_code,archived:v.archived},
        tags:p.tags,taxes:p.taxes,purchase_taxes:p.purchase_taxes});
    });
  });
  ENT_MIGRATION_SKUS.forEach(sku => {
    if (rows.filter(r => norm(r.sku) === sku).length !== 1)
      throw new Error('No hay una coincidencia única para '+sku);
  });
  const orders = holdedRequest_('get','/documents/salesorder?sort=created-desc');
  const selected = orders.filter(o => String(o.docNumber || o.number || '') === 'SO260208');
  const orderDetails = selected.map(o => holdedRequest_('get','/documents/salesorder/'+o.id));
  const snapshot = {createdAt:new Date().toISOString(),details,rows,orderDetails};
  const raw = JSON.stringify(snapshot), props = PropertiesService.getScriptProperties();
  const count = Math.ceil(raw.length/1500);
  for (let i=0; i<count; i++) props.setProperty('ENT_PREVIEW_'+i,raw.slice(i*1500,(i+1)*1500));
  props.setProperty('ENT_PREVIEW_COUNT',String(count));
  console.log('COPIA PRIVADA GUARDADA: '+count+' fragmentos.');
  rows.forEach(r => console.log(JSON.stringify(r)));
  console.log('PEDIDOS: '+JSON.stringify(orderDetails.map(o => ({id:o.id,docNumber:o.docNumber,products:o.products}))));
  console.log('SOLO LECTURA HOLDED. '+rows.length+' SKU comprobados; '+details.length+' productos/familias.');
  return rows;
}

function entReadPreview_() {
  const props = PropertiesService.getScriptProperties();
  const count = Number(props.getProperty('ENT_PREVIEW_COUNT'));
  if (!Number.isInteger(count) || count < 1 || count > 200) throw new Error('Falta copia previa válida');
  let raw = '';
  for (let i=0; i<count; i++) {
    const part = props.getProperty('ENT_PREVIEW_'+i);
    if (part === null) throw new Error('Copia previa incompleta');
    raw += part;
  }
  return JSON.parse(raw);
}

/** Diagnóstico de recuperación: únicamente GET, sin repetir operaciones. */
function inspectEntreteniumMigration() {
  assertLotsWebAppAccess_();
  const raw = PropertiesService.getScriptProperties().getProperty('ENT_MIGRATION_JOURNAL');
  if (!raw) throw new Error('No existe diario');
  const journal = JSON.parse(raw);
  console.log('DIARIO '+JSON.stringify(journal));
  const plan = entBuildPlan_(entReadPreview_());
  journal.created.forEach(r => {
    const item = plan.flatMap(f => f.items).find(i => i.sku === r.sku);
    const actual = holdedV2Request_('get','/products/'+r.id);
    console.log('COMPARACION '+JSON.stringify({sku:r.sku,expected:item.payload,actual}));
  });
}

function entBuildPlan_(snapshot) {
  const norm = v => String(v || '').trim().replace(/\s+/g,' ').toUpperCase();
  if (!snapshot || !Array.isArray(snapshot.details) || snapshot.details.length !== 10)
    throw new Error('Se requieren las diez familias revisadas');
  const seen = new Set();
  const families = snapshot.details.map(p => {
    if (!/^[a-f0-9]{24}$/i.test(p.id) || p.kind !== 'variants' || p.variants.length !== 2 ||
      !(p.tags || []).some(t => norm(t) === 'ET')) throw new Error('Familia no válida '+p.sku);
    ['rates','attributes','pack_items'].forEach(k => {
      if ((p[k] || []).length) throw new Error('Campo no soportado '+p.sku+': '+k);
    });
    const items = p.variants.map(v => {
      const sku = norm(v.sku), stock = Number(v.stock);
      if (!ENT_MIGRATION_SKUS.includes(sku) || seen.has(sku) || !Number.isFinite(stock))
        throw new Error('Variante no autorizada o duplicada '+sku);
      seen.add(sku);
      if (v.archived || v.factory_code || (v.options||[]).length || (v.sales_rates||[]).length)
        throw new Error('Campos especiales no soportados '+sku);
      const fields = v.category_fields || [];
      if (fields.some(f => norm(f.name) !== 'TIPO DE PLASTICO' ||
        norm(f.value) !== (/-N$/.test(sku) ? 'NATURAL' : 'MASA')))
        throw new Error('Campo de categoría inesperado '+sku);
      const stocks = (p.stocks||[]).filter(s => String(s.variant_id) === String(v.id));
      if (stocks.length > 1 || (stock !== 0 && stocks.length !== 1) ||
        stocks.some(s => Number(s.stock) !== stock || !s.warehouse_id))
        throw new Error('Distribución de almacenes no soportada '+sku);
      const payload = {
        name:sku,kind:'lots',sku,description:v.description == null ? p.description : v.description,
        barcode:v.barcode || null,price:migrationProductionDecimal_(v.price),
        cost:migrationProductionDecimal_(v.cost),purchase_price:migrationProductionDecimal_(v.purchase_price),
        tags:p.tags,taxes:p.taxes,stock,weight:migrationProductionNumber_(v.weight == null ? p.weight : v.weight),
        has_stock:true,for_sale:p.for_sale,for_purchase:p.for_purchase,
        show_start_date:false,show_end_date:false,
        warehouse_id:(stocks[0] && stocks[0].warehouse_id) || p.warehouse_id || null,
        sales_channel_id:p.sales_channel_id,exp_account_id:p.exp_account_id
      };
      return {sourceId:v.id,sku,stock,payload};
    });
    if (Number(p.stock) !== items.reduce((sum,i)=>sum+i.stock,0)) throw new Error('Stock total incoherente '+p.sku);
    return {source:p,items};
  });
  if (seen.size !== 20) throw new Error('Deben ser exactamente 20 SKU');
  return families;
}

/** Comprueba todos los datos actuales sin modificar Holded. */
function validateMigrationEntretenium() {
  assertLotsWebAppAccess_();
  const plan = entBuildPlan_(entReadPreview_());
  plan.forEach(f => {
    const live = holdedV2Request_('get','/products/'+f.source.id);
    if (JSON.stringify(live) !== JSON.stringify(f.source))
      throw new Error('El producto ha cambiado desde la copia: '+f.source.sku);
  });
  console.log('VALIDADO: 10 familias y 20 SKU. Borrado y recreación pendientes de ejecución.');
  console.log('Se preservan SKU, precios, costes, peso, etiquetas y stock. Revisar manualmente imágenes, IVA de compra y campos de categoría.');
  return plan;
}

/**
 * DESTRUCTIVO: elimina las diez familias y crea veinte productos con lotes.
 * Ejecutar solo tras revisar la copia y confirmar este borrado irreversible.
 * No repetir tras un fallo: el diario conserva cada ID devuelto para recuperación.
 */
function migrateEntreteniumToLots() {
  assertLotsWebAppAccess_();
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const props = PropertiesService.getScriptProperties();
    if (props.getProperty('ENT_MIGRATION_JOURNAL')) throw new Error('Ya existe diario: revisar antes de reintentar');
    const plan = validateMigrationEntretenium();
    const journal = {startedAt:new Date().toISOString(),status:'RUNNING',deleted:[],created:[]};
    entExecuteJournal_(plan,journal,props);
  } finally { lock.releaseLock(); }
}

function entExecuteJournal_(plan,journal,props) {
    const save = () => props.setProperty('ENT_MIGRATION_JOURNAL',JSON.stringify(journal));
    save();
    try {
      plan.forEach(f => {
        if (!journal.deleted.includes(f.source.id)) {
        journal.pending = {operation:'DELETE',id:f.source.id}; save();
        holdedV2Request_('delete','/products/'+f.source.id);
        journal.deleted.push(f.source.id); save();
        }
        f.items.forEach(item => {
          let record = journal.created.find(r=>r.sku===item.sku);
          if (!record) {
          journal.pending = {operation:'CREATE',sku:item.sku}; save();
          const created = holdedV2Request_('post','/products',item.payload);
          if (!created || !/^[a-f0-9]{24}$/i.test(created.id)) throw new Error('Alta sin ID: '+item.sku);
          record = {sku:item.sku,sourceId:item.sourceId,parentId:f.source.id,id:created.id,stock:item.stock,verified:false};
          journal.created.push(record); save();
          }
          const v = holdedV2Request_('get','/products/'+record.id);
          if (v.kind !== 'lots' || v.sku !== item.sku || migrationProductionNumber_(v.stock) !== item.stock ||
            migrationProductionNumber_(v.weight) !== Number(item.payload.weight)) throw new Error('Verificación incorrecta: '+item.sku);
          ['price','cost','purchase_price'].forEach(k => {
            if (item.payload[k] != null && migrationProductionNumber_(v[k]) !== Number(item.payload[k]))
              throw new Error('Valor distinto '+item.sku+' '+k);
          });
          record.verified = true; journal.pending = null; save();
          console.log('VERIFICADO '+JSON.stringify(record));
          Utilities.sleep(300);
        });
      });
      journal.status = 'PRODUCTS_VERIFIED'; journal.completedAt = new Date().toISOString(); save();
      console.log('20 productos migrados. Pendiente refrescar catálogo y comprobar pedidos por SKU.');
    } catch (e) {
      journal.status = 'STOPPED'; journal.error = String(e.message); save(); throw e;
    }
}

/** Reanuda únicamente operaciones confirmadas en el diario, dentro del alcance autorizado. */
function resumeEntreteniumMigration() {
  assertLotsWebAppAccess_();
  const lock=LockService.getScriptLock();lock.waitLock(30000);
  try {
    const props=PropertiesService.getScriptProperties();
    const journal=JSON.parse(props.getProperty('ENT_MIGRATION_JOURNAL')||'null');
    if (!journal || journal.status !== 'STOPPED') throw new Error('No existe una ejecución detenida');
    const pending=journal.pending;
    if (pending && !(pending.operation==='CREATE' && journal.created.some(r=>r.sku===pending.sku && r.id)))
      throw new Error('Operación de resultado ambiguo; inspección manual necesaria');
    const plan=entBuildPlan_(entReadPreview_());
    plan.forEach(f=>{
      if (!journal.deleted.includes(f.source.id)) {
        const live=holdedV2Request_('get','/products/'+f.source.id);
        if(JSON.stringify(live)!==JSON.stringify(f.source)) throw new Error('Familia modificada '+f.source.sku);
      }
    });
    journal.status='RUNNING';journal.error=null;
    entExecuteJournal_(plan,journal,props);
  } finally {lock.releaseLock();}
}

/** Verifica los saldos finales y refresca el catálogo del MES; no mueve stock. */
function finishEntreteniumMigration() {
  assertLotsWebAppAccess_();
  const props=PropertiesService.getScriptProperties();
  const journal=JSON.parse(props.getProperty('ENT_MIGRATION_JOURNAL')||'null');
  if (!journal || journal.status !== 'PRODUCTS_VERIFIED' || journal.created.length !== 20)
    throw new Error('La migración de productos no está completa');
  const snapshot=entReadPreview_();
  const plan=entBuildPlan_(snapshot).flatMap(f=>f.items);
  journal.created.forEach(r=>{
    const p=holdedV2Request_('get','/products/'+r.id);
    const expected=plan.find(i=>i.sku===r.sku);
    const lotStock=(p.variants||[]).reduce((sum,v)=>sum+migrationProductionNumber_(v.stock),0);
    if(p.sku!==r.sku || p.kind!=='lots' || migrationProductionNumber_(p.stock)!==r.stock || lotStock!==r.stock)
      throw new Error('Saldo de producto/lote distinto '+r.sku);
    if(expected.payload.warehouse_id && r.stock!==0 && !(p.stocks||[]).some(s=>
      s.warehouse_id===expected.payload.warehouse_id && migrationProductionNumber_(s.stock)===r.stock))
      throw new Error('Almacén distinto '+r.sku);
    console.log('SALDO FINAL '+JSON.stringify({sku:p.sku,id:p.id,stock:p.stock,lotes:p.variants}));
  });
  snapshot.orderDetails.forEach(old=>{
    const current=holdedRequest_('get','/documents/salesorder/'+old.id);
    const content=order=>(order.products||[]).map(l=>[l.sku,l.units,l.price,l.desc]);
    if(JSON.stringify(content(old))!==JSON.stringify(content(current))) throw new Error('Cambió contenido del pedido '+old.docNumber);
    console.log('PEDIDO CONSERVADO '+old.docNumber+'; referencias '+JSON.stringify(current.products.map(l=>({sku:l.sku,productId:l.productId,variantId:l.variantId}))));
  });
  syncHoldedProducts();
  journal.catalogRefreshedAt=new Date().toISOString();
  props.setProperty('ENT_MIGRATION_JOURNAL',JSON.stringify(journal));
  console.log('VERIFICACION FINAL CORRECTA: 20 productos/lotes y almacenes, pedido conservado, catálogo sincronizado.');
}
