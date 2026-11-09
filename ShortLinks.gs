/** Disabled until hosting and Raspberry have both been verified. No key is sent to HTML. */
const SHORT_QR = {
  base: 'https://qr.rotoformas.com',
  enabledProperty: 'SHORT_QR_ENABLED',
  tokenProperty: 'SHORT_QR_API_TOKEN'
};

function shortQrUrl_(lot, longUrl) {
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty(SHORT_QR.enabledProperty) !== 'true') return longUrl;
  const value = safeStr_(lot);
  if (!value || value.length > 200 || /[\x00-\x1f\x7f]/.test(value)) {
    throw new Error('Lote no válido para el enlace QR.');
  }
  const key = 'SHORT_QR_V1_' + Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,
    value, Utilities.Charset.UTF_8).map(n => ((n + 256) % 256).toString(16).padStart(2, '0')).join('');
  const cache = CacheService.getScriptCache();
  const cached = cache.get(key);
  if (cached && cached === cached.trim() && /^https:\/\/qr\.rotoformas\.com\/[a-f0-9]{12}$/.test(cached)) return cached;
  const token = props.getProperty(SHORT_QR.tokenProperty);
  if (!token || token.length !== 64 || !/^[a-f0-9]{64}$/.test(token)) {
    throw new Error('Falta configurar el servicio de enlaces QR.');
  }
  const url = requestShortQrUrl_(value, token);
  cache.put(key, url, 600);
  return url;
}

function requestShortQrUrl_(value, token) {
  let response, data;
  try {
    response = UrlFetchApp.fetch(SHORT_QR.base + '/api/links', {
      method: 'post', contentType: 'application/json',
      headers: {Authorization: 'Bearer ' + token},
      payload: JSON.stringify({lot:value}),
      followRedirects: false, muteHttpExceptions: true, validateHttpsCertificates: true
    });
    if (![200,201].includes(response.getResponseCode())) throw new Error('HTTP');
    data = JSON.parse(response.getContentText());
    if (!data || data.ok !== true || typeof data.url !== 'string' || data.url !== data.url.trim() ||
        !/^https:\/\/qr\.rotoformas\.com\/[a-f0-9]{12}$/.test(data.url)) throw new Error('URL');
  } catch (_) {
    // No silent change back to a long QR, and no raw response/credential exposure.
    throw new Error('No se ha podido preparar el enlace QR. Inténtalo de nuevo; no se ha enviado la etiqueta.');
  }
  return data.url;
}

/** Private company settings form. Credentials never enter source/history or responses. */
function connectShortQrService(apiToken, sampleLot) {
  assertLotsWebAppAccess_();
  const token = safeStr_(apiToken);
  if (!/^[a-f0-9]{64}$/.test(token) || token.length !== 64) throw new Error('Clave no válida.');
  const lot = safeStr_(sampleLot);
  if (!lot || lot.length > 200 || /[\x00-\x1f\x7f]/.test(lot)) throw new Error('Lote no válido.');
  const url = requestShortQrUrl_(lot, token);
  PropertiesService.getScriptProperties().setProperties({SHORT_QR_API_TOKEN:token, SHORT_QR_ENABLED:'true'});
  return {ok:true,url};
}

/** Company manual-label preview; plant preview uses the queued job's exact URL. */
function getTraceabilityLabelUrl(lot) {
  assertLotsWebAppAccess_();
  const value = safeStr_(lot);
  if (!value || value.length > 200 || /[\x00-\x1f\x7f]/.test(value)) throw new Error('Lote no válido.');
  return hardwareQrUrl_(value);
}
