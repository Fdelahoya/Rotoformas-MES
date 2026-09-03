const MANUFACTURING_COSTS = {
  windowDays: 60,
  historySheet: "Histórico",
  rawSheet: "Holded Raw",
  priceBackupSheet: "Holded Raw respaldo 02-09-2026",
  previewSheet: "Holded Costes Preview",
  logSheet: "Holded Costes Log",
  apiPauseMs: 700,
  verifyAttempts: 6,
  verifyPauseMs: 1500,
  verifyTolerance: 0.0001
};

function roundManufacturingCost_(value) {
  return Math.round((Number(value) + Number.EPSILON) * 10000) / 10000;
}

function parseManufacturingDate_(value) {
  if (value instanceof Date && !isNaN(value.getTime())) {
    return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }

  const text = String(value || "").trim();
  let match = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (match) {
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  }

  match = text.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/);
  if (match) {
    return new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]));
  }

  const parsed = new Date(text);
  if (isNaN(parsed.getTime())) return null;
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
}

function getManufacturingCostWindow_() {
  const end = new Date();
  end.setHours(23, 59, 59, 999);

  const start = new Date(end);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (MANUFACTURING_COSTS.windowDays - 1));

  return { start, end };
}

function readManufacturingCostAggregates_(ss) {
  const sheet = ss.getSheetByName(MANUFACTURING_COSTS.historySheet);
  if (!sheet) {
    throw new Error(`No existe la hoja '${MANUFACTURING_COSTS.historySheet}'.`);
  }

  const values = sheet.getDataRange().getValues();
  if (values.length < 2) {
    throw new Error(`La hoja '${MANUFACTURING_COSTS.historySheet}' no tiene datos.`);
  }

  const headers = values[0];
  const idxDate = getColIndex_(headers, "^fecha$");
  // La hoja conserva cabeceras históricas (Producto / Unidades), mientras
  // que las filas nuevas se generan conceptualmente como SKU / Uds.
  // Aceptamos ambas nomenclaturas sin modificar datos existentes.
  const idxSku = getColIndex_(headers, "^(sku|producto)$");
  const idxUnits = getColIndex_(headers, "^(uds|unidades)$");
  const idxTotalCost = getColIndex_(headers, "^coste total");

  if ([idxDate, idxSku, idxUnits, idxTotalCost].some(index => index < 0)) {
    throw new Error(
      "No localizo las columnas Fecha, Producto/SKU, Unidades/Uds y Coste total en 'Histórico'."
    );
  }

  const { start, end } = getManufacturingCostWindow_();
  const aggregates = {};

  for (let rowIndex = 1; rowIndex < values.length; rowIndex++) {
    const row = values[rowIndex];
    const sku = safeStr_(row[idxSku]);
    if (!sku || sku === "__TOTAL_TURNO__" || sku === "TOTAL TURNO") continue;

    const date = parseManufacturingDate_(row[idxDate]);
    if (!date || date < start || date > end) continue;

    const units = toNumber_(row[idxUnits]);
    const totalCost = toNumber_(row[idxTotalCost]);
    if (!Number.isFinite(units) || units <= 0) continue;
    if (!Number.isFinite(totalCost) || totalCost <= 0) continue;

    const key = normalizeKey_(sku);
    if (!aggregates[key]) {
      aggregates[key] = {
        sku,
        totalUnits: 0,
        totalCost: 0,
        runs: 0,
        firstDate: date,
        lastDate: date
      };
    }

    const aggregate = aggregates[key];
    aggregate.totalUnits += units;
    aggregate.totalCost += totalCost;
    aggregate.runs++;
    if (date < aggregate.firstDate) aggregate.firstDate = date;
    if (date > aggregate.lastDate) aggregate.lastDate = date;
  }

  return { aggregates, start, end };
}

