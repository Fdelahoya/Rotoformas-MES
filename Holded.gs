const HOLDED = {
  baseUrl: "https://api.holded.com/api/invoicing/v1",

  // Ajusta esto si tu auth real usa otro header
  authHeaderName: "key",
  authHeaderValue: (key) => key,

  peCostSheet: "Parametros manuales",
  peCostRange: "H2:J2",
  peCostSkus: ["PE NATURAL", "PE MASA", "PE RECICLADO"]
};

const HOLDED_API_KEY_PROPERTY = "HOLDED_API_KEY";
const HOLDED_API_V2_TOKEN_PROPERTY = "HOLDED_API_V2_TOKEN";
const HOLDED_API_V2_BASE_URL = "https://api.holded.com/api/v2";
const HOLDED_SPREADSHEET_ID_PROPERTY = "HOLDED_SPREADSHEET_ID";
const HOLDED_LAST_SYNC_AT_PROPERTY = "HOLDED_LAST_SYNC_AT";
const HOLDED_SYNC_HANDLER = "syncHoldedProducts";
const HOLDED_SYNC_TIMEZONE = "Europe/Madrid";

function getHoldedApiKey_() {
  const key = String(
    PropertiesService.getScriptProperties()
      .getProperty(HOLDED_API_KEY_PROPERTY) || ""
  ).trim();

  if (!key) {
    throw new Error(
      `Falta la propiedad de script '${HOLDED_API_KEY_PROPERTY}'. ` +
      "Configúrala antes de usar la integración con Holded."
    );
  }

  return key;
}

function configureHoldedApiKey() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.prompt(
    "Configurar Holded",
    "Introduce la nueva clave API de Holded. Se guardará en las propiedades privadas del script.",
    ui.ButtonSet.OK_CANCEL
  );

  if (response.getSelectedButton() !== ui.Button.OK) return;

  const key = response.getResponseText().trim();
  if (!key) {
    throw new Error("La clave API no puede estar vacía.");
  }

  PropertiesService.getScriptProperties()
    .setProperty(HOLDED_API_KEY_PROPERTY, key);

  ui.alert("Clave de Holded guardada correctamente.");
}

function getHoldedApiV2Token_() {
  const token = String(
    PropertiesService.getScriptProperties()
      .getProperty(HOLDED_API_V2_TOKEN_PROPERTY) || ""
  ).trim();

  if (!token) {
    throw new Error(
      `Falta la propiedad de script '${HOLDED_API_V2_TOKEN_PROPERTY}'. ` +
      "Crea un token API v2 con permisos de lectura y escritura de Productos y configúralo desde el menú Rotoformas → Holded."
    );
  }

  return token;
}

function configureHoldedApiV2Token() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.prompt(
    "Configurar Holded API v2",
    "Introduce el token API v2 con permisos de lectura y escritura de Productos. Se guardará en las propiedades privadas del script.",
    ui.ButtonSet.OK_CANCEL
  );

  if (response.getSelectedButton() !== ui.Button.OK) return;

  const token = response.getResponseText().trim();
  if (!token) {
    throw new Error("El token API v2 no puede estar vacío.");
  }

  PropertiesService.getScriptProperties()
    .setProperty(HOLDED_API_V2_TOKEN_PROPERTY, token);

  ui.alert("Token API v2 de Holded guardado correctamente.");
}

function getHoldedSpreadsheet_() {
  const activeSpreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  if (activeSpreadsheet) return activeSpreadsheet;

  const spreadsheetId = String(
    PropertiesService.getScriptProperties()
      .getProperty(HOLDED_SPREADSHEET_ID_PROPERTY) || ""
  ).trim();

  if (!spreadsheetId) {
    throw new Error(
      `Falta la propiedad de script '${HOLDED_SPREADSHEET_ID_PROPERTY}'. ` +
      "Ejecuta installDailyHoldedSyncTrigger desde la hoja vinculada."
    );
  }

  return SpreadsheetApp.openById(spreadsheetId);
}

function installDailyHoldedSyncTrigger() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  if (!spreadsheet) {
    throw new Error("Abre el proyecto desde la hoja de cálculo antes de instalar el activador.");
  }

  PropertiesService.getScriptProperties()
    .setProperty(HOLDED_SPREADSHEET_ID_PROPERTY, spreadsheet.getId());

  ScriptApp.getProjectTriggers()
    .filter(trigger => trigger.getHandlerFunction() === HOLDED_SYNC_HANDLER)
    .forEach(trigger => ScriptApp.deleteTrigger(trigger));

  ScriptApp.newTrigger(HOLDED_SYNC_HANDLER)
    .timeBased()
    .atHour(6)
    .nearMinute(0)
    .everyDays(1)
    .inTimezone(HOLDED_SYNC_TIMEZONE)
    .create();

  console.log("Sincronización diaria de Holded instalada alrededor de las 06:00.");
}


