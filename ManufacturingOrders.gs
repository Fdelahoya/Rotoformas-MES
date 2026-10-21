const MANUFACTURING_ORDERS = {
  ordersSheet: "Ordenes Fabricacion",
  productionSheet: "Fabricaciones OF",
  qualitySheet: "Pesajes calidad",
  openStatus: "ABIERTA",
  closedStatus: "CERRADA",
  weightWarningPercent: 3,
  weightRejectPercent: 6,
  premiumClients: [
    { key: "MO", tag: "MO", contactTerms: ["MOSES"] },
    { key: "TY", tag: "TY", contactTerms: ["TEYME"] },
    { key: "MH", tag: "MH", contactTerms: ["MANN HUMMEL"] },
    { key: "TC", tag: "TC", contactTerms: ["TECNOSPRA"] },
    { key: "SL", tag: "SL", contactTerms: ["SOLA"] },
    { key: "STK", tag: "STK", contactTerms: ["SOLTEKA"] }
  ]
};

/** Consulta temporal de solo lectura para validar pedidos de venta de Tecnospra. */
function previewTecnospraSalesOrders() {
  const documents = holdedRequest_("get", "/documents/salesorder?sort=created-desc");
  if (!Array.isArray(documents)) {
    throw new Error("Holded no devolvió una lista válida de pedidos de venta.");
  }
  const normalize = value => safeStr_(value)
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
  const result = documents
    .filter(doc => normalize([
      doc && doc.contactName,
      doc && doc.contactCode,
      doc && doc.desc,
      doc && doc.notes
    ].join(" ")).includes("TECNOSPRA"))
    .slice(0, 10)
    .map(doc => ({
      id: safeStr_(doc.id),
      number: safeStr_(doc.docNumber || doc.invoiceNum || doc.number),
      contactId: safeStr_(doc.contactId),
      contactName: safeStr_(doc.contactName),
      date: doc.date || "",
      dueDate: doc.dueDate || "",
      status: safeStr_(doc.status),
      approved: doc.approveDoc === true || doc.approved === true,
      items: Array.isArray(doc.items) ? doc.items.map(item => ({
        productId: safeStr_(item.productId),
        sku: safeStr_(item.sku),
        name: safeStr_(item.name || item.desc),
        units: numberOrZero_(item.units || item.quantity),
        kind: safeStr_(item.kind),
        lotSku: safeStr_(item.lotSku)
      })) : []
    }));
  console.log("TECNOSPRA_SALES_ORDERS " + JSON.stringify(result));
  return result;
}

/** Lee el detalle de los dos pedidos más recientes encontrados en el preview. */
function previewTecnospraSalesOrderDetails() {
  const orders = previewTecnospraSalesOrders().slice(0, 2);
  const details = orders.map(order =>
    holdedRequest_("get", "/documents/salesorder/" + encodeURIComponent(order.id))
  );
  console.log("TECNOSPRA_SALES_ORDER_DETAILS " + JSON.stringify(details));
  return details;
}

function getManufacturingOrdersData() {
  assertLotsWebAppAccess_();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheets = ensureManufacturingOrderSheets_(ss);
  const orders = readManufacturingOrders_(sheets.orders, sheets.production);
  return {
    generatedAt: formatLotsDate_(new Date()),
    orders,
    clients: readPremiumManufacturingClients_(),
    catalog: readManufacturingOrderCatalog_(ss),
    summary: {
      open: orders.filter(order => order.status === MANUFACTURING_ORDERS.openStatus).length,
      closed: orders.filter(order => order.status === MANUFACTURING_ORDERS.closedStatus).length,
      total: orders.length
    }
  };
}

/** Preview de solo lectura para la primera OF de OX. No envía ningún PUT. */
function previewOxDisairFinishedLot() {
  return previewFinishedProductLotCreation_("OF-2026-0002");
}

/** Crea en Holded el lote terminado de la primera OF de OX y lo verifica. */
function createOxDisairFinishedLot() {
  return createFinishedProductLot_("OF-2026-0002");
}

/** Reintento seguro para cualquier OF ya creada; nunca duplica el lote. */
function ensureManufacturingOrderFinishedLot(orderId) {
  assertLotsWebAppAccess_();
  return createFinishedProductLot_(orderId);
}

function createFinishedProductLot_(orderId) {
  const preview = previewFinishedProductLotCreation_(orderId);
  if (preview.action === "NO_CAMBIAR") return preview;

  const updated = holdedV2Request_("put", "/products/" + encodeURIComponent(preview.productId), preview.payload);
  let verifiedLot = null;
  for (let attempt = 1; attempt <= 4 && !verifiedLot; attempt++) {
    if (attempt > 1) Utilities.sleep(800);
    const product = holdedV2Request_("get", "/products/" + encodeURIComponent(preview.productId));
    verifiedLot = (Array.isArray(product.variants) ? product.variants : []).find(variant =>
      normalizeKey_(variant && variant.lot_number) === normalizeKey_(preview.finishedLot) ||
      normalizeKey_(variant && variant.sku) === normalizeKey_(preview.finishedLot)
    ) || null;
  }
  if (!verifiedLot) {
    throw new Error("Holded aceptó la actualización, pero no devuelve el lote " + preview.finishedLot + ".");
  }

  const result = {
    ok: true,
    action: "LOTE_CREADO",
    orderId: preview.orderId,
    salesOrderNumber: preview.salesOrderNumber,
    productId: preview.productId,
    finishedLot: preview.finishedLot,
    lot: verifiedLot,
    updateResponse: updated
  };
  console.log("FINISHED_LOT_CREATED " + JSON.stringify(result));
  return result;
}

/**
 * Construye el reemplazo completo exigido por PUT /api/v2/products/{id} para
 * añadir el lote terminado de una OF. Solo consulta y registra el borrador.
 */
