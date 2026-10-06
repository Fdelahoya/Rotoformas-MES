const LOTS_APP = {
  activeSheet: "Lotes activos",
  historySheet: "Cambios de lote",
  materialSkus: [
    "PE NATURAL",
    "PE MASA",
    "PE RECICLADO",
    "PIG300",
    "PIG301",
    "INSERTO V4"
  ]
};

/** Aplicación web incrustable en Google Sites. No ejecuta movimientos de stock. */
function doGet() {
  return HtmlService.createHtmlOutputFromFile("LotsWebAppPage")
    .setTitle("Rotoformas MES")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function getLotsDashboardData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheets = ensureLotsSheets_(ss);
  const products = getLotManagedMaterials_();
  const activeBySku = readActiveLots_(sheets.active);

  const materials = LOTS_APP.materialSkus.map(sku => {
    const product = products[normalizeKey_(sku)] || null;
    const active = activeBySku[normalizeKey_(sku)] || null;
    const lots = product ? product.lots.map(normalizeLotForApp_) : [];
    const activeLot = active && product
      ? lots.find(lot => lot.id === active.lotId) || null
      : null;

    return {
      sku,
      productName: product ? product.name : "",
      productId: product ? product.id : "",
      found: !!product,
      lots,
      active: active ? {
        lotId: active.lotId,
        lotName: activeLot ? activeLot.name : active.lotName,
        barcode: activeLot ? activeLot.barcode : active.barcode,
        stock: activeLot ? activeLot.stock : null,
        changedAt: formatLotsDate_(active.changedAt),
        changedBy: active.changedBy,
        valid: !!activeLot
      } : null
    };
  });

  return {
    generatedAt: formatLotsDate_(new Date()),
    materials,
    history: readLotHistory_(sheets.history, 30)
  };
}

/**
 * Activa un lote real de Holded. Acepta su ID, código de barras o nombre/SKU.
 * Esta función solo guarda la selección del MES; no modifica stock en Holded.
 */
function activateProductionLot(sku, lotReference) {
  const expectedSku = safeStr_(sku);
  const reference = safeStr_(lotReference);
  if (!expectedSku || !reference) {
    throw new Error("Selecciona una materia prima e indica o escanea un lote.");
  }
  if (!LOTS_APP.materialSkus.some(item => normalizeKey_(item) === normalizeKey_(expectedSku))) {
    throw new Error("La materia prima no está configurada para la gestión de lotes.");
  }

  const products = getLotManagedMaterials_();
  const product = products[normalizeKey_(expectedSku)];
  if (!product) throw new Error(`No encuentro ${expectedSku} como producto con lotes en Holded.`);

  const refKey = normalizeKey_(reference);
  const matches = product.lots.filter(lot =>
    lot.id === reference ||
    normalizeKey_(lot.sku) === refKey ||
    normalizeKey_(lot.barcode) === refKey
  );
  if (matches.length !== 1) {
    throw new Error(matches.length
      ? "La referencia identifica más de un lote; selecciónalo en la lista."
      : `No encuentro el lote '${reference}' dentro de ${expectedSku}.`);
  }

  const lot = matches[0];
  const now = new Date();
  const user = Session.getActiveUser().getEmail() || "Usuario no identificado";
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheets = ensureLotsSheets_(ss);
  const lock = LockService.getDocumentLock();
  lock.waitLock(15000);
  try {
    const previous = readActiveLots_(sheets.active)[normalizeKey_(expectedSku)] || null;
    upsertActiveLot_(sheets.active, {
      sku: expectedSku,
      productName: product.name,
      productId: product.id,
      lotName: safeStr_(lot.sku),
      lotId: lot.id,
      barcode: safeStr_(lot.barcode),
      stock: numberOrZero_(lot.stock),
      changedAt: now,
      changedBy: user,
      status: "ACTIVO"
    });
    sheets.history.appendRow([
      now,
      user,
      expectedSku,
      product.name,
      product.id,
      previous ? previous.lotName : "",
      previous ? previous.lotId : "",
      safeStr_(lot.sku),
      lot.id,
      safeStr_(lot.barcode),
      numberOrZero_(lot.stock),
      "ACTIVADO"
    ]);
  } finally {
    lock.releaseLock();
  }

  return {
    ok: true,
    sku: expectedSku,
    lotId: lot.id,
    lotName: safeStr_(lot.sku),
    barcode: safeStr_(lot.barcode),
    stock: numberOrZero_(lot.stock),
    changedAt: formatLotsDate_(now),
    changedBy: user
  };
}

