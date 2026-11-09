/** Una OF contiene una fila por SKU. La pareja OF/SKU es la identidad de línea. */
function manufacturingLineKey_(id, sku) {
  return JSON.stringify([safeStr_(id), normalizeKey_(sku)]);
}

function selectManufacturingOrderLine_(orders, orderId, sku) {
  const matches = orders.filter(o => o.id === safeStr_(orderId) &&
    (!safeStr_(sku) || normalizeKey_(o.sku) === normalizeKey_(sku)));
  if (!matches.length) throw new Error('No encuentro esa pieza en la OF ' + safeStr_(orderId) + '.');
  if (matches.length !== 1) throw new Error('Selecciona el modelo de pieza de la OF ' + safeStr_(orderId) + '.');
  return matches[0];
}

function groupManufacturingOrders_(lines) {
  const groups = new Map();
  lines.forEach(line => {
    if (!groups.has(line.id)) groups.set(line.id, {
      id:line.id, client:line.client, salesOrderNumber:line.salesOrderNumber,
      reference:line.reference || '', targetDateDisplay:line.targetDateDisplay,
      status:line.status, lines:[], targetQuantity:0, producedQuantity:0
    });
    const group = groups.get(line.id);
    group.lines.push(line);
    group.targetQuantity += line.targetQuantity;
    group.producedQuantity += line.producedQuantity;
    if (line.status === MANUFACTURING_ORDERS.openStatus) group.status = line.status;
  });
  return Array.from(groups.values());
}

/** Agrupa las líneas comerciales por SKU, conservando todas sus referencias de origen. */
function buildSalesOrderManufacturingLines_(detail, catalog) {
  const bySku = new Map(catalog.map(p => [normalizeKey_(p.sku), p]));
  const groups = new Map();
  (Array.isArray(detail.products) ? detail.products : []).forEach((line, index) => {
    const product = bySku.get(normalizeKey_(line.sku));
    if (!product) return;
    const quantity = Number(line.units);
    if (!Number.isFinite(quantity) || quantity <= 0) return;
    const key = normalizeKey_(product.sku);
    if (!groups.has(key)) groups.set(key, {
      sku:product.sku, product:product.product || safeStr_(line.name), quantity:0,
      salesOrderLineIds:[], descriptions:[]
    });
    const group = groups.get(key);
    group.quantity += quantity;
    group.salesOrderLineIds.push(safeStr_(line.line_id) || safeStr_(detail.id) + ':' + index);
    const description = safeStr_(line.desc);
    if (description) group.descriptions.push(quantity + ' uds · ' + description);
  });
  return Array.from(groups.values()).map(g => Object.assign(g, {description:g.descriptions.join(' / ')}));
}

function salesOrderManufacturingFingerprint_(lines) {
  return JSON.stringify(lines.map(line => [normalizeKey_(line.sku), line.quantity,
    line.salesOrderLineIds.slice().sort(), line.description || ''])
    .sort((a,b) => a[0].localeCompare(b[0])));
}

function salesOrderExcludedLines_(detail, catalog) {
  const available = new Set(catalog.map(p=>normalizeKey_(p.sku)));
  return (Array.isArray(detail.products) ? detail.products : [])
    .filter(line=>Number(line.units)>0 && !available.has(normalizeKey_(line.sku)))
    .map(line=>({sku:safeStr_(line.sku),product:safeStr_(line.name),quantity:Number(line.units)}));
}