function readHoldedRawForCosts_(ss, requestedSheetName) {
  const sheetName = requestedSheetName || MANUFACTURING_COSTS.rawSheet;
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    throw new Error(`No existe la hoja '${sheetName}'.`);
  }

  const values = sheet.getDataRange().getValues();
  if (values.length < 2) {
    throw new Error(`La hoja '${sheetName}' no tiene datos.`);
  }

  const headers = values[0];
  const indexes = {
    sku: getColIndex_(headers, "^sku holded$"),
    name: getColIndex_(headers, "^producto holded$"),
    productId: getColIndex_(headers, "^productid holded$"),
    parentId: getColIndex_(headers, "^productid padre$"),
    kind: getColIndex_(headers, "^kind$"),
    type: getColIndex_(headers, "^tipo"),
    active: getColIndex_(headers, "^activo"),
    price: getColIndex_(headers, "^precio$"),
    cost: getColIndex_(headers, "^coste medio$")
  };

  if (Object.values(indexes).some(index => index < 0)) {
    throw new Error(`Faltan columnas necesarias en '${sheetName}'.`);
  }

  const products = {};
  for (let rowIndex = 1; rowIndex < values.length; rowIndex++) {
    const row = values[rowIndex];
    const sku = safeStr_(row[indexes.sku]);
    if (!sku) continue;

    products[normalizeKey_(sku)] = {
      rawRow: rowIndex + 1,
      sku,
      name: safeStr_(row[indexes.name]),
      productId: safeStr_(row[indexes.productId]),
      parentId: safeStr_(row[indexes.parentId]),
      kind: safeStr_(row[indexes.kind]),
      type: safeStr_(row[indexes.type]),
      active: row[indexes.active] === true,
      currentPrice: normalizeHoldedCost_(row[indexes.price]),
      currentCost: normalizeHoldedCost_(row[indexes.cost])
    };
  }

  return {
    sheet,
    products,
    priceColumn: indexes.price + 1,
    costColumn: indexes.cost + 1
  };
}

function buildManufacturingCostRows_(ss) {
  const history = readManufacturingCostAggregates_(ss);
  const raw = readHoldedRawForCosts_(ss);
  const rows = [];

  Object.keys(history.aggregates).forEach(key => {
    const aggregate = history.aggregates[key];
    const product = raw.products[key];
    const calculatedCost = roundManufacturingCost_(
      aggregate.totalCost / aggregate.totalUnits
    );

    let status = "LISTO";
    if (!product) {
      status = "SKU no encontrado en Holded Raw";
    } else if (!product.active) {
      status = "Producto inactivo";
    } else if (product.type !== "FG") {
      status = "No es producto fabricado (FG)";
    } else if (!product.productId) {
      status = "Falta productId de Holded";
    } else if (!Number.isFinite(calculatedCost) || calculatedCost <= 0) {
      status = "Coste calculado no válido";
    } else if (
      product.currentCost != null &&
      Math.abs(product.currentCost - calculatedCost) < MANUFACTURING_COSTS.verifyTolerance
    ) {
      status = "SIN CAMBIOS";
    }

    const currentCost = product && product.currentCost != null
      ? product.currentCost
      : null;
    const difference = currentCost == null
      ? null
      : roundManufacturingCost_(calculatedCost - currentCost);
    const differencePct = currentCost && difference != null
      ? difference / currentCost
      : null;

    rows.push({
      sku: product ? product.sku : aggregate.sku,
      name: product ? product.name : "",
      productId: product ? product.productId : "",
      parentId: product ? product.parentId : "",
      kind: product ? product.kind : "",
      firstDate: aggregate.firstDate,
      lastDate: aggregate.lastDate,
      runs: aggregate.runs,
      totalUnits: round2_(aggregate.totalUnits),
      currentCost,
      calculatedCost,
      difference,
      differencePct,
      status,
      rawRow: product ? product.rawRow : null
    });
  });

  rows.sort((a, b) => a.sku.localeCompare(b.sku));
  return { rows, start: history.start, end: history.end, raw };
}

function getManufacturingCostPreviewHeaders_() {
  return [
    "Aplicar",
    "SKU",
    "Producto Holded",
    "productId Holded",
    "productId Padre",
    "Kind",
    "Desde",
    "Hasta",
    "Fabricaciones",
    "Unidades",
    "Coste Holded",
    "Coste fabricación 60d",
    "Variación €",
    "Variación %",
    "Estado"
  ];
}

