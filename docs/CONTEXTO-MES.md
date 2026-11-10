# Contexto vivo del MES de Rotoformas

Actualizado el 10 de noviembre de 2026. Responsable del contenido: equipo Rotoformas.

Este documento permite continuar el desarrollo del MES, especialmente la integración de Raspberry Pi, báscula, impresora Zebra y láser. Recoge las decisiones vigentes y los límites que deben respetar tanto los desarrolladores como sus asistentes de IA.

El 9 de noviembre se contrastó GitHub con el código de Apps Script y sus despliegues, entonces en versión 60. Se incorporaron los cambios de Raspberry, báscula y QR presentes en Apps Script. La ampliación de [OF con varias piezas](OF-VARIAS-PIEZAS.md) permite una OF por pedido y una línea por SKU. La configuración física de los equipos debe mantenerla el administrador junto con el código de Raspberry.

## QR, enlaces cortos y equipos documentados el 10/11/2026

La [guía de trazabilidad y QR](TRAZABILIDAD-QR.md) recoge las decisiones y
comprobaciones de esta implantación. La ficha de invitado no pide contraseña:
solo muestra nombre, fecha de fabricación, lote de polietileno, lote terminado
y foto disponible de Holded. Se devuelve una única ficha de fabricación
aceptada más reciente por lote, no una identificación del último pesaje físico.
La cuenta autorizada conserva la trazabilidad completa.

Los [enlaces cortos de qr.rotoformas.com](ENLACES-CORTOS.md) están activos desde
el 9/11. Sulime publicó el DNS y el usuario instaló el servicio en el alojamiento
Raiola con HTTPS. El MES, autenticado con una clave privada en propiedades,
asigna automáticamente una URL permanente por lote; Zebra y láser reciben
la misma URL. El servicio solo redirige al Apps Script original, que decide la
vista. No se modificaron datos ni formato de la etiqueta. Los trabajos históricos
conservan su URL y no se reenvían al activar este formato.

La actualización se implantó en versión 60; las ampliaciones de OF y materias
primas publicadas posteriormente conservan este recorrido. Este cambio
**documental** no publica Apps Script ni sustituye las versiones posteriores
63/64 ya registradas en este documento.

La [configuración operativa de equipos](EQUIPOS-OPERATIVOS-2026-11-05.md) reúne
servicio, rutas, parámetros USB, cola CUPS, V1, respaldos y discrepancias de IP.
Las direcciones y credenciales concretas se conservan en la copia operativa
privada. La IP de Zebra comunicada posteriormente y el destino de la cola
inicial no se confunden: no se verificó una migración de la cola.

La consulta real sin cookies abrió la ficha pública y con sesión autorizada
abrió la trazabilidad. Se verificaron API, idempotencia, redirección y vista
previa; el usuario confirmó el acceso final. No se imprimió ni marcó durante
la activación del enlace corto. La prueba física de una nueva etiqueta corta
en ambos equipos no se ha documentado todavía. La pantalla administrativa
Conectar enlaces QR se dejó abierta, causó confusión y se cerró; no forma parte
del recorrido de invitados.

El [índice de documentación](README.md) separa las guías vigentes de los
procedimientos históricos. Las fuentes del servicio PHP y del agente Raspberry
siguen en el checkout local y en sus instalaciones; esta publicación sube
únicamente documentación, sin sustituir el código más reciente de main.

## Cómo mantener este documento

Los nombres comerciales de los productos del catálogo migrado se restauraron posteriormente conservando los nuevos IDs, SKU, lotes y stock; catálogo MES actualizado.

Catálogo migrado: la [migración de veinte SKU a lotes](MIGRACION-ENTRETENIUM.md) está ejecutada y verificada. Los productos menores (aros, semirrodillos y semiesferas) quedan fuera de la OF por decisión del usuario. REFERENCIA_EJEMPLO permite crear una OF de 8 modelos y 20 unidades; el catálogo está sincronizado. Antes de expedir en Holded hay que reenlazar sus líneas comerciales, que conservan los IDs antiguos. También quedan por revisar los campos que no copia el alta (imágenes, IVA de compra y Tipo de plástico).

