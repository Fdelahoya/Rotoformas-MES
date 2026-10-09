const MANUFACTURING_ORDERS = {
  ordersSheet: "Ordenes Fabricacion",
  productionSheet: "Fabricaciones OF",
  openStatus: "ABIERTA",
  closedStatus: "CERRADA",
  premiumClientKeys: ["CONTENUR", "TEYME", "MANN HUMMEL", "TECNOSPRA", "SOLA", "SOLTEKA"]
};

function getManufacturingOrdersData() {
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

function getManufacturingOrderDetail(orderId) {
  const id = safeStr_(orderId);
  if (!id) throw new Error("No se ha indicado el número de OF.");
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheets = ensureManufacturingOrderSheets_(ss);
  const order = readManufacturingOrders_(sheets.orders, sheets.production)
    .find(item => item.id === id);
  if (!order) throw new Error(`No encuentro la orden ${id}.`);
  return {
    order,
    productions: readProductionsForOrder_(sheets.production, id)
  };
}

function createManufacturingOrder(input) {
  const data = validateManufacturingOrderInput_(input);
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheets = ensureManufacturingOrderSheets_(ss);
  const lock = LockService.getDocumentLock();
  lock.waitLock(15000);
  try {
    const now = new Date();
    const user = getManufacturingOrderUser_();
    const id = nextManufacturingOrderId_(sheets.orders, now.getFullYear());
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
      data.clientId
    ]);
    return { ok: true, id };
  } finally {
    lock.releaseLock();
  }
}

function updateManufacturingOrder(orderId, input) {
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
    const original = sheets.orders.getRange(rowNumber, 1, 1, 14).getValues()[0];
    sheets.orders.getRange(rowNumber, 1, 1, 14).setValues([[
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
      data.clientId
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
    "Creada por", "Modificada por", "contactId Holded"
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
    "Clave origen", "Vinculada"
  ];
  if (production.getLastRow() === 0) {
    production.getRange(1, 1, 1, productionHeaders.length).setValues([productionHeaders]).setFontWeight("bold");
    production.setFrozenRows(1);
  } else if (production.getLastColumn() < productionHeaders.length) {
    production.getRange(1, 1, 1, productionHeaders.length).setValues([productionHeaders]).setFontWeight("bold");
  }
  return { orders, production };
}

function syncManufacturingOrdersForShift_(ss, productionRows, dateText, shiftText) {
  const sheets = ensureManufacturingOrderSheets_(ss);
  const shift = safeStr_(shiftText);
  const sourcePrefix = `RESUMEN|${safeStr_(dateText)}|${shift}|`;
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
      if (!sku || units <= 0) return;
      const candidates = ordersBySku[normalizeKey_(sku)] || [];
      const previousOrder = ordersById[previousLinks[normalizeKey_(sku)]];
      const order = previousOrder || candidates.find(candidate => candidate.pendingQuantity > 0) || candidates[0];
      if (!order) return;
      rowsToAppend.push([
        date,
        shift,
        order.id,
        sku,
        units,
        numberOrZero_(item.kgTotal || item.realWeight),
        "",
        "",
        "",
        sourcePrefix + normalizeKey_(sku),
        now
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
  const sheet = ss.getSheetByName("Holded Raw");
  if (!sheet) throw new Error("No existe la hoja 'Holded Raw'.");
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  const headers = values[0];
  const skuIdx = getColIndex_(headers, "^sku holded$");
  const nameIdx = getColIndex_(headers, "^producto holded$");
  const typeIdx = getColIndex_(headers, "^tipo");
  const activeIdx = getColIndex_(headers, "^activo");
  const kindIdx = getColIndex_(headers, "^kind$");
  if (skuIdx < 0 || nameIdx < 0) throw new Error("No localizo SKU y producto en 'Holded Raw'.");

  const out = [];
  const seen = new Set();
  for (let row = 1; row < values.length; row++) {
    const sku = safeStr_(values[row][skuIdx]);
    if (!sku || seen.has(normalizeKey_(sku))) continue;
    if (activeIdx >= 0 && values[row][activeIdx] !== true) continue;
    if (typeIdx >= 0 && normalizeKey_(values[row][typeIdx]) === "rm") continue;
    if (kindIdx >= 0 && normalizeKey_(values[row][kindIdx]) !== "lots") continue;
    seen.add(normalizeKey_(sku));
    out.push({ sku, product: safeStr_(values[row][nameIdx]) });
  }
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
    const premiumKey = MANUFACTURING_ORDERS.premiumClientKeys.find(key => searchText.includes(key));
    if (!premiumKey || !name || seen.has(String(contact.id))) return;
    seen.add(String(contact.id));
    out.push({ id: String(contact.id), name, premiumKey });
  });
  return out.sort((a, b) => a.name.localeCompare(b.name));
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
  if (!client) throw new Error("El cliente es obligatorio.");
  if (!clientId) throw new Error("Selecciona un cliente premium de Holded.");
  const validClient = readPremiumManufacturingClients_()
    .some(item => item.id === clientId && normalizeKey_(item.name) === normalizeKey_(client));
  if (!validClient) throw new Error("El cliente seleccionado ya no coincide con un cliente premium de Holded.");
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
  return { client, clientId, sku, product, targetQuantity, color, targetDate, status, notes };
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
