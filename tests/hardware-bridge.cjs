const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const server = fs.readFileSync('HardwareBridge.gs', 'utf8');
const html = fs.readFileSync('PlantWeightPage.html', 'utf8');
const script = html.match(/<script>\s*([\s\S]*?)<\/script>/)[1];
new vm.Script(server);
new vm.Script(script);

assert.match(html, /function openWeight\(id\)[^\n]*loadScaleWeight\(\)/);
assert.match(html, /function loadScaleWeight\(\)[^\n]*getPlantScaleWeight\(\)/);
assert.match(html, /function openLabel\(\)[^\n]*queueHardwareLabel\(r\)/);
assert.match(html, /function queueHardwareLabel\(r\)[^\n]*queuePlantLabelJob/);
assert.match(server, /function doPost\(e\)/);
assert.match(server, /RPI_BRIDGE_TOKEN/);
assert.match(server, /function getPlantScaleWeight\(\)/);
assert.match(server, /function queuePlantLabelJob\(/);
assert.match(server, /function getPlantLabelJobStatus\(/);
assert.match(server, /NO CONFORME/);
assert.match(server, /15 \* 60 \* 1000/);
assert.doesNotMatch(server, /UrlFetchApp\.fetch/);
console.log('PASS: Apps Script bridge parses and plant UI wires scale, queued label and status.');