La ampliación está publicada: versión 61 para planta y QR públicos y versión 62 para gestión privada, con el mismo código y manifiestos de acceso separados. Se conservaron las URLs y se verificaron acceso privado y pedidos agrupados. Cinco pruebas automatizadas pasan; la revisión visual con varias piezas utiliza datos ficticios. No se generaron movimientos ni trabajos físicos de prueba. La gestión por lotes de REFERENCIA_EJEMPLO quedó habilitada posteriormente mediante la migración de Entretenium. Véanse la verificación y la incidencia de despliegue corregida en [OF con varias piezas](OF-VARIAS-PIEZAS.md).

GitHub es la fuente principal de este contexto. Una copia subida a un proyecto de ChatGPT es una instantánea y no se actualiza automáticamente al cambiar este archivo.

En cada cambio funcional, actualizar este documento en el mismo commit o pull request cuando afecte a reglas de negocio, interfaces de equipos, datos, permisos, despliegues o pendientes. Actualizar la fecha e indicar qué se ha validado. No convertir una propuesta en funcionalidad implantada hasta comprobarla.

El código y las pruebas determinan el comportamiento implementado. Este documento explica el comportamiento acordado. Si difieren, registrar la discrepancia antes de modificar producción. Algunos apartados de `SETUP.md` y `FEATURES.md` describen fases antiguas; para materias primas por OF, consultar también [MATERIAS-PRIMAS-POR-OF.md](MATERIAS-PRIMAS-POR-OF.md).

## Arquitectura y accesos

Google Sites presenta las aplicaciones de Apps Script. Google Sheets almacena producción, órdenes, pesajes, recetas y registros de integración. Holded contiene el catálogo, los pedidos, los lotes y el stock. GitHub conserva el código y su documentación.

- Proyecto de Apps Script (dirección conservada en el registro privado).
- Hoja principal de producción (dirección conservada en el registro privado).
- Pantalla pública de producción (dirección conservada en el registro privado).
- Gestión y trazabilidad (dirección conservada en el registro privado).

el administrador puede editar el proyecto desde el navegador si dispone de permiso de edición en Apps Script. No necesita instalar Node o clasp para ese acceso. GitHub permite revisar cambios y mantener versiones; el acceso al repositorio no concede por sí mismo acceso a Google ni a Holded.

La pantalla de planta permite operaciones limitadas sin iniciar sesión. La aplicación de gestión requiere una cuenta autorizada por el servidor. `CUENTA_AUTORIZADA` forma parte de la lista configurada. Compartir Google Sites no sustituye esa autorización. La consulta QR ofrece ahora una ficha pública limitada por coincidencia exacta de lote; los datos internos y la gestión permanecen protegidos.

Las credenciales de Holded se guardan en propiedades del script, entre ellas `HOLDED_API_KEY` y `HOLDED_API_V2_TOKEN`. No incluir sus valores, sesiones de Google, tokens de clasp ni credenciales de equipos en este documento, el repositorio o conversaciones.

## Flujo de fabricación

1. Crear un pedido de venta en Holded cuando corresponda. También existe creación manual de OF para fabricación sin pedido.
2. Desde pedidos pendientes, crear una OF para las referencias elegibles del pedido. Las líneas repetidas del mismo SKU se agrupan. La elegibilidad depende de que el producto tenga gestión por lotes; no del término comercial «premium», que no debe aparecer en la interfaz. Se muestran las líneas excluidas para revisarlas.
3. El MES genera un lote de producto terminado por SKU de la OF en Holded, inicialmente sin existencias. El nombre sigue `SKU-MMYYYY-OFNNNN`, usando la fecha objetivo o, en su defecto, la de creación. Los colores son instrucciones, no SKU ni lotes distintos.
4. Configurar las materias primas de cada línea de la OF, incluyendo el lote de PE y, cuando proceda, el pigmento.
5. Registrar la producción por turno. Al generar el resumen se vinculan las fabricaciones a la OF.
6. Procesar los movimientos de stock del turno: descontar componentes y sumar producto terminado en el lote de esa OF.
7. Registrar pesajes individuales y emitir o reimprimir etiquetas cuando se necesiten.

