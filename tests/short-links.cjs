const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const props=new Map(),cache=new Map(),requests=[];
let status=201,body={ok:true,url:'https://qr.rotoformas.com/a123456789ab'},fail=false;
const context=vm.createContext({
  safeStr_:v=>String(v||'').trim(),
  PropertiesService:{getScriptProperties:()=>({getProperty:k=>props.get(k)})},
  CacheService:{getScriptCache:()=>({get:k=>cache.get(k),put:(k,v)=>cache.set(k,v)})},
  Utilities:{DigestAlgorithm:{SHA_256:'sha256'},Charset:{UTF_8:'utf8'},
    computeDigest:(alg,v)=>[...crypto.createHash(alg).update(v).digest()]},
  UrlFetchApp:{fetch:(url,options)=>{requests.push({url,options});if(fail)throw Error('secret response');
    return {getResponseCode:()=>status,getContentText:()=>JSON.stringify(body)};}},
  assertLotsWebAppAccess_:()=>{throw Error('Acceso restringido');}
});
vm.runInContext(fs.readFileSync('ShortLinks.gs','utf8'),context);
assert.equal(context.shortQrUrl_('Lote A','long-url'),'long-url');assert.equal(requests.length,0);
props.set('SHORT_QR_ENABLED','true');
assert.throws(()=>context.shortQrUrl_('Lote A','long-url'),/Falta configurar/);
props.set('SHORT_QR_API_TOKEN','f'.repeat(64));
assert.equal(context.shortQrUrl_('Lote A','long-url'),body.url);
assert.equal(context.shortQrUrl_('Lote A','long-url'),body.url);assert.equal(requests.length,1);
assert.equal(requests[0].url,'https://qr.rotoformas.com/api/links');
assert.equal(requests[0].options.headers.Authorization,'Bearer '+'f'.repeat(64));
assert.equal(requests[0].options.payload,JSON.stringify({lot:'Lote A'}));
assert.equal(requests[0].options.followRedirects,false);
assert.equal(requests[0].options.validateHttpsCertificates,true);
assert.equal(context.shortQrUrl_('Lote B','long-url'),body.url);assert.equal(requests.length,2);
cache.clear();
for (const url of ['https://attacker.invalid/a123456789ab','http://qr.rotoformas.com/a123456789ab',
  'https://qr.rotoformas.com/a123456789ab?x=1','https://qr.rotoformas.com@attacker.invalid/a123456789ab',
  'https://qr.rotoformas.com/a123456789ab\n','https://qr.rotoformas.com/api/links']) {
  body={ok:true,url};assert.throws(()=>context.shortQrUrl_('Lote A','long-url'),/No se ha podido/);
}
body={ok:true,url:'https://qr.rotoformas.com/a123456789ab'};
for(const code of [301,302,401,500]){status=code;assert.throws(()=>context.shortQrUrl_('Lote A','long-url'),/No se ha podido/);}
status=201;fail=true;
assert.throws(()=>context.shortQrUrl_('Lote A','long-url'),e=>!e.message.includes('secret')&&e.message.includes('No se ha podido'));
assert.throws(()=>context.getTraceabilityLabelUrl('A'),/Acceso restringido/);
const plant=fs.readFileSync('PlantWeightPage.html','utf8'),company=fs.readFileSync('LotsWebAppPage.html','utf8');
assert.match(plant,/renderLabelQr\(job.url\)/);
assert.doesNotMatch(plant,/const traceUrl=TRACEABILITY_BASE_URL/);
assert.match(company,/getTraceabilityLabelUrl\(o.finishedLot\)/);
assert.doesNotMatch(company,/const traceUrl=TRACEABILITY_BASE_URL/);
new vm.Script(company.match(/<script>\s*([\s\S]*?)<\/script>/)[1].replace(/<\?!=[\s\S]*?\?>/g,'""'));
console.log('PASS: disabled until activation; server-only key; cached lot-specific request; HTTPS allowlist; no redirect following; fail closed; previews use server URLs.');
