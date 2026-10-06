/** Preview de solo lectura para preparar migraciones en Holded producción. */
const MIGRATION_PRODUCTION_PREVIEW_SKU = "PORTATAPAS";
const MIGRATION_PRODUCTION_PORTATAPAS_ID = "6960c9cf12ba41cb2706029a";
const MIGRATION_PRODUCTION_PORTATAPAS_BACKUP = "HOLDED_PRODUCTION_PORTATAPAS_BACKUP";
const MIGRATION_PRODUCTION_NEXT_SKUS = [
  "CONJUNTO-FILTRO1B",
  "CONJUNTO-FILTRO2B",
  "PORTATAPAS OVAL2000"
];
const MIGRATION_PRODUCTION_OVAL2000_SKU = "PORTATAPAS OVAL2000";
const MIGRATION_PRODUCTION_OVAL2000_ID = "6a8d397db8d01e472309945c";
const MIGRATION_PRODUCTION_OVAL2000_BACKUP = "HOLDED_PRODUCTION_OVAL2000_BACKUP";
const MIGRATION_PRODUCTION_TAGGED_ZERO_STOCK = [
  { id: "691f11758d2a6b25b40e10bb", sku: "CAÑON M" },
  { id: "691f11758d2a6b25b40e10d9", sku: "DEP 1000A" },
  { id: "691f11758d2a6b25b40e10f1", sku: "DEP 1200S" },
  { id: "691f11768d2a6b25b40e1139", sku: "ENVOLVENTE AD" },
  { id: "691f11780eb5f3774200f6e8", sku: "TOBERA 120" },
  { id: "691f11780eb5f3774200f6ee", sku: "TOBERA 200" },
  { id: "691f11780eb5f3774200f6f4", sku: "TOBERA 200M" },
  { id: "691f11780eb5f3774200f6fa", sku: "TOBERA D900" },
  { id: "691f11780eb5f3774200f700", sku: "TOBERA PW" },
  { id: "691f11790eb5f3774200f742", sku: "TOLVA70MD" },
  { id: "6920235b5053084968026ef5", sku: "ENVOLVENTE 8S" },
  { id: "696dfe8ddcd9ff1b44071349", sku: "DEP 1000 AUX" }
];
const MIGRATION_PRODUCTION_TAGGED_POSITIVE_STOCK = [
  { id: "691f11758d2a6b25b40e1103", sku: "DEP 1500A", stock: 4 },
  { id: "691f11768d2a6b25b40e1109", sku: "DEP 1500AUXA", stock: 4 }
];
const MIGRATION_PRODUCTION_TAGGED_NEGATIVE_STOCK = [
  { id: "691f11778d2a6b25b40e11b7", sku: "TOBERA 100", stock: -4 },
  { id: "6920235b5053084968026eef", sku: "ENVOLVENTE U", stock: -14 }
];
const MIGRATION_PRODUCTION_TC_SIMPLE = [
  { id: "691f11758d2a6b25b40e10f7", sku: "DEP 135AUXD", stock: 9 },
  { id: "691f11768d2a6b25b40e110f", sku: "DEP 150AUXD", stock: 13 },
  { id: "691f11768d2a6b25b40e1115", sku: "DEP 170AUXT", stock: 5 },
  { id: "691f11768d2a6b25b40e1121", sku: "DEP 250AUXD", stock: 3 },
  { id: "691f11768d2a6b25b40e1133", sku: "ENVOLVENTE", stock: 0 },
  { id: "691f11768d2a6b25b40e1157", sku: "LAV 18", stock: 0 },
  { id: "691f11790eb5f3774200f748", sku: "TOOLBOXEVO", stock: 24 },
  { id: "691f117a0eb5f3774200f75a", sku: "TUBO TYPHOON", stock: 0 },
  { id: "691f117a0eb5f3774200f760", sku: "TUBO VENTURI", stock: 0 },
  { id: "6920235a5053084968026e9b", sku: "CICLON L", stock: 0 }
];
const MIGRATION_PRODUCTION_TC_VARIANT_FAMILIES = [
  { id: "69ba422bd74f0284df0021da", sku: "DEP 1000T-N", variants: [
    { id: "69ba422bd74f0284df0021db", sku: "DEP 1000T-N", stock: 0 },
    { id: "69ba422bd74f0284df0021dc", sku: "DEP 1000T-M", stock: 0 }
  ] },
  { id: "69ba6219f927715df80e52d7", sku: "DEP 1100-N", variants: [
    { id: "69ba6219f927715df80e52d8", sku: "DEP 1100-N", stock: 0 },
    { id: "69ba6219f927715df80e52d9", sku: "DEP 1100-M", stock: 0 }
  ] },
  { id: "69ba62a8605419957b0624bb", sku: "DEP 1200-N", variants: [
    { id: "69ba62a8605419957b0624bc", sku: "DEP 1200-N", stock: 1 },
    { id: "69ba62a8605419957b0624bd", sku: "DEP 1200-M", stock: 0 }
  ] },
  { id: "69ba6301e6fa3d5c4a096846", sku: "DEP 1500-N", variants: [
    { id: "69ba6301e6fa3d5c4a096847", sku: "DEP 1500-N", stock: 8 },
    { id: "69ba6301e6fa3d5c4a096848", sku: "DEP 1500-M", stock: 0 }
  ] },
  { id: "69ba6352e6c63fff3b0095da", sku: "DEP 2250-N", variants: [
    { id: "69ba6352e6c63fff3b0095db", sku: "DEP 2250-N", stock: 0 },
    { id: "69ba6352e6c63fff3b0095dc", sku: "DEP 2250-M", stock: 0 }
  ] },
  { id: "69ba639df793ca80aa057209", sku: "DEP 750D-N", variants: [
    { id: "69ba639df793ca80aa05720a", sku: "DEP 750D-N", stock: -1 },
    { id: "69ba639df793ca80aa05720b", sku: "DEP 750D-M", stock: 6 }
  ] },
  { id: "69ba63f13e8e7022500f10be", sku: "DEP EVOL-N", variants: [
    { id: "69ba63f13e8e7022500f10bf", sku: "DEP EVOL-N", stock: 6 },
    { id: "69ba63f13e8e7022500f10c0", sku: "DEP EVOL-M", stock: 1 }
  ] },
  { id: "69e088801aef4d1c1408fb0d", sku: "AUX EVOL", variants: [
    { id: "69e088801aef4d1c1408fb0e", sku: "AUX EVOL-N", stock: 5 },
    { id: "69e088801aef4d1c1408fb0f", sku: "AUX EVOL-M", stock: -6 }
  ] },
  { id: "6a269572ab727d7a870f72c7", sku: "LAV 26-N", variants: [
    { id: "6a269572ab727d7a870f72c8", sku: "LAV 26-N", stock: 0 },
    { id: "6a269572ab727d7a870f72c9", sku: "LAV 26-M", stock: 6 }
  ] }
];

