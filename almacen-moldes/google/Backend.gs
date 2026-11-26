/** Almacén público, disponible también en el menú del MES. */
const WAREHOUSE_FILE_KEY_ = 'WAREHOUSE_DATA_FILE_ID';

function warehouseUser_() {
  // Acceso público solicitado por el propietario. La identidad de Google es opcional.
  try { return String(Session.getActiveUser().getEmail() || '').trim().toLowerCase() || 'Invitado'; }
  catch (e) { return 'Invitado'; }
}

function doGet(e) {
  const template = HtmlService.createTemplateFromFile('Index');
  template.embedded = Boolean(e && e.parameter && e.parameter.mes === '1');
  return template.evaluate().setTitle('Almacén de moldes · Rotoformas')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include_(name) {
  return HtmlService.createHtmlOutputFromFile(name).getContent();
}

function warehouseRead_() {
  const id = PropertiesService.getScriptProperties().getProperty(WAREHOUSE_FILE_KEY_);
  if (!id) return {revision: 0, state: Model.empty(), updatedAt: '', updatedBy: ''};
  // Si el archivo falta o está dañado, fallar: nunca sustituirlo por un inventario vacío.
  const db = JSON.parse(DriveApp.getFileById(id).getBlob().getDataAsString('UTF-8'));
  if (!Number.isInteger(db.revision) || db.revision < 0) throw new Error('Inventario no válido. Contacta con el administrador.');
  Model.validate(db.state);
  return db;
}

function warehouseGetState() {
  const email = warehouseUser_();
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const db = warehouseRead_();
    return {state: db.state, revision: db.revision, email, updatedAt: db.updatedAt};
  } finally { lock.releaseLock(); }
}

function warehousePutState(next, revision, restore) {
  const email = warehouseUser_();
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const db = warehouseRead_();
    if (!Number.isInteger(revision) || revision !== db.revision) {
      throw new Error('Otra persona ha actualizado el inventario. Pulsa Actualizar inventario antes de repetir el cambio.');
    }
    Model.validate(next);
    if (restore !== true) warehouseCheckChange_(db.state, next);
    const oldMoves = new Set(db.state.moves.map(m => m.id));
    const now = new Date().toISOString();
    next.moves.forEach(m => {
      if (restore !== true && !oldMoves.has(m.id)) { m.actor = email; m.at = now; }
    });
    const saved = {revision: db.revision + 1, state: next, updatedAt: now, updatedBy: email};
    const json = JSON.stringify(saved);
    if (Utilities.newBlob(json).getBytes().length > 8 * 1024 * 1024) {
      throw new Error('El inventario supera el límite de esta versión. Exporta una copia y contacta con el administrador.');
    }
    const props = PropertiesService.getScriptProperties();
    const id = props.getProperty(WAREHOUSE_FILE_KEY_);
    if (id) {
      const file = DriveApp.getFileById(id);
      // Antes de una sustitución por copia se conserva un respaldo en Drive.
      if (restore === true) file.makeCopy('Almacén de moldes · antes de importar · ' + now);
      file.setContent(json);
    } else {
      const file = DriveApp.createFile('Almacén de moldes · inventario compartido.json', json, MimeType.PLAIN_TEXT);
      props.setProperty(WAREHOUSE_FILE_KEY_, file.getId());
    }
    return {state: saved.state, revision: saved.revision, email, updatedAt: now};
  } finally { lock.releaseLock(); }
}

function warehouseCheckChange_(before, after) {
  // Los catálogos y ubicaciones existentes se conservan. Las fichas son editables.
  for (const key of ['owners', 'types', 'locations', 'moves']) {
    for (const old of before[key]) {
      const current = after[key].find(x => x.id === old.id);
      if (!current || JSON.stringify(current) !== JSON.stringify(old)) {
        throw new Error('No se pueden eliminar ni reescribir catálogos, ubicaciones o movimientos existentes.');
      }
    }
  }
  for (const mold of before.molds) {
    const current = after.molds.find(x => x.id === mold.id);
    if (!current || ['code', 'owner', 'type'].some(k => mold[k] !== current[k])) {
      throw new Error('El código y la identidad de los moldes deben conservarse.');
    }
  }
}
