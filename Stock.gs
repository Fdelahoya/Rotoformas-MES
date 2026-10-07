const HOLDED_STOCK = {
  warehouseId: "6900db4e6a7a552ad20df16b",
  baseUrl: "https://api.holded.com/api/invoicing/v1"
};

function readRecycledSkuList_(ss, sheetName) {
  const sh = ss.getSheetByName(sheetName);
  if (!sh) throw new Error(`No encuentro la hoja: ${sheetName}`);

  const startRow = 9; // E9:E ; encabezado en E8
  const col = 5;      // columna E
  const lastRow = sh.getLastRow();

  if (lastRow < startRow) return new Set();

  const values = sh.getRange(startRow, col, lastRow - startRow + 1, 1).getValues();
  const out = new Set();

  values.forEach(r => {
    const sku = safeStr_(r[0]);
    if (sku) out.add(normalizeKey_(sku));
  });

  return out;
}

function buildStockMovementsFromResumen_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const resumen = ss.getSheetByName("Resumen");
  const holded = ss.getSheetByName("Holded Raw");

  if (!resumen) throw new Error("No existe la hoja 'Resumen'.");
  if (!holded) throw new Error("No existe la hoja 'Holded Raw'.");

  const recycledSkus = readRecycledSkuList_(ss, CONFIG.productMasterSheet);

  const holdedData = holded.getDataRange().getValues();
  if (holdedData.length < 2) throw new Error("Holded Raw no tiene datos.");

  const holdedIdx = {};
  for (let i = 1; i < holdedData.length; i++) {
    const sku = safeStr_(holdedData[i][0]);
    const nombre = safeStr_(holdedData[i][1]);
    const productId = safeStr_(holdedData[i][2]);
    const parentId = safeStr_(holdedData[i][3]);
    const kind = safeStr_(holdedData[i][4]);
    const tipo = safeStr_(holdedData[i][7]);
    const unidad = safeStr_(holdedData[i][8]);
    const activo = holdedData[i][9];

    if (!sku || activo !== true) continue;

    holdedIdx[normalizeKey_(sku)] = {
      sku,
      nombre,
      productId,
      parentId,
      kind,
      tipo,
      unidad
    };
  }

  const startRow = 4;
  const lastRow = resumen.getLastRow();
  if (lastRow < startRow) throw new Error("Resumen no tiene filas de producto.");

  const data = resumen.getRange(startRow, 1, lastRow - startRow + 1, 4).getValues();

  const movimientos = [];
  let peNaturalKg = 0;
  let peMasaKg = 0;
  let peRecicladoKg = 0;
  let insertoV4Uds = 0;
  let pigmento301Kg = 0;
  let pigmento300Kg = 0;

  for (let i = 0; i < data.length; i++) {
    const sku = safeStr_(data[i][0]);
    const uds = numberOrZero_(data[i][1]);
    const kgTotales = numberOrZero_(data[i][3]);

    if (!sku) continue;
    if (sku === "TOTAL TURNO" || sku === "__TOTAL_TURNO__") break;
    if (uds === 0) continue;

    const info = holdedIdx[normalizeKey_(sku)];

    if (!info) {
      movimientos.push({
        sku,
        producto: "",
        productId: "",
        parentId: "",
        kind: "",
        tipo: "FG",
        unidad: "ud",
        movimiento: uds,
        sentido: "+",
        estado: "SKU no encontrado en Holded Raw"
      });
    } else {
      movimientos.push({
        sku: info.sku,
        producto: info.nombre,
        productId: info.productId,
        parentId: info.parentId,
        kind: info.kind,
        tipo: "FG",
        unidad: "ud",
        movimiento: uds,
        sentido: "+",
        estado: "OK"
      });
    }

    const skuKey = normalizeKey_(sku);
    const esReciclado = recycledSkus.has(skuKey);
    const esMasa = /-M(\s|$)/.test(sku);

    if (esReciclado) {
      peRecicladoKg += kgTotales;
    } else if (esMasa) {
      peMasaKg += kgTotales;
    } else {
      peNaturalKg += kgTotales;
    }

    // Consumos especiales de PORTATAPAS
    if (sku === "PORTATAPAS") {
      insertoV4Uds += uds * 24;
      pigmento300Kg += uds * 0.09;
    }

    // Consumos especiales de PORTATAPAS OVAL2000
    if (sku === "PORTATAPAS OVAL2000") {
     insertoV4Uds += uds * 20;
     pigmento301Kg += uds * 0.90;
    }

    // Consumos especiales de LAV 26
    if (sku === "LAV 26") {
      insertoV4Uds += uds * 4;
    }
  }

  if (peNaturalKg > 0) {
    const info = holdedIdx[normalizeKey_("PE NATURAL")];
    movimientos.push({
      sku: "PE NATURAL",
      producto: info ? info.nombre : "",
      productId: info ? info.productId : "",
      parentId: info ? info.parentId : "",
      kind: info ? info.kind : "",
      tipo: "RM",
      unidad: "kg",
      movimiento: round2_(peNaturalKg),
      sentido: "-",
      estado: info ? "OK" : "SKU no encontrado en Holded Raw"
    });
  }

  if (peMasaKg > 0) {
    const info = holdedIdx[normalizeKey_("PE MASA")];
    movimientos.push({
      sku: "PE MASA",
      producto: info ? info.nombre : "",
      productId: info ? info.productId : "",
      parentId: info ? info.parentId : "",
      kind: info ? info.kind : "",
      tipo: "RM",
      unidad: "kg",
      movimiento: round2_(peMasaKg),
      sentido: "-",
      estado: info ? "OK" : "SKU no encontrado en Holded Raw"
    });
  }

  if (peRecicladoKg > 0) {
    const info = holdedIdx[normalizeKey_("PE RECICLADO")];
    movimientos.push({
      sku: "PE RECICLADO",
      producto: info ? info.nombre : "",
      productId: info ? info.productId : "",
      parentId: info ? info.parentId : "",
      kind: info ? info.kind : "",
      tipo: "RM",
      unidad: "kg",
      movimiento: round2_(peRecicladoKg),
      sentido: "-",
      estado: info ? "OK" : "SKU no encontrado en Holded Raw"
    });
  }

  if (insertoV4Uds > 0) {
    const info = holdedIdx[normalizeKey_("INSERTO V4")];
    movimientos.push({
      sku: "INSERTO V4",
      producto: info ? info.nombre : "",
      productId: info ? info.productId : "",
      parentId: info ? info.parentId : "",
      kind: info ? info.kind : "",
      tipo: "RM",
      unidad: "ud",
      movimiento: round2_(insertoV4Uds),
      sentido: "-",
      estado: info ? "OK" : "SKU no encontrado en Holded Raw"
    });
  }

  if (pigmento300Kg > 0) {
    const info = holdedIdx[normalizeKey_("PIG300")];
    movimientos.push({
      sku: "PIG300",
      producto: info ? info.nombre : "",
      productId: info ? info.productId : "",
      parentId: info ? info.parentId : "",
      kind: info ? info.kind : "",
      tipo: "RM",
      unidad: "kg",
      movimiento: round2_(pigmento300Kg),
      sentido: "-",
      estado: info ? "OK" : "SKU no encontrado en Holded Raw"
    });
  }

  if (pigmento301Kg > 0) {
    const info = holdedIdx[normalizeKey_("PIG301")];
    movimientos.push({
      sku: "PIG301",
      producto: info ? info.nombre : "",
      productId: info ? info.productId : "",
      parentId: info ? info.parentId : "",
      kind: info ? info.kind : "",
      tipo: "RM",
      unidad: "kg",
      movimiento: round2_(pigmento301Kg),
      sentido: "-",
      estado: info ? "OK" : "SKU no encontrado en Holded Raw"
    });
  }

  return movimientos;
}