function previewFinishedProductLotCreation_(orderId) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheets = ensureManufacturingOrderSheets_(ss);
  const order = readManufacturingOrders_(sheets.orders, sheets.production)
    .find(item => item.id === safeStr_(orderId));
  if (!order) throw new Error("No encuentro la OF " + safeStr_(orderId) + ".");
  if (!order.finishedLot) throw new Error("La OF no tiene lote terminado propuesto.");

  const v1Products = holdedRequest_("get", "/products");
  const productMatches = (Array.isArray(v1Products) ? v1Products : []).filter(product =>
    product && normalizeKey_(product.sku) === normalizeKey_(order.sku)
  );
  if (productMatches.length !== 1) {
    throw new Error("Se esperaba un único producto Holded para " + order.sku +
      "; encontrados: " + productMatches.length + ".");
  }
  const catalogProduct = productMatches[0];
  if (normalizeKey_(catalogProduct.kind) !== "lots") {
    throw new Error(order.sku + " no está configurado con gestión por lotes.");
  }

  const source = holdedV2Request_("get", "/products/" + encodeURIComponent(catalogProduct.id));
  const existingVariants = Array.isArray(source.variants) ? source.variants : [];
  const lotKey = normalizeKey_(order.finishedLot);
  const duplicate = existingVariants.find(variant =>
    normalizeKey_(variant && variant.lot_number) === lotKey ||
    normalizeKey_(variant && variant.sku) === lotKey
  );
  if (duplicate) {
    return {
      ok: true,
      action: "NO_CAMBIAR",
      reason: "El lote ya existe en Holded.",
      orderId: order.id,
      finishedLot: order.finishedLot,
      productId: source.id,
      existingLot: duplicate
    };
  }

  const date = order.targetDate instanceof Date ? order.targetDate : new Date(order.targetDate);
  const startDate = isNaN(date.getTime())
    ? Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd")
    : Utilities.formatDate(date, Session.getScriptTimeZone(), "yyyy-MM-dd");
  const newLot = {
    sku: order.finishedLot,
    barcode: null,
    price: source.price,
    cost: source.cost,
    purchase_price: source.purchase_price,
    stock: 0,
    description: order.id + (order.salesOrderNumber ? " · Pedido " + order.salesOrderNumber : ""),
    weight: source.weight,
    factory_code: null,
    archived: false,
    lot_number: order.finishedLot,
    start_date: startDate,
    end_date: null
  };
  const payload = {
    name: source.name,
    description: source.description,
    sku: source.sku,
    barcode: source.barcode,
    price: source.price,
    cost: source.cost,
    purchase_price: source.purchase_price,
    weight: source.weight,
    tags: Array.isArray(source.tags) ? source.tags : [],
    taxes: Array.isArray(source.taxes) ? source.taxes : [],
    for_sale: Boolean(source.for_sale),
    for_purchase: Boolean(source.for_purchase),
    archived: Boolean(source.archived),
    variants: existingVariants.concat([newLot]),
    pack_items: Array.isArray(source.pack_items) ? source.pack_items : [],
    show_start_date: Boolean(source.show_start_date),
    show_end_date: Boolean(source.show_end_date),
    warehouse_id: source.warehouse_id || null,
    sales_channel_id: source.sales_channel_id || null,
    exp_account_id: source.exp_account_id || null
  };
  const result = {
    ok: true,
    action: "PREVIEW_PUT_NO_ENVIADO",
    endpoint: "/api/v2/products/" + source.id,
    orderId: order.id,
    salesOrderNumber: order.salesOrderNumber,
    finishedLot: order.finishedLot,
    productId: source.id,
    existingLots: existingVariants,
    newLot,
    payload
  };
  console.log("FINISHED_LOT_PREVIEW_NO_ENVIADO " + JSON.stringify(result));
  return result;
}

function getPremiumSalesOrderProposals() {
  assertLotsWebAppAccess_();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheets = ensureManufacturingOrderSheets_(ss);
  const existingLineIds = readImportedSalesOrderLineIds_(sheets.orders);
  const catalog = readManufacturingOrderCatalog_(ss);
  const catalogBySku = {};
  catalog.forEach(item => { catalogBySku[normalizeKey_(item.sku)] = item; });

  const documents = holdedRequest_("get", "/documents/salesorder?sort=created-desc");
  if (!Array.isArray(documents)) throw new Error("Holded no devolvió una lista válida de pedidos de venta.");

  // La trazabilidad depende del producto, no del cliente: cualquier pedido
  // pendiente con un producto terminado activo y gestionado por lotes puede
  // originar una OF.
  const candidates = documents
    .filter(doc => {
      if (Number(doc && doc.status) !== 0) return false;
      const summaryLines = Array.isArray(doc && doc.items)
        ? doc.items
        : (Array.isArray(doc && doc.products) ? doc.products : []);
      // Algunas respuestas antiguas de Holded no incluyen líneas en el
      // listado. En ese caso conservamos el pedido y lo validamos al leer
      // su detalle.
      if (!summaryLines.length) return true;
      return summaryLines.some(line => catalogBySku[normalizeKey_(line && line.sku)]);
    })
    .slice(0, 50);

  const proposals = [];
  candidates.forEach(summary => {
    const detail = holdedRequest_("get", "/documents/salesorder/" + encodeURIComponent(summary.id));
    const products = Array.isArray(detail && detail.products) ? detail.products : [];
    products.forEach((line, index) => {
      const lineId = safeStr_(line.line_id) || `${safeStr_(detail.id)}:${index}`;
      const sku = safeStr_(line.sku);
      const catalogItem = catalogBySku[normalizeKey_(sku)] || null;
      if (!catalogItem || existingLineIds.has(lineId)) return;
      proposals.push({
        salesOrderId: safeStr_(detail.id),
        salesOrderNumber: safeStr_(detail.docNumber || summary.docNumber),
        salesOrderLineId: lineId,
        clientId: safeStr_(detail.contact),
        client: safeStr_(detail.contactName),
        sku,
        product: safeStr_(line.name || catalogItem.product),
        quantity: numberOrZero_(line.units),
        orderDate: formatManufacturingOrderEpochDate_(detail.date),
        orderDateDisplay: formatManufacturingOrderEpochDate_(detail.date, "dd/MM/yyyy"),
        requestedDate: detail.forecastDate || detail.deliverydate
          ? formatManufacturingOrderEpochDate_(detail.forecastDate || detail.deliverydate)
          : "",
        requestedDateDisplay: detail.forecastDate || detail.deliverydate
          ? formatManufacturingOrderEpochDate_(detail.forecastDate || detail.deliverydate, "dd/MM/yyyy")
          : "",
        description: safeStr_(line.desc)
      });
    });
  });
  return {
    generatedAt: formatLotsDate_(new Date()),
    clients: readPremiumManufacturingClients_(),
    catalog,
    proposals: proposals.sort((a, b) => b.salesOrderNumber.localeCompare(a.salesOrderNumber))
  };
}

