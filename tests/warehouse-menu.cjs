const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync(process.argv[2]||'LotsWebAppPage.html','utf8');
assert.ok(html.includes('id="navWarehouse"'));
assert.ok(html.includes('id="warehouseView" class="view" hidden'));
assert.ok(html.includes('id="warehouseFrame"'));
const frameTag=html.match(/<iframe id="warehouseFrame"[^>]*>/)[0];
assert.ok(frameTag.includes('data-src="https://script.google.com/macros/s/'));
assert.ok(!/\ssrc=/.test(frameTag),'no cargar el almacén al entrar en otros apartados');
const frames=new Map();let loads=0;
function el(id){if(!frames.has(id))frames.set(id,{hidden:false,dataset:{src:'https://script.google.com/macros/s/almacen/exec?mes=1'},attrs:{},classList:{toggle(){}},focus(){},getAttribute(k){return this.attrs[k]||null},setAttribute(k,v){this.attrs[k]=v;loads++}});return frames.get(id)}
const ctx=vm.createContext({el,clearNotice(){},ordersData:{},salesData:{},loadOrders(){throw Error('No cargar OF al abrir el almacén')},loadSalesOrders(){throw Error('No cargar pedidos al abrir el almacén')},setTimeout:f=>f()});
const functions=html.split('\n').filter(l=>/^\s*function (showView|loadWarehouse)\(/.test(l)).join('\n');
assert.ok(functions.includes('function showView(')&&functions.includes('function loadWarehouse('));
vm.runInContext(functions,ctx);
ctx.showView('warehouse');assert.equal(loads,1);assert.equal(el('warehouseView').hidden,false);assert.equal(el('lotsView').hidden,true);
ctx.showView('trace');assert.equal(el('warehouseView').hidden,true);assert.equal(el('traceView').hidden,false);
ctx.showView('warehouse');assert.equal(loads,1,'volver al almacén conserva la sesión y el formulario en curso');
ctx.showView('orders');assert.equal(el('ordersView').hidden,false);assert.equal(el('warehouseView').hidden,true);
for(const block of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)){if(block[1].trim())new vm.Script(block[1].replace(/<\?[\s\S]*?\?>/g,'""'));}
console.log('Menú almacén: apertura integrada, carga diferida, retorno sin recarga y navegación previa conservada. Sintaxis del cliente correcta.');
