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