function createManufacturingOrderFromSalesOrderLine(input) {
  assertLotsWebAppAccess_();
  const value = input || {};
  const salesOrderId = safeStr_(value.salesOrderId);
  const salesOrderLineId = safeStr_(value.salesOrderLineId);
  if (!salesOrderId || !salesOrderLineId) throw new Error("Falta identificar el pedido o su línea.");

  const detail = holdedRequest_("get", "/documents/salesorder/" + encodeURIComponent(salesOrderId));
  if (!detail || Number(detail.status) !== 0) throw new Error("El pedido ya no está pendiente en Holded.");
  const products = Array.isArray(detail.products) ? detail.products : [];
  const line = products.find((item, index) =>
    (safeStr_(item.line_id) || `${salesOrderId}:${index}`) === salesOrderLineId
  );
  if (!line) throw new Error("La línea ya no existe en el pedido de Holded.");

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheets = ensureManufacturingOrderSheets_(ss);
  if (readImportedSalesOrderLineIds_(sheets.orders).has(salesOrderLineId)) {
    throw new Error("Esta línea del pedido ya tiene una OF creada.");
  }
  const catalogItem = readManufacturingOrderCatalog_(ss)
    .find(item => normalizeKey_(item.sku) === normalizeKey_(line.sku));
  if (!catalogItem) throw new Error("El producto no está disponible como referencia con gestión por lotes.");

  const notes = [
    safeStr_(line.desc),
    safeStr_(value.notes)
  ].filter(Boolean).join(" · ");
  return createManufacturingOrder({
    client: safeStr_(detail.contactName),
    clientId: safeStr_(detail.contact),
    sku: safeStr_(line.sku),
    product: safeStr_(line.name || catalogItem.product),
    targetQuantity: numberOrZero_(line.units),
    color: safeStr_(value.color),
    targetDate: safeStr_(value.targetDate),
    status: MANUFACTURING_ORDERS.openStatus,
    notes,
    salesOrderNumber: safeStr_(detail.docNumber),
    salesOrderId,
    salesOrderLineId,
    salesOrderQuantity: numberOrZero_(line.units)
  });
}

function getManufacturingOrderDetail(orderId) {
  assertLotsWebAppAccess_();
  const id = safeStr_(orderId);
  if (!id) throw new Error("No se ha indicado el número de OF.");
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheets = ensureManufacturingOrderSheets_(ss);
  const order = readManufacturingOrders_(sheets.orders, sheets.production)
    .find(item => item.id === id);
  if (!order) throw new Error(`No encuentro la orden ${id}.`);
  return {
    order,
    productions: readProductionsForOrder_(sheets.production, id),
    quality: getManufacturingQualityData_(sheets.quality, order)
  };
}

function recordManufacturingPieceWeight(input) {
  assertLotsWebAppAccess_();
  return recordManufacturingPieceWeight_(input, getManufacturingOrderUser_());
}

/** Vista pública y limitada para el puesto de pesaje de planta. */
function getPlantWeightOrders() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheets = ensureManufacturingOrderSheets_(ss);
  const orders = readManufacturingOrders_(sheets.orders, sheets.production)
    .filter(order => order.status === MANUFACTURING_ORDERS.openStatus)
    .map(order => ({
      id: order.id,
      sku: order.sku,
      product: order.product,
      finishedLot: order.finishedLot,
      targetQuantity: order.targetQuantity,
      producedQuantity: order.producedQuantity,
      theoreticalWeight: readManufacturingTheoreticalWeight_(ss, order.sku),
      quality: getManufacturingQualityData_(sheets.quality, order)
    }));
  return { generatedAt: formatLotsDate_(new Date()), orders };
}

/** Registra un pesaje desde la pantalla pública de planta. */
function recordPlantManufacturingPieceWeight(input) {
  const data = input || {};
  const operator = safeStr_(data.operator).replace(/[\r\n\t]/g, " ").slice(0, 80);
  if (!operator) throw new Error("Indica el nombre o identificador del operario.");
  return recordManufacturingPieceWeight_(data, operator);
}