function previewStockMovements() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const movimientos = buildStockMovementsFromResumen_();

  let sh = ss.getSheetByName("Holded Preview");
  if (!sh) sh = ss.insertSheet("Holded Preview");
  sh.clearContents();

  const headers = [
    "SKU",
    "Producto Holded",
    "productId Holded",
    "productId Padre",
    "Kind",
    "Tipo",
    "Unidad",
    "Sentido",
    "Movimiento",
    "Estado"
  ];

  const rows = movimientos.map(m => [
    m.sku,
    m.producto,
    m.productId,
    m.parentId || "",
    m.kind || "",
    m.tipo,
    m.unidad,
    m.sentido,
    m.movimiento,
    m.estado
  ]);

  sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight("bold");

  if (rows.length) {
    sh.getRange(2, 1, rows.length, headers.length).setValues(rows);
  }

  sh.setFrozenRows(1);
  sh.autoResizeColumns(1, headers.length);
}

function applyStockMovements() {
  const movimientos = buildStockMovementsFromResumen_();
  const grouped = {};
  const timestamp = new Date();
  const logRows = [];
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const resumenInfo = getResumenFechaTurno_();
  const alreadyApplied = readAppliedStockMovementKeys_(ss, resumenInfo);
  const catalog = readHoldedStockCatalog_();
  const activeLots = readActiveStockLots_(ss);

  // Agrupar por producto real de Holded
  movimientos.forEach(m => {
    if (m.estado !== "OK") {
      logRows.push([timestamp, m.sku, m.producto, m.productId, m.parentId || "", m.kind || "", m.tipo, m.unidad, m.sentido, m.movimiento, "", "", "ERROR", m.estado]);
      return;
    }

    const currentProduct = catalog[normalizeKey_(m.sku)] || null;
    const isLotManaged = currentProduct && currentProduct.kind === "lots";
    const esVariante = !isLotManaged && !!m.parentId && m.kind === "variants";
    const urlProductId = currentProduct && currentProduct.id
      ? currentProduct.id
      : (esVariante ? m.parentId : m.productId);
    const lotResolution = isLotManaged
      ? resolveStockLot_(m.sku, currentProduct, activeLots)
      : { lot: null, source: "SIN LOTES" };
    const bodyProductId = isLotManaged && lotResolution.lot ? lotResolution.lot.id : m.productId;
    const delta = m.sentido === "+" ? m.movimiento : -m.movimiento;
    const key = `${urlProductId}__${bodyProductId}`;

    if (!grouped[key]) {
      grouped[key] = {
        ...m,
        urlProductId,
        bodyProductId,
        lotId: lotResolution.lot ? lotResolution.lot.id : "",
        lotName: lotResolution.lot ? safeStr_(lotResolution.lot.sku) : "",
        lotSource: lotResolution.source,
        lotError: lotResolution.error || "",
        delta: 0,
        movimientoAgrupado: 0
      };
    }

    grouped[key].delta += delta;
    grouped[key].movimientoAgrupado += m.movimiento;
  });

  Object.values(grouped).forEach((g, idx) => {
    try {
      const delta = round2_(g.delta);
      const movementKey = buildStockMovementKey_(resumenInfo, g.sku, delta);
      if (g.lotError) throw new Error(g.lotError);
      if (alreadyApplied.has(movementKey)) {
        logRows.push([
          timestamp, g.sku, g.producto, g.productId, g.parentId || "", g.kind || "",
          g.tipo, g.unidad, delta >= 0 ? "+" : "-", round2_(Math.abs(g.movimientoAgrupado)),
          "", "", "OMITIDO", "Ya aplicado anteriormente; no se duplica.",
          g.lotId, g.lotName, g.lotSource, movementKey
        ]);
        return;
      }
      const url = `${HOLDED_STOCK.baseUrl}/products/${g.urlProductId}/stock`;

      const payload = {
        stock: {
          [HOLDED_STOCK.warehouseId]: {
            [g.bodyProductId]: delta
          }
        }
      };

      const response = UrlFetchApp.fetch(url, {
        method: "put",
        headers: {
          "key": getHoldedApiKey_(),
          "accept": "application/json",
          "content-type": "application/json"
        },
        payload: JSON.stringify(payload),
        muteHttpExceptions: true
      });

      const code = response.getResponseCode();
      const body = response.getContentText();

      if (code < 200 || code >= 300) {
        throw new Error(`Holded ${code}: ${body}`);
      }

      logRows.push([
        timestamp,
        g.sku,
        g.producto,
        g.productId,
        g.parentId || "",
        g.kind || "",
        g.tipo,
        g.unidad,
        delta >= 0 ? "+" : "-",
        round2_(Math.abs(g.movimientoAgrupado)),
        delta,
        "",
        "OK",
        "",
        g.lotId,
        g.lotName,
        g.lotSource,
        movementKey
      ]);

      Utilities.sleep(700); // evita rate limit

    } catch (e) {
      logRows.push([
        timestamp,
        g.sku,
        g.producto,
        g.productId,
        g.parentId || "",
        g.kind || "",
        g.tipo,
        g.unidad,
        g.sentido,
        round2_(g.movimientoAgrupado),
        "",
        "",
        "ERROR",
        e.message,
        g.lotId || "",
        g.lotName || "",
        g.lotSource || "",
        buildStockMovementKey_(resumenInfo, g.sku, round2_(g.delta))
      ]);
    }
  });
  let errorCount = 0;
  let okCount = 0;

  logRows.forEach(r => {
   if (r[12] === "ERROR") errorCount++;
   if (r[12] === "OK") okCount++;
  });
  writeHoldedLog_(logRows);
  const msg = `Stock Holded → OK: ${okCount} | ERROR: ${errorCount}`;

if (errorCount > 0) {
  SpreadsheetApp.getUi().alert("⚠️ " + msg + "\nRevisa la hoja 'Holded Log'.");
  throw new Error(msg); // hace que el script "falle" visible
} else {
  SpreadsheetApp.getUi().alert("✅ " + msg);
}
}