function previewManufacturingCosts() {
  const ss = getHoldedSpreadsheet_();
  const result = buildManufacturingCostRows_(ss);

  let sheet = ss.getSheetByName(MANUFACTURING_COSTS.previewSheet);
  if (!sheet) sheet = ss.insertSheet(MANUFACTURING_COSTS.previewSheet);
  sheet.clear();

  const headers = getManufacturingCostPreviewHeaders_();
  const values = result.rows.map(row => [
    false,
    row.sku,
    row.name,
    row.productId,
    row.parentId,
    row.kind,
    row.firstDate,
    row.lastDate,
    row.runs,
    row.totalUnits,
    row.currentCost == null ? "" : row.currentCost,
    row.calculatedCost,
    row.difference == null ? "" : row.difference,
    row.differencePct == null ? "" : row.differencePct,
    row.status
  ]);

  sheet.getRange(1, 1, 1, headers.length)
    .setValues([headers])
    .setFontWeight("bold");

  if (values.length) {
    sheet.getRange(2, 1, values.length, headers.length).setValues(values);
    sheet.getRange(2, 1, values.length, 1).insertCheckboxes();
    sheet.getRange(2, 7, values.length, 2).setNumberFormat("dd/mm/yyyy");
    sheet.getRange(2, 11, values.length, 3).setNumberFormat("0.0000");
    sheet.getRange(2, 14, values.length, 1).setNumberFormat("0.00%");
  }

  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, headers.length);

  PropertiesService.getScriptProperties().setProperties({
    HOLDED_COST_PREVIEW_AT: new Date().toISOString(),
    HOLDED_COST_WINDOW_START: result.start.toISOString(),
    HOLDED_COST_WINDOW_END: result.end.toISOString()
  });

  ss.toast(
    `Vista previa creada con ${result.rows.length} SKU(s). Marca solo los que quieras aplicar.`,
    "Costes de fabricación",
    8
  );
}

function readSelectedManufacturingCosts_(ss) {
  const sheet = ss.getSheetByName(MANUFACTURING_COSTS.previewSheet);
  if (!sheet) {
    throw new Error("Primero genera la vista previa de costes de fabricación.");
  }

  const values = sheet.getDataRange().getValues();
  if (values.length < 2) {
    throw new Error("La vista previa no contiene productos.");
  }

  const headers = values[0];
  const indexes = {
    apply: getColIndex_(headers, "^aplicar$"),
    sku: getColIndex_(headers, "^sku$"),
    productId: getColIndex_(headers, "^productid holded$"),
    parentId: getColIndex_(headers, "^productid padre$"),
    calculatedCost: getColIndex_(headers, "^coste fabricación 60d$"),
    status: getColIndex_(headers, "^estado$")
  };

  if (Object.values(indexes).some(index => index < 0)) {
    throw new Error("La estructura de la vista previa no es válida. Vuelve a generarla.");
  }

  const selected = [];
  for (let rowIndex = 1; rowIndex < values.length; rowIndex++) {
    const row = values[rowIndex];
    if (row[indexes.apply] !== true) continue;

    selected.push({
      previewRow: rowIndex + 1,
      sku: safeStr_(row[indexes.sku]),
      productId: safeStr_(row[indexes.productId]),
      parentId: safeStr_(row[indexes.parentId]),
      calculatedCost: toNumber_(row[indexes.calculatedCost]),
      status: safeStr_(row[indexes.status]),
      statusColumn: indexes.status + 1,
      applyColumn: indexes.apply + 1,
      currentCostColumn: getColIndex_(headers, "^coste holded$") + 1,
      differenceColumn: getColIndex_(headers, "^variación €$") + 1,
      differencePctColumn: getColIndex_(headers, "^variación %$") + 1
    });
  }

  if (!selected.length) {
    throw new Error("No has marcado ningún SKU en la columna 'Aplicar'.");
  }

  return { sheet, selected };
}