function recordManufacturingPieceWeight_(input, actor) {
  const data = input || {};
  const orderId = safeStr_(data.orderId);
  const actualWeight = Number(String(data.actualWeight || "").replace(",", "."));
  if (!orderId) throw new Error("No se ha indicado la orden de fabricación.");
  if (!isFinite(actualWeight) || actualWeight <= 0) throw new Error("Introduce un peso real mayor que cero.");

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheets = ensureManufacturingOrderSheets_(ss);
  const order = readManufacturingOrders_(sheets.orders, sheets.production)
    .find(item => item.id === orderId);
  if (!order) throw new Error(`No encuentro la orden ${orderId}.`);
  const theoreticalWeight = readManufacturingTheoreticalWeight_(ss, order.sku);
  if (!(theoreticalWeight > 0)) {
    throw new Error(`El producto ${order.sku} no tiene un peso teórico válido en Holded Raw.`);
  }

  const lock = LockService.getDocumentLock();
  lock.waitLock(15000);
  try {
    const values = sheets.quality.getDataRange().getValues();
    let pieceNumber = 1;
    for (let row = 1; row < values.length; row++) {
      if (safeStr_(values[row][2]) === orderId) {
        pieceNumber = Math.max(pieceNumber, numberOrZero_(values[row][6]) + 1);
      }
    }
    const difference = actualWeight - theoreticalWeight;
    const deviationPercent = Math.abs(difference) / theoreticalWeight * 100;
    const result = classifyManufacturingWeight_(deviationPercent);
    const now = new Date();
    const user = safeStr_(actor) || "Pantalla producción";
    sheets.quality.appendRow([
      now,
      user,
      order.id,
      order.finishedLot,
      order.sku,
      order.product,
      pieceNumber,
      theoreticalWeight,
      actualWeight,
      difference,
      deviationPercent,
      result,
      safeStr_(data.notes)
    ]);
    return {
      ok: true,
      orderId: order.id,
      finishedLot: order.finishedLot,
      sku: order.sku,
      product: order.product,
      pieceNumber,
      theoreticalWeight,
      actualWeight,
      difference,
      deviationPercent,
      result,
      measuredAt: formatLotsDate_(now),
      measuredBy: user,
      quality: getManufacturingQualityData_(sheets.quality, order)
    };
  } finally {
    lock.releaseLock();
  }
}

function getTraceabilityRecord(reference) {
  assertLotsWebAppAccess_();
  const query = normalizeKey_(reference);
  if (!query) throw new Error("Escanea un QR o introduce un lote de producto terminado.");
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheets = ensureManufacturingOrderSheets_(ss);
  const orders = readManufacturingOrders_(sheets.orders, sheets.production);
  const order = orders.find(item =>
    normalizeKey_(item.finishedLot) === query || normalizeKey_(item.id) === query
  );
  if (!order) throw new Error("No encuentro una orden de fabricación para ese lote.");
  const productions = readProductionsForOrder_(sheets.production, order.id);
  const quality = getManufacturingQualityData_(sheets.quality, order);
  const timeline = [{ date: order.createdAt, event: "OF creada" }];
  productions.slice().reverse().forEach(item => timeline.push({
    date: [item.date, item.shift].filter(Boolean).join(" · "),
    event: `${numberOrZero_(item.units)} uds fabricadas`
  }));
  if (order.status === MANUFACTURING_ORDERS.closedStatus) {
    timeline.push({ date: order.updatedAt, event: "OF cerrada" });
  }
  return {
    generatedAt: formatLotsDate_(new Date()),
    status: order.status === MANUFACTURING_ORDERS.closedStatus
      ? "CERRADO"
      : order.producedQuantity > 0 ? "EN PRODUCCIÓN" : "PLANIFICADO",
    order,
    productions,
    quality,
    timeline
  };
}

function createManufacturingOrder(input) {
  assertLotsWebAppAccess_();
  const data = validateManufacturingOrderInput_(input);
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheets = ensureManufacturingOrderSheets_(ss);
  const lock = LockService.getDocumentLock();
  let id = "";
  let finishedLot = "";
  lock.waitLock(15000);
  try {
    if (data.salesOrderLineId && readImportedSalesOrderLineIds_(sheets.orders).has(data.salesOrderLineId)) {
      throw new Error("Esta línea del pedido ya tiene una OF creada.");
    }
    const now = new Date();
    const user = getManufacturingOrderUser_();
    id = nextManufacturingOrderId_(sheets.orders, now.getFullYear());
    finishedLot = buildFinishedProductLotName_(data.sku, data.targetDate || now, id);
    sheets.orders.appendRow([
      id,
      data.client,
      data.sku,
      data.product,
      data.targetQuantity,
      data.color,
      data.targetDate || "",
      data.status,
      data.notes,
      now,
      now,
      user,
      user,
      data.clientId,
      data.salesOrderNumber,
      data.salesOrderId,
      data.salesOrderLineId,
      data.salesOrderQuantity,
      finishedLot
    ]);
  } finally {
    lock.releaseLock();
  }

  try {
    const lotResult = createFinishedProductLot_(id);
    return {
      ok: true,
      id,
      finishedLot,
      lotCreated: true,
      lotAction: lotResult.action
    };
  } catch (error) {
    const lotError = error && error.message ? error.message : String(error);
    console.error("FINISHED_LOT_AUTO_CREATE_ERROR " + JSON.stringify({ id, finishedLot, lotError }));
    return {
      ok: true,
      id,
      finishedLot,
      lotCreated: false,
      lotError
    };
  }
}