function readHoldedStockCatalog_() {
  const products = holdedRequest_("get", "/products");
  if (!Array.isArray(products)) throw new Error("Holded no devolvió un catálogo válido.");
  const out = {};
  products.forEach(product => {
    const sku = safeStr_(product && product.sku);
    if (sku) out[normalizeKey_(sku)] = product;
  });
  return out;
}

function readActiveStockLots_(ss) {
  const sheet = ss.getSheetByName(LOTS_APP.activeSheet);
  return sheet ? readActiveLots_(sheet) : {};
}

function resolveStockLot_(sku, product, activeLots) {
  const lots = Array.isArray(product.lots) ? product.lots : [];
  const active = activeLots[normalizeKey_(sku)] || null;
  if (active && safeStr_(active.status).toUpperCase() === "ACTIVO") {
    const selected = lots.find(lot => lot && lot.id === active.lotId);
    if (selected) return { lot: selected, source: "LOTE ACTIVO MES" };
  }

  const skuKey = normalizeKey_(sku);
  const fallback = lots.filter(lot => lot && normalizeKey_(lot.sku) === skuKey);
  if (fallback.length === 1) return { lot: fallback[0], source: "LOTE SKU" };
  if (fallback.length > 1) {
    return { lot: null, source: "", error: `Hay más de un lote llamado '${sku}' en Holded; selecciona un lote activo.` };
  }
  return { lot: null, source: "", error: `No hay lote activo válido ni un lote llamado '${sku}' en Holded.` };
}

