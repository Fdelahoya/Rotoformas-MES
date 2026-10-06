/** Herramientas aisladas para inspeccionar y migrar exclusivamente testvar en sandbox. */
const MIGRATION_SANDBOX_TESTVAR_ID = "6ac4ac1f2306dbc2b20ab51a";
const MIGRATION_SANDBOX_BACKUP_PROPERTY = "HOLDED_SANDBOX_TESTVAR_BACKUP";

function previewMigrationSandboxTestvar() {
  const key = migrationSandboxKey_();

  const catalog = migrationSandboxGet_("/products?name=testvar&limit=200", key);
  if (!catalog.json || !Array.isArray(catalog.json.items)) {
    throw new Error("El catálogo V2 sandbox no contiene items[].");
  }
  if (catalog.json.has_more) {
    throw new Error("La búsqueda de testvar devolvió más de 200 resultados; revisa el filtro antes de consultar detalles.");
  }
  const normalize = value => String(value == null ? "" : value).trim().toLowerCase();
  const matches = catalog.json.items.filter(product => product && (
    normalize(product.name) === "testvar" || normalize(product.sku) === "testvar" ||
    (Array.isArray(product.variants) && product.variants.some(variant => variant && (
      normalize(variant.name) === "testvar" || normalize(variant.sku) === "testvar"
    )))
  ));

  if (matches.length !== 1) {
    throw new Error("Se esperaba una única familia testvar; coincidencias exactas: " + matches.length +
      ". has_more=" + Boolean(catalog.json.has_more) +
      ". No se ha consultado ningún detalle ni modificado datos.");
  }
  const family = matches[0];
  if (!family.id) throw new Error("La familia encontrada no tiene id.");
  migrationSandboxLogJson_("testvar / catálogo", JSON.stringify(family));
  const detail = migrationSandboxGet_("/products/" + encodeURIComponent(String(family.id)), key);
  migrationSandboxLogJson_("testvar / detalle (respuesta original)", detail.body);
  return { productId: family.id, catalogProduct: family, detail: detail.json, rawDetail: detail.body };
}

/** Construye un borrador de alta V2 de testvar. No envía ninguna escritura. */
function previewMigrationSandboxTestvarPayload() {
  const source = previewMigrationSandboxTestvar().detail;
  if (source.kind !== "variants" || !Array.isArray(source.variants)) {
    throw new Error("testvar no es una familia de variantes reconocible.");
  }
  const draft = {
    name: source.name,
    kind: source.kind,
    description: source.description,
    sku: source.sku,
    barcode: source.barcode,
    price: migrationSandboxDecimal_(source.price),
    cost: migrationSandboxDecimal_(source.cost),
    purchase_price: migrationSandboxDecimal_(source.purchase_price),
    tags: source.tags,
    taxes: source.taxes,
    stock: migrationSandboxNumber_(source.stock),
    weight: migrationSandboxNumber_(source.weight),
    has_stock: source.has_stock,
    for_sale: source.for_sale,
    for_purchase: source.for_purchase,
    warehouse_id: source.warehouse_id,
    sales_channel_id: source.sales_channel_id,
    exp_account_id: source.exp_account_id,
    variants: source.variants.map(variant => ({
      sku: variant.sku,
      barcode: variant.barcode,
      price: migrationSandboxDecimal_(variant.price),
      cost: migrationSandboxDecimal_(variant.cost),
      purchase_price: migrationSandboxDecimal_(variant.purchase_price),
      stock: migrationSandboxNumber_(variant.stock),
      description: variant.description,
      weight: migrationSandboxNumber_(variant.weight),
      factory_code: variant.factory_code,
      archived: variant.archived
    }))
  };

  // Estos campos están en GET, pero no figuran en el cuerpo de POST /products.
  const separate = {
    purchase_taxes: source.purchase_taxes,
    rates: source.rates,
    stocks: source.stocks,
    variant_sales_rates: source.variants.map(v => ({ sku: v.sku, sales_rates: v.sales_rates })),
    variant_options: source.variants.map(v => ({ sku: v.sku, options: v.options }))
  };
  migrationSandboxLogJson_("testvar / borrador POST (NO ENVIADO)", JSON.stringify(draft));
  migrationSandboxLogJson_("testvar / campos pendientes", JSON.stringify(separate));
  return { draft: draft, separate: separate };
}