function updateManufacturingOrder(orderId, input) {
  assertLotsWebAppAccess_();
  const id = safeStr_(orderId);
  if (!id) throw new Error("No se ha indicado el número de OF.");
  const data = validateManufacturingOrderInput_(input);
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheets = ensureManufacturingOrderSheets_(ss);
  const lock = LockService.getDocumentLock();
  lock.waitLock(15000);
  try {
    const values = sheets.orders.getDataRange().getValues();
    let rowNumber = 0;
    for (let row = 1; row < values.length; row++) {
      if (safeStr_(values[row][0]) === id) {
        rowNumber = row + 1;
        break;
      }
    }
    if (!rowNumber) throw new Error(`No encuentro la orden ${id}.`);
    const original = sheets.orders.getRange(rowNumber, 1, 1, 19).getValues()[0];
    sheets.orders.getRange(rowNumber, 1, 1, 19).setValues([[
      id,
      data.client,
      data.sku,
      data.product,
      data.targetQuantity,
      data.color,
      data.targetDate || "",
      data.status,
      data.notes,
      original[9] || new Date(),
      new Date(),
      original[11] || "",
      getManufacturingOrderUser_(),
      data.clientId,
      original[14] || data.salesOrderNumber,
      original[15] || data.salesOrderId,
      original[16] || data.salesOrderLineId,
      original[17] || data.salesOrderQuantity,
      original[18] || buildFinishedProductLotName_(data.sku, data.targetDate || original[9], id)
    ]]);
    return { ok: true, id };
  } finally {
    lock.releaseLock();
  }
}

function ensureManufacturingOrderSheets_(ss) {
  let orders = ss.getSheetByName(MANUFACTURING_ORDERS.ordersSheet);
  if (!orders) orders = ss.insertSheet(MANUFACTURING_ORDERS.ordersSheet);
  const orderHeaders = [
    "Nº OF", "Cliente", "SKU", "Producto", "Cantidad objetivo", "Color",
    "Fecha objetivo", "Estado", "Observaciones", "Creada", "Modificada",
    "Creada por", "Modificada por", "contactId Holded",
    "Pedido venta Holded", "salesOrderId Holded", "salesOrderLineId Holded", "Cantidad pedido",
    "Lote producto terminado"
  ];
  if (orders.getLastRow() === 0) {
    orders.getRange(1, 1, 1, orderHeaders.length).setValues([orderHeaders]).setFontWeight("bold");
    orders.setFrozenRows(1);
  } else if (orders.getLastColumn() < orderHeaders.length) {
    orders.getRange(1, 1, 1, orderHeaders.length).setValues([orderHeaders]).setFontWeight("bold");
  }

  let production = ss.getSheetByName(MANUFACTURING_ORDERS.productionSheet);
  if (!production) production = ss.insertSheet(MANUFACTURING_ORDERS.productionSheet);
  const productionHeaders = [
    "Fecha", "Turno", "Nº OF", "SKU", "Uds", "Peso real",
    "Lote PE", "Lote pigmento", "Lote producto terminado",
    "Clave origen", "Vinculada", "Uds rechazadas", "Uds moldeadas"
  ];
  if (production.getLastRow() === 0) {
    production.getRange(1, 1, 1, productionHeaders.length).setValues([productionHeaders]).setFontWeight("bold");
    production.setFrozenRows(1);
  } else if (production.getLastColumn() < productionHeaders.length) {
    production.getRange(1, 1, 1, productionHeaders.length).setValues([productionHeaders]).setFontWeight("bold");
  }

  let quality = ss.getSheetByName(MANUFACTURING_ORDERS.qualitySheet);
  if (!quality) quality = ss.insertSheet(MANUFACTURING_ORDERS.qualitySheet);
  const qualityHeaders = [
    "Fecha y hora", "Operario", "Nº OF", "Lote producto terminado", "SKU", "Producto",
    "Nº pieza", "Peso teórico", "Peso real", "Diferencia", "Desviación %", "Resultado", "Observaciones"
  ];
  if (quality.getLastRow() === 0) {
    quality.getRange(1, 1, 1, qualityHeaders.length).setValues([qualityHeaders]).setFontWeight("bold");
    quality.setFrozenRows(1);
  } else if (quality.getLastColumn() < qualityHeaders.length) {
    quality.getRange(1, 1, 1, qualityHeaders.length).setValues([qualityHeaders]).setFontWeight("bold");
  }
  return { orders, production, quality };
}

function readManufacturingTheoreticalWeight_(ss, sku) {
  const sheet = ss.getSheetByName("Holded Raw");
  if (!sheet) throw new Error("No existe la hoja 'Holded Raw'.");
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return 0;
  const skuIdx = getColIndex_(values[0], "^sku holded$");
  const weightIdx = getColIndex_(values[0], "^peso$");
  if (skuIdx < 0 || weightIdx < 0) throw new Error("No localizo SKU y Peso en 'Holded Raw'.");
  const key = normalizeKey_(sku);
  for (let row = 1; row < values.length; row++) {
    if (normalizeKey_(values[row][skuIdx]) === key) return numberOrZero_(values[row][weightIdx]);
  }
  return 0;
}

function classifyManufacturingWeight_(deviationPercent) {
  if (deviationPercent <= MANUFACTURING_ORDERS.weightWarningPercent) return "CONFORME";
  if (deviationPercent < MANUFACTURING_ORDERS.weightRejectPercent) return "ALERTA";
  return "NO CONFORME";
}

function getManufacturingQualityData_(sheet, order) {
  const values = sheet.getDataRange().getValues();
  const measurements = [];
  for (let row = 1; row < values.length; row++) {
    if (safeStr_(values[row][2]) !== order.id) continue;
    measurements.push({
      measuredAt: formatLotsDate_(values[row][0]),
      measuredBy: safeStr_(values[row][1]),
      pieceNumber: numberOrZero_(values[row][6]),
      theoreticalWeight: numberOrZero_(values[row][7]),
      actualWeight: numberOrZero_(values[row][8]),
      difference: numberOrZero_(values[row][9]),
      deviationPercent: numberOrZero_(values[row][10]),
      result: safeStr_(values[row][11]),
      notes: safeStr_(values[row][12])
    });
  }
  const actualWeights = measurements.map(item => item.actualWeight);
  const conforming = measurements.filter(item => item.result === "CONFORME").length;
  const warnings = measurements.filter(item => item.result === "ALERTA").length;
  const rejected = measurements.filter(item => item.result === "NO CONFORME").length;
  return {
    theoreticalWeight: measurements.length
      ? measurements[measurements.length - 1].theoreticalWeight
      : readManufacturingTheoreticalWeight_(SpreadsheetApp.getActiveSpreadsheet(), order.sku),
    measured: measurements.length,
    conforming,
    warnings,
    rejected,
    conformingPercent: measurements.length ? Math.round(conforming / measurements.length * 1000) / 10 : 0,
    averageWeight: actualWeights.length ? actualWeights.reduce((sum, value) => sum + value, 0) / actualWeights.length : 0,
    minWeight: actualWeights.length ? Math.min.apply(null, actualWeights) : 0,
    maxWeight: actualWeights.length ? Math.max.apply(null, actualWeights) : 0,
    measurements: measurements.reverse()
  };
}