El stock se actualiza por turno, no al cerrar la OF. Pesar o imprimir no aumenta las unidades fabricadas ni mueve stock. La generación automática de albaranes y facturas al cerrar OF no está implementada en el flujo revisado.

Si hay varias OF abiertas pendientes para el mismo SKU, la producción agregada del turno no permite elegir inequívocamente una. El sistema debe detener esa asignación; no seleccionar arbitrariamente la primera. Varias OF de productos diferentes no tienen esa ambigüedad.

## Materias primas por orden

Cada modelo o SKU de la OF tiene configuración propia en «Materias primas»:

- PE obligatorio, con producto compatible con la receta y un lote existente de Holded.
- Pigmento opcional. Al activarlo, se seleccionan producto y lote existentes; debe corresponder al pigmento y cantidad de la receta. Se registra y descuenta ese lote.
- Si no se activa pigmento, no se registra su consumo para esa OF. Se ocultan los campos o columnas correspondientes en las vistas de trazabilidad; no mostrar «sin seguimiento» ni guiones al cliente.
- No sustituir silenciosamente una configuración incompleta de OF por el lote activo global.

Los productos sin OF mantienen el uso de «Lotes activos», por ejemplo chimeneas y otros productos genéricos que consumen PE natural o reciclado. Por ello esta pestaña sigue siendo necesaria. El flujo general conserva su resolución de lotes, incluido el lote cuyo nombre coincide con el SKU cuando corresponda; esa alternativa no debe sustituir el lote terminado de una OF.

Cada nueva fabricación conserva una instantánea de productos y lotes utilizados. Cambiar la configuración afecta a las fabricaciones posteriores, no debe reescribir las anteriores ni cambiar los lotes de un reintento.

Para Tecnospra se acordó inicialmente seguir PE sin consumir ni seguir pigmentos no configurados. El color escrito en la OF no equivale a una receta de pigmento.

## Ejemplos de referencia

Los casos con pedidos, productos, lotes y cantidades reales se conservan en
el registro operativo privado. Para pruebas públicas se usan SKU-EJEMPLO,
LOTE-EJEMPLO y cantidades ficticias. No ejecutar pruebas de stock con datos
reales por copiar un ejemplo de documentación.

Se mantiene pendiente revisar la precisión de consumos pequeños: el cálculo
conserva más decimales que algunos envíos de movimientos. No darlo por resuelto
sin contrastar cantidades y registros.

## Pesaje y calidad

Se pesa cada pieza al salir del horno, antes del mecanizado o retrabajo. Se compara con el peso teórico del producto en Holded. El objetivo es controlar cada pieza, no el peso acumulado del lote.

La desviación es el valor absoluto de la diferencia respecto al teórico, dividido por el teórico:

| Desviación | Resultado |
| --- | --- |
| Hasta el 3 % inclusive | Conforme, verde |
| Mayor del 3 % y menor del 6 % | Alerta, amarillo |
| Desde el 6 % inclusive | No conforme, rojo |

Se admite peso manual positivo y finito, también con coma decimal. Se registra OF, lote, número interno de pieza, peso, desviación, resultado, fecha, operario y observaciones. El desplegable de operarios está ordenado como los operarios configurados. Elegir un nombre no constituye autenticación de identidad.

Funciones relevantes:

- `getPlantWeightOrders`: proyección de órdenes abiertas para la pantalla pública.
- `recordPlantManufacturingPieceWeight`: entrada pública limitada para guardar pesajes.
- `recordManufacturingPieceWeight`: entrada privada con comprobación de acceso.
- `recordManufacturingPieceWeight_`: guardado compartido.

