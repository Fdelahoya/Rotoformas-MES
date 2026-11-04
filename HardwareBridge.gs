/**
 * Puente industrial Raspberry Pi <-> Apps Script.
 * Nunca dispara el laser: solo actualiza V1.
 * Token de estacion en ScriptProperties (RPI_BRIDGE_TOKEN), no en HTML/Git.
 */
const HARDWARE = {
  spreadsheetProperty: 'HOLDED_SPREADSHEET_ID',
  tokenProperty: 'RPI_BRIDGE_TOKEN',
  scaleCacheKey: 'ROTOFORMAS_SCALE_SAMPLE_V1',
  scaleMaxAgeMs: 6500,
  stationProperty: 'RPI_PLANT_KEY',
  sessionSeconds: 1800,
  sheet: 'Trabajos equipos',
  headers: ['Id trabajo','Creado','OF','N pieza','SKU','Producto','Lote PT',
    'Peso kg','Fecha pesaje','URL QR','Estado','Impresora','Laser','Detalle','Modificado','Salidas autorizadas'],
  qrBase: 'https://script.google.com/a/macros/rotoformas.com/s/AKfycbw5LAL2__An-gyUsq8qDYNKfYZ5tfJys8INv7__MpmHx32SuZWxonaFiygbsO92tBsN5Q/exec'
};

function hardwareSpreadsheet_() {
  const id = PropertiesService.getScriptProperties().getProperty(HARDWARE.spreadsheetProperty);
  if (!id) throw new Error('Configura HOLDED_SPREADSHEET_ID para el puente Raspberry.');
  return SpreadsheetApp.openById(id);
}

/** Ejecutar UNA VEZ desde la hoja (editor de Apps Script), sin tocar stock. */
function initializeRaspberryBridge() {
  assertLotsWebAppAccess_();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('Ejecuta esta funcion desde la hoja de produccion.');
  PropertiesService.getScriptProperties().setProperty(HARDWARE.spreadsheetProperty, ss.getId());
  // Solo vincula la hoja: no habilita salidas ni crea trabajos.
  return {ok:true, spreadsheetIdConfigured:true,
    tokenConfigured:!!PropertiesService.getScriptProperties().getProperty(HARDWARE.tokenProperty)};
}

function hardwareEnabled_(name) {
  return PropertiesService.getScriptProperties().getProperty('RPI_' + name + '_ENABLED') === 'true';
}

/** Clave de puesto distinta del token del equipo; nunca se incrusta en HTML. */
function openPlantStationSession(key) {
  const expected = PropertiesService.getScriptProperties().getProperty(HARDWARE.stationProperty);
  if (!expected || !/^[a-fA-F0-9]{64}$/.test(expected) || key !== expected ||
      expected === PropertiesService.getScriptProperties().getProperty(HARDWARE.tokenProperty)) {
    throw new Error('Puesto no autorizado.');
  }
  const session = Utilities.getUuid() + Utilities.getUuid();
  CacheService.getScriptCache().put('PLANT_SESSION_' + session, expected, HARDWARE.sessionSeconds);
  return {session, expiresIn: HARDWARE.sessionSeconds};
}

function assertPlantStation_(session) {
  const expected = PropertiesService.getScriptProperties().getProperty(HARDWARE.stationProperty);
  if (typeof session !== 'string' || session.length !== 72 || !expected ||
      CacheService.getScriptCache().get('PLANT_SESSION_' + session) !== expected) {
    throw new Error('Desbloquea el puesto de planta; la sesion puede haber caducado.');
  }
}

function hardwareJobsSheet_(ss) {
  let sheet = ss.getSheetByName(HARDWARE.sheet);
  if (!sheet) sheet = ss.insertSheet(HARDWARE.sheet);
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1,1,1,HARDWARE.headers.length).setValues([HARDWARE.headers]);
    sheet.setFrozenRows(1);
  } else {
    sheet.getRange(1,HARDWARE.headers.length).setValue('Salidas autorizadas');
  }
  return sheet;
}

function hardwareQrUrl_(lot) {
  return HARDWARE.qrBase + '?lote=' + encodeURIComponent(lot);
}

/** Lectura reciente publicada por la Raspberry; no guarda pesajes. */
function getPlantScaleWeight() {
  if (!hardwareEnabled_('SCALE')) return {ok:false, message:'Lectura USB deshabilitada.'};
  const cached = CacheService.getScriptCache().get(HARDWARE.scaleCacheKey);
  if (!cached) return {ok:false, message:'Bascula sin conexion o lectura caducada.'};
  let sample;
  try { sample = JSON.parse(cached); } catch (_) { return {ok:false, message:'Lectura USB invalida.'}; }
  const age = sample && Date.now() - sample.measuredAt;
  if (!sample || sample.stable !== true || typeof sample.weight !== 'number' || !Number.isFinite(sample.weight) ||
      sample.weight <= 0.100 || sample.weight >= 100000 || typeof sample.measuredAt !== 'number' || !Number.isFinite(age) ||
      age < 0 || age > HARDWARE.scaleMaxAgeMs) {
    return {ok:false, message:'Espera a un peso reciente y estable mayor de 0,100 kg.'};
  }
  return {ok:true, weight:sample.weight.toFixed(3), receivedAt:sample.receivedAt,
    validForMs:HARDWARE.scaleMaxAgeMs - age};
}

