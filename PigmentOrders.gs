/** Pigmento por OF. La configuración no modifica consumos ni registros anteriores. */
function getOrderPigmentOptions(orderId) {
  assertLotsWebAppAccess_();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheets = ensureManufacturingOrderSheets_(ss);
  const order = readManufacturingOrders_(sheets.orders, sheets.production).find(o => o.id === safeStr_(orderId));
  if (!order) throw new Error('No encuentro la OF.');
  const products = holdedRequest_('get', '/products');
  if (!Array.isArray(products)) throw new Error('No se pudo consultar el catálogo de pigmentos.');
  const materials = products.filter(p => !p.archived && p.kind === 'lots' && /^(PIG|PE\s)/i.test(safeStr_(p.sku))).map(p => ({
    id: safeStr_(p.id), sku: safeStr_(p.sku), name: safeStr_(p.name),
    lots: (p.lots || []).filter(l => !l.archived).map(l => ({id: safeStr_(l.id), name: safeStr_(l.sku || l.lot_number || l.name), stock: numberOrZero_(l.stock)}))
  }));
  return {order, products: materials.filter(p => /^PIG/i.test(p.sku)), peProducts: materials.filter(p => /^PE\s/i.test(p.sku))};
}

function setOrderPigment(input) {
  assertLotsWebAppAccess_();
  const id = safeStr_(input && input.orderId);
  const mode = safeStr_(input && input.mode);
  if (!['ON', 'OFF'].includes(mode)) throw new Error('Selecciona el seguimiento de pigmento.');
  const options = getOrderPigmentOptions(id);
  const pe = (options.peProducts || []).find(p => p.id === safeStr_(input.peProductId));
  const peLot = pe && pe.lots.find(l => l.id === safeStr_(input.peLotId));
  if (!pe || !peLot) throw new Error('Selecciona el PE y un lote existente en Holded.');
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const recipe = readMesRecipes_(ss)[normalizeKey_(options.order.sku)] || [];
  const peComponents = recipe.filter(c => /^PE\s/i.test(c.componentSku));
  const expectedPe = peComponents.length ? peComponents[0].componentSku :
    (readRecycledSkuList_(ss, CONFIG.productMasterSheet).has(normalizeKey_(options.order.sku)) ? 'PE RECICLADO' : /-M(\s|$)/.test(options.order.sku) ? 'PE MASA' : 'PE NATURAL');
  if (peComponents.length > 1 || normalizeKey_(pe.sku) !== normalizeKey_(expectedPe)) throw new Error('El PE seleccionado debe coincidir con el material de la receta: ' + expectedPe);
  let product = null, lot = null;
  if (mode === 'ON') {
    product = options.products.find(p => p.id === safeStr_(input.productId));
    lot = product && product.lots.find(l => l.id === safeStr_(input.lotId));
    if (!product || !lot) throw new Error('Selecciona un pigmento y un lote existente en Holded.');
    const recipe = readMesRecipes_(SpreadsheetApp.getActiveSpreadsheet())[normalizeKey_(options.order.sku)] || [];
    const pigments = recipe.filter(c => /^PIG/i.test(safeStr_(c.componentSku)));
    if (!pigments.length && options.order.sku === 'PORTATAPAS') pigments.push({componentSku:'PIG300',quantity:0.09});
    if (!pigments.length && options.order.sku === 'PORTATAPAS OVAL2000') pigments.push({componentSku:'PIG301',quantity:0.90});
    if (!pigments.length || !pigments.every(p => numberOrZero_(p.quantity) > 0)) throw new Error('Define primero el pigmento y su cantidad por pieza en la receta de esta referencia.');
    if (pigments.length > 1 || (pigments.length === 1 && normalizeKey_(pigments[0].componentSku) !== normalizeKey_(product.sku))) {
      throw new Error('El pigmento debe coincidir con la receta. Revisa la receta antes de cambiar de producto.');
    }
  }
  const lock = LockService.getDocumentLock();
  lock.waitLock(15000);
  try {
    const sheets = ensureManufacturingOrderSheets_(SpreadsheetApp.getActiveSpreadsheet());
    const values = sheets.orders.getDataRange().getValues();
    const index = values.findIndex((r,i) => i > 0 && safeStr_(r[0]) === id);
    if (index < 0) throw new Error('No encuentro la OF.');
    if (normalizeKey_(values[index][2]) !== normalizeKey_(options.order.sku)) throw new Error('La referencia de la OF ha cambiado. Vuelve a abrir su configuración.');
    if (safeStr_(values[index][7]) !== MANUFACTURING_ORDERS.openStatus) throw new Error('La OF está cerrada.');
    sheets.orders.getRange(index + 1, 20, 1, 5).setValues([[mode, product ? product.sku : '', product ? product.id : '', lot ? lot.id : '', lot ? lot.name : '']]);
    sheets.orders.getRange(index + 1, 25, 1, 4).setValues([[pe.sku, pe.id, peLot.id, peLot.name]]);
    sheets.orders.getRange(index + 1, 11).setValue(new Date());
    sheets.orders.getRange(index + 1, 13).setValue(getManufacturingOrderUser_());
    return {ok: true, orderId: id, mode};
  } finally { lock.releaseLock(); }
}

function orderPigmentSnapshot_(order, activeLots, recipePigmentSku) {
  if (order.pigmentMode === 'OFF') return {mode: 'OFF', sku: '', productId: '', lotId: '', name: ''};
  if (order.pigmentMode === 'ON') {
    if (!order.pigmentSku || !order.pigmentLotId || !order.pigmentLotName) throw new Error('Configura el lote de pigmento de ' + order.id);
    if (recipePigmentSku && normalizeKey_(recipePigmentSku) !== normalizeKey_(order.pigmentSku)) throw new Error('El pigmento de la receta no coincide con la OF ' + order.id);
    return {mode:'ON', sku:order.pigmentSku, productId:order.pigmentProductId, lotId:order.pigmentLotId, name:order.pigmentLotName};
  }
  throw new Error('Configura las materias primas de ' + order.id + ' antes de fabricar.');
}

function orderPeSnapshot_(order, materialSku) {
  if (!order.peSku || !order.peLotId || !order.peLotName) throw new Error('Selecciona el lote de PE de ' + order.id + ' antes de fabricar.');
  if (!materialSku || normalizeKey_(materialSku) !== normalizeKey_(order.peSku)) throw new Error('El PE de la receta no coincide con la OF ' + order.id);
  return {sku:order.peSku, productId:order.peProductId, lotId:order.peLotId, name:order.peLotName};
}
