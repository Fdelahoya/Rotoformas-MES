/***** CONFIG *****/
const CONFIG = {
  sourceSheet: "Respuestas por turno en crudo", // datos crudos del form
  targetSheet: "Resumen",                        // hoja de salida
  dateCell: "A1",                               // fecha a filtrar
  turnoCell: "B1",                              // turno (opcional)
  outputStartCell: "A3",                        // inicio de tabla en "Resumen"
  historicoSheet: "Histórico",                  // hoja del histórico
  historicoDedup: true,                         // borrar previo (fecha+turno) antes de guardar
  productMasterSheet: "Parametros manuales"        // hoja maestra de productos y costes
};
/*******************/

/** ============ UTILS BASE ============ **/
function toNumber_(v) {
  if (v == null || v === "") return NaN;
  if (typeof v === "number") return v;

  let s = String(v).trim().replace(/\u00A0/g, "");
  s = s.replace(/\s/g, "");

  // 1.234,56 -> 1234.56
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) {
    return Number(s.replace(/\./g, "").replace(",", "."));
  }

  // 2,7 -> 2.7
  if (/^\d+,\d+$/.test(s)) {
    return Number(s.replace(",", "."));
  }

  const n = Number(s.replace(",", "."));
  return isNaN(n) ? NaN : n;
}

function numberOrZero_(v) {
  const n = toNumber_(v);
  return isNaN(n) ? 0 : n;
}