function validateSelectedManufacturingCost_(selected, current) {
  if (!current) {
    throw new Error("El SKU ya no está disponible en el cálculo actual.");
  }
  if (current.status !== "LISTO") {
    throw new Error(`El cálculo actual no se puede aplicar: ${current.status}.`);
  }
  if (selected.status !== "LISTO") {
    throw new Error("La fila seleccionada no estaba en estado LISTO. Regenera la vista previa.");
  }
  if (selected.productId !== current.productId || selected.parentId !== current.parentId) {
    throw new Error("Los identificadores de Holded han cambiado. Regenera la vista previa.");
  }
  if (
    !Number.isFinite(selected.calculatedCost) ||
    Math.abs(selected.calculatedCost - current.calculatedCost) >= MANUFACTURING_COSTS.verifyTolerance
  ) {
    throw new Error("El histórico ha cambiado. Regenera la vista previa antes de aplicar.");
  }
}

function holdedV2Decimal_(value) {
  if (value == null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? String(number) : null;
}

function findHoldedVariant_(variants, productId, sku) {
  return variants.find(item =>
    safeStr_(item.id) === safeStr_(productId) ||
    normalizeKey_(item.sku) === normalizeKey_(sku)
  );
}

function getHoldedEconomicValue_(item, snakeCaseField, camelCaseField) {
  if (!item) return null;
  if (item[snakeCaseField] != null && item[snakeCaseField] !== "") {
    return item[snakeCaseField];
  }
  if (item[camelCaseField] != null && item[camelCaseField] !== "") {
    return item[camelCaseField];
  }
  return null;
}

function buildHoldedV2Variant_(variant, row, legacyVariants, priceOverrides) {
  const isTarget =
    row && (
      safeStr_(variant.id) === row.productId ||
      normalizeKey_(variant.sku) === normalizeKey_(row.sku)
    );
  const legacyVariant = findHoldedVariant_(
    legacyVariants,
    variant.id,
    variant.sku
  );

  if (!legacyVariant) {
    throw new Error(
      `No puedo conservar de forma segura los datos de la variante ${variant.sku || variant.id}.`
    );
  }

  // La lectura v2 devuelve los costes vacíos aunque la escritura funcione.
  // Para no borrar el coste de las variantes hermanas, lo conservamos desde v1.
  const preservedCost = isTarget
    ? row.calculatedCost
    : legacyVariant.cost;
  const skuKey = normalizeKey_(variant.sku || legacyVariant.sku);
  const preservedPrice = priceOverrides && priceOverrides[skuKey] != null
    ? priceOverrides[skuKey]
    : getHoldedEconomicValue_(legacyVariant, "price", "price");
  const preservedPurchasePrice = getHoldedEconomicValue_(
    legacyVariant,
    "purchase_price",
    "purchasePrice"
  );

  const result = {
    id: safeStr_(variant.id),
    sku: variant.sku == null ? null : String(variant.sku),
    barcode: variant.barcode == null ? null : String(variant.barcode),
    price: holdedV2Decimal_(preservedPrice),
    cost: holdedV2Decimal_(preservedCost),
    purchase_price: holdedV2Decimal_(preservedPurchasePrice),
    stock: variant.stock == null ? null : Number(variant.stock),
    description: variant.description == null ? null : String(variant.description),
    weight: variant.weight == null ? null : Number(variant.weight),
    factory_code: variant.factory_code == null ? null : String(variant.factory_code),
    archived: variant.archived == null ? null : Boolean(variant.archived)
  };

  ["lot_number", "start_date", "end_date"].forEach(field => {
    if (variant[field] !== undefined) result[field] = variant[field];
  });

  return { result, isTarget };
}

function buildHoldedV2ProductPayload_(product, row, legacyProduct, priceOverrides) {
  if (!legacyProduct) {
    throw new Error("No puedo conservar de forma segura los datos económicos del producto.");
  }

  const productSkuKey = normalizeKey_(product.sku || legacyProduct.sku);
  const preservedPrice = priceOverrides && priceOverrides[productSkuKey] != null
    ? priceOverrides[productSkuKey]
    : getHoldedEconomicValue_(legacyProduct, "price", "price");
  const preservedPurchasePrice = getHoldedEconomicValue_(
    legacyProduct,
    "purchase_price",
    "purchasePrice"
  );
  const preservedCost = row && !row.parentId
    ? row.calculatedCost
    : legacyProduct.cost;

  const payload = {
    name: String(product.name || ""),
    description: product.description == null ? null : String(product.description),
    sku: product.sku == null ? null : String(product.sku),
    barcode: product.barcode == null ? null : String(product.barcode),
    price: holdedV2Decimal_(preservedPrice),
    cost: holdedV2Decimal_(preservedCost),
    purchase_price: holdedV2Decimal_(preservedPurchasePrice),
    tags: Array.isArray(product.tags) ? product.tags : null,
    taxes: Array.isArray(product.taxes) ? product.taxes : null,
    for_sale: Boolean(product.for_sale),
    for_purchase: Boolean(product.for_purchase),
    archived: Boolean(product.archived)
  };

  if (Array.isArray(product.variants)) {
    const legacyVariants = legacyProduct && Array.isArray(legacyProduct.variants)
      ? legacyProduct.variants
      : [];
    let targetFound = !row || !row.parentId;
    payload.variants = product.variants.map(variant => {
      const mapped = buildHoldedV2Variant_(variant, row, legacyVariants, priceOverrides);
      if (mapped.isTarget) targetFound = true;
      return mapped.result;
    });
    if (!targetFound) {
      throw new Error("No localizo la variante dentro del producto padre de Holded v2.");
    }
  }

  if (Array.isArray(product.pack_items)) payload.pack_items = product.pack_items;
  if (product.show_start_date !== undefined) payload.show_start_date = product.show_start_date;
  if (product.show_end_date !== undefined) payload.show_end_date = product.show_end_date;

  return payload;
}

function updateHoldedManufacturingCost_(row) {
  const productId = row.parentId || row.productId;
  const path = `/products/${encodeURIComponent(productId)}`;
  const product = holdedV2Request_("get", path);
  const legacyProduct = holdedRequest_(
    "get",
    `/products/${encodeURIComponent(productId)}`
  );
  const payload = buildHoldedV2ProductPayload_(product, row, legacyProduct);

  holdedV2Request_("put", path, payload);

  Utilities.sleep(MANUFACTURING_COSTS.apiPauseMs);
  return verifyHoldedManufacturingCost_(row);
}

function verifyHoldedManufacturingCost_(row) {
  const verificationId = row.parentId || row.productId;
  let remoteCost = null;

  for (let attempt = 1; attempt <= MANUFACTURING_COSTS.verifyAttempts; attempt++) {
    const remote = holdedRequest_(
      "get",
      `/products/${encodeURIComponent(verificationId)}`
    );

    if (row.parentId) {
      const variants = Array.isArray(remote.variants) ? remote.variants : [];
      const variant = findHoldedVariant_(variants, row.productId, row.sku);
      remoteCost = variant ? normalizeHoldedCost_(variant.cost) : null;
    } else {
      remoteCost = normalizeHoldedCost_(remote.cost);
    }

    if (
      remoteCost != null &&
      Math.abs(remoteCost - row.calculatedCost) < MANUFACTURING_COSTS.verifyTolerance
    ) {
      return remoteCost;
    }

    if (attempt < MANUFACTURING_COSTS.verifyAttempts) {
      Utilities.sleep(MANUFACTURING_COSTS.verifyPauseMs);
    }
  }

  const received = remoteCost == null ? "sin coste" : remoteCost;
  throw new Error(
    `Holded aceptó la actualización, pero después de ${MANUFACTURING_COSTS.verifyAttempts} comprobaciones ` +
    `devuelve ${received} para ${row.sku}, en vez de ${row.calculatedCost}.`
  );
}

function updateHoldedRawCost_(raw, row, verifiedCost) {
  raw.sheet.getRange(row.rawRow, raw.costColumn).setValue(verifiedCost);
}

function verifyHoldedPrice_(productId, variantId, sku, expectedPrice) {
  let remotePrice = null;

  for (let attempt = 1; attempt <= MANUFACTURING_COSTS.verifyAttempts; attempt++) {
    const remote = holdedRequest_(
      "get",
      `/products/${encodeURIComponent(productId)}`
    );

    if (variantId) {
      const variants = Array.isArray(remote.variants) ? remote.variants : [];
      const variant = findHoldedVariant_(variants, variantId, sku);
      remotePrice = variant ? normalizeHoldedCost_(variant.price) : null;
    } else {
      remotePrice = normalizeHoldedCost_(remote.price);
    }

    if (
      remotePrice != null &&
      Math.abs(remotePrice - expectedPrice) < MANUFACTURING_COSTS.verifyTolerance
    ) {
      return remotePrice;
    }

    if (attempt < MANUFACTURING_COSTS.verifyAttempts) {
      Utilities.sleep(MANUFACTURING_COSTS.verifyPauseMs);
    }
  }

  const received = remotePrice == null ? "sin precio" : remotePrice;
  throw new Error(
    `Holded devuelve ${received} para ${sku}, en vez de ${expectedPrice}.`
  );
}

function repairHoldedPricesFromBackup() {
  const ss = getHoldedSpreadsheet_();
  const current = readHoldedRawForCosts_(ss, MANUFACTURING_COSTS.rawSheet);
  const backup = readHoldedRawForCosts_(ss, MANUFACTURING_COSTS.priceBackupSheet);
  const repairs = [];

  Object.keys(backup.products).forEach(key => {
    const before = backup.products[key];
    const now = current.products[key];
    if (!now || before.currentPrice == null || before.currentPrice <= 0) return;

    const lostPrice = now.currentPrice == null || now.currentPrice === 0;
    if (!lostPrice) return;

    repairs.push({
      sku: now.sku,
      productId: now.productId,
      parentId: now.parentId,
      rawRow: now.rawRow,
      price: before.currentPrice
    });
  });

  if (!repairs.length) {
    SpreadsheetApp.getUi().alert("No hay precios perdidos que reparar.");
    return;
  }

  const ui = SpreadsheetApp.getUi();
  const confirmation = ui.alert(
    "Reparar precios de Holded",
    `Se restaurarán ${repairs.length} precios desde '${MANUFACTURING_COSTS.priceBackupSheet}'. ¿Quieres continuar?`,
    ui.ButtonSet.YES_NO
  );
  if (confirmation !== ui.Button.YES) return;

  const simpleRepairs = repairs.filter(item => !item.parentId);
  const variantGroups = {};
  repairs.filter(item => item.parentId).forEach(item => {
    if (!variantGroups[item.parentId]) variantGroups[item.parentId] = [];
    variantGroups[item.parentId].push(item);
  });

  let okCount = 0;
  const errors = [];

  simpleRepairs.forEach(item => {
    try {
      const path = `/products/${encodeURIComponent(item.productId)}`;
      const product = holdedV2Request_("get", path);
      const legacyProduct = holdedRequest_("get", path);
      const priceOverrides = {};
      priceOverrides[normalizeKey_(item.sku)] = item.price;
      const payload = buildHoldedV2ProductPayload_(
        product,
        null,
        legacyProduct,
        priceOverrides
      );
      holdedV2Request_("put", path, payload);
      Utilities.sleep(MANUFACTURING_COSTS.apiPauseMs);
      const verified = verifyHoldedPrice_(item.productId, "", item.sku, item.price);
      current.sheet.getRange(item.rawRow, current.priceColumn).setValue(verified);
      okCount++;
    } catch (error) {
      errors.push(`${item.sku}: ${error && error.message ? error.message : error}`);
    }
  });

  Object.keys(variantGroups).forEach(parentId => {
    const group = variantGroups[parentId];
    try {
      const path = `/products/${encodeURIComponent(parentId)}`;
      const product = holdedV2Request_("get", path);
      const legacyProduct = holdedRequest_("get", path);
      const priceOverrides = {};
      group.forEach(item => {
        priceOverrides[normalizeKey_(item.sku)] = item.price;
      });

      const payload = buildHoldedV2ProductPayload_(
        product,
        null,
        legacyProduct,
        priceOverrides
      );
      holdedV2Request_("put", path, payload);
      Utilities.sleep(MANUFACTURING_COSTS.apiPauseMs);

      group.forEach(item => {
        const verified = verifyHoldedPrice_(parentId, item.productId, item.sku, item.price);
        current.sheet.getRange(item.rawRow, current.priceColumn).setValue(verified);
        okCount++;
      });
    } catch (error) {
      const detail = error && error.message ? error.message : String(error);
      group.forEach(item => errors.push(`${item.sku}: ${detail}`));
    }
  });

  if (errors.length) {
    console.error(errors.join("\n"));
    ui.alert(
      `⚠️ Precios reparados: ${okCount} | errores: ${errors.length}. Revisa el registro de ejecución.`
    );
    throw new Error(`Reparación incompleta: ${errors.length} error(es).`);
  }

  ui.alert(`✅ Precios restaurados en Holded y Holded Raw: ${okCount}.`);
}

function writeManufacturingCostLog_(ss, rows) {
  let sheet = ss.getSheetByName(MANUFACTURING_COSTS.logSheet);
  if (!sheet) sheet = ss.insertSheet(MANUFACTURING_COSTS.logSheet);

  const headers = [
    "Timestamp",
    "SKU",
    "productId Holded",
    "productId Padre",
    "Coste anterior",
    "Coste calculado",
    "Coste verificado",
    "Resultado",
    "Detalle"
  ];

  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length)
      .setValues([headers])
      .setFontWeight("bold");
  }

  if (rows.length) {
    sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, headers.length)
      .setValues(rows);
  }
  sheet.autoResizeColumns(1, headers.length);
}