/** Vista previa de las dos altas independientes con gestión por lotes. Solo GET. */
function previewMigrationSandboxTestvarLots() {
  const source = previewMigrationSandboxTestvar().detail;
  const candidates = migrationSandboxBuildLotCandidates_(source);
  migrationSandboxLogJson_("testvar / dos productos por lotes (NO ENVIADOS)",
    JSON.stringify({ source_product_id: source.id, candidates: candidates }));
  console.log("Los SKU propuestos siguen ocupados por las variantes originales. " +
    "La documentación no garantiza la seguridad de SKU duplicados; no se ha probado el alta.");
  return candidates;
}

function migrationSandboxBuildLotCandidates_(source) {
  if (source.kind !== "variants" || !Array.isArray(source.variants) ||
      source.variants.length !== 2) {
    throw new Error("Se esperaban exactamente dos variantes en testvar.");
  }
  if (source.stocks && source.stocks.length) {
    throw new Error("testvar ya tiene stock por almacén. Hay que planificar su traslado antes de crear productos.");
  }
  if ((source.rates && source.rates.length) ||
      (source.attributes && source.attributes.length) ||
      source.variants.some(variant =>
        (variant.sales_rates && variant.sales_rates.length) || variant.factory_code)) {
    throw new Error("testvar contiene tarifas, atributos o códigos de fabricación no incluidos en este borrador.");
  }
  const seen = {};
  const candidates = source.variants.map(variant => {
    const sku = String(variant.sku || "").trim();
    if (!sku || seen[sku.toUpperCase()]) throw new Error("SKU ausente o duplicado entre las variantes.");
    seen[sku.toUpperCase()] = true;
    if (migrationSandboxNumber_(variant.stock) !== 0) {
      throw new Error("La variante " + sku + " tiene stock distinto de cero.");
    }
    return {
      source_variant_id: variant.id,
      manual_purchase_taxes: source.purchase_taxes,
      payload: {
        name: sku, // Propuesta: nombre igual al SKU; revisar antes de crear.
        kind: "lots",
        description: variant.description == null ? source.description : variant.description,
        sku: sku,
        barcode: variant.barcode || null,
        price: migrationSandboxDecimal_(variant.price),
        cost: migrationSandboxDecimal_(variant.cost),
        purchase_price: migrationSandboxDecimal_(variant.purchase_price),
        tags: source.tags,
        taxes: source.taxes,
        stock: 0,
        weight: migrationSandboxNumber_(variant.weight),
        has_stock: true,
        for_sale: source.for_sale,
        for_purchase: source.for_purchase,
        show_start_date: false,
        show_end_date: false,
        warehouse_id: source.warehouse_id,
        sales_channel_id: source.sales_channel_id,
        exp_account_id: source.exp_account_id
      }
    };
  });
  return candidates;
}

/** Borra la familia testvar del sandbox y crea dos productos independientes con lotes. */
function migrateSandboxTestvarToLots() {
  const key = migrationSandboxKey_();
  const source = previewMigrationSandboxTestvar().detail;
  if (source.id !== MIGRATION_SANDBOX_TESTVAR_ID || source.sku !== "testvar") {
    throw new Error("El producto encontrado no coincide con la familia sandbox autorizada.");
  }
  const candidates = migrationSandboxBuildLotCandidates_(source);
  const expectedSkus = ["TESTVARIANTES", "TESTVARIANTES2"];
  const actualSkus = candidates.map(item => item.payload.sku.toUpperCase()).sort();
  if (JSON.stringify(actualSkus) !== JSON.stringify(expectedSkus.sort())) {
    throw new Error("Los SKU de las variantes no coinciden con los dos SKU autorizados.");
  }

  const properties = PropertiesService.getScriptProperties();
  properties.setProperty(MIGRATION_SANDBOX_BACKUP_PROPERTY, JSON.stringify({
    saved_at: new Date().toISOString(),
    source: source
  }));
  migrationSandboxLogJson_("testvar / copia previa al borrado", JSON.stringify(source));

  migrationSandboxRequest_("delete", "/products/" + source.id, key);
  console.log("Familia sandbox eliminada: " + source.id + ". El borrado es permanente.");

  const created = [];
  candidates.forEach(candidate => {
    const response = migrationSandboxRequest_("post", "/products", key, candidate.payload);
    if (!response.json || !/^[a-fA-F0-9]{24}$/.test(String(response.json.id || ""))) {
      throw new Error("Holded no devolvió un ID válido al crear " + candidate.payload.sku +
        ". Creados hasta ahora: " + JSON.stringify(created));
    }
    const createdId = String(response.json.id);
    const verified = migrationSandboxGet_("/products/" + createdId, key).json;
    if (verified.id !== createdId || verified.kind !== "lots" ||
        verified.sku !== candidate.payload.sku) {
      throw new Error("La verificación no coincide para " + candidate.payload.sku +
        ". ID creado: " + createdId);
    }
    created.push({ id: createdId, sku: verified.sku, kind: verified.kind, product: verified });
    migrationSandboxLogJson_("testvar / producto creado y verificado", JSON.stringify(verified));
  });

  properties.setProperty("HOLDED_SANDBOX_TESTVAR_MIGRATION_RESULT", JSON.stringify({
    completed_at: new Date().toISOString(),
    deleted_product_id: source.id,
    created: created.map(item => ({ id: item.id, sku: item.sku, kind: item.kind }))
  }));
  migrationSandboxLogJson_("testvar / migración completada", JSON.stringify(created));
  return created;
}