El guardado recibe `orderId`, `actualWeight`, `operator` y `notes`; devuelve el registro y su clasificación. Estas funciones se llaman desde Apps Script con `google.script.run`; no constituyen una API REST ya preparada para la Raspberry.

Actualmente, repetir la petición de guardado puede crear otro pesaje. La integración automática necesita identificar cada medición y evitar duplicados antes de introducir reintentos de red.

## Etiquetas y QR

La etiqueta tiene formato de 100 × 150 mm e incluye producto, SKU, lote, peso bruto, fecha, OF, número interno de pieza y QR. Ya utiliza un QR real; las referencias antiguas a un recuadro provisional o a 100 × 60 mm están superadas.

Todas las piezas de un mismo lote comparten el QR. Cada SKU de una OF tiene su lote. El número de pesada es secuencial para toda la OF y diferencia registros internos, pero el QR no identifica de forma única la pieza física. El destino se obtiene del servicio común de enlaces: admite los QR antiguos `?lote=`, los compatibles con láser `?lote/` y enlaces cortos por lote de `qr.rotoformas.com` cuando están habilitados.

Se puede guardar un pesaje sin imprimir y reimprimirlo posteriormente desde trazabilidad tantas veces como sea necesario. Reimprimir reutiliza el registro existente y no crea otro pesaje, fabricación o movimiento de stock.

Las plantillas están en `PlantWeightPage.html` y `LotsWebAppPage.html`; deben mantenerse coherentes. Planta prepara un trabajo Raspberry mediante `queuePlantLabelJob`, con el registro guardado y su URL QR. La impresión manual del navegador queda como alternativa según el estado del trabajo. El puente utiliza protocolo 2 y actualiza V1 del láser sin iniciar el marcado.

## Direcciones y despliegues que deben conservarse

Conservar los identificadores de QR permanente, planta y gestión. Las URLs
reales, IDs de proyecto/hoja y cuentas autorizadas pertenecen al registro
privado y no se publican aquí. Recrear un despliegue puede romper etiquetas
ya distribuidas. La consulta pública ejecuta con la identidad configurada del
propietario; la gestión privada conserva el acceso de empresa y su autorización.

La instalación de enlaces cortos se publicó inicialmente como versión 60.
Las ampliaciones posteriores de OF y materias primas alcanzaron las versiones
63 para planta/QR y 64 para gestión, según el registro de publicación disponible.
No degradar esas versiones ni cambiar los permisos al mantener los enlaces.

## Mapa del código y los datos

| Archivo | Responsabilidad |
| --- | --- |
| `MES.gs` | Resumen por turno, producción e histórico; vinculación con OF |
| `Recipes.gs` | Recetas y componentes; configuración de rechazo de OX |
| `ManufacturingOrders.gs` | Pedidos, OF, lotes terminados, fabricación vinculada, trazabilidad y pesajes |
| `MultiPieceOrders.gs` | Agrupación de pedido por SKU, creación conjunta y selección inequívoca de línea |
| `PigmentOrders.gs` | Configuración y captura de PE y pigmento por OF, pese al nombre del archivo |
| `LotsWebApp.gs` | Entrada web, permisos y lotes activos globales |
| `LotsWebAppPage.html` | Interfaz privada y reimpresión desde trazabilidad |
| `PlantWeightPage.html` | Interfaz pública de planta, pesaje, etiqueta e incidencias visuales |
| `Stock.gs` | Preparación, resolución de lotes, envío y reintento de stock |
| `Holded.gs` | Catálogo y comunicación con Holded |
| `Costs.gs` | Flujo separado de costes |
| `HardwareBridge.gs` | Lectura de báscula, cola de trabajos y sincronización autenticada de Raspberry |
| `ShortLinks.gs` | URL QR común y servicio de enlaces cortos por lote |
| `GuestTraceabilityPage.html` | Consulta pública limitada del lote |