function holdedRequest_(method, path) {
  const url = `${HOLDED.baseUrl}${path}`;
  const headers = {};
  headers[HOLDED.authHeaderName] = HOLDED.authHeaderValue(getHoldedApiKey_());

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

function holdedV2Request_(method, path, payload) {
  const options = {
    method,
    headers: {
      "Authorization": `Bearer ${getHoldedApiV2Token_()}`,
      "Accept": "application/json"
    },
    muteHttpExceptions: true
  };

  if (payload !== undefined) {
    options.contentType = "application/json";
    options.payload = JSON.stringify(payload);
  }

  const response = UrlFetchApp.fetch(`${HOLDED_API_V2_BASE_URL}${path}`, options);
  const code = response.getResponseCode();
  const body = response.getContentText();

  if (code < 200 || code >= 300) {
    throw new Error(`Holded v2 ${code}: ${body}`);
  }

  return body ? JSON.parse(body) : null;
}

function syncHoldedProducts() {
  const data = holdedRequest_("get", "/products");
  if (!Array.isArray(data)) {
    throw new Error("Holded no ha devuelto una lista de productos válida.");
  }

  const ss = getHoldedSpreadsheet_();
  const sheetName = "Holded Raw";
  const materialCosts = {};

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
    "Activo (TRUE/FALSE)",
    "Coste medio"
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
        const sku = variant.sku || item.sku || "";
        const coste = normalizeHoldedCost_(variant.cost);

        rows.push([
          sku,
          nombre,
          variant.id || "",
          item.id || "",
          item.kind || "",
          peso,
          variant.price ?? precio,
          tipo,
          unidad,
          true,
          coste ?? ""
        ]);

        collectPeCost_(materialCosts, sku, coste);
      });
    } else {
      const sku = item.sku || "";
      const coste = normalizeHoldedCost_(item.cost);

      rows.push([
        sku,
        item.name || "",
        item.id || "",
        "",
        item.kind || "",
        item.weight ?? "",
        item.price ?? "",
        tipo,
        unidad,
        true,
        coste ?? ""
      ]);

      collectPeCost_(materialCosts, sku, coste);
    }
  });

  // Validamos antes de sobrescribir ninguna hoja para conservar el último dato
  // correcto si Holded devuelve un catálogo incompleto.
  const peCosts = getRequiredPeCosts_(materialCosts);
  const parameterSheet = ss.getSheetByName(HOLDED.peCostSheet);
  if (!parameterSheet) {
    throw new Error(`No encuentro la hoja '${HOLDED.peCostSheet}'.`);
  }

  let sh = ss.getSheetByName(sheetName);
  if (!sh) {
    sh = ss.insertSheet(sheetName);
  } else {
    sh.clearContents();
  }

  sh.getRange(1, 1, rows.length, headers.length).setValues(rows);
  sh.getRange(1, 1, 1, headers.length).setFontWeight("bold");
  sh.setFrozenRows(1);
  sh.autoResizeColumns(1, headers.length);

  parameterSheet.getRange(HOLDED.peCostRange).setValues([peCosts]);

  PropertiesService.getScriptProperties()
    .setProperty(HOLDED_LAST_SYNC_AT_PROPERTY, new Date().toISOString());
}

function normalizeHoldedCost_(value) {
  if (value == null || value === "") return null;
  const cost = Number(value);
  return Number.isFinite(cost) ? cost : null;
}

function normalizeHoldedSku_(sku) {
  return String(sku || "").trim().toUpperCase();
}

function collectPeCost_(materialCosts, sku, cost) {
  if (cost == null) return;

  const normalizedSku = normalizeHoldedSku_(sku);
  if (HOLDED.peCostSkus.includes(normalizedSku)) {
    materialCosts[normalizedSku] = cost;
  }
}

function getRequiredPeCosts_(materialCosts) {
  const missing = HOLDED.peCostSkus.filter(sku => materialCosts[sku] == null);
  if (missing.length) {
    throw new Error(
      "No se han recibido costes válidos de Holded para: " + missing.join(", ") +
      ". No se ha actualizado ninguna hoja."
    );
  }

  return HOLDED.peCostSkus.map(sku => materialCosts[sku]);
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
