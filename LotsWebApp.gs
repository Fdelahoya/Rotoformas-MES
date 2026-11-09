const LOTS_APP = {
  activeSheet: "Lotes activos",
  historySheet: "Cambios de lote",
  allowedUsers: [
    "fidel@rotoformas.com",
    "bflorentin@rotoformas.com",
    "mauro@rotoformas.com"
  ],
  materialSkus: [
    "PE NATURAL",
    "PE MASA",
    "PE RECICLADO",
    "PIG300",
    "PIG301",
    "PIG RTF073",
    "INSERTO V4"
  ]
};

/** Aplicación web incrustable en Google Sites. No ejecuta movimientos de stock. */
function doGet(e) {
  const mode = safeStr_(e && e.parameter && e.parameter.modo).toLowerCase();
  const email = safeStr_(Session.getActiveUser().getEmail()).toLowerCase();
  const reference = traceabilityReference_(e);
  if (mode === "config-qr") {
    assertLotsWebAppAccess_();
    return HtmlService.createTemplateFromFile("ShortLinksSettings").evaluate()
      .setTitle("Rotoformas · Enlaces QR");
  }
  if (mode !== "pesaje" && reference && !LOTS_APP.allowedUsers.includes(email)) {
    const guest = HtmlService.createTemplateFromFile("GuestTraceabilityPage");
    guest.records = readGuestTraceability_(reference);
    guest.productImage = guest.records.length ? readGuestProductImage_(reference) : "";
    guest.companyUrl = "https://script.google.com/a/macros/rotoformas.com/s/AKfycbyNA69u8JNmcqRaAct4vNMYey5dXCSKa4L-5f9wwcV2FG-zrBjnWnsfUlzKHoIL4ek86w/exec?lote=" + encodeURIComponent(reference);
    return guest.evaluate().setTitle("Rotoformas · Consulta de lote")
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }
  if (mode === "pesaje" || !LOTS_APP.allowedUsers.includes(email)) {
    return HtmlService.createTemplateFromFile("PlantWeightPage").evaluate()
      .setTitle("Rotoformas · Pesaje en planta")
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }
  assertLotsWebAppAccess_();
  const template = HtmlService.createTemplateFromFile("LotsWebAppPage");
  template.initialTraceabilityReference = reference;
  return template.evaluate()
    .setTitle("Rotoformas MES")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/** Los QR nuevos usan ?lote/ sin '=' para no truncar la variable del laser LC. */
function traceabilityReference_(e) {
  const legacy = safeStr_(e && e.parameter && e.parameter.lote);
  if (legacy) return legacy;
  const query = safeStr_(e && e.queryString).split("&")[0];
  const key = Object.keys(e && e.parameter || {}).find(name => name.startsWith("lote/")) || "";
  const path = query.startsWith("lote/") ? query : key || safeStr_(e && e.pathInfo).replace(/^\/+/, "");
  if (!path.startsWith("lote/")) return "";
  try { return safeStr_(decodeURIComponent(path.slice(5))); } catch (_) { return ""; }
}

function getLotsDashboardData() {
  assertLotsWebAppAccess_();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheets = ensureLotsSheets_(ss);
  const activeBySku = readActiveLots_(sheets.active);
  const products = getLotManagedMaterials_(ss, activeBySku);

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
  assertLotsWebAppAccess_();
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

function assertLotsWebAppAccess_() {
  const email = safeStr_(Session.getActiveUser().getEmail()).toLowerCase();
  if (!LOTS_APP.allowedUsers.includes(email)) {
    throw new Error("Acceso restringido. Inicia sesión con una cuenta autorizada de Rotoformas.");
  }
  return email;
}

function getLotManagedMaterials_(fallbackSpreadsheet, activeBySku) {
  let data = null;
  try {
    data = holdedRequest_("get", "/products");
    if (!Array.isArray(data)) throw new Error("Holded no devolvió un catálogo válido.");
  } catch (error) {
    if (!fallbackSpreadsheet) throw error;
    console.warn("No se pudo refrescar productos y lotes de Holded: " + error.message);
    return getLotManagedMaterialsFromSheet_(fallbackSpreadsheet, activeBySku || {});
  }

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

function getLotManagedMaterialsFromSheet_(ss, activeBySku) {
  const sheet = ss.getSheetByName("Holded Raw");
  if (!sheet) throw new Error("No existe la hoja 'Holded Raw' para recuperar las materias primas.");
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return {};
  const skuIdx = getColIndex_(values[0], "^sku holded$");
  const nameIdx = getColIndex_(values[0], "^producto holded$");
  const productIdIdx = getColIndex_(values[0], "^productid holded$");
  const kindIdx = getColIndex_(values[0], "^kind$");
  if (skuIdx < 0 || nameIdx < 0 || productIdIdx < 0 || kindIdx < 0) {
    throw new Error("La hoja 'Holded Raw' no contiene las columnas necesarias para recuperar las materias primas.");
  }
  const wanted = new Set(LOTS_APP.materialSkus.map(normalizeKey_));
  const out = {};
  for (let row = 1; row < values.length; row++) {
    const sku = safeStr_(values[row][skuIdx]);
    const key = normalizeKey_(sku);
    if (!wanted.has(key) || out[key] || normalizeKey_(values[row][kindIdx]) !== "lots") continue;
    const active = activeBySku[key] || null;
    out[key] = {
      id: safeStr_(values[row][productIdIdx]),
      sku,
      name: safeStr_(values[row][nameIdx]),
      kind: "lots",
      lots: active ? [{
        id: active.lotId,
        sku: active.lotName,
        barcode: active.barcode,
        stock: active.stock,
        description: "Copia local del lote activo"
      }] : []
    };
  }
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

/** Consulta pública de solo lectura. No acepta números de OF ni devuelve datos internos. */
function readGuestTraceability_(reference) {
  const lot = safeStr_(reference);
  if (!lot || lot.length > 200) return [];
  const ss = hardwareSpreadsheet_();
  const orders = ss.getSheetByName(MANUFACTURING_ORDERS.ordersSheet);
  const production = ss.getSheetByName(MANUFACTURING_ORDERS.productionSheet);
  if (!orders || !production) return [];
  // Coincidencia exacta del lote, sin búsquedas parciales ni enumeración de otras OF.
  const matches = orders.getDataRange().getValues().slice(1)
    .filter(row => safeStr_(row[18]) === lot && safeStr_(row[0]));
  if (matches.length !== 1) return [];
  const order = matches[0];
  const seen = new Set();
  return production.getDataRange().getValues().slice(1)
    .filter(row => safeStr_(row[2]) === safeStr_(order[0]) &&
      safeStr_(row[8]) === lot && numberOrZero_(row[4]) > 0)
    .map(row => ({
      date: formatManufacturingOrderDate_(row[0], "dd/MM/yyyy"),
      peLot: safeStr_(row[6]),
      ptLot: lot,
      product: safeStr_(order[3])
    }))
    .filter(record => {
      const key = JSON.stringify(record);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => a.date.split("/").reverse().join("").localeCompare(b.date.split("/").reverse().join("")))
    .slice(-1);
}

/** Solo devuelve la URL HTTPS de la foto principal; las credenciales quedan en el servidor. */
function readGuestProductImage_(reference) {
  try {
    const ss = hardwareSpreadsheet_();
    const orders = ss.getSheetByName(MANUFACTURING_ORDERS.ordersSheet);
    const raw = ss.getSheetByName("Holded Raw");
    if (!orders || !raw) return "";
    const matches = orders.getDataRange().getValues().slice(1)
      .filter(row => safeStr_(row[18]) === safeStr_(reference));
    if (matches.length !== 1) return "";
    const values = raw.getDataRange().getValues();
    const skuIdx = getColIndex_(values[0], "^sku holded$");
    const idIdx = getColIndex_(values[0], "^productid holded$");
    const parentIdx = getColIndex_(values[0], "^productid padre$");
    if (skuIdx < 0 || idIdx < 0) return "";
    const products = values.slice(1).filter(row => safeStr_(row[skuIdx]) === safeStr_(matches[0][2]));
    if (products.length !== 1) return "";
    const product = products[0];
    const id = safeStr_(parentIdx >= 0 && product[parentIdx]) || safeStr_(product[idIdx]);
    if (!/^[a-f0-9]{24}$/i.test(id)) return "";
    const cache = CacheService.getScriptCache();
    const key = "GUEST_PRODUCT_IMAGE_V1|" + id;
    const cached = cache.get(key);
    if (cached !== null) return cached === "NONE" ? "" : cached;
    const image = holdedV2Request_("get", "/products/" + encodeURIComponent(id) + "/image");
    const url = safeStr_(image && image.sizes && image.sizes.medium && image.sizes.medium.url) ||
      safeStr_(image && image.url);
    // No se admite una URL de API autenticada, HTML, credenciales ni contenido ejecutable.
    if (!/^https:\/\/[a-z0-9.-]+(?::443)?\/[^\s<>"']*$/i.test(url) ||
        /^https:\/\/api\.holded\.com\//i.test(url)) return "";
    cache.put(key, url, 600);
    return url;
  } catch (error) {
    // La ficha de lote sigue disponible cuando Holded no tiene foto o no responde.
    console.warn("No se pudo recuperar la foto pública del producto de Holded.");
    return "";
  }
}