/**
 * Localiza PORTATAPAS por SKU exacto y muestra su JSON completo.
 * Esta función únicamente realiza peticiones GET; no modifica Holded.
 */
function previewMigrationProductionPortatapas() {
  const expectedSku = MIGRATION_PRODUCTION_PREVIEW_SKU;
  const catalog = holdedV2Request_(
    "get",
    "/products?name=" + encodeURIComponent(expectedSku) + "&limit=200"
  );

  if (!catalog || !Array.isArray(catalog.items)) {
    throw new Error("El catálogo V2 de producción no contiene items[].");
  }
  if (catalog.has_more) {
    throw new Error(
      "La búsqueda devolvió más de 200 resultados. No se consultará ningún detalle."
    );
  }

  const normalize = value => String(value == null ? "" : value)
    .trim()
    .toUpperCase();
  const matches = catalog.items.filter(product => product && (
    normalize(product.sku) === expectedSku ||
    (Array.isArray(product.variants) && product.variants.some(
      variant => variant && normalize(variant.sku) === expectedSku
    ))
  ));

  if (matches.length !== 1) {
    throw new Error(
      "Se esperaba una única coincidencia exacta para " + expectedSku +
      "; encontradas: " + matches.length + ". No se ha modificado nada."
    );
  }

  const product = matches[0];
  if (!/^[a-fA-F0-9]{24}$/.test(String(product.id || ""))) {
    throw new Error("El producto encontrado no tiene un ID válido.");
  }

  migrationProductionLogJson_(
    expectedSku + " / catálogo producción",
    JSON.stringify(product)
  );
  const detail = holdedV2Request_(
    "get",
    "/products/" + encodeURIComponent(String(product.id))
  );
  migrationProductionLogJson_(
    expectedSku + " / detalle producción (SOLO LECTURA)",
    JSON.stringify(detail)
  );
  console.log("Preview completado. No se ha borrado, creado ni actualizado ningún producto.");

  return {
    productId: product.id,
    catalogProduct: product,
    detail: detail
  };
}

/**
 * Inventario de solo lectura para el siguiente bloque de migración.
 * Compara etiquetas STK/TY con criterio OR y AND sin modificar productos.
 */
