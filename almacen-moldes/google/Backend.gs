/** Consulta pública; movimientos de planta y administración autorizados en servidor. */
const WAREHOUSE_FILE_KEY_ = 'WAREHOUSE_DATA_FILE_ID';
function warehouseAccess_() {
  let email = '';
  // Nunca usar getEffectiveUser(): sería la identidad del propietario.
  try { email = String(Session.getActiveUser().getEmail() || '').trim().toLowerCase(); } catch (e) {}
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) email = '';
  const props = PropertiesService.getScriptProperties();
  const listed = key => {
    try {
      const values = JSON.parse(props.getProperty(key) || '[]');
      return Array.isArray(values) && values.every(v => typeof v === 'string') && values.some(v => v.trim().toLowerCase() === email);
    } catch (e) { return false; }
  };
  const inDomain = key => {
    const domain = String(props.getProperty(key) || '').trim().toLowerCase();
    return /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/.test(domain) && email.split('@')[1] === domain;
  };
  const canAdmin = Boolean(email && (listed('WAREHOUSE_ADMIN_USERS') || inDomain('WAREHOUSE_ADMIN_DOMAIN')));
  const canMove = Boolean(canAdmin || (email && (listed('WAREHOUSE_PLANT_USERS') || inDomain('WAREHOUSE_PLANT_DOMAIN'))));
  return {email, role: canAdmin ? 'administracion' : canMove ? 'planta' : 'consulta', canMove, canAdmin};
}
function warehouseRequire_(permission) {
  const access = warehouseAccess_();
  if (!access[permission]) throw new Error(permission === 'canAdmin' ? 'Esta operación requiere una cuenta de administración autorizada.' : 'Registrar movimientos requiere una cuenta de planta autorizada.');
  return access;
}
function doGet(e) {
  const template = HtmlService.createTemplateFromFile('Index');
  template.embedded = Boolean(e && e.parameter && e.parameter.mes === '1');
  return template.evaluate().setTitle('Almacén de moldes · Rotoformas').setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
function include_(name) { return HtmlService.createHtmlOutputFromFile(name).getContent(); }
function warehouseRead_() {
  const id = PropertiesService.getScriptProperties().getProperty(WAREHOUSE_FILE_KEY_);
  if (!id) return {revision: 0, state: Model.empty(), audit: [], updatedAt: '', updatedBy: ''};
  const db = JSON.parse(DriveApp.getFileById(id).getBlob().getDataAsString('UTF-8'));
  if (!Number.isInteger(db.revision) || db.revision < 0 || (db.audit && !Array.isArray(db.audit))) throw new Error('Inventario no válido. Contacta con el administrador.');
  Model.validate(db.state); return db;
}
function warehouseResponse_(db, access) {
  const state = JSON.parse(JSON.stringify(db.state));
  if (!access.canMove) state.moves.forEach(m => { m.actor = ''; m.person = ''; m.actorVerified = false; m.actorRole = ''; });
  return {state, revision: db.revision, access, email: access.email, updatedAt: db.updatedAt, audit: access.canAdmin ? (db.audit || []) : []};
}
function warehouseGetState() {
  const access = warehouseAccess_(), lock = LockService.getScriptLock(); lock.waitLock(30000);
  try { return warehouseResponse_(warehouseRead_(), access); } finally { lock.releaseLock(); }
}
function warehouseExportBackup() {
  warehouseRequire_('canAdmin');
  const lock = LockService.getScriptLock(); lock.waitLock(30000);
  try { return warehouseRead_().state; } finally { lock.releaseLock(); }
}
function warehouseRevision_(db, revision) {
  if (!Number.isInteger(revision) || revision !== db.revision) throw new Error('Otra persona ha actualizado el inventario. Pulsa Actualizar inventario antes de repetir el cambio.');
}
function warehouseSave_(db, state, access, kind, restore) {
  Model.validate(state);
  const at = new Date().toISOString();
  const audit = (db.audit || []).concat({id: Utilities.getUuid(), kind, at, actor: access.email, actorVerified: true, role: access.role, previousRevision: db.revision});
  const saved = {revision: db.revision + 1, state, audit, updatedAt: at, updatedBy: access.email};
  const json = JSON.stringify(saved);
  if (Utilities.newBlob(json).getBytes().length > 8 * 1024 * 1024) throw new Error('El inventario supera el límite de esta versión. Exporta una copia y contacta con el administrador.');
  const props = PropertiesService.getScriptProperties(), id = props.getProperty(WAREHOUSE_FILE_KEY_);
  if (id) {
    const file = DriveApp.getFileById(id);
    if (restore) file.makeCopy('Almacén de moldes · antes de importar · ' + at);
    file.setContent(json);
  } else {
    const file = DriveApp.createFile('Almacén de moldes · inventario compartido.json', json, MimeType.PLAIN_TEXT);
    props.setProperty(WAREHOUSE_FILE_KEY_, file.getId());
  }
  return warehouseResponse_(saved, access);
}
/** El servidor calcula el movimiento: no acepta un estado ni una identidad del cliente. */
function warehouseRecordMovement(input, revision) {
  const access = warehouseRequire_('canMove');
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Movimiento no válido.');
  const values = {};
  for (const key of ['mold', 'kind', 'location', 'destination', 'status', 'person', 'notes']) {
    const value = input[key] == null ? '' : input[key];
    if (typeof value !== 'string' || value.length > (key === 'notes' ? 2000 : 150)) throw new Error('Datos de movimiento no válidos.');
    values[key] = value;
  }
  const lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    const db = warehouseRead_(); warehouseRevision_(db, revision);
    const state = JSON.parse(JSON.stringify(db.state)); Model.move(state, values);
    const movement = state.moves[state.moves.length - 1];
    movement.actor = access.email; movement.actorVerified = true; movement.actorRole = access.role;
    return warehouseSave_(db, state, access, 'movement', false);
  } finally { lock.releaseLock(); }
}
/** Administración de fichas: no es un atajo para mover ni reescribir historial. */
function warehousePutState(next, revision, restore) {
  const access = warehouseRequire_('canAdmin');
  if (restore === true) return warehouseRestoreBackup(next, revision);
  const lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    const db = warehouseRead_(); warehouseRevision_(db, revision);
    Model.validate(next); warehouseCheckChange_(db.state, next);
    return warehouseSave_(db, next, access, 'administration', false);
  } finally { lock.releaseLock(); }
}
function warehouseRestoreBackup(input, revision) {
  const access = warehouseRequire_('canAdmin');
  const next = JSON.parse(JSON.stringify(input)); Model.validate(next);
  // Una copia importada no acredita la identidad de sus movimientos históricos.
  next.moves.forEach(m => { m.actorVerified = false; m.actorRole = ''; });
  const lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    const db = warehouseRead_(); warehouseRevision_(db, revision);
    return warehouseSave_(db, next, access, 'restore', true);
  } finally { lock.releaseLock(); }
}
// El transporte de Apps Script no garantiza el orden de las claves de objetos.
// Se conservan tipos, campos y orden de arrays al comparar los datos protegidos.
function warehouseSameValue_(a, b) {
  if (a === b) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
  if (Array.isArray(a) || Array.isArray(b)) return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((v, i) => warehouseSameValue_(v, b[i]));
  const keys = Object.keys(a), otherKeys = Object.keys(b);
  return keys.length === otherKeys.length && keys.every(k => Object.prototype.hasOwnProperty.call(b, k) && warehouseSameValue_(a[k], b[k]));
}
function warehouseCheckChange_(before, after) {
  if (!warehouseSameValue_(before.moves, after.moves)) throw new Error('El historial solo se modifica registrando movimientos.');
  for (const key of ['owners', 'types', 'locations']) for (const old of before[key]) {
    const current = after[key].find(x => x.id === old.id);
    if (!current || !warehouseSameValue_(current, old)) throw new Error('No se pueden eliminar ni reescribir catálogos o ubicaciones existentes.');
  }
  for (const mold of before.molds) {
    const current = after.molds.find(x => x.id === mold.id);
    if (!current || ['code', 'owner', 'type', 'location', 'destination', 'status'].some(k => mold[k] !== current[k])) throw new Error('La identidad y la ubicación solo cambian mediante las operaciones previstas.');
  }
  for (const mold of after.molds) if (!before.molds.some(x => x.id === mold.id) && (mold.location || mold.destination || mold.status !== 'Pendiente de ubicar')) throw new Error('Un molde nuevo debe registrarse sin ubicación; después registra su entrada.');
}
