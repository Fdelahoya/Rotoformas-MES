const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
function ui(file){
  const html=fs.readFileSync(file,'utf8');
  const code=html.match(/<script>\s*([\s\S]*)<\/script>/)[1].replace(/<\?!= JSON.stringify\(initialTraceabilityReference\) \?>/,'""');
  const elements={};const el=id=>elements[id]||(elements[id]={value:'',textContent:'',innerHTML:'',style:{},classList:{toggle(){}},focus(){},addEventListener(){},showModal(){this.open=true},close(){this.open=false},reset(){}});
  let captured=[];const runner=new Proxy({withSuccessHandler(fn){this.success=fn;return this},withFailureHandler(fn){this.failure=fn;return this}},{get(t,k){return k in t?t[k]:(...args)=>captured.push({method:k,args})}});
  const c=vm.createContext({document:{getElementById:el},google:{script:{run:runner}},Intl,Date,Map,JSON,setTimeout(){},scrollTo(){},window:{scrollTo(){}}});vm.runInContext(code,c);return {c,el,runner,captured};
}
const fixture=[
  {id:'OF-1',sku:'CODO "90"',product:'Codo <90>',client:'Cliente A',salesOrderNumber:'SO208',reference:'Parque Norte',status:'ABIERTA',finishedLot:'L-A',theoreticalWeight:8,targetQuantity:4,producedQuantity:2,quality:{measured:3}},
  {id:'OF-1',sku:'TRAMO',product:'Tramo',client:'Cliente A',salesOrderNumber:'SO208',reference:'Parque Norte',status:'ABIERTA',finishedLot:'L-B',theoreticalWeight:12,targetQuantity:2,producedQuantity:0,quality:{measured:0}},
  {id:'OF-2',sku:'CODO "90"',product:'Codo <90>',client:'Cliente A',salesOrderNumber:'SO209',reference:'Parque Sur',status:'ABIERTA',finishedLot:'L-C',theoreticalWeight:8,targetQuantity:4,producedQuantity:0,quality:{measured:0}}
];
fixture.forEach(o=>o.materials={ready:true,pe:{sku:'PE NATURAL',lot:'PE-A'}});
let {c,el,runner,captured}=ui('PlantWeightPage.html');c.fixture={orders:fixture};vm.runInContext('data=fixture;render()',c);
assert.equal((el('orders').innerHTML.match(/<article/g)||[]).length,2);
assert.equal((el('orders').innerHTML.match(/>Pesar<\/button>/g)||[]).length,3);
assert.match(el('orders').innerHTML,/SO208/);assert.match(el('orders').innerHTML,/SO209/);
assert.match(el('orders').innerHTML,/Codo &lt;90&gt;/);assert.match(el('orders').innerHTML,/3 pesajes registrados/);
el('operator').value='Emilio';c.openWeightLine(1);assert.equal(el('orderId').value,'OF-1');assert.equal(el('lineSku').value,'TRAMO');
assert.match(el('context').innerHTML,/SO208/);assert.match(el('context').innerHTML,/12,0 kg/);
el('weight').value='12';c.saveWeight({preventDefault(){}});let call=captured.at(-1);
assert.equal(call.method,'recordPlantManufacturingPieceWeight');assert.equal(call.args[0].sku,'TRAMO');
c.openWeightLine(2);assert.equal(el('orderId').value,'OF-2');assert.match(el('context').innerHTML,/Parque Sur/);
c.openWeight('OF-1');assert.match(el('notice').textContent,/modelo/);
({c,el,runner,captured}=ui('LotsWebAppPage.html'));c.fixture={orders:fixture,summary:{open:2,closed:0,total:2},clients:[],catalog:[]};
el('orderStatus').value='ABIERTA';vm.runInContext('ordersData=fixture;renderOrders()',c);
assert.equal((el('ordersList').innerHTML.match(/<article/g)||[]).length,2);
c.orderLineAction('weight',1);assert.equal(el('weightSku').value,'TRAMO');
el('actualWeight').value='12';c.savePieceWeight({preventDefault(){}});assert.equal(captured.at(-1).args[0].sku,'TRAMO');
c.orderLineAction('materials',1);assert.deepEqual(Array.from(captured.at(-1).args),['OF-1','TRAMO']);
el('orderSearch').value='SO209';c.renderOrders();assert.equal((el('ordersList').innerHTML.match(/<article/g)||[]).length,1);assert(!el('ordersList').innerHTML.includes('SO208'));
c.renderTraceability({selection:true,orderId:'OF-1',lines:fixture.slice(0,2)});assert.match(el('traceResult').innerHTML,/Selecciona el modelo/);
// Every generated onclick parses, including lot recovery and detail's SKU argument.
el('orderSearch').value='';fixture[0].lotState='ERROR';c.renderOrders();
function checkHandlers(markup){for(const m of markup.matchAll(/onclick="([^"]*)"/g)){const js=m[1].replaceAll('&quot;','"').replaceAll('&#39;',"'").replaceAll('&amp;','&').replaceAll('&lt;','<').replaceAll('&gt;','>');new vm.Script(js)}}
checkHandlers(el('ordersList').innerHTML);
c.orderLineAction('detail',0);runner.success({order:fixture[0],productions:[],quality:{measurements:[],measured:0}});checkHandlers(el('orderDetail').innerHTML);
console.log('PASS: compact grouped cards, same customer/model in distinct orders, explicit SKU in weight/material actions, escaped display and handlers, order search and traceability model chooser.');

// Pending sibling cannot open weighing; ready sibling remains usable.
fixture[0].materials={ready:false};c.renderOrders();assert.match(el('ordersList').innerHTML,/Preparación: 1 de 2 líneas listas/);assert.match(el('ordersList').innerHTML,/Pendiente de materias primas/);el('weightDialog').open=false;c.openWeightDialog('OF-1',fixture[0].sku);assert.equal(el('weightDialog').open,false);c.openWeightDialog('OF-1','TRAMO');assert.equal(el('weightDialog').open,true);
({c,el}=ui('PlantWeightPage.html'));c.fixture={orders:fixture};vm.runInContext('data=fixture;render()',c);assert.match(el('orders').innerHTML,/Preparación: 1 de 2 líneas listas/);el('operator').value='Emilio';c.openWeightLine(0);assert(!el('weightDialog').open);c.openWeightLine(1);assert(el('weightDialog').open);assert(!el('orders').innerHTML.includes('Pigmento:'));
console.log('PASS: per-line readiness, blocked dialog entry, ready siblings and hidden untracked pigment.');

({c,el,runner,captured}=ui('LotsWebAppPage.html'));c.fixture={orders:fixture,summary:{open:2,closed:0,total:2}};el('orderStatus').value='ABIERTA';vm.runInContext('ordersData=fixture;orderPigmentData={order:fixture.orders[0]}',c);el('pigmentMode').value='OFF';el('peProduct').value='PE';el('peLot').value='A';c.saveOrderPigment();assert.equal(el('savePigmentButton').textContent,'Guardando…');const calls=captured.length;c.saveOrderPigment();assert.equal(captured.length,calls);runner.success({order:{...fixture[0],materials:{ready:true,pe:{sku:'PE NATURAL',lot:'A'}}}});assert.match(el('ordersList').innerHTML,/Preparación: 2 de 2 líneas listas/);assert.equal(captured.length,calls);assert.match(el('notice').textContent,/Materias primas guardadas/);console.log('PASS: save feedback, duplicate submit guard and targeted merge without catalog reload.');