function previewMigrationProductionNextBatch() {
  const products = holdedRequest_("get", "/products");
  if (!Array.isArray(products)) {
    throw new Error("Holded producción no devolvió un catálogo válido.");
  }

  const normalize = value => String(value == null ? "" : value).trim().toUpperCase();
  const normalizeTag = value => normalize(value).replace(/^#+/, "");
  const exact = {};
  MIGRATION_PRODUCTION_NEXT_SKUS.forEach(sku => { exact[sku] = []; });
  const taggedEither = [];
  const taggedBoth = [];

  products.forEach(product => {
    if (!product) return;
    const productSkus = [product.sku]
      .concat(Array.isArray(product.variants) ? product.variants.map(v => v && v.sku) : [])
      .map(normalize)
      .filter(Boolean);
    MIGRATION_PRODUCTION_NEXT_SKUS.forEach(sku => {
      if (productSkus.indexOf(sku) !== -1) exact[sku].push(product);
    });

    const tags = (Array.isArray(product.tags) ? product.tags : []).map(normalizeTag);
    const hasStk = tags.indexOf("STK") !== -1;
    const hasTy = tags.indexOf("TY") !== -1;
    if (hasStk || hasTy) taggedEither.push(product);
    if (hasStk && hasTy) taggedBoth.push(product);
  });

  MIGRATION_PRODUCTION_NEXT_SKUS.forEach(sku => {
    if (exact[sku].length !== 1) {
      throw new Error("SKU " + sku + ": se esperaba 1 familia y se encontraron " +
        exact[sku].length + ". No se ha modificado nada.");
    }
  });

  const summarize = product => ({
    id: product.id,
    kind: product.kind,
    sku: product.sku,
    name: product.name,
    stock: product.stock,
    stocks: product.stocks,
    tags: product.tags,
    variants: Array.isArray(product.variants) ? product.variants.map(variant => ({
      id: variant.id,
      sku: variant.sku,
      stock: variant.stock
    })) : []
  });
  const result = {
    exact_skus: MIGRATION_PRODUCTION_NEXT_SKUS.map(sku => summarize(exact[sku][0])),
    tagged_STK_or_TY: taggedEither.map(summarize),
    tagged_STK_and_TY: taggedBoth.map(summarize)
  };
  migrationProductionLogJson_("Siguiente bloque / preview SOLO LECTURA", JSON.stringify(result));
  console.log("Coincidencias STK o TY: " + taggedEither.length +
    ". Coincidencias con ambas etiquetas: " + taggedBoth.length + ".");
  return result;
}

/** Inventario de solo lectura de todos los productos con etiqueta TC. */
function previewMigrationProductionTc() {
  const products = holdedRequest_("get", "/products");
  if (!Array.isArray(products)) {
    throw new Error("Holded producción no devolvió un catálogo válido.");
  }
  const normalize = value => String(value == null ? "" : value).trim().toUpperCase();
  const normalizeTag = value => normalize(value).replace(/^#+/, "");
  const matches = products.filter(product => product &&
    (Array.isArray(product.tags) ? product.tags : []).map(normalizeTag).indexOf("TC") !== -1
  );
  if (!matches.length) {
    throw new Error("No se encontraron productos con etiqueta TC.");
  }

  const summary = matches.map(product => ({
    id: product.id,
    kind: product.kind,
    sku: product.sku,
    name: product.name,
    stock: product.stock,
    stocks: product.stocks,
    tags: product.tags,
    variants: Array.isArray(product.variants) ? product.variants.map(variant => ({
      id: variant.id,
      sku: variant.sku,
      stock: variant.stock,
      price: variant.price,
      cost: variant.cost
    })) : []
  }));
  const counts = summary.reduce((result, product) => {
    const kind = product.kind || "unknown";
    result[kind] = (result[kind] || 0) + 1;
    return result;
  }, {});
  const result = { counts: counts, products: summary };
  migrationProductionLogJson_("TC / preview SOLO LECTURA", JSON.stringify(result));
  console.log("Productos TC encontrados: " + summary.length + ". Tipos: " + JSON.stringify(counts));
  return result;
}

/** Preview V2 exacto de PORTATAPAS OVAL2000. Solo lectura. */
function previewMigrationProductionOval2000() {
  const source = holdedV2Request_(
    "get",
    "/products/" + MIGRATION_PRODUCTION_OVAL2000_ID
  );
  const sku = String(source && source.sku || "").trim().toUpperCase();
  if (!source || String(source.id) !== MIGRATION_PRODUCTION_OVAL2000_ID ||
      sku !== MIGRATION_PRODUCTION_OVAL2000_SKU) {
    throw new Error("El ID ya no corresponde exactamente a PORTATAPAS OVAL2000.");
  }
  migrationProductionLogJson_(
    "PORTATAPAS OVAL2000 / detalle producción (SOLO LECTURA)",
    JSON.stringify(source)
  );
  return source;
}

/** Convierte únicamente PORTATAPAS OVAL2000 de simple a lotes. */
function migrateProductionOval2000ToLots() {
  const source = previewMigrationProductionOval2000();
  if (source.kind !== "simple" ||
      (Array.isArray(source.variants) && source.variants.length)) {
    throw new Error("PORTATAPAS OVAL2000 ya no es un producto simple sin variantes.");
  }
  if ((source.rates && source.rates.length) ||
      (source.attributes && source.attributes.length) ||
      (source.pack_items && source.pack_items.length)) {
    throw new Error("El producto contiene tarifas, atributos o componentes no contemplados.");
  }

  const stock = migrationProductionNumber_(source.stock);
  if (stock !== 23 || !Array.isArray(source.stocks) || source.stocks.length !== 1 ||
      migrationProductionNumber_(source.stocks[0].stock) !== 23 ||
      !source.stocks[0].warehouse_id) {
    throw new Error("El stock ya no coincide con el preview: 23 unidades en un almacén.");
  }

  const payload = {
    name: source.name,
    kind: "lots",
    description: source.description,
    sku: source.sku,
    barcode: source.barcode,
    price: migrationProductionDecimal_(source.price),
    cost: migrationProductionDecimal_(source.cost),
    purchase_price: migrationProductionDecimal_(source.purchase_price),
    tags: source.tags,
    taxes: source.taxes,
    stock: stock,
    weight: migrationProductionNumber_(source.weight),
    has_stock: true,
    for_sale: source.for_sale,
    for_purchase: source.for_purchase,
    show_start_date: false,
    show_end_date: false,
    warehouse_id: source.stocks[0].warehouse_id,
    sales_channel_id: source.sales_channel_id,
    exp_account_id: source.exp_account_id
  };

  const properties = PropertiesService.getScriptProperties();
  properties.setProperty(MIGRATION_PRODUCTION_OVAL2000_BACKUP, JSON.stringify({
    saved_at: new Date().toISOString(),
    source: source,
    ignored_image: source.image || null,
    manual_purchase_taxes: source.purchase_taxes || []
  }));
  migrationProductionLogJson_(
    "PORTATAPAS OVAL2000 / copia previa al borrado",
    JSON.stringify(source)
  );

  holdedV2Request_("delete", "/products/" + MIGRATION_PRODUCTION_OVAL2000_ID);
  console.log("PORTATAPAS OVAL2000 original eliminado: " + MIGRATION_PRODUCTION_OVAL2000_ID + ".");

  const created = holdedV2Request_("post", "/products", payload);
  if (!created || !/^[a-fA-F0-9]{24}$/.test(String(created.id || ""))) {
    throw new Error("Holded no devolvió un ID válido al recrear PORTATAPAS OVAL2000.");
  }
  const verified = holdedV2Request_("get", "/products/" + encodeURIComponent(created.id));
  if (String(verified.id) !== String(created.id) || verified.kind !== "lots" ||
      String(verified.sku || "").trim().toUpperCase() !== MIGRATION_PRODUCTION_OVAL2000_SKU ||
      migrationProductionNumber_(verified.stock) !== 23) {
    throw new Error("La verificación del nuevo PORTATAPAS OVAL2000 no coincide.");
  }

  properties.setProperty("HOLDED_PRODUCTION_OVAL2000_MIGRATION_RESULT", JSON.stringify({
    completed_at: new Date().toISOString(),
    deleted_product_id: source.id,
    created_product_id: verified.id,
    sku: verified.sku,
    kind: verified.kind,
    stock: verified.stock
  }));
  migrationProductionLogJson_(
    "PORTATAPAS OVAL2000 / producto creado y verificado",
    JSON.stringify(verified)
  );
  console.log("Revisa manualmente el IVA de compra y, si procede, la imagen.");
  return verified;
}

/** Convierte a lotes los 12 productos STK/TY autorizados con stock cero. */
function migrateProductionTaggedZeroStockToLots() {
  const normalize = value => String(value == null ? "" : value).trim().toUpperCase();
  const normalizeTag = value => normalize(value).replace(/^#+/, "");
  const sources = MIGRATION_PRODUCTION_TAGGED_ZERO_STOCK.map(expected => {
    const source = holdedV2Request_("get", "/products/" + expected.id);
    const tags = (Array.isArray(source.tags) ? source.tags : []).map(normalizeTag);
    const warehouseStocks = Array.isArray(source.stocks) ? source.stocks : [];
    const nonZeroWarehouse = warehouseStocks.filter(item =>
      migrationProductionNumber_(item && item.stock) !== 0
    );

    if (!source || String(source.id) !== expected.id || normalize(source.sku) !== expected.sku ||
        source.kind !== "simple") {
      throw new Error("No coincide el producto autorizado: " + expected.sku + ".");
    }
    if (tags.indexOf("STK") === -1 && tags.indexOf("TY") === -1) {
      throw new Error(expected.sku + " ya no tiene etiqueta STK ni TY.");
    }
    if (migrationProductionNumber_(source.stock) !== 0 || nonZeroWarehouse.length) {
      throw new Error(expected.sku + " ya no tiene stock cero.");
    }
    if ((Array.isArray(source.variants) && source.variants.length) ||
        (source.rates && source.rates.length) ||
        (source.attributes && source.attributes.length) ||
        (source.pack_items && source.pack_items.length)) {
      throw new Error(expected.sku + " contiene variantes, tarifas, atributos o componentes.");
    }
    return source;
  });

  const properties = PropertiesService.getScriptProperties();
  const backupKeys = [];
  sources.forEach(source => {
    const key = "HOLDED_PROD_BACKUP_" + normalize(source.sku).replace(/[^A-Z0-9]+/g, "_");
    properties.setProperty(key, JSON.stringify({
      saved_at: new Date().toISOString(),
      source: source,
      ignored_image: source.image || null,
      manual_purchase_taxes: source.purchase_taxes || []
    }));
    backupKeys.push({ sku: source.sku, key: key, id: source.id });
  });
  properties.setProperty("HOLDED_PRODUCTION_TAGGED_ZERO_BACKUPS", JSON.stringify({
    saved_at: new Date().toISOString(),
    products: backupKeys
  }));
  console.log("Preflight correcto y 12 copias guardadas. Comienza la migración.");

  const created = [];
  sources.forEach(source => {
    const warehouseStocks = Array.isArray(source.stocks) ? source.stocks : [];
    const warehouseId = source.warehouse_id ||
      (warehouseStocks[0] && warehouseStocks[0].warehouse_id) || null;
    const payload = {
      name: source.name,
      kind: "lots",
      description: source.description,
      sku: source.sku,
      barcode: source.barcode,
      price: migrationProductionDecimal_(source.price),
      cost: migrationProductionDecimal_(source.cost),
      purchase_price: migrationProductionDecimal_(source.purchase_price),
      tags: source.tags,
      taxes: source.taxes,
      stock: 0,
      weight: migrationProductionNumber_(source.weight),
      has_stock: true,
      for_sale: source.for_sale,
      for_purchase: source.for_purchase,
      show_start_date: false,
      show_end_date: false,
      warehouse_id: warehouseId,
      sales_channel_id: source.sales_channel_id,
      exp_account_id: source.exp_account_id
    };

    holdedV2Request_("delete", "/products/" + source.id);
    Utilities.sleep(300);
    const response = holdedV2Request_("post", "/products", payload);
    if (!response || !/^[a-fA-F0-9]{24}$/.test(String(response.id || ""))) {
      throw new Error("Sin ID válido al recrear " + source.sku +
        ". Completados: " + JSON.stringify(created));
    }
    Utilities.sleep(300);
    const verified = holdedV2Request_("get", "/products/" + response.id);
    if (String(verified.id) !== String(response.id) || verified.kind !== "lots" ||
        normalize(verified.sku) !== normalize(source.sku) ||
        migrationProductionNumber_(verified.stock) !== 0) {
      throw new Error("Verificación incorrecta de " + source.sku +
        ". Completados: " + JSON.stringify(created));
    }
    created.push({
      sku: verified.sku,
      deleted_id: source.id,
      created_id: verified.id,
      kind: verified.kind,
      stock: verified.stock
    });
    console.log("Migrado y verificado [" + created.length + "/" + sources.length + "]: " +
      verified.sku + " -> " + verified.id);
    Utilities.sleep(300);
  });

  properties.setProperty("HOLDED_PRODUCTION_TAGGED_ZERO_RESULT", JSON.stringify({
    completed_at: new Date().toISOString(),
    created: created
  }));
  migrationProductionLogJson_("STK/TY stock cero / migración completada", JSON.stringify(created));
  console.log("Revisa manualmente los IVA de compra y las imágenes que procedan.");
  return created;
}

/** Convierte a lotes los dos productos STK/TY autorizados con stock positivo. */
function migrateProductionTaggedPositiveStockToLots() {
  const normalize = value => String(value == null ? "" : value).trim().toUpperCase();
  const normalizeTag = value => normalize(value).replace(/^#+/, "");
  const sources = MIGRATION_PRODUCTION_TAGGED_POSITIVE_STOCK.map(expected => {
    const source = holdedV2Request_("get", "/products/" + expected.id);
    const tags = (Array.isArray(source.tags) ? source.tags : []).map(normalizeTag);
    const warehouseStocks = Array.isArray(source.stocks) ? source.stocks : [];
    if (!source || String(source.id) !== expected.id || normalize(source.sku) !== expected.sku ||
        source.kind !== "simple") {
      throw new Error("No coincide el producto autorizado: " + expected.sku + ".");
    }
    if (tags.indexOf("STK") === -1 && tags.indexOf("TY") === -1) {
      throw new Error(expected.sku + " ya no tiene etiqueta STK ni TY.");
    }
    if (migrationProductionNumber_(source.stock) !== expected.stock ||
        warehouseStocks.length !== 1 ||
        migrationProductionNumber_(warehouseStocks[0].stock) !== expected.stock ||
        !warehouseStocks[0].warehouse_id) {
      throw new Error(expected.sku + " ya no tiene exactamente " + expected.stock +
        " unidades en un único almacén.");
    }
    if ((Array.isArray(source.variants) && source.variants.length) ||
        (source.rates && source.rates.length) ||
        (source.attributes && source.attributes.length) ||
        (source.pack_items && source.pack_items.length)) {
      throw new Error(expected.sku + " contiene variantes, tarifas, atributos o componentes.");
    }
    return { source: source, expected: expected };
  });

  const properties = PropertiesService.getScriptProperties();
  sources.forEach(item => {
    const source = item.source;
    const key = "HOLDED_PROD_BACKUP_" + normalize(source.sku).replace(/[^A-Z0-9]+/g, "_");
    properties.setProperty(key, JSON.stringify({
      saved_at: new Date().toISOString(),
      source: source,
      ignored_image: source.image || null,
      manual_purchase_taxes: source.purchase_taxes || []
    }));
  });
  console.log("Preflight correcto y 2 copias guardadas. Comienza la migración.");

  const created = [];
  sources.forEach(item => {
    const source = item.source;
    const expected = item.expected;
    const payload = {
      name: source.name,
      kind: "lots",
      description: source.description,
      sku: source.sku,
      barcode: source.barcode,
      price: migrationProductionDecimal_(source.price),
      cost: migrationProductionDecimal_(source.cost),
      purchase_price: migrationProductionDecimal_(source.purchase_price),
      tags: source.tags,
      taxes: source.taxes,
      stock: expected.stock,
      weight: migrationProductionNumber_(source.weight),
      has_stock: true,
      for_sale: source.for_sale,
      for_purchase: source.for_purchase,
      show_start_date: false,
      show_end_date: false,
      warehouse_id: source.stocks[0].warehouse_id,
      sales_channel_id: source.sales_channel_id,
      exp_account_id: source.exp_account_id
    };

    holdedV2Request_("delete", "/products/" + source.id);
    Utilities.sleep(300);
    const response = holdedV2Request_("post", "/products", payload);
    if (!response || !/^[a-fA-F0-9]{24}$/.test(String(response.id || ""))) {
      throw new Error("Sin ID válido al recrear " + source.sku + ".");
    }
    Utilities.sleep(300);
    const verified = holdedV2Request_("get", "/products/" + response.id);
    if (String(verified.id) !== String(response.id) || verified.kind !== "lots" ||
        normalize(verified.sku) !== expected.sku ||
        migrationProductionNumber_(verified.stock) !== expected.stock) {
      throw new Error("Verificación incorrecta de " + source.sku + ".");
    }
    created.push({
      sku: verified.sku,
      deleted_id: source.id,
      created_id: verified.id,
      kind: verified.kind,
      stock: verified.stock
    });
    console.log("Migrado y verificado [" + created.length + "/2]: " +
      verified.sku + " -> " + verified.id);
    Utilities.sleep(300);
  });

  properties.setProperty("HOLDED_PRODUCTION_TAGGED_POSITIVE_RESULT", JSON.stringify({
    completed_at: new Date().toISOString(),
    created: created
  }));
  migrationProductionLogJson_("STK/TY stock positivo / migración completada", JSON.stringify(created));
  console.log("Revisa manualmente los IVA de compra y las imágenes que procedan.");
  return created;
}

/** Intenta conservar el stock negativo al convertir los dos últimos STK/TY a lotes. */
function migrateProductionTaggedNegativeStockToLots() {
  const normalize = value => String(value == null ? "" : value).trim().toUpperCase();
  const normalizeTag = value => normalize(value).replace(/^#+/, "");
  const sources = MIGRATION_PRODUCTION_TAGGED_NEGATIVE_STOCK.map(expected => {
    const source = holdedV2Request_("get", "/products/" + expected.id);
    const tags = (Array.isArray(source.tags) ? source.tags : []).map(normalizeTag);
    const warehouseStocks = Array.isArray(source.stocks) ? source.stocks : [];
    if (!source || String(source.id) !== expected.id || normalize(source.sku) !== expected.sku ||
        source.kind !== "simple") {
      throw new Error("No coincide el producto autorizado: " + expected.sku + ".");
    }
    if (tags.indexOf("STK") === -1 && tags.indexOf("TY") === -1) {
      throw new Error(expected.sku + " ya no tiene etiqueta STK ni TY.");
    }
    if (migrationProductionNumber_(source.stock) !== expected.stock ||
        warehouseStocks.length !== 1 ||
        migrationProductionNumber_(warehouseStocks[0].stock) !== expected.stock ||
        !warehouseStocks[0].warehouse_id) {
      throw new Error(expected.sku + " ya no tiene exactamente " + expected.stock +
        " unidades en un único almacén.");
    }
    if ((Array.isArray(source.variants) && source.variants.length) ||
        (source.rates && source.rates.length) ||
        (source.attributes && source.attributes.length) ||
        (source.pack_items && source.pack_items.length)) {
      throw new Error(expected.sku + " contiene variantes, tarifas, atributos o componentes.");
    }
    return { source: source, expected: expected };
  });

  const properties = PropertiesService.getScriptProperties();
  sources.forEach(item => {
    const source = item.source;
    const key = "HOLDED_PROD_BACKUP_" + normalize(source.sku).replace(/[^A-Z0-9]+/g, "_");
    properties.setProperty(key, JSON.stringify({
      saved_at: new Date().toISOString(),
      source: source,
      ignored_image: source.image || null,
      manual_purchase_taxes: source.purchase_taxes || []
    }));
  });
  console.log("Preflight correcto y 2 copias guardadas. Se intentará conservar el stock negativo.");

  const created = [];
  sources.forEach(item => {
    const source = item.source;
    const expected = item.expected;
    const payload = {
      name: source.name,
      kind: "lots",
      description: source.description,
      sku: source.sku,
      barcode: source.barcode,
      price: migrationProductionDecimal_(source.price),
      cost: migrationProductionDecimal_(source.cost),
      purchase_price: migrationProductionDecimal_(source.purchase_price),
      tags: source.tags,
      taxes: source.taxes,
      stock: expected.stock,
      weight: migrationProductionNumber_(source.weight),
      has_stock: true,
      for_sale: source.for_sale,
      for_purchase: source.for_purchase,
      show_start_date: false,
      show_end_date: false,
      warehouse_id: source.stocks[0].warehouse_id,
      sales_channel_id: source.sales_channel_id,
      exp_account_id: source.exp_account_id
    };

    holdedV2Request_("delete", "/products/" + source.id);
    Utilities.sleep(300);
    const response = holdedV2Request_("post", "/products", payload);
    if (!response || !/^[a-fA-F0-9]{24}$/.test(String(response.id || ""))) {
      throw new Error("Sin ID válido al recrear " + source.sku +
        ". La copia está en HOLDED_PROD_BACKUP_" +
        normalize(source.sku).replace(/[^A-Z0-9]+/g, "_") + ".");
    }
    Utilities.sleep(300);
    const verified = holdedV2Request_("get", "/products/" + response.id);
    if (String(verified.id) !== String(response.id) || verified.kind !== "lots" ||
        normalize(verified.sku) !== expected.sku ||
        migrationProductionNumber_(verified.stock) !== expected.stock) {
      throw new Error("Holded creó " + source.sku +
        ", pero no conservó el stock negativo esperado " + expected.stock + ".");
    }
    created.push({
      sku: verified.sku,
      deleted_id: source.id,
      created_id: verified.id,
      kind: verified.kind,
      stock: verified.stock
    });
    console.log("Migrado y verificado [" + created.length + "/2]: " +
      verified.sku + " -> " + verified.id + ", stock " + verified.stock);
    Utilities.sleep(300);
  });

  properties.setProperty("HOLDED_PRODUCTION_TAGGED_NEGATIVE_RESULT", JSON.stringify({
    completed_at: new Date().toISOString(),
    created: created
  }));
  migrationProductionLogJson_("STK/TY stock negativo / migración completada", JSON.stringify(created));
  console.log("Revisa manualmente los IVA de compra y las imágenes que procedan.");
  return created;
}

/** Convierte a lotes los 10 productos simples con etiqueta TC. */
function migrateProductionTcSimpleToLots() {
  return migrationProductionMigrateSimpleBatch_(
    MIGRATION_PRODUCTION_TC_SIMPLE,
    "TC simples",
    "HOLDED_PRODUCTION_TC_SIMPLE_RESULT",
    "TC"
  );
}

function migrationProductionMigrateSimpleBatch_(expectedProducts, label, resultProperty, requiredTag) {
  const normalize = value => String(value == null ? "" : value).trim().toUpperCase();
  const normalizeTag = value => normalize(value).replace(/^#+/, "");
  const sources = expectedProducts.map(expected => {
    const source = holdedV2Request_("get", "/products/" + expected.id);
    const tags = (Array.isArray(source.tags) ? source.tags : []).map(normalizeTag);
    const warehouseStocks = Array.isArray(source.stocks) ? source.stocks : [];
    if (!source || String(source.id) !== expected.id || normalize(source.sku) !== expected.sku ||
        source.kind !== "simple") {
      throw new Error("No coincide el producto simple autorizado: " + expected.sku + ".");
    }
    if (tags.indexOf(requiredTag) === -1) {
      throw new Error(expected.sku + " ya no tiene etiqueta " + requiredTag + ".");
    }
    if (migrationProductionNumber_(source.stock) !== expected.stock) {
      throw new Error(expected.sku + " ya no tiene stock " + expected.stock + ".");
    }
    if (expected.stock !== 0 && (warehouseStocks.length !== 1 ||
        migrationProductionNumber_(warehouseStocks[0].stock) !== expected.stock ||
        !warehouseStocks[0].warehouse_id)) {
      throw new Error(expected.sku + " no tiene el stock esperado en un único almacén.");
    }
    if (expected.stock === 0 && warehouseStocks.some(item =>
      migrationProductionNumber_(item && item.stock) !== 0)) {
      throw new Error(expected.sku + " tiene stock por almacén distinto de cero.");
    }
    if ((Array.isArray(source.variants) && source.variants.length) ||
        (source.rates && source.rates.length) ||
        (source.attributes && source.attributes.length) ||
        (source.pack_items && source.pack_items.length)) {
      throw new Error(expected.sku + " contiene variantes, tarifas, atributos o componentes.");
    }
    return { source: source, expected: expected };
  });

  const properties = PropertiesService.getScriptProperties();
  sources.forEach(item => {
    const source = item.source;
    const key = "HOLDED_PROD_BACKUP_" + normalize(source.sku).replace(/[^A-Z0-9]+/g, "_");
    properties.setProperty(key, JSON.stringify({
      saved_at: new Date().toISOString(),
      source: source,
      ignored_image: source.image || null,
      manual_purchase_taxes: source.purchase_taxes || []
    }));
  });
  console.log("Preflight correcto y " + sources.length + " copias guardadas para " + label + ".");

  const created = [];
  sources.forEach(item => {
    const source = item.source;
    const expected = item.expected;
    const warehouseStocks = Array.isArray(source.stocks) ? source.stocks : [];
    const warehouseId = source.warehouse_id ||
      (warehouseStocks[0] && warehouseStocks[0].warehouse_id) || null;
    const payload = {
      name: source.name,
      kind: "lots",
      description: source.description,
      sku: source.sku,
      barcode: source.barcode,
      price: migrationProductionDecimal_(source.price),
      cost: migrationProductionDecimal_(source.cost),
      purchase_price: migrationProductionDecimal_(source.purchase_price),
      tags: source.tags,
      taxes: source.taxes,
      stock: expected.stock,
      weight: migrationProductionNumber_(source.weight),
      has_stock: true,
      for_sale: source.for_sale,
      for_purchase: source.for_purchase,
      show_start_date: false,
      show_end_date: false,
      warehouse_id: warehouseId,
      sales_channel_id: source.sales_channel_id,
      exp_account_id: source.exp_account_id
    };
    holdedV2Request_("delete", "/products/" + source.id);
    Utilities.sleep(300);
    const response = holdedV2Request_("post", "/products", payload);
    if (!response || !/^[a-fA-F0-9]{24}$/.test(String(response.id || ""))) {
      throw new Error("Sin ID válido al recrear " + source.sku + ".");
    }
    Utilities.sleep(300);
    const verified = holdedV2Request_("get", "/products/" + response.id);
    if (String(verified.id) !== String(response.id) || verified.kind !== "lots" ||
        normalize(verified.sku) !== expected.sku ||
        migrationProductionNumber_(verified.stock) !== expected.stock) {
      throw new Error("Verificación incorrecta de " + source.sku + ".");
    }
    created.push({
      sku: verified.sku,
      deleted_id: source.id,
      created_id: verified.id,
      kind: verified.kind,
      stock: verified.stock
    });
    console.log("Migrado y verificado [" + created.length + "/" + sources.length + "]: " +
      verified.sku + " -> " + verified.id + ", stock " + verified.stock);
    Utilities.sleep(300);
  });
  properties.setProperty(resultProperty, JSON.stringify({
    completed_at: new Date().toISOString(),
    created: created
  }));
  migrationProductionLogJson_(label + " / migración completada", JSON.stringify(created));
  console.log("Revisa manualmente los IVA de compra y las imágenes que procedan.");
  return created;
}

/** Divide las 9 familias TC en 18 productos independientes con lotes. */
function migrateProductionTcVariantFamiliesToLots() {
  const normalize = value => String(value == null ? "" : value).trim().toUpperCase();
  const normalizeTag = value => normalize(value).replace(/^#+/, "");
  const families = MIGRATION_PRODUCTION_TC_VARIANT_FAMILIES.map(expectedFamily => {
    const source = holdedV2Request_("get", "/products/" + expectedFamily.id);
    const tags = (Array.isArray(source.tags) ? source.tags : []).map(normalizeTag);
    if (!source || String(source.id) !== expectedFamily.id ||
        normalize(source.sku) !== expectedFamily.sku || source.kind !== "variants" ||
        !Array.isArray(source.variants) || source.variants.length !== 2) {
      throw new Error("No coincide la familia TC autorizada: " + expectedFamily.sku + ".");
    }
    if (tags.indexOf("TC") === -1) {
      throw new Error(expectedFamily.sku + " ya no tiene etiqueta TC.");
    }
    if ((source.rates && source.rates.length) ||
        (source.attributes && source.attributes.length) ||
        (source.pack_items && source.pack_items.length)) {
      throw new Error(expectedFamily.sku + " contiene tarifas, atributos o componentes.");
    }

    const variants = expectedFamily.variants.map(expectedVariant => {
      const matches = source.variants.filter(variant => variant &&
        String(variant.id) === expectedVariant.id &&
        normalize(variant.sku) === expectedVariant.sku);
      if (matches.length !== 1) {
        throw new Error("No coincide la variante autorizada " + expectedVariant.sku + ".");
      }
      const variant = matches[0];
      if (migrationProductionNumber_(variant.stock) !== expectedVariant.stock) {
        throw new Error(expectedVariant.sku + " ya no tiene stock " + expectedVariant.stock + ".");
      }
      if ((variant.sales_rates && variant.sales_rates.length) ||
          (variant.options && variant.options.length) ||
          variant.factory_code || variant.archived) {
        throw new Error(expectedVariant.sku +
          " contiene tarifas, opciones, código de fábrica o está archivada.");
      }
      const categoryFields = Array.isArray(variant.category_fields) ? variant.category_fields : [];
      if (categoryFields.length) {
        const expectedPlastic = /-N$/.test(expectedVariant.sku) ? "NATURAL" :
          (/-M$/.test(expectedVariant.sku) ? "MASA" : "");
        if (categoryFields.length !== 1 ||
            normalize(categoryFields[0].name) !== "TIPO DE PLASTICO" ||
            normalize(categoryFields[0].value) !== expectedPlastic) {
          throw new Error(expectedVariant.sku + " contiene campos de categoría no reconocidos.");
        }
      }
      const stockRows = (Array.isArray(source.stocks) ? source.stocks : []).filter(row =>
        row && String(row.variant_id || "") === expectedVariant.id);
      if (expectedVariant.stock !== 0 && (stockRows.length !== 1 ||
          migrationProductionNumber_(stockRows[0].stock) !== expectedVariant.stock ||
          !stockRows[0].warehouse_id)) {
        throw new Error(expectedVariant.sku + " no tiene el stock esperado en un único almacén.");
      }
      if (expectedVariant.stock === 0 && stockRows.some(row =>
        migrationProductionNumber_(row.stock) !== 0)) {
        throw new Error(expectedVariant.sku + " tiene stock por almacén distinto de cero.");
      }
      return { variant: variant, expected: expectedVariant, stockRows: stockRows };
    });
    const expectedTotal = expectedFamily.variants.reduce((sum, item) => sum + item.stock, 0);
    if (migrationProductionNumber_(source.stock) !== expectedTotal) {
      throw new Error(expectedFamily.sku + " ya no tiene stock total " + expectedTotal + ".");
    }
    return { source: source, expected: expectedFamily, variants: variants };
  });

  const properties = PropertiesService.getScriptProperties();
  families.forEach(family => {
    const key = "HOLDED_PROD_BACKUP_FAMILY_" +
      normalize(family.source.sku).replace(/[^A-Z0-9]+/g, "_");
    properties.setProperty(key, JSON.stringify({
      saved_at: new Date().toISOString(),
      source: family.source,
      ignored_image: family.source.image || null,
      manual_purchase_taxes: family.source.purchase_taxes || []
    }));
  });
  console.log("Preflight correcto y 9 copias de familias TC guardadas.");

  const created = [];
  families.forEach((family, familyIndex) => {
    holdedV2Request_("delete", "/products/" + family.source.id);
    Utilities.sleep(300);
    family.variants.forEach(item => {
      const variant = item.variant;
      const expected = item.expected;
      const warehouseId = (item.stockRows[0] && item.stockRows[0].warehouse_id) ||
        family.source.warehouse_id || null;
      const payload = {
        name: variant.sku,
        kind: "lots",
        description: variant.description == null ? family.source.description : variant.description,
        sku: variant.sku,
        barcode: variant.barcode || null,
        price: migrationProductionDecimal_(variant.price),
        cost: migrationProductionDecimal_(variant.cost),
        purchase_price: migrationProductionDecimal_(variant.purchase_price),
        tags: family.source.tags,
        taxes: family.source.taxes,
        stock: expected.stock,
        weight: migrationProductionNumber_(variant.weight == null ? family.source.weight : variant.weight),
        has_stock: true,
        for_sale: family.source.for_sale,
        for_purchase: family.source.for_purchase,
        show_start_date: false,
        show_end_date: false,
        warehouse_id: warehouseId,
        sales_channel_id: family.source.sales_channel_id,
        exp_account_id: family.source.exp_account_id
      };
      const response = holdedV2Request_("post", "/products", payload);
      if (!response || !/^[a-fA-F0-9]{24}$/.test(String(response.id || ""))) {
        throw new Error("Sin ID válido al crear " + variant.sku + ".");
      }
      Utilities.sleep(300);
      const verified = holdedV2Request_("get", "/products/" + response.id);
      if (String(verified.id) !== String(response.id) || verified.kind !== "lots" ||
          normalize(verified.sku) !== expected.sku ||
          migrationProductionNumber_(verified.stock) !== expected.stock) {
        throw new Error("Verificación incorrecta de " + variant.sku + ".");
      }
      created.push({
        source_family_id: family.source.id,
        sku: verified.sku,
        created_id: verified.id,
        kind: verified.kind,
        stock: verified.stock
      });
      console.log("Familia [" + (familyIndex + 1) + "/9], producto " +
        verified.sku + " creado y verificado con stock " + verified.stock + ".");
      Utilities.sleep(300);
    });
  });
  properties.setProperty("HOLDED_PRODUCTION_TC_VARIANTS_RESULT", JSON.stringify({
    completed_at: new Date().toISOString(),
    created: created
  }));
  migrationProductionLogJson_("TC variantes / migración completada", JSON.stringify(created));
  console.log("Revisa manualmente los IVA de compra, imágenes y el campo Tipo de Plastico que procedan.");
  return created;
}

/** Diagnóstico de solo lectura de campos especiales en las variantes TC. */
function previewMigrationProductionTcVariantDetails() {
  const result = MIGRATION_PRODUCTION_TC_VARIANT_FAMILIES.map(expectedFamily => {
    const source = holdedV2Request_("get", "/products/" + expectedFamily.id);
    return {
      family_id: source.id,
      family_sku: source.sku,
      rates: source.rates,
      attributes: source.attributes,
      pack_items: source.pack_items,
      variants: (source.variants || []).map(variant => ({
        id: variant.id,
        sku: variant.sku,
        factory_code: variant.factory_code,
        archived: variant.archived,
        options: variant.options,
        category_fields: variant.category_fields,
        sales_rates: variant.sales_rates
      }))
    };
  });
  migrationProductionLogJson_("TC variantes / campos especiales SOLO LECTURA", JSON.stringify(result));
  return result;
}

/**
 * Convierte únicamente PORTATAPAS de producto simple a producto con lotes.
 * El borrado del producto original es permanente.
 */
function migrateProductionPortatapasToLots() {
  const preview = previewMigrationProductionPortatapas();
  const source = preview.detail;
  const normalize = value => String(value == null ? "" : value).trim().toUpperCase();

  if (String(source.id) !== MIGRATION_PRODUCTION_PORTATAPAS_ID ||
      normalize(source.sku) !== MIGRATION_PRODUCTION_PREVIEW_SKU ||
      source.kind !== "simple") {
    throw new Error("El producto no coincide exactamente con PORTATAPAS simple autorizado.");
  }
  if (Array.isArray(source.variants) && source.variants.length) {
    throw new Error("PORTATAPAS contiene variantes inesperadas. No se modificará nada.");
  }
  if ((source.rates && source.rates.length) ||
      (source.attributes && source.attributes.length) ||
      (source.pack_items && source.pack_items.length)) {
    throw new Error("PORTATAPAS contiene tarifas, atributos o componentes no contemplados.");
  }

  const stock = migrationProductionNumber_(source.stock);
  if (stock !== 1 || !Array.isArray(source.stocks) || source.stocks.length !== 1 ||
      migrationProductionNumber_(source.stocks[0].stock) !== 1 ||
      !source.stocks[0].warehouse_id) {
    throw new Error("El stock ya no coincide con el preview autorizado: 1 unidad en un almacén.");
  }

  const payload = {
    name: source.name,
    kind: "lots",
    description: source.description,
    sku: source.sku,
    barcode: source.barcode,
    price: migrationProductionDecimal_(source.price),
    cost: migrationProductionDecimal_(source.cost),
    purchase_price: migrationProductionDecimal_(source.purchase_price),
    tags: source.tags,
    taxes: source.taxes,
    stock: stock,
    weight: migrationProductionNumber_(source.weight),
    has_stock: true,
    for_sale: source.for_sale,
    for_purchase: source.for_purchase,
    show_start_date: false,
    show_end_date: false,
    warehouse_id: source.stocks[0].warehouse_id,
    sales_channel_id: source.sales_channel_id,
    exp_account_id: source.exp_account_id
  };

  const properties = PropertiesService.getScriptProperties();
  properties.setProperty(MIGRATION_PRODUCTION_PORTATAPAS_BACKUP, JSON.stringify({
    saved_at: new Date().toISOString(),
    source: source,
    ignored_image: source.image || null,
    manual_purchase_taxes: source.purchase_taxes || []
  }));
  migrationProductionLogJson_("PORTATAPAS / copia previa al borrado", JSON.stringify(source));

  holdedV2Request_("delete", "/products/" + MIGRATION_PRODUCTION_PORTATAPAS_ID);
  console.log("PORTATAPAS original eliminado: " + MIGRATION_PRODUCTION_PORTATAPAS_ID + ".");

  const created = holdedV2Request_("post", "/products", payload);
  if (!created || !/^[a-fA-F0-9]{24}$/.test(String(created.id || ""))) {
    throw new Error("Holded no devolvió un ID válido al recrear PORTATAPAS.");
  }

  const verified = holdedV2Request_("get", "/products/" + encodeURIComponent(created.id));
  if (String(verified.id) !== String(created.id) ||
      normalize(verified.sku) !== MIGRATION_PRODUCTION_PREVIEW_SKU ||
      verified.kind !== "lots") {
    throw new Error("La verificación del nuevo PORTATAPAS no coincide con lo esperado.");
  }
  if (migrationProductionNumber_(verified.stock) !== 1) {
    throw new Error("PORTATAPAS se creó con lotes, pero el stock verificado no es 1.");
  }

  properties.setProperty("HOLDED_PRODUCTION_PORTATAPAS_MIGRATION_RESULT", JSON.stringify({
    completed_at: new Date().toISOString(),
    deleted_product_id: source.id,
    created_product_id: verified.id,
    sku: verified.sku,
    kind: verified.kind,
    stock: verified.stock
  }));
  migrationProductionLogJson_("PORTATAPAS / producto creado y verificado", JSON.stringify(verified));
  console.log("Revisa manualmente el IVA de compra y, si procede, la imagen.");
  return verified;
}

function migrationProductionDecimal_(value) {
  if (value == null || value === "") return null;
  const normalized = String(value).trim().replace(",", ".");
  if (!/^-?\d+(?:\.\d+)?$/.test(normalized)) {
    throw new Error("Valor numérico no reconocido en PORTATAPAS.");
  }
  return normalized;
}

function migrationProductionNumber_(value) {
  const decimal = migrationProductionDecimal_(value);
  return decimal == null ? null : Number(decimal);
}

function migrationProductionLogJson_(label, body) {
  const size = 4000;
  const count = Math.max(1, Math.ceil(body.length / size));
  for (let index = 0; index < count; index++) {
    console.log(
      label + " [" + (index + 1) + "/" + count + "]\n" +
      body.slice(index * size, (index + 1) * size)
    );
  }
}
