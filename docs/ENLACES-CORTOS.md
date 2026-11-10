# Enlaces QR de lotes en qr.rotoformas.com

> Versión pública: las direcciones, usuarios, identificadores de adaptadores y
> valores de configuración son marcadores o ejemplos. Los datos reales y las
> credenciales se conservan en la documentación operativa privada.

## Implantación del 9/11/2026, documentada el 10/11/2026

DNS A público verificado: IP_PUBLICA_HOSTING. DNS autoritativos el proveedor DNS,
gestionados por Sulime; el alta en cPanel no publicaba por sí sola el registro.
HTTPS válido verificado mediante petición normal (sin omitir validación TLS).
El servidor respondía 404 antes de instalar el servicio. Raíz propia vista en
cPanel: /home/USUARIO_HOSTING/qr.rotoformas.com, con php.ini. Paquete instalado por el
usuario y verificado en el alojamiento real. Los tres despliegues existentes
están en versión 60 (9/11/2026, 11:11). Raspberry actualizada y servicio activo.
El usuario autorizó expresamente la clave y activación; SHORT_QR_ENABLED=true.
La versión 60 identifica esta instalación. Las ampliaciones posteriores de OF
y materias primas están documentadas en el contexto vivo; no volver a publicar
una versión anterior para mantener los enlaces cortos.

## Servicio de alojamiento

`short-links/build_package.py` crea un ZIP con index.php, service.php, config.php
y .htaccess directamente en su raíz. Subir y extraer únicamente en la carpeta
del subdominio. No incluye php.ini ni modifica la web principal. Si cPanel
advierte de archivos preexistentes, inspeccionar y respaldar antes de sustituir.
El servidor necesita PHP 7.3 o posterior (preferentemente una versión mantenida),
reescritura Apache/LiteSpeed y permiso para crear la carpeta privada hermana.

Cada lote recibe un código aleatorio de 12 caracteres hexadecimales, con
comprobación de colisiones y asignación idempotente. El servicio no acepta un
destino arbitrario: compone únicamente el QR permanente de Apps Script más el
lote codificado. No existen operaciones de borrado ni reasignación. Los GET/HEAD
de códigos válidos redirigen mediante 302. La raíz muestra un mensaje breve.

POST /api/links recibe únicamente `{"lot":"..."}`. Requiere HTTPS y Authorization:
Bearer con clave de 64 caracteres hexadecimales. El ZIP solo contiene su hash
SHA256. La clave real se conserva en outputs/short-links-2026-11-09/private,
fuera del repositorio y del paquete, para configurar SHORT_QR_API_TOKEN en
Script Properties. No mostrar la clave en el chat ni subir ese archivo a cPanel.

Registro: /home/USUARIO_HOSTING/rotoformas-qr-private/links.json, fuera de la carpeta
pública, con permisos 0600 y directorio 0700. Escritores sincronizados con
flock; sustitución atómica; un registro dañado provoca error y no se sobrescribe.
Incluir SIEMPRE esa carpeta en las copias de seguridad. Conservarla entre
actualizaciones: es la relación permanente para todos los QR ya impresos.
Las reglas permiten .well-known para renovar el certificado y no sirven
config.php, service.php, php.ini ni archivos de datos como descargas.

El registro DNS es compartido por todos los lotes. Crear un código no crea una
zona DNS, un subdominio o una página nueva. El servicio resuelve cada código
contra el registro persistente y construye la URL de Apps Script del lote.

## DNS, certificado y alcance de la autorización

El alojamiento se gestiona en cPanel de Raiola. Sulime gestiona los DNS activos
del dominio, servidos por los servidores autoritativos del proveedor DNS. Crear el subdominio en
cPanel no bastó: faltaba el registro público A `qr` hacia `IP_PUBLICA_HOSTING`.
Una vez publicado por Sulime, se comprobó en el servidor autoritativo, Google
y Cloudflare. No se cambiaron los servidores DNS ni registros web o de correo.

Se creó qr.rotoformas.com con raíz propia, sin compartir public_html. La
validación inicial de Let's Encrypt falló mientras no existía el DNS público.
Tras publicarlo se obtuvo HTTPS válido. El 404 previo a la subida del servicio
solo indicaba que aún no había aplicación instalada; después la raíz responde
200 con el mensaje de consulta QR. Las renovaciones conservan acceso a
.well-known/acme-challenge y .well-known/pki-validation.

La clave autoriza exclusivamente POST /api/links. El MES no recibe credenciales
de cPanel, DNS, correo o administración de la web. Solo se admiten lotes y el
destino fijo de trazabilidad: no existe un acortador público de URLs arbitrarias.

## Integración activada

ShortLinks.gs y ShortLinksSettings.html se añaden al proyecto y .claspignore.
SHORT_QR_ENABLED se activó tras verificar el circuito. Para futuras instalaciones
debe seguir ausente o false hasta comprobarlo. hardwareQrUrl_ conserva los
enlaces largos mientras no se active. Activado, consulta /api/links y cachea la
relación diez minutos. Nunca sigue una redirección de la API ni permite destinos
fuera de https://qr.rotoformas.com/[a-f0-9]{12}. Si falla la creación, no encola
la etiqueta ni sustituye silenciosamente el enlace por otro formato.

