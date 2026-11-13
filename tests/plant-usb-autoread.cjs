const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync(process.argv[2]||'PlantWeightPage.html','utf8');
function setup(){
  let now=0,success,failure,timerId=0;
  const elements=new Map(),calls=[],saves=[],timers=[];
  const el=id=>{
    if(!elements.has(id))elements.set(id,{value:'',style:{},textContent:'',innerHTML:'',open:false,listeners:{},
      showModal(){this.open=true},close(){this.open=false},focus(){},addEventListener(name,fn){this.listeners[name]=fn}});
    return elements.get(id);
  };
  const runner={withSuccessHandler(fn){success=fn;return this},withFailureHandler(fn){failure=fn;return this},
    getPlantWeightOrders(){},getPlantScaleWeight(){calls.push({success,failure})},recordPlantManufacturingPieceWeight(v){saves.push(v)}};
  class Clock extends Date{static now(){return now}}
  const c=vm.createContext({document:{getElementById:el},google:{script:{run:runner}},Date:Clock,Intl,
    setTimeout(fn,delay){timers.push({fn,delay,id:++timerId});return timerId},scrollTo(){}});
  vm.runInContext(html.match(/<script>\s*([\s\S]*?)<\/script>/)[1],c);
  vm.runInContext("data={orders:[{id:'OF1',sku:'SKU',product:'Producto',theoreticalWeight:26,materials:{ready:true}}]}",c);
  el('operator').value='Operario';
  function tick(){const t=timers.shift();assert.ok(t,'expected a scheduled retry');now+=t.delay;t.fn()}
  return {c,el,calls,saves,timers,tick,advance(ms){now+=ms}};
}
{
  const s=setup();s.c.openWeight('OF1','SKU');
  assert.equal(s.calls.length,1,'blue Pesar immediately requests USB');
  s.calls[0].success({ok:false,message:'Espera a un peso reciente y estable'});
  assert.equal(s.el('weight').value,'');s.tick();
  assert.equal(s.calls.length,2,'blue Pesar retries without clicking white Pesar');
  const sample={ok:true,weight:'26.000',validForMs:6500};s.calls[1].success(sample);
  assert.equal(s.el('weight').value,'26.0');assert.equal(sample.weight,'26.000');
  s.c.loadScaleWeight();s.calls[2].success({ok:true,weight:'25.800',validForMs:6500});
  assert.equal(s.el('weight').value,'25.8','white Pesar uses the same reader');
  assert.equal(s.saves.length,0,'reading never saves a measurement');
}
{
  const s=setup();s.c.openWeight('OF1','SKU');s.advance(5000);
  s.calls[0].success({ok:true,weight:'26.000',validForMs:1000});
  assert.equal(s.el('weight').value,'','late first reply is not used');s.tick();
  s.calls[1].success({ok:true,weight:'26.100',validForMs:6500});
  assert.equal(s.el('weight').value,'26.1','fresh replacement fills automatically');
}
for(const action of ['manual','close','escape','newRead']){
  const s=setup();s.c.openWeight('OF1','SKU');s.calls[0].success({ok:false,message:'Sin muestra'});
  if(action==='manual'){s.el('weight').value='27.4';s.el('weight').listeners.input()}
  if(action==='close')s.c.closeWeight();
  if(action==='escape')s.el('weightDialog').close();
  if(action==='newRead'){s.c.loadScaleWeight();s.calls[1].success({ok:true,weight:'25.900',validForMs:6500})}
  const count=s.calls.length;s.tick();
  assert.equal(s.calls.length,count,'stale retry cancelled after '+action);
  if(action==='manual')assert.equal(s.el('weight').value,'27.4');
  if(action==='newRead')assert.equal(s.el('weight').value,'25.9');
  assert.equal(s.saves.length,0);
}
{
  const s=setup();s.c.openWeight('OF1','SKU');
  s.calls[0].failure(new Error('red'));s.tick();
  s.calls[1].success({ok:true,weight:'NaN',validForMs:6500});s.tick();
  s.calls[2].success({ok:true,weight:'0.000',validForMs:6500});
  assert.equal(s.calls.length,3);assert.equal(s.timers.length,0,'retries are bounded');
  assert.equal(s.el('weight').value,'');assert.match(s.el('scaleStatus').textContent,/Puedes pulsar Pesar/);
}
console.log('PASS: blue and white Pesar read USB; fresh bounded retries; stale/manual/closed responses ignored; no saves.');
