const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const elements=new Map(), calls=[];
const el=id=>{if(!elements.has(id))elements.set(id,{value:'',style:{},textContent:'',innerHTML:'',showModal(){},focus(){},addEventListener(){}});return elements.get(id);};
let success, failure;
const runner={withSuccessHandler(fn){success=fn;return this},withFailureHandler(fn){failure=fn;return this},
  getPlantWeightOrders(){},getPlantScaleWeight(){calls.push({success,failure})}};
const c=vm.createContext({document:{getElementById:el},google:{script:{run:runner}},Date,Intl,setTimeout(){},scrollTo(){}});
vm.runInContext(fs.readFileSync('PlantWeightPage.html','utf8').match(/<script>\s*([\s\S]*?)<\/script>/)[1],c);
vm.runInContext("data={orders:[{id:'OF1',sku:'SKU',product:'Producto',theoreticalWeight:8.8}]}",c);
el('operator').value='Operario'; c.openWeight('OF1');
assert.equal(calls.length,1,'Pesar pieza automatically requests USB sample');
calls[0].success({ok:true,weight:'8.800',validForMs:6500}); assert.equal(el('weight').value,'8.8');
assert.match(el('scaleStatus').textContent,/8,8 kg/);
assert.equal(vm.runInContext('kg(8.1)',c),'8,1');
assert.equal(vm.runInContext('kg(8)',c),'8,0');
c.loadScaleWeight(); el('weight').value='9.2'; calls[1].success({ok:true,weight:'7.700',validForMs:6500});
assert.equal(el('weight').value,'9.2','late reply never overwrites manual input');
c.loadScaleWeight(); c.loadScaleWeight(); calls[2].success({ok:true,weight:'7.700',validForMs:6500});
assert.equal(el('weight').value,'9.2','out of order reply ignored');
calls[3].success({ok:false,message:'Lectura inestable'});assert.equal(el('weight').value,'');
c.loadScaleWeight();calls[4].success({ok:true,weight:'8.800',validForMs:-1});assert.equal(el('weight').value,'');
el('weight').value='8.8';c.loadScaleWeight();calls[5].failure(new Error('sin conexion'));assert.equal(el('weight').value,'');
for (const [weight,display] of [['8.100','8.1'],['8.000','8.0'],['8.149','8.1']]) {
  c.loadScaleWeight();
  const response={ok:true,weight,validForMs:6500};
  calls[calls.length-1].success(response);
  assert.equal(el('weight').value,display,'USB field displays one decimal');
  assert.equal(response.weight,weight,'presentation does not change the source sample');
}
console.log('PASS: one-decimal USB presentation; source sample preserved; stale, unstable, disconnected, manual edits and out-of-order responses handled.');
