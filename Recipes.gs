const MES_RECIPES = {
  sheetName: "Recetas MES",
  headers: [
    "Producto SKU", "Componente SKU", "Cantidad por unidad",
    "Unidad", "Gestionar lote", "Activo"
  ],
  initialRows: [
    ["OX DISAIR BASIC", "INSERTO ALU M4", 63, "ud", false, true],
    ["OX DISAIR BASIC", "INSERTO ALU M10", 4, "ud", false, true],
    ["OX DISAIR BASIC", "PE NATURAL", 8.8, "kg", true, true],
    ["OX DISAIR BASIC", "PIG RTF073", 0.044, "kg", true, true]
  ]
};

function ensureMesRecipesSheet_(ss) {
  let sheet = ss.getSheetByName(MES_RECIPES.sheetName);
  if (!sheet) sheet = ss.insertSheet(MES_RECIPES.sheetName);

  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, MES_RECIPES.headers.length)
      .setValues([MES_RECIPES.headers])
      .setFontWeight("bold");
    sheet.setFrozenRows(1);
  }

  const values = sheet.getDataRange().getValues();
  const existing = new Set();
  for (let row = 1; row < values.length; row++) {
    const productSku = normalizeKey_(values[row][0]);
    const componentSku = normalizeKey_(values[row][1]);
    if (productSku && componentSku) existing.add(productSku + "|" + componentSku);
  }

  const missing = MES_RECIPES.initialRows.filter(row =>
    !existing.has(normalizeKey_(row[0]) + "|" + normalizeKey_(row[1]))
  );
  if (missing.length) {
    sheet.getRange(sheet.getLastRow() + 1, 1, missing.length, MES_RECIPES.headers.length)
      .setValues(missing);
  }
  return sheet;
}

function readMesRecipes_(ss) {
  const sheet = ensureMesRecipesSheet_(ss);
  const values = sheet.getDataRange().getValues();
  const recipes = {};

  for (let row = 1; row < values.length; row++) {
    const productSku = safeStr_(values[row][0]);
    const componentSku = safeStr_(values[row][1]);
    const quantity = numberOrZero_(values[row][2]);
    const unit = safeStr_(values[row][3]) || "ud";
    const lotManaged = values[row][4] === true;
    const active = values[row][5] !== false;
    if (!productSku || !componentSku || quantity <= 0 || !active) continue;

    const key = normalizeKey_(productSku);
    if (!recipes[key]) recipes[key] = [];
    recipes[key].push({
      productSku,
      componentSku,
      quantity,
      unit,
      lotManaged
    });
  }
  return recipes;
}

function parseProductionHeader_(header) {
  const text = safeStr_(header);
  if (!text) return null;
  const patterns = [
    /^(.*?)\s*\[\s*RECHAZADAS?\s*\]$/i,
    /^(.*?)\s*[-–:]\s*RECHAZADAS?$/i,
    /^RECHAZADAS?\s*[-–:]?\s*(.*?)$/i,
    /^(.*?)\s+RECHAZADAS?$/i
  ];
  for (let i = 0; i < patterns.length; i++) {
    const match = text.match(patterns[i]);
    if (match && safeStr_(match[1])) {
      return { sku: safeStr_(match[1]), rejected: true };
    }
  }
  return { sku: text, rejected: false };
}

function installOxDisairRejectedUnitsQuestion() {
  const title = "OX DISAIR BASIC [RECHAZADAS]";
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const formUrl = spreadsheet.getFormUrl();
  if (!formUrl) throw new Error("Esta hoja no está vinculada a un formulario de Google.");

  const form = FormApp.openByUrl(formUrl);
  const exists = form.getItems().some(item => safeStr_(item.getTitle()) === title);
  if (!exists) {
    form.addTextItem()
      .setTitle(title)
      .setHelpText("Piezas moldeadas rechazadas. Consumen materiales, pero no incrementan el stock terminado.")
      .setRequired(false);
  }
  ensureMesRecipesSheet_(spreadsheet);
  const message = exists
    ? "La captura de rechazos ya estaba preparada."
    : "Captura de rechazos añadida al formulario y receta OX Disair preparada.";
  try {
    SpreadsheetApp.getUi().alert(message);
  } catch (error) {
    console.log(message);
  }
  return { ok: true, questionCreated: !exists, message };
}