/** Una etiqueta por pesaje y numero de pieza, sin afectar stock. */
function queuePlantLabelJob(orderId, pieceNumber, stationSession) {
  assertPlantStation_(stationSession);
  if (!hardwareEnabled_('PRINT')) throw new Error('Impresion deshabilitada; no se ha creado ningun trabajo.');
  const id = safeStr_(orderId);
  const piece = Number(pieceNumber);
  if (!id || !Number.isInteger(piece) || piece < 1) throw new Error('Pesaje no valido.');
  const ss = hardwareSpreadsheet_();
  const quality = ss.getSheetByName(MANUFACTURING_ORDERS.qualitySheet);
  if (!quality) throw new Error('No existe la hoja Pesajes calidad.');
  const rows = quality.getDataRange().getValues();
  let measurement = null;
  for (let i = 1; i < rows.length; i++) {
    if (safeStr_(rows[i][2]) === id && Number(rows[i][6]) === piece) {
      measurement = rows[i]; break;
    }
  }
  if (!measurement) throw new Error('No se ha guardado ese pesaje.');
  if (safeStr_(measurement[11]) === 'NO CONFORME') throw new Error('No se imprime una pieza no conforme.');
  if (!['CONFORME','ALERTA'].includes(safeStr_(measurement[11]))) throw new Error('Estado de calidad no valido.');
  const date = measurement[0] instanceof Date ? measurement[0] : new Date(measurement[0]);
  if (!Number.isFinite(date.getTime()) || Date.now() - date.getTime() > 15 * 60 * 1000 ||
      date.getTime() - Date.now() > 60000) {
    throw new Error('La preparacion automatica solo esta permitida durante 15 minutos tras el pesaje.');
  }
  const lot = safeStr_(measurement[3]);
  if (!lot) throw new Error('Falta el lote terminado para la etiqueta.');
  const jobId = id + '|P' + piece;
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const sh = hardwareJobsSheet_(ss);
    const jobs = sh.getDataRange().getValues();
    for (let i = 1; i < jobs.length; i++) {
      if (safeStr_(jobs[i][0]) === jobId) {
        return {ok:true, existing:true, jobId, status:safeStr_(jobs[i][10]), print:safeStr_(jobs[i][11]),
          laser:safeStr_(jobs[i][12]), url:safeStr_(jobs[i][9])};
      }
    }
    const weight = Number(measurement[8]);
    if (!Number.isFinite(weight) || weight <= 0) throw new Error('Peso incorrecto.');
    const url = hardwareQrUrl_(lot);
    sh.appendRow([jobId,new Date(),id,piece,safeStr_(measurement[4]),safeStr_(measurement[5]),
      lot,weight,Utilities.formatDate(date,Session.getScriptTimeZone(),'dd/MM/yyyy HH:mm'),
      url,'PENDIENTE','','','',new Date(),JSON.stringify({print:true,laser:hardwareEnabled_('LASER')})]);
    return {ok:true,existing:false,jobId,status:'PENDIENTE',url};
  } finally { lock.releaseLock(); }
}

/** Estado visible despues de preparar una etiqueta. */
function getPlantLabelJobStatus(jobId, stationSession) {
  assertPlantStation_(stationSession);
  const sh = hardwareSpreadsheet_().getSheetByName(HARDWARE.sheet);
  if (!sh) return {found:false};
  const rows = sh.getDataRange().getValues();
  const id = safeStr_(jobId);
  for (let i = rows.length - 1; i >= 1; i--) {
    if (id && safeStr_(rows[i][0]) === id) {
      return {found:true,jobId:id,status:safeStr_(rows[i][10]),
        print:safeStr_(rows[i][11]),laser:safeStr_(rows[i][12]),detail:safeStr_(rows[i][13]),
        manualAllowed:hardwareEnabled_('PRINT') && safeStr_(rows[i][10]) === 'FINALIZADO' && safeStr_(rows[i][11]) === 'ERROR'};
    }
  }
  return {found:false};
}

/**
 * Endpoint solo Raspberry (implementacion publica "ejecutar como propietario").
 * ContentService sirve respuestas JSON sin revelar token.
 * No publicar una nueva implementacion abierta sin configurar el token.
 */