Tablas principales: `Ordenes Fabricacion`, `Fabricaciones OF`, `Pesajes calidad`, `Recetas MES`, `Lotes activos`, `Cambios de lote`, `Holded Raw`, `Holded Preview` y `Holded Log`, además del resumen y el histórico de producción. Ocultar una pestaña no autoriza a eliminarla: puede ser parte del almacenamiento del MES.

En `Stock.gs`, revisar especialmente `applyStockMovements`, `resolveStockLotForMovement_`, `readFinishedLotsForCurrentResumen_` y `buildStockMovementKey_`. El sistema usa bloqueo y registros para evitar repetir movimientos ya correctos. Los lotes forman parte de la identificación de movimientos de PE y pigmento. Un lote o cantidad discrepante requiere conciliación; no borrar registros para forzar el reintento.

La actualización de varios productos no es una transacción indivisible en Holded: puede haber éxito parcial. Consultar `Holded Log` y existencias antes de repetir un turno completo. Las funciones de prueba y migración pueden escribir datos reales; no ejecutarlas solo porque su nombre incluya «test» o «sandbox».

## Integración de equipos y fuentes pendientes

El código de Apps Script recuperado el 9 de noviembre incluye lectura reciente y estable de báscula, cola para Zebra y actualización de V1 del láser. Se conserva en el repositorio. La instalación y sus verificaciones se documentan en [Equipos operativos](EQUIPOS-OPERATIVOS-2026-11-05.md). El agente Raspberry funciona en la instalación; sus fuentes y las del servicio PHP todavía deben incorporarse a main mediante un cambio de código separado. La verificación de comunicaciones no sustituye la lectura de la etiqueta física ni demuestra marcado.

El láser adquirido es Datamark UV Touch de 10 W y 355 nm. No describirlo como láser de fibra de 20–30 W. Se han comunicado pruebas de marcaje resistente al rascado y sobre superficies curvas; no equivalen a certificación de resistencia UV, envejecimiento exterior o cumplimiento de EN 1176.

el administrador debe aportar, sin secretos:

- Modelo de Raspberry, sistema operativo, servicios y forma de arranque y recuperación.
- Cola CUPS, controlador, conexión y parámetros de etiqueta que dan impresión correcta.
- Modelo de báscula, adaptador serie, puerto, velocidad, protocolo, unidades, tara y señal de lectura estable.
- Software del láser, formatos admitidos, interfaz de envío disponible y confirmación local de ejecución.
- Código actual de los servicios y procedimiento de instalación, con configuración de ejemplo sin credenciales.

Los materiales históricos incluyen `Manual_Zebra_ZT231_Raspberry_CUPS_DGA.pdf`, `lector_sensocar_raspberry (1).zip` y `LASER UV TOUCH (ES).pdf`. Deben contrastarse con la instalación actual; no basta con adjuntarlos para dar una integración por terminada.

### Contrato de equipos y siguientes mejoras

Guardar una medición, preparar una etiqueta y marcar una pieza son operaciones distintas. Los trabajos actuales usan la clave `OF|Pnúmero` y reutilizan el registro guardado. El número de pesada sigue siendo único en toda la OF aunque haya varios SKU. Un reintento de impresión no debe volver a guardar el peso. El guardado del pesaje todavía necesita deduplicación por identificador de medición antes de introducir reintentos automáticos de esa operación.

El puente de servidor ya autentica la sincronización con `RPI_BRIDGE_TOKEN`, almacenado en propiedades del script. `doPost` admite la operación de sincronización del protocolo 2, recibe telemetría y resultados y entrega trabajos autorizados. No exponer claves de Holded ni convertir las funciones privadas de gestión en una API pública. Mantener la compatibilidad con el cliente Raspberry antes de cambiar ese contrato.

La aceptación de un trabajo por CUPS no demuestra por sí sola que la etiqueta haya salido físicamente. Registrar errores y permitir reimpresión controlada. Para el láser, conservar la misma URL QR y validar dimensiones, contraste y lectura en pieza real. Mantener confirmación local y protecciones del equipo; la recepción de un trabajo no debe activar automáticamente el láser sin el procedimiento seguro establecido.

