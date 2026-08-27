const HOLDED = {
  baseUrl: "https://api.holded.com/api/invoicing/v1",
  apiKey: "5a88a6a507bece40129d8f390c8a41e9",

  // Ajusta esto si tu auth real usa otro header
  authHeaderName: "key",
  authHeaderValue: (key) => key
};


function holdedRequest_(method, path) {
  const url = `${HOLDED.baseUrl}${path}`;
  const headers = {};
  headers[HOLDED.authHeaderName] = HOLDED.authHeaderValue(HOLDED.apiKey);

  const res = UrlFetchApp.fetch(url, {
    method,
    headers,
    muteHttpExceptions: true
  });

  const code = res.getResponseCode();
  const body = res.getContentText();

  if (code < 200 || code >= 300) {
    throw new Error(`Holded API error ${code}: ${body}`);
  }

  return JSON.parse(body);
}

function syncHoldedProducts() {
  const data = holdedRequest_("get", "/products");
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetName = "Holded Raw";

  let sh = ss.getSheetByName(sheetName);
  if (!sh) {
    sh = ss.insertSheet(sheetName);
  } else {
    sh.clearContents();
  }

  const headers = [
    "SKU Holded",
    "Producto Holded",
    "productId Holded",
    "productId Padre",
    "Kind",
    "Peso",
    "Precio",
    "Tipo (FG / RM)",
    "Unidad (ud / kg)",
    "Activo (TRUE/FALSE)"
  ];

  const rows = [headers];

  data.forEach(item => {
    const nombre = item.name || "";
    const peso = item.weight ?? "";
    const precio = item.price ?? "";
    const tipo = inferTipoHolded_(nombre, item.sku, item.tags);
    const unidad = inferUnidadHolded_(tipo, nombre, item.sku);

    if (item.kind === "variants" && Array.isArray(item.variants) && item.variants.length) {
      item.variants.forEach(variant => {
        rows.push([
          variant.sku || item.sku || "",
          nombre,
          variant.id || "",
          item.id || "",
          item.kind || "",
          peso,
          variant.price ?? precio,
          tipo,
          unidad,
          true
        ]);
      });
    } else {
      rows.push([
        item.sku || "",
        item.name || "",
        item.id || "",
        "",
        item.kind || "",
        item.weight ?? "",
        item.price ?? "",
        tipo,
        unidad,
        true
      ]);
    }
  });

  sh.getRange(1, 1, rows.length, headers.length).setValues(rows);
  sh.getRange(1, 1, 1, headers.length).setFontWeight("bold");
  sh.setFrozenRows(1);
  sh.autoResizeColumns(1, headers.length);
}

function inferTipoHolded_(nombre, sku, tags) {
  const txt = `${nombre || ""} ${sku || ""} ${(tags || []).join(" ")}`.toLowerCase();

  if (
    txt.includes("polietileno") ||
    txt.includes("pigmento") ||
    txt.includes("inserto")
  ) {
    return "RM";
  }

  return "FG";
}

function inferUnidadHolded_(tipo, nombre, sku) {
  if (tipo === "RM") {
    const txt = `${nombre || ""} ${sku || ""}`.toLowerCase();
    if (txt.includes("inserto")) return "ud";
    return "kg";
  }
  return "ud";
}