/**
 * PRUEBA TEMPORAL: resta 0,10 kg al lote "lote Test" de PE NATURAL.
 * Usa la misma API V1, almacén y credencial que applyStockMovements().
 * No forma parte del flujo general de movimientos.
 */
function testStockPeNaturalLoteTest() {
  const expectedSku = "PE NATURAL";
  const expectedLotNumber = "lote Test";
  const delta = -0.10;
  const products = holdedRequest_("get", "/products");

  if (!Array.isArray(products)) {
    throw new Error("Holded no devolvió un catálogo válido.");
  }
  const normalize = value => String(value == null ? "" : value).trim().toUpperCase();
  const matches = products.filter(product => product && normalize(product.sku) === expectedSku);
  if (matches.length !== 1) {
    throw new Error("Se esperaba un único producto PE NATURAL; encontrados: " + matches.length + ".");
  }

  const product = matches[0];
  console.log("PE NATURAL / respuesta catálogo V1: " + JSON.stringify(product));
  if (product.kind !== "lots" || !Array.isArray(product.lots)) {
    throw new Error("PE NATURAL no aparece como producto con lotes en la API V1.");
  }
  const lots = product.lots.filter(lot => lot &&
    normalize(lot.sku) === normalize(expectedLotNumber));
  if (lots.length !== 1) {
    console.log("PE NATURAL / lotes disponibles: " + JSON.stringify(product.lots));
    throw new Error("Se esperaba un único lote 'lote Test'; encontrados: " + lots.length + ".");
  }

  const lot = lots[0];
  if (!product.id || !lot.id) {
    throw new Error("PE NATURAL o lote Test no tienen identificador válido.");
  }
  const url = `${HOLDED_STOCK.baseUrl}/products/${product.id}/stock`;
  const payload = {
    stock: {
      [HOLDED_STOCK.warehouseId]: {
        [lot.id]: delta
      }
    }
  };
  console.log("TEST PE NATURAL / producto y lote: " + JSON.stringify({
    productId: product.id,
    sku: product.sku,
    kind: product.kind,
    lotId: lot.id,
    lotNumber: lot.sku,
    lotStockBefore: lot.stock,
    warehouseId: HOLDED_STOCK.warehouseId
  }));
  console.log("TEST PE NATURAL / request: " + JSON.stringify({
    method: "put",
    url: url,
    payload: payload
  }));

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
  console.log("TEST PE NATURAL / response: " + JSON.stringify({
    status: code,
    body: body
  }));
  if (code < 200 || code >= 300) {
    throw new Error("Holded " + code + ": " + body);
  }

  let lotAfter = null;
  for (let attempt = 1; attempt <= 5; attempt++) {
    Utilities.sleep(1000);
    const productsAfter = holdedRequest_("get", "/products");
    const productAfter = Array.isArray(productsAfter)
      ? productsAfter.find(item => item && item.id === product.id)
      : null;
    lotAfter = productAfter && Array.isArray(productAfter.lots)
      ? productAfter.lots.find(item => item && item.id === lot.id)
      : null;
    console.log("TEST PE NATURAL / verificación " + attempt + ": " + JSON.stringify({
      productId: product.id,
      lotId: lot.id,
      lotStockExpected: Number(lot.stock) + delta,
      lotStockActual: lotAfter ? lotAfter.stock : null
    }));
    if (lotAfter && Math.abs(Number(lotAfter.stock) - (Number(lot.stock) + delta)) < 0.000001) {
      break;
    }
  }

  return {
    productId: product.id,
    lotId: lot.id,
    lotNumber: lot.sku,
    lotStockBefore: lot.stock,
    lotStockAfter: lotAfter ? lotAfter.stock : null,
    delta: delta,
    responseCode: code,
    responseBody: body
  };
}