/** Crea todas las referencias de un pedido con una única numeración de OF. */
function createManufacturingOrderFromSalesOrder(input) {
  assertLotsWebAppAccess_();
  const data = input || {};
  const salesOrderId = safeStr_(data.salesOrderId);
  if (!salesOrderId) throw new Error('Selecciona un pedido de venta.');
  const detail = holdedRequest_('get', '/documents/salesorder/' + encodeURIComponent(salesOrderId));
  if (!detail || safeStr_(detail.id) !== salesOrderId || Number(detail.status) !== 0) {
    throw new Error('El pedido ya no está pendiente en Holded. Actualiza la lista.');
  }
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheets = ensureManufacturingOrderSheets_(ss);
  const lines = buildSalesOrderManufacturingLines_(detail, readManufacturingOrderCatalog_(ss));
  if (!lines.length) throw new Error('El pedido no contiene productos disponibles para fabricar con gestión por lotes.');
  if (!data.fingerprint || data.fingerprint !== salesOrderManufacturingFingerprint_(lines)) {
    throw new Error('Las piezas del pedido han cambiado. Actualiza los pedidos y revisa la OF antes de crearla.');
  }
  const reference = safeStr_(data.reference).slice(0,160);
  const validated = lines.map(line => validateManufacturingOrderInput_({
    client:safeStr_(detail.contactName), clientId:safeStr_(detail.contact),
    sku:line.sku, product:line.product, targetQuantity:line.quantity,
    color:'', targetDate:safeStr_(data.targetDate), status:MANUFACTURING_ORDERS.openStatus,
    notes:[line.description,safeStr_(data.notes)].filter(Boolean).join(' · '),
    salesOrderNumber:safeStr_(detail.docNumber), salesOrderId,
    salesOrderLineId:line.salesOrderLineIds[0], salesOrderQuantity:line.quantity
  }));
  const lock = LockService.getDocumentLock();
  let id;
  lock.waitLock(15000);
  try {
    const existing = sheets.orders.getDataRange().getValues().slice(1);
    if (existing.some(row => safeStr_(row[15]) === salesOrderId)) {
      throw new Error('Este pedido ya tiene una OF. Actualiza la lista; no se ha creado otra.');
    }
    const imported = readImportedSalesOrderLineIds_(sheets.orders);
    if (lines.some(line => line.salesOrderLineIds.some(lineId => imported.has(lineId)))) {
      throw new Error('Alguna línea ya tiene OF. Revisa la planificación existente antes de agrupar el pedido.');
    }
    const now = new Date(), user = getManufacturingOrderUser_();
    id = nextManufacturingOrderId_(sheets.orders, now.getFullYear());
    const rows = validated.map((line,index) => [
      id,line.client,line.sku,line.product,line.targetQuantity,line.color,line.targetDate || '',
      line.status,line.notes,now,now,user,user,line.clientId,line.salesOrderNumber,
      salesOrderId,line.salesOrderLineId,line.salesOrderQuantity,
      buildFinishedProductLotName_(line.sku,line.targetDate || now,id),
      'OFF','','','','','','','','',reference,
      JSON.stringify(lines[index].salesOrderLineIds),'PENDIENTE',''
    ]);
    // Una única escritura de filas después de validar todo; reintentos no duplican OF.
    sheets.orders.getRange(sheets.orders.getLastRow()+1,1,rows.length,rows[0].length).setValues(rows);
  } finally { lock.releaseLock(); }
  const lots = lines.map(line => {
    try {
      const result = ensureManufacturingOrderFinishedLot(id,line.sku);
      return {sku:line.sku,ok:true,finishedLot:result.finishedLot};
    } catch (error) {
      return {sku:line.sku,ok:false,error:error.message || String(error)};
    }
  });
  return {ok:true,id,lineCount:lines.length,lotCreated:lots.every(l=>l.ok),lots};
}

function setManufacturingLotState_(orderId, sku, state, detail) {
  const lock = LockService.getDocumentLock();
  lock.waitLock(15000);
  try {
    const sheets = ensureManufacturingOrderSheets_(SpreadsheetApp.getActiveSpreadsheet());
    const rows = sheets.orders.getDataRange().getValues();
    const indices = rows.map((r,i)=>i).filter(i=>i>0 && safeStr_(rows[i][0])===safeStr_(orderId) &&
      normalizeKey_(rows[i][2])===normalizeKey_(sku));
    if (indices.length !== 1) throw new Error('No encuentro una línea única para guardar el estado del lote.');
    sheets.orders.getRange(indices[0]+1,31,1,2).setValues([[state,safeStr_(detail).slice(0,500)]]);
  } finally { lock.releaseLock(); }
}
