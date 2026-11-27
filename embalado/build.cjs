const fs = require('node:fs');
const path = require('node:path');
const root = __dirname;
const catalog = JSON.parse(fs.readFileSync(path.join(root, 'catalog.json'), 'utf8')).map(product => ({
  ...product, image: 'data:image/jpeg;base64,' + fs.readFileSync(path.join(root, product.imageFile)).toString('base64')
}));
const dist = path.join(root, 'dist');
fs.mkdirSync(dist, {recursive: true});
const backend = fs.readFileSync(path.join(root, 'src/Code.gs'), 'utf8');
fs.writeFileSync(path.join(dist, 'Code.gs'), 'const PACKAGING_PRODUCTS = ' + JSON.stringify(catalog) + ';\n' + backend);
for (const name of ['Ficha.html', 'appsscript.json']) {
  fs.copyFileSync(path.join(root, 'src', name), path.join(dist, name));
}
fs.writeFileSync(path.join(dist, '.claspignore'), '**/**\n!Code.gs\n!Ficha.html\n!appsscript.json\n');
console.log('Embalado: ' + catalog.length + ' fichas preparadas en dist/');