function normalizeKey_(s) {
  return String(s || "")
    .replace(/\u00A0/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function getColIndex_(headers, pattern) {
  const re = new RegExp(pattern, "i");
  for (let i = 0; i < headers.length; i++) {
    const h = String(headers[i] || "")
      .replace(/\u00A0/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (re.test(h)) return i;
  }
  return -1;
}

function safeStr_(v) {
  return v == null ? "" : String(v).trim();
}

function round2_(x) {
  return Math.round((x + Number.EPSILON) * 100) / 100;
}

function normalizarSoloFechaString(v) {
  const d = v instanceof Date ? v : tryParseDate_(v);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function tryParseDate_(val) {
  if (val instanceof Date) return val;
  const s = String(val).trim();
  const m = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/);
  if (m) {
    const d = parseInt(m[1], 10);
    const mm = parseInt(m[2], 10) - 1;
    const y = parseInt(m[3], 10);
    return new Date(y, mm, d);
  }
  const d2 = new Date(s);
  if (!isNaN(d2.getTime())) return d2;
  return new Date();
}

function limpiarSalida_(sheet, startA1) {
  const start = sheet.getRange(startA1);
  const maxRows = sheet.getMaxRows() - start.getRow() + 1;
  const maxCols = 32;
  sheet.getRange(start.getRow(), start.getColumn(), maxRows, maxCols).clearContent();
}

/** ============ MENU ============ **/
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("Rotoformas")
    .addItem("Generar resumen del día (con márgenes)", "generarResumenDelDia")
    .addSeparator()
    .addSubMenu(
      SpreadsheetApp.getUi().createMenu("Holded")
        .addItem("Actualizar catálogo Holded", "syncHoldedProducts")
        .addItem("Configurar token API v2", "configureHoldedApiV2Token")
        .addSeparator()
        .addItem("Preparar costes fabricación (60 días)", "previewManufacturingCosts")
        .addItem("Aplicar costes seleccionados", "applySelectedManufacturingCosts")
        .addSeparator()
        .addItem("Verificar SKUs del resumen", "verificarSkusResumen")
        .addItem("Preview movimientos stock", "previewStockMovements")
        .addItem("Aplicar movimientos stock", "applyStockMovements")
    )
    .addToUi();
}

/** ============ RESUMEN DEL DÍA ============ **/
function generarResumenDelDia() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const src = ss.getSheetByName(CONFIG.sourceSheet);
  const dst = ss.getSheetByName(CONFIG.targetSheet);

  if (!src || !dst) {
    throw new Error("Revisa CONFIG: no encuentro hojas origen/destino.");
  }

  const fechaObjetivo = dst.getRange(CONFIG.dateCell).getValue();
  const turnoObjetivo = (dst.getRange(CONFIG.turnoCell).getValue() || "").toString().trim();

  if (!fechaObjetivo) {
    throw new Error(`Pon una fecha en ${CONFIG.targetSheet}!${CONFIG.dateCell}`);
  }

  const data = src.getDataRange().getValues();
  if (data.length < 2) {
    throw new Error("No hay datos en la hoja de origen.");
  }

  const headers = data[0];
  const rows = data.slice(1);

  const idxFecha = 0;
  const idxTurno = 1;

  const objetivoStr = normalizarSoloFechaString(fechaObjetivo);

  const candidatas = rows.filter(r => {
    const fechaFila = r[idxFecha];
    if (!fechaFila) return false;
    const filaStr = normalizarSoloFechaString(fechaFila);
    const okFecha = filaStr === objetivoStr;
    const okTurno = turnoObjetivo ? String(r[idxTurno] || "").trim() === turnoObjetivo : true;
    return okFecha && okTurno;
  });

  limpiarSalida_(dst, CONFIG.outputStartCell);

  if (candidatas.length === 0) {
    dst.getRange(CONFIG.outputStartCell).setValue("⚠️ No hay registros para esa fecha/turno.");
    return;
  }

  candidatas.sort((a, b) => {
    const da = new Date(a[idxFecha]).getTime() || 0;
    const db = new Date(b[idxFecha]).getTime() || 0;
    return db - da;
  });
  const fila = candidatas[0];

  // SKU | Uds
  const pares = [];
  for (let i = 2; i < headers.length; i++) {
    const header = String(headers[i] || "").trim();
    const val = fila[i];
    if (header && val !== "" && val != null) {
      const uds = toNumber_(val);
      if (!isNaN(uds) && uds !== 0) {
        pares.push({ producto: header, uds });
      }
    }
  }

  if (pares.length === 0) {
    dst.getRange(CONFIG.outputStartCell).setValue("⚠️ No hay productos con unidades > 0 para esa fecha/turno.");
    return;
  }

  const costes = readCostParameters_(ss, CONFIG.productMasterSheet);
  const master = readHoldedRawMaster_(ss, "Holded Raw");
  const recycledSkus = readRecycledSkuList_(ss, CONFIG.productMasterSheet);

  const totalGas = costes.turnoGas || 0;
  const totalLuz = costes.turnoLuz || 0;
  const totalMOD = costes.turnoMOD || 0;
  const totalIndirecto = totalGas + totalLuz + totalMOD;

  let kgTotalTurno = 0;
  const missing = [];

  

const filasCalc = pares.map(p => {
  const key = normalizeKey_(p.producto);
  const meta = master[key] || {};

  if (!meta || (!meta.peso && !meta.precio)) {
    missing.push(p.producto);
  }

  const peso = numberOrZero_(meta.peso);
  const precioVenta = numberOrZero_(meta.precio);
  const skuOriginal = safeStr_(p.producto);
  const skuKey = normalizeKey_(skuOriginal);

  const esReciclado = recycledSkus.has(skuKey);
  const esMasa = /-M(\s|$)/.test(skuOriginal);

  const precioPE = esReciclado
    ? numberOrZero_(costes.peReciclado)
    : esMasa
      ? numberOrZero_(costes.peMasa)
      : numberOrZero_(costes.peGlobal);

  const kgTotal = peso * p.uds;
  kgTotalTurno += kgTotal;

  const ingresos = precioVenta * p.uds;
  const costeMaterial = precioPE * kgTotal;

  return {
    producto: p.producto,
    uds: p.uds,
    pesoKgUd: peso,
    kgTotal,
    precioVenta,
    ingresos,
    precioPE,
    costeMaterial
  };
});

  filasCalc.forEach(r => {
    const share = kgTotalTurno > 0 ? r.kgTotal / kgTotalTurno : 0;
    r.costeIndirecto = round2_(share * totalIndirecto);
    r.costeTotal = round2_(r.costeMaterial + r.costeIndirecto);
    r.margen = round2_(r.ingresos - r.costeTotal);
    r.margenPct = r.ingresos > 0 ? round2_(r.margen / r.ingresos) : 0;
    r.margenUnit = r.uds > 0 ? round2_(r.margen / r.uds) : 0;
  });

  const headerOut = [
    "SKU", "Uds", "Peso (kg/u)", "Kg totales",
    "Precio venta (€)", "Ingresos (€)",
    "PE €/kg", "Coste material (€)",
    "Indirectos prorr. (€)", "Coste total (€)",
    "Margen (€)", "Margen (%)", "Margen unit (€)",
    "Gas turno (€)", "Luz turno (€)", "MOD turno (€)", "Kg totales turno"
  ];

  const rowsOut = filasCalc.map(r => [
    r.producto, r.uds, r.pesoKgUd, r.kgTotal,
    r.precioVenta, r.ingresos,
    r.precioPE, r.costeMaterial,
    r.costeIndirecto, r.costeTotal,
    r.margen, r.margenPct, r.margenUnit,
    totalGas, totalLuz, totalMOD, kgTotalTurno
  ]);

  const start = dst.getRange(CONFIG.outputStartCell);
  const area = dst.getRange(start.getRow(), start.getColumn(), rowsOut.length + 1, headerOut.length);
  area.clearContent();

  dst.getRange(start.getRow(), start.getColumn(), 1, headerOut.length)
    .setValues([headerOut])
    .setFontWeight("bold");

  dst.getRange(start.getRow() + 1, start.getColumn(), rowsOut.length, headerOut.length)
    .setValues(rowsOut);

  // Aviso de SKUs sin ficha
  if (missing.length) {
    dst.getRange(start.getRow() - 1, start.getColumn())
      .setValue("⚠️ Sin ficha en 'HOlded Raw': " + [...new Set(missing)].join(", "));
  }

  // Totales
  const totalIngresos = round2_(filasCalc.reduce((s, r) => s + r.ingresos, 0));
  const totalCoste = round2_(filasCalc.reduce((s, r) => s + r.costeTotal, 0));
  const totalMargen = round2_(filasCalc.reduce((s, r) => s + r.margen, 0));
  const totalMargenPct = totalIngresos > 0 ? round2_(totalMargen / totalIngresos) : 0;

  const gap = 1;
  const totalsStartRow = start.getRow() + 1 + rowsOut.length + gap;
  const totalsStartCol = start.getColumn();

  dst.getRange(totalsStartRow, totalsStartCol, 1, 2)
    .setValues([["TOTAL TURNO", ""]])
    .setFontWeight("bold");

  const totals = [
    ["Ingresos totales (€)", totalIngresos],
    ["Coste total (€)", totalCoste],
    ["Margen total (€)", totalMargen],
    ["Margen (%)", totalMargenPct]
  ];

  dst.getRange(totalsStartRow + 1, totalsStartCol, totals.length, 2).setValues(totals);
  dst.getRange(totalsStartRow + 4, totalsStartCol + 1).setNumberFormat("0.00%");

  const fechaStr = objetivoStr;
  const turnoStr = turnoObjetivo || "";
  writeHistoricoConCalculos_(ss, filasCalc, fechaStr, turnoStr, totalGas, totalLuz, totalMOD, kgTotalTurno);
}

/** ============ LECTURA MAESTRA ============ **/
function readCostParameters_(ss, sheetName) {
  const sh = ss.getSheetByName(sheetName);
  if (!sh) throw new Error(`No encuentro la hoja de parámetros: ${sheetName}`);

  return {
    turnoGas: numberOrZero_(sh.getRange("E2").getValue()),
    turnoLuz: numberOrZero_(sh.getRange("F2").getValue()),
    turnoMOD: numberOrZero_(sh.getRange("G2").getValue()),
    peGlobal: numberOrZero_(sh.getRange("H2").getValue()),
    peMasa: numberOrZero_(sh.getRange("I2").getValue()),
    peReciclado: numberOrZero_(sh.getRange("J2").getValue()),
    turnosAnio: numberOrZero_(sh.getRange("K2").getValue())
  };
}

function readHoldedRawMaster_(ss, sheetName) {
  const sh = ss.getSheetByName(sheetName);
  if (!sh) throw new Error(`No encuentro la hoja maestra de Holded: ${sheetName}`);

  const values = sh.getDataRange().getValues();
  if (values.length < 2) throw new Error("La hoja 'Holded Raw' no tiene datos.");

  const headers = values[0];

  const idxSku    = getColIndex_(headers, "^sku holded$");
  const idxNombre = getColIndex_(headers, "^producto holded$");
  const idxPeso   = getColIndex_(headers, "^peso$");
  const idxPrecio = getColIndex_(headers, "^precio$");
  const idxTipo   = getColIndex_(headers, "^tipo");
  const idxUnidad = getColIndex_(headers, "^unidad");
  const idxActivo = getColIndex_(headers, "^activo");

  if ([idxSku, idxPeso, idxPrecio].some(i => i < 0)) {
    throw new Error("No localizo columnas clave en 'Holded Raw'.");
  }

  const out = {};

  for (let r = 1; r < values.length; r++) {
    const row = values[r];
    const sku = safeStr_(row[idxSku]);
    if (!sku) continue;

    const activo = idxActivo >= 0 ? row[idxActivo] : true;
    if (activo !== true) continue;

    out[normalizeKey_(sku)] = {
      sku: sku,
      nombre: idxNombre >= 0 ? safeStr_(row[idxNombre]) : "",
      peso: numberOrZero_(row[idxPeso]),
      precio: numberOrZero_(row[idxPrecio]),
      tipo: idxTipo >= 0 ? safeStr_(row[idxTipo]) : "",
      unidad: idxUnidad >= 0 ? safeStr_(row[idxUnidad]) : ""
    };
  }

  return out;
}

/** ============ HISTÓRICO ============ **/
function writeHistoricoConCalculos_(ss, filasCalc, fechaStr, turnoStr, totalGas, totalLuz, totalMOD, kgTotalTurno) {
  let hist = ss.getSheetByName(CONFIG.historicoSheet);
  if (!hist) hist = ss.insertSheet(CONFIG.historicoSheet);

  const header = [
    "Fecha", "Turno", "SKU", "Uds", "Peso (kg/u)", "Kg totales",
    "Precio venta (€)", "Ingresos (€)",
    "PE €/kg", "Coste material (€)",
    "Indirectos prorr. (€)", "Coste total (€)",
    "Margen (€)", "Margen (%)", "Margen unit (€)",
    "Gas turno (€)", "Luz turno (€)", "MOD turno (€)", "Kg totales turno"
  ];

  if (hist.getLastRow() === 0) hist.appendRow(header);

  if (CONFIG.historicoDedup) {
    const rng = hist.getDataRange().getValues();
    for (let r = rng.length - 1; r >= 1; r--) {
      const f = String(rng[r][0] || "").trim();
      const t = String(rng[r][1] || "").trim();
      if (f === fechaStr && t === turnoStr) {
        hist.deleteRow(r + 1);
      }
    }
  }

  const rows = filasCalc.map(r => [
    fechaStr, turnoStr, r.producto, r.uds, r.pesoKgUd, r.kgTotal,
    r.precioVenta, r.ingresos,
    r.precioPE, r.costeMaterial,
    r.costeIndirecto, r.costeTotal,
    r.margen, r.margenPct, r.margenUnit,
    totalGas, totalLuz, totalMOD, kgTotalTurno
  ]);

  const totalIngresos = filasCalc.reduce((s, r) => s + (r.ingresos || 0), 0);
  const totalCosteMat = filasCalc.reduce((s, r) => s + (r.costeMaterial || 0), 0);
  const totalIndir = filasCalc.reduce((s, r) => s + (r.costeIndirecto || 0), 0);
  const totalCoste = filasCalc.reduce((s, r) => s + (r.costeTotal || 0), 0);
  const totalMargen = filasCalc.reduce((s, r) => s + (r.margen || 0), 0);
  const totalMargenPct = totalIngresos > 0 ? totalMargen / totalIngresos : 0;

  const totalRow = [
    fechaStr, turnoStr, "__TOTAL_TURNO__", "", "", kgTotalTurno,
    "", totalIngresos,
    "", totalCosteMat,
    totalIndir, totalCoste,
    totalMargen, totalMargenPct, "",
    totalGas, totalLuz, totalMOD, kgTotalTurno
  ];

  const startRow = hist.getLastRow() + 1;
  if (rows.length) {
    hist.getRange(startRow, 1, rows.length, header.length).setValues(rows);
  }
  hist.getRange(startRow + rows.length, 1, 1, header.length).setValues([totalRow]);
  hist.getRange(startRow + rows.length, 14).setNumberFormat("0.00%");
}
function readRecycledSkuList_(ss, sheetName) {
  const sh = ss.getSheetByName(sheetName);
  if (!sh) throw new Error(`No encuentro la hoja: ${sheetName}`);

  const startRow = 9;   // E9 hacia abajo
  const col = 5;        // columna E
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