function syncManufacturingOrdersForShift_(ss, productionRows, dateText, shiftText) {
  const sheets = ensureManufacturingOrderSheets_(ss);
  const shift = safeStr_(shiftText);
  const sourcePrefix = `RESUMEN|${safeStr_(dateText)}|${shift}|`;
  const activeLotsSheet = ss.getSheetByName(LOTS_APP.activeSheet);
  const activeLots = activeLotsSheet ? readActiveLots_(activeLotsSheet) : {};
  const lotManagedFinishedSkus = readLotManagedFinishedSkus_(ss);
  const lock = LockService.getDocumentLock();
  lock.waitLock(15000);
  try {
    const previousLinks = removeManufacturingOrderLinksBySource_(sheets.production, sourcePrefix);

    const allOrders = readManufacturingOrders_(sheets.orders, sheets.production)
      .sort((a, b) => a.id.localeCompare(b.id));
    const orders = allOrders.filter(order => order.status === MANUFACTURING_ORDERS.openStatus);
    const ordersById = {};
    allOrders.forEach(order => { ordersById[order.id] = order; });
    const ordersBySku = {};
    orders.forEach(order => {
      const key = normalizeKey_(order.sku);
      if (!ordersBySku[key]) ordersBySku[key] = [];
      ordersBySku[key].push(order);
    });

    const date = parseManufacturingOrderLocalDate_(dateText);
    const now = new Date();
    const rowsToAppend = [];
    (productionRows || []).forEach(item => {
      const sku = safeStr_(item.producto || item.sku);
      const units = numberOrZero_(item.uds || item.units);
      const rejectedUnits = numberOrZero_(item.udsRechazadas || item.rejectedUnits);
      const moldedUnits = numberOrZero_(item.udsMoldeadas || item.moldedUnits) || units + rejectedUnits;
      if (!sku || (units <= 0 && moldedUnits <= 0)) return;
      const candidates = ordersBySku[normalizeKey_(sku)] || [];
      const previousOrder = ordersById[previousLinks[normalizeKey_(sku)]];
      const order = previousOrder || candidates.find(candidate => candidate.pendingQuantity > 0) || candidates[0];
      if (!order) return;
      const peLot = getActiveManufacturingLotName_(activeLots, item.materialSku);
      const pigmentLot = getActiveManufacturingLotName_(activeLots, item.pigmentSku);
      const finishedLot = lotManagedFinishedSkus.has(normalizeKey_(sku))
        ? order.finishedLot || buildFinishedProductLotName_(sku, order.targetDate || date, order.id)
        : "";
      rowsToAppend.push([
        date,
        shift,
        order.id,
        sku,
        units,
        numberOrZero_(item.kgTotal || item.realWeight),
        peLot,
        pigmentLot,
        finishedLot,
        sourcePrefix + normalizeKey_(sku),
        now,
        rejectedUnits,
        moldedUnits
      ]);
      order.producedQuantity += units;
      order.pendingQuantity = Math.max(0, order.targetQuantity - order.producedQuantity);
    });

    if (rowsToAppend.length) {
      sheets.production.getRange(
        sheets.production.getLastRow() + 1,
        1,
        rowsToAppend.length,
        rowsToAppend[0].length
      ).setValues(rowsToAppend);
    }
    return { linked: rowsToAppend.length };
  } finally {
    lock.releaseLock();
  }
}

function getActiveManufacturingLotName_(activeLots, sku) {
  const key = normalizeKey_(sku);
  if (!key) return "";
  const active = activeLots[key] || null;
  if (!active || safeStr_(active.status).toUpperCase() !== "ACTIVO") return "";
  return safeStr_(active.lotName);
}

function buildFinishedProductLotName_(sku, productionDate, orderId) {
  const cleanSku = safeStr_(sku);
  const cleanOrder = safeStr_(orderId).replace(/^OF-\d{4}-/i, "OF");
  if (!cleanSku || !cleanOrder) return "";
  const date = productionDate instanceof Date ? productionDate : new Date(productionDate);
  if (isNaN(date.getTime())) return "";
  return cleanSku + "-" + Utilities.formatDate(date, Session.getScriptTimeZone(), "MMyyyy") + "-" + cleanOrder;
}

function readLotManagedFinishedSkus_(ss) {
  const sheet = ss.getSheetByName("Holded Raw");
  if (!sheet) return new Set();
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return new Set();
  const skuIdx = getColIndex_(values[0], "^sku holded$");
  const kindIdx = getColIndex_(values[0], "^kind$");
  const typeIdx = getColIndex_(values[0], "^tipo");
  if (skuIdx < 0 || kindIdx < 0) return new Set();
  const out = new Set();
  for (let row = 1; row < values.length; row++) {
    if (normalizeKey_(values[row][kindIdx]) !== "LOTS") continue;
    if (typeIdx >= 0 && normalizeKey_(values[row][typeIdx]) === "RM") continue;
    const sku = normalizeKey_(values[row][skuIdx]);
    if (sku) out.add(sku);
  }
  return out;
}

