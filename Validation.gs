function verificarSkusResumen() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const resumen = ss.getSheetByName("Resumen");
  const holded = ss.getSheetByName("Holded Raw");

  if (!resumen) throw new Error("No existe la hoja 'Resumen'");
  if (!holded) throw new Error("No existe la hoja 'Holded Raw'");

  const holdedData = holded.getDataRange().getValues();
  const holdedSkus = new Set();

  for (let i = 1; i < holdedData.length; i++) {
    const sku = String(holdedData[i][0] || "").trim();
    const activo = holdedData[i][9];
    if (sku && activo === true) {
      holdedSkus.add(sku);
    }
  }

  const startRow = 4;
  const lastRow = resumen.getLastRow();
  const valores = resumen.getRange(startRow, 1, lastRow - startRow + 1, 1).getValues();

  const faltantes = [];

  for (let i = 0; i < valores.length; i++) {
    const valor = String(valores[i][0] || "").trim();

    if (!valor) continue;
    if (valor === "TOTAL TURNO") break;

    if (!holdedSkus.has(valor)) {
      faltantes.push([valor]);
    }
  }

  let out = ss.getSheetByName("SKUs no encontrados");
  if (!out) out = ss.insertSheet("SKUs no encontrados");
  out.clearContents();
  out.getRange(1, 1).setValue("SKU no encontrado").setFontWeight("bold");

  if (faltantes.length > 0) {
    out.getRange(2, 1, faltantes.length, 1).setValues(faltantes);
    SpreadsheetApp.getUi().alert(`Hay ${faltantes.length} valor(es) no encontrados. Revisa la hoja 'SKUs no encontrados'.`);
  } else {
    out.getRange(2, 1).setValue("Todos los valores del resumen existen en Holded Raw.");
    SpreadsheetApp.getUi().alert("Todos los valores del resumen existen en Holded Raw.");
  }
}