La vista previa de planta usa job.url, exactamente como Zebra y láser. La
etiqueta manual de empresa pide la misma URL al servidor con autorización.
Raspberry acepta estrictamente el dominio corto y conserva los QR antiguos.
No se modifican dimensiones, información de etiqueta, peso, stock ni funciones
de marcado. La diferenciación de invitado/empresa sigue en Apps Script.
El comportamiento público y los datos permitidos se detallan en
[Trazabilidad y QR](TRAZABILIDAD-QR.md). La pantalla administrativa de conexión
no es el destino de una etiqueta ni una contraseña que deban introducir invitados.

Orden para la instalación: subir servicio; probar HTTPS, autorización,
idempotencia y redirección de un lote conocido sin crear trabajos industriales;
respaldar e instalar bridge.py, probar en el Python nativo y reiniciar servicio;
añadir ShortLinks.gs y los cambios de HardwareBridge/ambos HTML al proyecto;
publicar en los tres despliegues existentes preservando IDs y permisos; abrir
la gestión privada con ?modo=config-qr y usar su formulario para verificar la
clave y un lote real antes de guardar y activar. No reencolar históricos.
Esta pantalla requiere usuario autorizado tanto en doGet como en el método
servidor. No muestra claves existentes ni devuelve claves o errores internos.

## Copias, recuperación y diagnóstico

Guardar por separado: el registro privado `links.json`, el paquete del servicio,
su configuración y la credencial privada del MES. Restaurar los archivos del
servicio sin restaurar el registro no recupera los enlaces ya distribuidos.

1. Ante un fallo, comprobar DNS, certificado y HTTP de la raíz, en ese orden.
2. Un código inexistente o archivo protegido devuelve 404. Un alta sin clave
   devuelve 401. Un registro corrupto o no accesible provoca 503 y no se sustituye
   por un registro vacío. No borrar links.json para hacer desaparecer el error.
3. Restaurar la última copia válida del registro en su carpeta privada, con
   propietario y permisos adecuados al alojamiento. Conservar sus códigos.
4. Reinstalar los archivos públicos en la raíz exclusiva del subdominio sin
   sustituir php.ini ni la web principal. Mantener la clave y su hash coherentes;
   generar otra clave exige reconfigurar el MES, no reasignar códigos.
5. Probar un enlace ya emitido y comprobar el lote exacto sin sesión. Repetir el
   alta de ese mismo lote debe devolver el mismo enlace. Verificar después la
   vista de empresa con cuenta autorizada y un lote nuevo en operación normal.

Desactivar SHORT_QR_ENABLED detiene la creación de enlaces cortos para trabajos
nuevos y vuelve al enlace largo compatible. No recupera ni debe eliminar los
enlaces cortos ya impresos: su servicio y registro deben seguir disponibles.
Los trabajos ya guardados conservan su propia URL.

El código Apps Script está en GitHub. A la revisión del 10/11, el servicio PHP
y el agente Raspberry se conservan en el checkout local y en sus instalaciones;
su incorporación al código de main queda separada de esta publicación documental.
Los archivos se identifican aquí para su mantenimiento; no asumir que están
versionados en main por el mero hecho de aparecer mencionados en esta guía.

## Validación local

PHP oficial 8.4.27 NTS descargado de windows.php.net, hash SHA256 contrastado
con el manifiesto oficial. Siete pruebas HTTP/almacenamiento pasan, incluyendo
20 solicitudes concurrentes en procesos independientes, persistencia, aislamiento
del registro, autenticación, destino fijo, datos inválidos y fallo seguro ante
corrupción. Ocho suites Node pasan, incluidas la integración de URLs y las
restricciones administrativas. Pasan 27 pruebas Python Raspberry con equipos
simulados. En hosting real pasan: raíz 200, sin clave 401, creación 201,
repetición 200 con misma URL, resolución 302 y protección de archivos 404.
Ejemplo ilustrativo, no enlace operativo: https://qr.rotoformas.com/CODIGO_DEL_LOTE para el lote
SKU-EJEMPLO-112026-OF0001. Probada vista pública sin sesión y vista empresa
con el administrador; vista previa de etiqueta renderiza QR sin imprimir.
El agente Python por defecto recibía 403 del alojamiento; el identificador
Rotoformas-MES/1.0 funciona. La petición real de Apps Script funciona sin
modificaciones a la seguridad del alojamiento ni a su agente de usuario.

Respaldo Raspberry: /ruta/ejemplo/puente/bridge.py.RESPALDO_ANTERIOR.
La huella del programa y sus respaldos se conservan en el registro operativo privado.
No se enviaron etiquetas ni datos al láser en esta activación. La comprobación
física debe usar un nuevo pesaje: un trabajo existente reutiliza su URL histórica.