function applySelectedManufacturingCosts() {
  const ss = getHoldedSpreadsheet_();
  const preview = readSelectedManufacturingCosts_(ss);
  const currentResult = buildManufacturingCostRows_(ss);
  const currentBySku = {};
  currentResult.rows.forEach(row => {
    currentBySku[normalizeKey_(row.sku)] = row;
  });

  const ui = SpreadsheetApp.getUi();
  const confirmation = ui.alert(
    "Actualizar costes en Holded",
    `Se actualizarán ${preview.selected.length} SKU(s). ¿Quieres continuar?`,
    ui.ButtonSet.YES_NO
  );
  if (confirmation !== ui.Button.YES) return;

  const timestamp = new Date();
  const logRows = [];
  let okCount = 0;
  let errorCount = 0;

  preview.selected.forEach(selected => {
    const current = currentBySku[normalizeKey_(selected.sku)];

    try {
      validateSelectedManufacturingCost_(selected, current);
      const verifiedCost = updateHoldedManufacturingCost_(current);
      updateHoldedRawCost_(currentResult.raw, current, verifiedCost);

      preview.sheet.getRange(selected.previewRow, selected.applyColumn).setValue(false);
      preview.sheet.getRange(selected.previewRow, selected.currentCostColumn).setValue(verifiedCost);
      preview.sheet.getRange(selected.previewRow, selected.differenceColumn).setValue(0);
      preview.sheet.getRange(selected.previewRow, selected.differencePctColumn).setValue(0);
      preview.sheet.getRange(selected.previewRow, selected.statusColumn).setValue("ACTUALIZADO");

      logRows.push([
        timestamp,
        current.sku,
        current.productId,
        current.parentId,
        current.currentCost == null ? "" : current.currentCost,
        current.calculatedCost,
        verifiedCost,
        "OK",
        ""
      ]);
      okCount++;
    } catch (error) {
      const detail = error && error.message ? error.message : String(error);
      preview.sheet.getRange(selected.previewRow, selected.statusColumn)
        .setValue("ERROR - revisa Holded Costes Log");

      logRows.push([
        timestamp,
        selected.sku,
        selected.productId,
        selected.parentId,
        current && current.currentCost != null ? current.currentCost : "",
        current ? current.calculatedCost : selected.calculatedCost,
        "",
        "ERROR",
        detail
      ]);
      errorCount++;
    }
  });

  writeManufacturingCostLog_(ss, logRows);
  const message = `Costes Holded → OK: ${okCount} | ERROR: ${errorCount}`;

  if (errorCount) {
    ui.alert("⚠️ " + message + "\nRevisa la hoja 'Holded Costes Log'.");
    throw new Error(message);
  }

  ui.alert("✅ " + message);
}