function migrationSandboxDecimal_(value) {
  if (value == null || value === "") return null;
  const normalized = String(value).trim().replace(",", ".");
  if (!/^-?\d+(?:\.\d+)?$/.test(normalized)) {
    throw new Error("Importe no reconocido en el borrador de testvar.");
  }
  return normalized;
}

function migrationSandboxNumber_(value) {
  const decimal = migrationSandboxDecimal_(value);
  return decimal == null ? null : Number(decimal);
}

function migrationSandboxKey_() {
  const key = String(PropertiesService.getScriptProperties()
    .getProperty("HOLDED_SANDBOX_API_KEY") || "").trim();
  if (!key) throw new Error("Falta HOLDED_SANDBOX_API_KEY. No se usará la clave de producción.");
  return key;
}

function migrationSandboxGet_(path, key) {
  if (!/^\/products(?:\?name=testvar&limit=200|\/[a-fA-F0-9]{24})$/.test(path)) {
    throw new Error("Ruta no permitida para el preview sandbox.");
  }
  const response = UrlFetchApp.fetch("https://api.holded.com/api/v2" + path, {
    method: "get",
    headers: { Authorization: "Bearer " + key, Accept: "application/json" },
    followRedirects: false,
    muteHttpExceptions: true
  });
  const code = response.getResponseCode();
  const body = response.getContentText();
  if (code < 200 || code >= 300) {
    const safeBody = body.split(key).join("[CLAVE OCULTA]")
      .replace(/("(?:key|api_?key|token|access_token|authorization)"\s*:\s*")[^"]*/gi, "$1[OCULTO]")
      .slice(0, 3000);
    throw new Error("GET sandbox " + path + " devolvió HTTP " + code +
      ". Respuesta Holded: " + (safeBody || "(vacía)"));
  }
  let json;
  try { json = JSON.parse(body); }
  catch (error) { throw new Error("GET sandbox " + path + " no devolvió JSON válido."); }
  return { body: body, json: json };
}

function migrationSandboxRequest_(method, path, key, payload) {
  const normalizedMethod = String(method || "").toLowerCase();
  const allowed =
    (normalizedMethod === "delete" && path === "/products/" + MIGRATION_SANDBOX_TESTVAR_ID) ||
    (normalizedMethod === "post" && path === "/products");
  if (!allowed) throw new Error("Escritura sandbox no permitida: " + method + " " + path);

  const options = {
    method: normalizedMethod,
    headers: { Authorization: "Bearer " + key, Accept: "application/json" },
    followRedirects: false,
    muteHttpExceptions: true
  };
  if (payload !== undefined) {
    options.contentType = "application/json";
    options.payload = JSON.stringify(payload);
  }
  const response = UrlFetchApp.fetch("https://api.holded.com/api/v2" + path, options);
  const code = response.getResponseCode();
  const body = response.getContentText();
  const ok = normalizedMethod === "delete" ? code === 204 : code === 201;
  if (!ok) {
    const safeBody = body.split(key).join("[CLAVE OCULTA]").slice(0, 3000);
    throw new Error(method.toUpperCase() + " sandbox " + path + " devolvió HTTP " + code +
      ". Respuesta Holded: " + (safeBody || "(vacía)"));
  }
  return { code: code, body: body, json: body ? JSON.parse(body) : null };
}

function migrationSandboxLogJson_(label, body) {
  // Fragmentos numerados para evitar truncar una única entrada grande del log.
  const size = 4000;
  const count = Math.ceil(body.length / size);
  for (let index = 0; index < count; index++) {
    console.log(label + " [" + (index + 1) + "/" + count + "]\n" +
      body.slice(index * size, (index + 1) * size));
  }
}