function removeManufacturingOrderLinksBySource_(sheet, sourcePrefix) {
  const values = sheet.getDataRange().getValues();
  const previousLinks = {};
  for (let row = values.length - 1; row >= 1; row--) {
    if (safeStr_(values[row][9]).startsWith(sourcePrefix)) {
      previousLinks[normalizeKey_(values[row][3])] = safeStr_(values[row][2]);
      sheet.deleteRow(row + 1);
    }
  }
  return previousLinks;
}

function parseManufacturingOrderLocalDate_(value) {
  const match = safeStr_(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  const parsed = value instanceof Date ? value : new Date(value);
  return isNaN(parsed.getTime()) ? new Date() : parsed;
}

function readManufacturingOrders_(ordersSheet, productionSheet) {
  const productionTotals = {};
  const productionValues = productionSheet.getDataRange().getValues();
  for (let row = 1; row < productionValues.length; row++) {
    const id = safeStr_(productionValues[row][2]);
    if (!id) continue;
    productionTotals[id] = (productionTotals[id] || 0) + numberOrZero_(productionValues[row][4]);
  }

  const values = ordersSheet.getDataRange().getValues();
  const out = [];
  for (let row = 1; row < values.length; row++) {
    const id = safeStr_(values[row][0]);
    if (!id) continue;
    const target = numberOrZero_(values[row][4]);
    const produced = productionTotals[id] || 0;
    out.push({
      id,
      client: safeStr_(values[row][1]),
      sku: safeStr_(values[row][2]),
      product: safeStr_(values[row][3]),
      targetQuantity: target,
      color: safeStr_(values[row][5]),
      targetDate: formatManufacturingOrderDate_(values[row][6], "yyyy-MM-dd"),
      targetDateDisplay: formatManufacturingOrderDate_(values[row][6], "dd/MM/yyyy"),
      status: safeStr_(values[row][7]) || MANUFACTURING_ORDERS.openStatus,
      notes: safeStr_(values[row][8]),
      createdAt: formatLotsDate_(values[row][9]),
      updatedAt: formatLotsDate_(values[row][10]),
      createdBy: safeStr_(values[row][11]),
      updatedBy: safeStr_(values[row][12]),
      clientId: safeStr_(values[row][13]),
      salesOrderNumber: safeStr_(values[row][14]),
      salesOrderId: safeStr_(values[row][15]),
      salesOrderLineId: safeStr_(values[row][16]),
      salesOrderQuantity: numberOrZero_(values[row][17]),
      finishedLot: safeStr_(values[row][18]),
      producedQuantity: produced,
      pendingQuantity: Math.max(0, target - produced),
      progress: target > 0 ? Math.min(100, Math.round(produced / target * 1000) / 10) : 0
    });
  }
  return out.sort((a, b) => {
    if (a.status !== b.status) return a.status === MANUFACTURING_ORDERS.openStatus ? -1 : 1;
    return b.id.localeCompare(a.id);
  });
}

function readProductionsForOrder_(sheet, orderId) {
  const values = sheet.getDataRange().getValues();
  const rows = [];
  for (let row = 1; row < values.length; row++) {
    if (safeStr_(values[row][2]) !== orderId) continue;
    rows.push({
      date: formatManufacturingOrderDate_(values[row][0], "dd/MM/yyyy"),
      shift: safeStr_(values[row][1]),
      sku: safeStr_(values[row][3]),
      units: numberOrZero_(values[row][4]),
      realWeight: numberOrZero_(values[row][5]),
      peLot: safeStr_(values[row][6]),
      pigmentLot: safeStr_(values[row][7]),
      finishedLot: safeStr_(values[row][8])
    });
  }
  return rows.reverse();
}

function readManufacturingOrderCatalog_(ss) {
  const liveProducts = holdedRequest_("get", "/products");
  if (!Array.isArray(liveProducts)) throw new Error("Holded no devolvió un catálogo válido de productos.");
  const out = [];
  const seen = new Set();
  liveProducts.forEach(item => {
    const sku = safeStr_(item && item.sku);
    if (!sku || seen.has(normalizeKey_(sku))) return;
    if (normalizeKey_(item.kind) !== "lots") return;
    seen.add(normalizeKey_(sku));
    const tags = (Array.isArray(item.tags) ? item.tags : []).map(normalizeManufacturingTag_);
    const client = MANUFACTURING_ORDERS.premiumClients.find(config => tags.includes(config.tag)) || null;
    out.push({
      sku,
      product: safeStr_(item.name),
      productId: safeStr_(item.id),
      clientKey: client ? client.key : ""
    });
  });
  return out.sort((a, b) => a.sku.localeCompare(b.sku));
}

function readPremiumManufacturingClients_() {
  const contacts = holdedRequest_("get", "/contacts");
  if (!Array.isArray(contacts)) throw new Error("Holded no devolvió un catálogo válido de clientes.");
  const normalize = value => safeStr_(value)
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toUpperCase().replace(/[^A-Z0-9]+/g, " ").trim();
  const out = [];
  const seen = new Set();
  contacts.forEach(contact => {
    if (!contact || !contact.id) return;
    const name = safeStr_(contact.name || contact.tradeName);
    const searchText = normalize([contact.name, contact.tradeName, contact.code].join(" "));
    const config = MANUFACTURING_ORDERS.premiumClients.find(item =>
      item.contactTerms.some(term => searchText.includes(term))
    );
    if (!config || !name || seen.has(String(contact.id))) return;
    seen.add(String(contact.id));
    out.push({ id: String(contact.id), name, premiumKey: config.key, productTag: config.tag });
  });
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

function normalizeManufacturingTag_(value) {
  return safeStr_(value).replace(/^#+/, "").toUpperCase();
}

function normalizeManufacturingSearchText_(value) {
  return safeStr_(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toUpperCase().replace(/[^A-Z0-9]+/g, " ").trim();
}

function readImportedSalesOrderLineIds_(sheet) {
  const out = new Set();
  const values = sheet.getDataRange().getValues();
  for (let row = 1; row < values.length; row++) {
    const lineId = safeStr_(values[row][16]);
    if (lineId) out.add(lineId);
  }
  return out;
}

function formatManufacturingOrderEpochDate_(value, pattern) {
  const seconds = Number(value);
  if (!isFinite(seconds) || seconds <= 0) return "";
  return Utilities.formatDate(new Date(seconds * 1000), Session.getScriptTimeZone(), pattern || "yyyy-MM-dd");
}

function previewPremiumProductsWithoutLots() {
  const products = holdedRequest_("get", "/products");
  if (!Array.isArray(products)) throw new Error("Holded no devolvió un catálogo válido de productos.");
  const rows = [];
  products.forEach(product => {
    const tags = (Array.isArray(product && product.tags) ? product.tags : []).map(normalizeManufacturingTag_);
    const configs = MANUFACTURING_ORDERS.premiumClients.filter(config => tags.includes(config.tag));
    configs.forEach(config => {
      if (normalizeKey_(product.kind) === "lots") return;
      if (product.kind === "variants" && Array.isArray(product.variants) && product.variants.length) {
        product.variants.forEach(variant => rows.push([
          config.key, "#" + config.tag, safeStr_(variant.sku || product.sku),
          safeStr_(product.name), safeStr_(product.id), safeStr_(variant.id),
          safeStr_(product.kind), numberOrZero_(variant.stock), "PENDIENTE CONVERTIR"
        ]));
      } else {
        rows.push([
          config.key, "#" + config.tag, safeStr_(product.sku), safeStr_(product.name),
          safeStr_(product.id), "", safeStr_(product.kind), numberOrZero_(product.stock),
          "PENDIENTE CONVERTIR"
        ]);
      }
    });
  });
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName("Productos sin lotes");
  const oldSheet = ss.getSheetByName("Premium sin lotes");
  if (!sheet && oldSheet) {
    oldSheet.setName("Productos sin lotes");
    sheet = oldSheet;
  }
  if (!sheet) sheet = ss.insertSheet("Productos sin lotes");
  sheet.clearContents();
  const headers = ["Cliente", "Etiqueta", "SKU", "Producto", "productId", "variantId", "Kind", "Stock", "Estado"];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight("bold");
  if (rows.length) sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, headers.length);
  SpreadsheetApp.getUi().alert(`Auditoría de lotes: ${rows.length} SKU pendientes de gestión por lotes.`);
  return { pending: rows.length };
}

function validateManufacturingOrderInput_(input) {
  const value = input || {};
  const client = safeStr_(value.client);
  const clientId = safeStr_(value.clientId);
  const sku = safeStr_(value.sku);
  const product = safeStr_(value.product);
  const targetQuantity = Number(value.targetQuantity);
  const color = safeStr_(value.color);
  const notes = safeStr_(value.notes);
  const status = safeStr_(value.status).toUpperCase() || MANUFACTURING_ORDERS.openStatus;
  const salesOrderNumber = safeStr_(value.salesOrderNumber);
  const salesOrderId = safeStr_(value.salesOrderId);
  const salesOrderLineId = safeStr_(value.salesOrderLineId);
  const salesOrderQuantity = numberOrZero_(value.salesOrderQuantity);
  if (!client) throw new Error("El cliente es obligatorio.");
  if (!clientId) throw new Error("Selecciona un cliente de Holded.");
  const comesFromSalesOrder = !!salesOrderId && !!salesOrderLineId;
  if (!comesFromSalesOrder) {
    const validClient = readPremiumManufacturingClients_()
      .some(item => item.id === clientId && normalizeKey_(item.name) === normalizeKey_(client));
    if (!validClient) throw new Error("El cliente seleccionado ya no está incluido en la planificación de fabricación.");
  }
  if (!sku) throw new Error("El SKU es obligatorio.");
  if (!product) throw new Error("El producto es obligatorio.");
  if (!isFinite(targetQuantity) || targetQuantity <= 0) {
    throw new Error("La cantidad objetivo debe ser mayor que cero.");
  }
  if (![MANUFACTURING_ORDERS.openStatus, MANUFACTURING_ORDERS.closedStatus].includes(status)) {
    throw new Error("El estado debe ser ABIERTA o CERRADA.");
  }
  let targetDate = "";
  if (safeStr_(value.targetDate)) {
    const parts = safeStr_(value.targetDate).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!parts) throw new Error("La fecha objetivo no es válida.");
    targetDate = new Date(Number(parts[1]), Number(parts[2]) - 1, Number(parts[3]));
  }
  return {
    client, clientId, sku, product, targetQuantity, color, targetDate, status, notes,
    salesOrderNumber, salesOrderId, salesOrderLineId, salesOrderQuantity
  };
}

function nextManufacturingOrderId_(sheet, year) {
  const prefix = `OF-${year}-`;
  let max = 0;
  const values = sheet.getDataRange().getValues();
  for (let row = 1; row < values.length; row++) {
    const id = safeStr_(values[row][0]);
    if (!id.startsWith(prefix)) continue;
    const sequence = Number(id.slice(prefix.length));
    if (isFinite(sequence)) max = Math.max(max, sequence);
  }
  return prefix + String(max + 1).padStart(4, "0");
}

function formatManufacturingOrderDate_(value, pattern) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (isNaN(date.getTime())) return "";
  return Utilities.formatDate(date, Session.getScriptTimeZone(), pattern);
}

function getManufacturingOrderUser_() {
  return Session.getActiveUser().getEmail() || "Pantalla producción";
}