## Publicación y pruebas

Trabajar en una rama y revisar diferencias antes de publicar. Editar el proyecto de Apps Script puede afectar a funciones ejecutadas desde la hoja o disparadores aunque no se publique una nueva versión web. Un entorno de prueba debe separar datos, disparadores y escrituras reales en Holded.

`clasp push` sube código; no demuestra que una aplicación web haya quedado desplegada correctamente. Publicar sobre el despliegue existente, verificando versión, tipo de despliegue, identidad de ejecución y permisos. No recrear el despliegue QR. No copiar a ciegas una configuración de manifiesto que cambie el acceso.

Antes de dar por finalizada una integración:

1. Abrir planta sin sesión y comprobar que no ofrece funciones privadas.
2. Abrir gestión y un QR antiguo con cuenta autorizada; comprobar rechazo de una no autorizada.
3. Guardar una pesada manual y otra recibida del equipo, validando unidades y umbrales de calidad.
4. Simular pérdida de conexión y reintento sin duplicar mediciones.
5. Reimprimir un registro varias veces sin alterar pesajes, producción ni stock.
6. Comprobar etiqueta de 100 × 150 mm y lectura del QR real con móvil.
7. Validar OF con PE y pigmento, OF solo con PE y producto genérico sin OF.
8. Verificar por separado cualquier prueba de stock, con cantidades autorizadas y conciliación del log.

Existen pruebas en `tests/order-pigment.cjs`, `tests/order-material-flow.cjs` y `tests/plant-events-ui.cjs`. Complementan, pero no sustituyen, la prueba física y la comprobación de permisos de los despliegues.

## Pendientes explícitos

- Versionar las fuentes reproducibles del agente Raspberry y del servicio PHP de enlaces, conservadas en el checkout local y en la instalación. La configuración y pruebas ya están documentadas. Comprobar recuperación de errores y deduplicación del guardado de pesajes; el protocolo de trabajos de servidor ya existe.
- Revisión de precisión de consumos pequeños de pigmento.
- Resolver el caso de varias OF simultáneas para el mismo SKU si se requiere.
- Registro persistente de paradas e incidencias: actualmente hay interfaz, no backend. Véase [PARADAS-INCIDENCIAS-UI.md](PARADAS-INCIDENCIAS-UI.md).
- No dar por integrados temperatura, tiempos, molde o parámetros de proceso sin revisar su captura y almacenamiento.
- No afirmar automatización de albaranes, facturas ni certificación normativa a partir del flujo de stock o del QR.
- Actualizar progresivamente las páginas antiguas de documentación para retirar instrucciones superadas.

## Instrucciones para los asistentes del proyecto

Lee este archivo y la documentación específica antes de proponer cambios. Comprueba la versión del repositorio: una copia en ChatGPT puede estar desactualizada. Distingue acuerdos, implementación comprobada y propuestas. Revisa código y pruebas antes de afirmar que una función existe.

Conserva los identificadores y URLs de QR ya distribuidos, la separación pública y privada, las instantáneas de lotes y la protección frente a movimientos duplicados. No cambies stock ni datos históricos como efecto secundario de probar impresión o pesaje. No incluyas credenciales en código o conversaciones. Documenta las modificaciones funcionales en este mismo archivo y explica qué se ha probado y qué queda pendiente.

## Preparación de materias primas por línea — 09/11/2026

Publicado en versiones 63 (planta/QR) y 64 (privada). Cada línea muestra pendiente/asignada y sus lotes; cabecera con líneas preparadas. Pesaje bloqueado en UI y servidor hasta configurar PE y decidir pigmento. Guardar actualiza solo esa línea y confirma el resultado. Véase [Materias primas por OF](MATERIAS-PRIMAS-POR-OF.md). No cambia stock, equipos, URLs ni registros históricos.