function buildStockMovementKey_(info, sku, delta) {
  return [info.fechaStr, normalizeKey_(info.turno), normalizeKey_(sku), round2_(delta)].join("|");
}

function readAppliedStockMovementKeys_(ss, resumenInfo) {
  const out = new Set();
  const sh = ss.getSheetByName("Holded Log");
  if (!sh || sh.getLastRow() < 2) return out;
  const values = sh.getDataRange().getValues();
  const headers = values[0].map(safeStr_);
  const idx = name => headers.indexOf(name);
  const keyIdx = idx("Clave movimiento");
  for (let row = 1; row < values.length; row++) {
    if (safeStr_(values[row][idx("Resultado")]) !== "OK") continue;
    let key = keyIdx >= 0 ? safeStr_(values[row][keyIdx]) : "";
    if (!key &&
        normalizarSoloFechaString(values[row][idx("Fecha resumen")]) === resumenInfo.fechaStr &&
        normalizeKey_(values[row][idx("Turno")]) === normalizeKey_(resumenInfo.turno)) {
      const sign = safeStr_(values[row][idx("Sentido")]) === "-" ? -1 : 1;
      const delta = numberOrZero_(values[row][idx("Movimiento")]) * sign;
      key = buildStockMovementKey_(resumenInfo, values[row][idx("SKU")], delta);
    }
    if (key) out.add(key);
  }
  return out;
}
function getResumenFechaTurno_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const resumen = ss.getSheetByName(CONFIG.targetSheet || "Resumen");

  if (!resumen) throw new Error("No existe la hoja 'Resumen'.");

  const fecha = resumen.getRange(CONFIG.dateCell || "A1").getValue();
  const turno = safeStr_(resumen.getRange(CONFIG.turnoCell || "B1").getValue());

  if (!fecha) throw new Error("No hay fecha en Resumen!A1.");
  if (!turno) throw new Error("No hay turno en Resumen!B1.");

  return {
    fechaStr: normalizarSoloFechaString(fecha),
    turno: turno
  };
}
function writeHoldedLog_(rows) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName("Holded Log");
  if (!sh) sh = ss.insertSheet("Holded Log");

  const headers = [
    "Fecha resumen",
    "Turno",
    "Timestamp",
    "SKU",
    "Producto Holded",
    "productId Holded",
    "productId Padre",
    "Kind",
    "Tipo",
    "Unidad",
    "Sentido",
    "Movimiento",
    "Delta enviado",
    "Stock nuevo",
    "Resultado",
    "Detalle",
    "lotId",
    "Lote",
    "Origen lote",
    "Clave movimiento"
  ];

  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight("bold");
  } else if (sh.getLastColumn() < headers.length) {
    sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight("bold");
  }

  const { fechaStr, turno } = getResumenFechaTurno_();

  const enrichedRows = rows.map(r => {
    const padded = r.slice();
    while (padded.length < headers.length - 2) padded.push("");
    return [fechaStr, turno, ...padded];
  });

  if (enrichedRows.length) {
    sh.getRange(sh.getLastRow() + 1, 1, enrichedRows.length, headers.length).setValues(enrichedRows);
  }

  sh.autoResizeColumns(1, headers.length);
}
