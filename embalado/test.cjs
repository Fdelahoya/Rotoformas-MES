const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
require('./build.cjs');
const root = __dirname;
const catalog = JSON.parse(fs.readFileSync(path.join(root, 'catalog.json'), 'utf8')).map(product => ({
  ...product, image: 'data:image/jpeg;base64,' + fs.readFileSync(path.join(root, product.imageFile)).toString('base64')
}));
const site = JSON.parse(fs.readFileSync(path.join(root, 'site-pages.json'), 'utf8'));
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'dist/appsscript.json'), 'utf8'));
const source = fs.readFileSync(path.join(root, 'dist/Code.gs'), 'utf8');
const html = fs.readFileSync(path.join(root, 'dist/Ficha.html'), 'utf8');
const escape = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

// Execute the template's real conditionals and loops with Apps Script print semantics.
function render(product, embedded) {
  let cursor = 0, code = 'let out = "";\n';
  for (const m of html.matchAll(/<\?([\s\S]*?)\?>/g)) {
    code += 'out += ' + JSON.stringify(html.slice(cursor, m.index)) + ';\n';
    const body = m[1].trim();
    if (body.startsWith('!=')) code += 'out += String(' + body.slice(2) + ');\n';
    else if (body.startsWith('=')) code += 'out += esc(' + body.slice(1) + ');\n';
    else code += body + '\n';
    cursor = m.index + m[0].length;
  }
  code += 'out += ' + JSON.stringify(html.slice(cursor)) + ';\nreturn out;';
  return new Function('product', 'embedded', 'esc', code)(product, embedded, escape);
}
const ctx = vm.createContext({HtmlService:{
  XFrameOptionsMode:{ALLOWALL:'ALLOWALL'},
  createTemplateFromFile(name) {
    assert.equal(name, 'Ficha');
    return {evaluate() {
      const result = {html:render(this.product, this.embedded),
        setTitle(title) {this.title=title; return this;},
        setXFrameOptionsMode(mode) {this.frameMode=mode;return this;}};
      return result;
    }};
  }
}});
vm.runInContext(source, ctx);
assert.equal(catalog.length, 38);
assert.equal(new Set(catalog.map(p=>p.id)).size,38);
for (const product of catalog) {
  assert.match(product.image, /^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/);
  const bytes=Buffer.from(product.image.split(',')[1],'base64');
  assert.equal(bytes.subarray(0,2).toString('hex'),'ffd8');
  assert.equal(bytes.subarray(-2).toString('hex'),'ffd9');
  const page=ctx.doGet({parameter:{p:product.id,mes:'1'}});
  assert.equal(page.frameMode,'ALLOWALL');
  assert.ok(page.html.includes('<h1>'+escape(product.title)+'</h1>'));
  assert.ok(page.html.includes('src="'+product.image+'"'));
  assert.ok(page.html.includes('Parámetros de embalado'));
  assert.ok(!page.html.includes('Parámetros de rotomoldeo'));
  assert.ok(!page.html.includes('<header>'),'no duplicate MES header when embedded');
  assert.deepEqual([...page.html.matchAll(/<div class="number">(\d+)<\/div>/g)].map(m=>m[1]),['1','2','3','4','5','6']);
}
const standalone=ctx.doGet({parameter:{p:catalog[0].id}});
assert.ok(standalone.html.includes('<header>'));
for (const input of [undefined,{}, {parameter:{}},{parameter:{p:'missing'}},{parameter:{p:'__proto__'}},{parameter:{p:catalog[0].id+'-other'}},{parameter:{p:'<script>alert(1)</script>'}}]) {
  const page=ctx.doGet(input);
  assert.ok(!page.html.includes('class="photo"'));
  assert.ok(page.html.includes('Selecciona una pieza'));
}
assert.ok(render({...catalog[0],title:'<img onerror="alert(1)">'},true).includes('&lt;img onerror=&quot;alert(1)&quot;&gt;'));
assert.equal(site.pages.length,38);
assert.equal(new Set(site.pages.map(p=>p.path)).size,38);
assert.equal(site.imageLinks.length,39);
for (const p of site.pages) {
  assert.ok(catalog.some(r=>r.id===p.productId));
  assert.match(p.path,/^embalado-[a-z0-9-]+$/);
  assert.equal(p.hiddenFromNavigation,true);
}
for (const l of site.imageLinks) assert.ok(site.pages.some(p=>p.productId===l.productId));
assert.equal(new Set(site.imageLinks.map(l=>l.productId)).size,38);
assert.equal(site.imageLinks.filter(l=>l.productId==='tobogán-abierto-salida').length,2);
assert.deepEqual(manifest.webapp,{executeAs:'USER_DEPLOYING',access:'DOMAIN'});
assert.ok(!manifest.oauthScopes);
assert.ok(!/SpreadsheetApp|DriveApp|UrlFetchApp|PropertiesService|google\.script\.run/.test(source+html));
console.log('Embalado: 38 fichas renderizadas, fotografías, seis pasos, escape, IDs desconocidos, 39 enlaces internos y acceso DOMAIN comprobados.');