function doPost(e) {
  try {
    const raw = e && e.postData && e.postData.contents || '';
    if (raw.length > 12000) throw new Error('Solicitud demasiado grande.');
    const data = JSON.parse(raw);
    const expected = PropertiesService.getScriptProperties().getProperty(HARDWARE.tokenProperty);
    if (!expected || !/^[a-fA-F0-9]{64}$/.test(expected) ||
        typeof data.token !== 'string' || data.token !== expected) {
      throw new Error('Acceso no autorizado.');
    }
    if (data.action !== 'sync') throw new Error('Operacion no permitida.');
    const response = hardwareSync_(data);
    return ContentService.createTextOutput(JSON.stringify(response)).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    // No devolver errores del parser ni servicios: pueden incluir cuerpo o datos internos.
    return ContentService.createTextOutput(JSON.stringify({ok:false,error:'Solicitud rechazada o puente no disponible.'}))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function hardwareSync_(data) {
  if (data.protocolVersion !== 2) throw new Error('Actualiza el puente al protocolo 2.');
  const scale = data.sample;
  if (hardwareEnabled_('SCALE') && scale && typeof scale === 'object') {
    const stable = scale.stable === true;
    const num = scale.weight;
    const age = Date.now() - scale.measuredAt;
    const valid = stable && typeof num === 'number' && Number.isFinite(num) && num > 0.100 && num < 100000 &&
      typeof scale.measuredAt === 'number' && Number.isFinite(age) && age >= 0 && age <= HARDWARE.scaleMaxAgeMs;
    CacheService.getScriptCache().put(HARDWARE.scaleCacheKey,JSON.stringify({
      stable:valid,weight:valid?num:null,receivedAt:Date.now(),measuredAt:valid?scale.measuredAt:null,
      message:valid?'':'Bascula sin lectura estable mayor de 0,100 kg.'
    }),15);
  }
  // Telemetria sola no abre Sheets, no reconoce resultados ni consume la cola.
  const capabilities = data.capabilities || {};
  if (!hardwareEnabled_('PRINT') || capabilities.print !== true) {
    return {ok:true,ack:[],job:null};
  }
  const ss = hardwareSpreadsheet_();
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const sh = hardwareJobsSheet_(ss);
    const rows = sh.getDataRange().getValues();
    const ack = [];
    const results = Array.isArray(data.results) ? data.results.slice(0,10) : [];
    results.forEach(item => {
      const id = safeStr_(item && item.jobId);
      const index = rows.findIndex((row,i) => i>0 && safeStr_(row[0]) === id);
      if (index < 1) return;
      if (safeStr_(rows[index][10]) === 'FINALIZADO') {ack.push(id);return;}
      if (safeStr_(rows[index][10]) !== 'ENVIADO') return;
      const print = ['COLA_CUPS','ERROR','INCIERTO','DESHABILITADO'].includes(item.print) ? item.print : 'INCIERTO';
      const laser = ['V1_ACEPTADA','ERROR','INCIERTO','DESHABILITADO'].includes(item.laser) ? item.laser : 'INCIERTO';
      sh.getRange(index+1,11,1,5).setValues([['FINALIZADO',print,laser,
        safeStr_(item.detail).slice(0,900),new Date()]]);
      rows[index][10] = 'FINALIZADO';
      ack.push(id);
    });
    // No ejecutar trabajos antiguos acumulados durante una fase deshabilitada.
    const nextIndex = rows.findIndex((row,i)=>i>0 && safeStr_(row[10]) === 'PENDIENTE' &&
      row[1] instanceof Date && Date.now() - row[1].getTime() >= 0 && Date.now() - row[1].getTime() <= 15*60*1000 &&
      hardwareJobOutputs_(row).print === true);
    let job = null;
    if (nextIndex >= 1) {
      const row = rows[nextIndex];
      sh.getRange(nextIndex+1,11).setValue('ENVIADO');
      sh.getRange(nextIndex+1,15).setValue(new Date());
      job = {protocolVersion:2,outputs:{print:true,laser:hardwareJobOutputs_(row).laser === true &&
          hardwareEnabled_('LASER') && capabilities.laser === true},
        jobId:safeStr_(row[0]),orderId:safeStr_(row[2]),pieceNumber:Number(row[3]),
        sku:safeStr_(row[4]),product:safeStr_(row[5]),lot:safeStr_(row[6]),
        weight:Number(row[7]),measuredAt:safeStr_(row[8]),url:safeStr_(row[9])};
    }
    return {ok:true,ack,job};
  } finally { lock.releaseLock(); }
}

function hardwareJobOutputs_(row) {
  try { return JSON.parse(row[15] || '{}') || {}; } catch (_) { return {}; }
}



function configurarTokenRaspberry() {
  assertLotsWebAppAccess_();

  const ui = SpreadsheetApp.getUi();

  const respuesta = ui.prompt(
    'Configurar Raspberry',
    'Introduce el token hexadecimal privado de 64 caracteres generado en la Raspberry. No lo copies en codigo ni lo envies por chat.',
    ui.ButtonSet.OK_CANCEL
  );

  if (respuesta.getSelectedButton() !== ui.Button.OK) {
    return;
  }

  const token = respuesta.getResponseText().trim();

  if (!/^[a-fA-F0-9]{64}$/.test(token)) {
    ui.alert('El token debe tener exactamente 64 caracteres hexadecimales.');
    return;
  }

  PropertiesService.getScriptProperties()
    .setProperty(HARDWARE.tokenProperty, token);

  ui.alert('Token Raspberry guardado correctamente.');
}