function getLotManagedMaterials_() {
  const data = holdedRequest_("get", "/products");
  if (!Array.isArray(data)) throw new Error("Holded no devolvió un catálogo válido.");

  const wanted = new Set(LOTS_APP.materialSkus.map(normalizeKey_));
  const out = {};
  data.forEach(product => {
    const sku = safeStr_(product && product.sku);
    if (!wanted.has(normalizeKey_(sku))) return;
    if (product.kind !== "lots" || !Array.isArray(product.lots)) return;
    out[normalizeKey_(sku)] = product;
  });
  return out;
}

function normalizeLotForApp_(lot) {
  return {
    id: safeStr_(lot && lot.id),
    name: safeStr_(lot && lot.sku),
    barcode: safeStr_(lot && lot.barcode),
    stock: numberOrZero_(lot && lot.stock),
    description: safeStr_(lot && lot.description)
  };
}

function ensureLotsSheets_(ss) {
  let active = ss.getSheetByName(LOTS_APP.activeSheet);
  if (!active) active = ss.insertSheet(LOTS_APP.activeSheet);
  const activeHeaders = [
    "SKU", "Producto", "productId", "Lote activo", "lotId", "Código de barras",
    "Stock lote", "Último cambio", "Operario", "Estado"
  ];
  if (active.getLastRow() === 0) {
    active.getRange(1, 1, 1, activeHeaders.length).setValues([activeHeaders]).setFontWeight("bold");
    active.setFrozenRows(1);
  }

  let history = ss.getSheetByName(LOTS_APP.historySheet);
  if (!history) history = ss.insertSheet(LOTS_APP.historySheet);
  const historyHeaders = [
    "Fecha y hora", "Operario", "SKU", "Producto", "productId",
    "Lote anterior", "lotId anterior", "Lote nuevo", "lotId nuevo",
    "Código de barras", "Stock al activar", "Resultado"
  ];
  if (history.getLastRow() === 0) {
    history.getRange(1, 1, 1, historyHeaders.length).setValues([historyHeaders]).setFontWeight("bold");
    history.setFrozenRows(1);
  }
  return { active, history };
}

function readActiveLots_(sheet) {
  const values = sheet.getDataRange().getValues();
  const out = {};
  for (let row = 1; row < values.length; row++) {
    const sku = safeStr_(values[row][0]);
    if (!sku) continue;
    out[normalizeKey_(sku)] = {
      sku,
      productName: safeStr_(values[row][1]),
      productId: safeStr_(values[row][2]),
      lotName: safeStr_(values[row][3]),
      lotId: safeStr_(values[row][4]),
      barcode: safeStr_(values[row][5]),
      stock: values[row][6],
      changedAt: values[row][7],
      changedBy: safeStr_(values[row][8]),
      status: safeStr_(values[row][9])
    };
  }
  return out;
}

function upsertActiveLot_(sheet, item) {
  const values = sheet.getDataRange().getValues();
  let targetRow = 0;
  for (let row = 1; row < values.length; row++) {
    if (normalizeKey_(values[row][0]) === normalizeKey_(item.sku)) {
      targetRow = row + 1;
      break;
    }
  }
  if (!targetRow) targetRow = sheet.getLastRow() + 1;
  sheet.getRange(targetRow, 1, 1, 10).setValues([[
    item.sku, item.productName, item.productId, item.lotName, item.lotId,
    item.barcode, item.stock, item.changedAt, item.changedBy, item.status
  ]]);
}

function readLotHistory_(sheet, limit) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  const startRow = Math.max(2, lastRow - limit + 1);
  return sheet.getRange(startRow, 1, lastRow - startRow + 1, 12).getValues()
    .reverse()
    .map(row => ({
      changedAt: formatLotsDate_(row[0]),
      changedBy: safeStr_(row[1]),
      sku: safeStr_(row[2]),
      previousLot: safeStr_(row[5]),
      newLot: safeStr_(row[7]),
      stock: numberOrZero_(row[10])
    }));
}

function formatLotsDate_(value) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (isNaN(date.getTime())) return safeStr_(value);
  return Utilities.formatDate(date, Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm");
}
