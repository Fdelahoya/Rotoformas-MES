function doGet(e) {
  const key = String(e && e.parameter && e.parameter.p || '');
  const product = PACKAGING_PRODUCTS.find(function(p){return p.id === key;});
  const template = HtmlService.createTemplateFromFile('Ficha');
  template.product = product || null;
  template.embedded = !!(e && e.parameter && e.parameter.mes === "1");
  return template.evaluate().setTitle(product ? product.title + ' · Instrucciones de embalado' : 'Instrucciones de embalado')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
