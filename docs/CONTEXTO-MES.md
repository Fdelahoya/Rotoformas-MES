# Contexto vivo del MES de Rotoformas

Actualizado el 4 de noviembre de 2026. Responsable del contenido: equipo Rotoformas.

Revisión local de seguridad en `reconcile/raspberry-safe-2026-11-04`: se concilian
los cambios manuales del editor y se conserva su manifiesto. La consulta de
permisos del 4/11 confirma planta v48 anónima/propietario y QR/gestión v49
dominio/usuario que accede. No se ha subido ni publicado esta revisión.
Ahora el código local exige autorización en 53 entradas administrativas y una
sesión de puesto para guardar pesajes, encolar y consultar trabajos. El puente
usa protocolo 2, vigencia de la muestra original y doble habilitación de salidas,
apagadas por defecto; la fase inicial es solo báscula. Se han validado seis suites
Node y dieciséis pruebas Python con servicios/equipos simulados. Los párrafos
históricos sobre acceso anónimo para guardar y preparación automática de etiqueta
describen la revisión anterior; para la configuración propuesta y sus límites,
seguir [Conciliación y activación por fases](CONCILIACION-RASPBERRY-2026-11-04.md).
El [piloto de solo báscula USB](PRUEBA-BASCULA-USB.md) detalla instalación sin
arranque, prueba local de 20 segundos, configuración con salidas deshabilitadas,
condición de publicación aprobada de planta, aceptación y parada. Su preparación
para una PR no autoriza desplegar ni activar equipos.
Revisar propietarios de disparadores antes de subir; las versiones desplegadas
mantienen su código previo hasta una actualización aprobada.

Este documento permite continuar el desarrollo del MES, especialmente la integración de Raspberry Pi, báscula, impresora Zebra y láser. Recoge las decisiones vigentes y los límites que deben respetar tanto los desarrolladores como sus asistentes de IA.

La base de código revisada es el commit `0a5b3de`, del 29 de octubre de 2026. Los estados de despliegue indicados corresponden a esa revisión; deben comprobarse antes de publicar cambios. La configuración actual de los equipos físicos debe completarla Mauro.

## Cómo mantener este documento

GitHub es la fuente principal de este contexto. Una copia subida a un proyecto de ChatGPT es una instantánea y no se actualiza automáticamente al cambiar este archivo.

En cada cambio funcional, actualizar este documento en el mismo commit o pull request cuando afecte a reglas de negocio, interfaces de equipos, datos, permisos, despliegues o pendientes. Actualizar la fecha e indicar qué se ha validado. No convertir una propuesta en funcionalidad implantada hasta comprobarla.

El código y las pruebas determinan el comportamiento implementado. Este documento explica el comportamiento acordado. Si difieren, registrar la discrepancia antes de modificar producción. Algunos apartados de `SETUP.md` y `FEATURES.md` describen fases antiguas; para materias primas por OF, consultar también [MATERIAS-PRIMAS-POR-OF.md](MATERIAS-PRIMAS-POR-OF.md).

## Arquitectura y accesos

Google Sites presenta las aplicaciones de Apps Script. Google Sheets almacena producción, órdenes, pesajes, recetas y registros de integración. Holded contiene el catálogo, los pedidos, los lotes y el stock. GitHub conserva el código y su documentación.

- [Proyecto de Apps Script](https://script.google.com/home/projects/1H-EC2HEDjYlAKURqHEagdgqx4rJXfCYmzEVJxnCD3YiPqjjyK3gy_xuS/edit).
- [Hoja principal de producción](https://docs.google.com/spreadsheets/d/1PVM9RCMKzFy9qbzhSILuw59f-dojXkeLV7g5oUEobIo/edit).
- [Pantalla pública de producción](https://sites.google.com/rotoformas.com/estandarizacion/produccion).
- [Gestión y trazabilidad](https://sites.google.com/rotoformas.com/estandarizacion/producci%C3%B3n-y-trazabilidad).

Mauro puede editar el proyecto desde el navegador si dispone de permiso de edición en Apps Script. No necesita instalar Node o clasp para ese acceso. GitHub permite revisar cambios y mantener versiones; el acceso al repositorio no concede por sí mismo acceso a Google ni a Holded.

La pantalla de planta permite operaciones limitadas sin iniciar sesión. La aplicación de gestión y la consulta del QR requieren una cuenta autorizada por el servidor. `mauro@rotoformas.com` forma parte de la lista configurada en el código revisado. Compartir Google Sites no sustituye esa autorización. El portal QR no es, actualmente, una consulta pública para cualquier cliente.

Las credenciales de Holded se guardan en propiedades del script, entre ellas `HOLDED_API_KEY` y `HOLDED_API_V2_TOKEN`. No incluir sus valores, sesiones de Google, tokens de clasp ni credenciales de equipos en este documento, el repositorio o conversaciones.

## Flujo de fabricación

1. Crear un pedido de venta en Holded cuando corresponda. También existe creación manual de OF para fabricación sin pedido.
2. Desde pedidos pendientes, crear la OF. La elegibilidad depende de que el producto tenga gestión por lotes; no del término comercial «premium», que no debe aparecer en la interfaz.
3. El MES genera la OF y su lote de producto terminado en Holded, inicialmente sin existencias. El nombre sigue `SKU-MMYYYY-OFNNNN`, usando la fecha objetivo o, en su defecto, la de creación.
4. Configurar las materias primas de la OF, incluyendo el lote de PE y, cuando proceda, el pigmento.
5. Registrar la producción por turno. Al generar el resumen se vinculan las fabricaciones a la OF.
6. Procesar los movimientos de stock del turno: descontar componentes y sumar producto terminado en el lote de esa OF.
7. Registrar pesajes individuales y emitir o reimprimir etiquetas cuando se necesiten.

El stock se actualiza por turno, no al cerrar la OF. Pesar o imprimir no aumenta las unidades fabricadas ni mueve stock. La generación automática de albaranes y facturas al cerrar OF no está implementada en el flujo revisado.

Si hay varias OF abiertas pendientes para el mismo SKU, la producción agregada del turno no permite elegir inequívocamente una. El sistema debe detener esa asignación; no seleccionar arbitrariamente la primera. Varias OF de productos diferentes no tienen esa ambigüedad.

## Materias primas por orden

Las OF tienen configuración propia en «Materias primas»:

- PE obligatorio, con producto compatible con la receta y un lote existente de Holded.
- Pigmento opcional. Al activarlo, se seleccionan producto y lote existentes; debe corresponder al pigmento y cantidad de la receta. Se registra y descuenta ese lote.
- Si no se activa pigmento, no se registra su consumo para esa OF. Se ocultan los campos o columnas correspondientes en las vistas de trazabilidad; no mostrar «sin seguimiento» ni guiones al cliente.
- No sustituir silenciosamente una configuración incompleta de OF por el lote activo global.

Los productos sin OF mantienen el uso de «Lotes activos», por ejemplo chimeneas y otros productos genéricos que consumen PE natural o reciclado. Por ello esta pestaña sigue siendo necesaria. El flujo general conserva su resolución de lotes, incluido el lote cuyo nombre coincide con el SKU cuando corresponda; esa alternativa no debe sustituir el lote terminado de una OF.

Cada nueva fabricación conserva una instantánea de productos y lotes utilizados. Cambiar la configuración afecta a las fabricaciones posteriores, no debe reescribir las anteriores ni cambiar los lotes de un reintento.

Para Tecnospra se acordó inicialmente seguir PE sin consumir ni seguir pigmentos no configurados. El color escrito en la OF no equivale a una receta de pigmento.

## Ejemplos de referencia

### OX Disair Basic

Receta por pieza de `OX DISAIR BASIC`:

| Componente | Cantidad | Gestión por lotes |
| --- | ---: | --- |
| INSERTO ALU M4 | 63 uds | No |
| INSERTO ALU M10 | 4 uds | No |
| PE NATURAL | 8,8 kg | Sí |
| PIG RTF073 | 0,044 kg | Sí cuando está activado en la OF |

La OF de referencia es `OF-2026-0002`, con lote `OX DISAIR BASIC-102026-OF0002`. El peso teórico para calidad es 8,8 kg, despreciando insertos y pigmento en esa comparación. Las unidades rechazadas consumen la receta; solo las unidades conformes aumentan producto terminado y avance de fabricación.

Hay un punto pendiente de revisión: el cálculo de componentes conserva cuatro decimales, pero el envío de movimientos redondea a dos en el código revisado. Debe comprobarse la precisión para consumos pequeños como 0,044 kg antes de darla por resuelta.

### DEP 2250 N

La OF de referencia `OF-2026-0003` corresponde a seis unidades de `DEP 2250-N`, pedido `SO260204`, lote `DEP 2250-N-112026-OF0003` y peso teórico de 120 kg. Sirve para probar el flujo sin pigmento. Estos datos identifican el caso de prueba, no certifican su estado actual de fabricación ni su configuración actual de materiales.

## Pesaje y calidad

Se pesa cada pieza al salir del horno, antes del mecanizado o retrabajo. Se compara con el peso teórico del producto en Holded. El objetivo es controlar cada pieza, no el peso acumulado del lote.

La desviación es el valor absoluto de la diferencia respecto al teórico, dividido por el teórico:

| Desviación | Resultado |
| --- | --- |
| Hasta el 3 % inclusive | Conforme, verde |
| Mayor del 3 % y menor del 6 % | Alerta, amarillo |
| Desde el 6 % inclusive | No conforme, rojo |

Se admite peso manual positivo y finito, también con coma decimal. Se registra OF, lote, número interno de pieza, peso, desviación, resultado, fecha, operario y observaciones. El desplegable de operarios está ordenado como Álvaro, Carlos, Emilio, Llusif y Martha. Elegir un nombre no constituye autenticación de identidad.

Funciones relevantes:

- `getPlantWeightOrders`: proyección de órdenes abiertas para la pantalla pública.
- `recordPlantManufacturingPieceWeight`: entrada pública limitada para guardar pesajes.
- `recordManufacturingPieceWeight`: entrada privada con comprobación de acceso.
- `recordManufacturingPieceWeight_`: guardado compartido.

El guardado recibe `orderId`, `actualWeight`, `operator` y `notes`; devuelve el registro y su clasificación. Estas funciones se llaman desde Apps Script con `google.script.run`; no constituyen una API REST ya preparada para la Raspberry.

Actualmente, repetir la petición de guardado puede crear otro pesaje. La integración automática necesita identificar cada medición y evitar duplicados antes de introducir reintentos de red.

## Etiquetas y QR

La etiqueta tiene formato de 100 × 150 mm e incluye producto, SKU, lote, peso bruto, fecha, OF, número interno de pieza y QR. Ya utiliza un QR real; las referencias antiguas a un recuadro provisional o a 100 × 60 mm están superadas.

Todas las piezas de un mismo lote comparten el QR. El número de pieza diferencia los registros internos de pesaje, pero el QR no identifica de forma única la pieza física. Su destino es la ficha del lote con el parámetro `lote` correctamente codificado en la URL.

Se puede guardar un pesaje sin imprimir y reimprimirlo posteriormente desde trazabilidad tantas veces como sea necesario. Reimprimir reutiliza el registro existente y no crea otro pesaje, fabricación o movimiento de stock.

Las plantillas están en `PlantWeightPage.html` y `LotsWebAppPage.html`; deben mantenerse coherentes. El código revisado usa HTML y la impresión del navegador. No incorpora todavía un protocolo propio de trabajos ZPL o de marcado láser en Raspberry.

## Direcciones que debemos conservar

Ya existen etiquetas enviadas a clientes. La dirección de consulta QR es un compromiso de compatibilidad: no eliminar ni sustituir su despliegue al publicar otra versión.

Consulta QR, con `?lote=` y el lote codificado al final:

```text
https://script.google.com/a/macros/rotoformas.com/s/AKfycbw5LAL2__An-gyUsq8qDYNKfYZ5tfJys8INv7__MpmHx32SuZWxonaFiygbsO92tBsN5Q/exec
```

Gestión privada:

```text
https://script.google.com/a/macros/rotoformas.com/s/AKfycbyNA69u8JNmcqRaAct4vNMYey5dXCSKa4L-5f9wwcV2FG-zrBjnWnsfUlzKHoIL4ek86w/exec
```

Pantalla pública de pesaje:

```text
https://script.google.com/macros/s/AKfycbwZgzx_rFiDZ2ru8hsrmqnAIQO3WypJeGZXRTZpKL9uxQkvsrvvnSdrJ-7dG59qC9Hbsw/exec?modo=pesaje
```

Último estado documentado: consulta QR y gestión privada en versión 49, acceso de dominio y ejecución como usuario que accede; planta en versión 48, ejecución como propietario del despliegue y acceso anónimo. No asumir que código de desarrollo y los tres despliegues están sincronizados.

## Mapa del código y los datos

| Archivo | Responsabilidad |
| --- | --- |
| `MES.gs` | Resumen por turno, producción e histórico; vinculación con OF |
| `Recipes.gs` | Recetas y componentes; configuración de rechazo de OX |
| `ManufacturingOrders.gs` | Pedidos, OF, lotes terminados, fabricación vinculada, trazabilidad y pesajes |
| `PigmentOrders.gs` | Configuración y captura de PE y pigmento por OF, pese al nombre del archivo |
| `LotsWebApp.gs` | Entrada web, permisos y lotes activos globales |
| `LotsWebAppPage.html` | Interfaz privada y reimpresión desde trazabilidad |
| `PlantWeightPage.html` | Interfaz pública de planta, pesaje, etiqueta e incidencias visuales |
| `Stock.gs` | Preparación, resolución de lotes, envío y reintento de stock |
| `Holded.gs` | Catálogo y comunicación con Holded |
| `Costs.gs` | Flujo separado de costes |

Tablas principales: `Ordenes Fabricacion`, `Fabricaciones OF`, `Pesajes calidad`, `Recetas MES`, `Lotes activos`, `Cambios de lote`, `Holded Raw`, `Holded Preview` y `Holded Log`, además del resumen y el histórico de producción. Ocultar una pestaña no autoriza a eliminarla: puede ser parte del almacenamiento del MES.

En `Stock.gs`, revisar especialmente `applyStockMovements`, `resolveStockLotForMovement_`, `readFinishedLotsForCurrentResumen_` y `buildStockMovementKey_`. El sistema usa bloqueo y registros para evitar repetir movimientos ya correctos. Los lotes forman parte de la identificación de movimientos de PE y pigmento. Un lote o cantidad discrepante requiere conciliación; no borrar registros para forzar el reintento.

La actualización de varios productos no es una transacción indivisible en Holded: puede haber éxito parcial. Consultar `Holded Log` y existencias antes de repetir un turno completo. Las funciones de prueba y migración pueden escribir datos reales; no ejecutarlas solo porque su nombre incluya «test» o «sandbox».

## Integración Raspberry en rama de desarrollo (3/11/2026)

La rama feat/raspberry-balanza-zebra-laser añade HardwareBridge.gs y raspberry/bridge.py con telemetría estable por USB de la báscula, trabajos de etiqueta CUPS y actualización de V1 del láser, además de una pantalla de pesaje que carga peso reciente y encola automáticamente al preparar la etiqueta. **Todavía NO se ha desplegado ni validado físicamente**, y se conserva el flujo manual existente. No se envía ningún comando para iniciar el marcado. Antes de publicar, revisar seguridad de funciones globales accesibles desde la implementación pública, instalar token compartido solo en propiedades/archivo protegido, probar pérdida de conexión e imprimir/leer QR real. Ver [INTEGRACION-RASPBERRY.md](INTEGRACION-RASPBERRY.md). Esta entrada no sustituye la descripción del estado de producción anterior.

## Integración de equipos que debe completar Mauro

La impresión de etiquetas con Zebra ZT231 mediante Raspberry Pi y CUPS ha sido comunicada como operativa. Falta incorporar al repositorio la configuración reproducible y confirmar qué versión funciona actualmente. La integración automática de báscula y láser con el MES no queda acreditada por disponer de conexión física.

El láser adquirido es Datamark UV Touch de 10 W y 355 nm. No describirlo como láser de fibra de 20–30 W. Se han comunicado pruebas de marcaje resistente al rascado y sobre superficies curvas; no equivalen a certificación de resistencia UV, envejecimiento exterior o cumplimiento de EN 1176.

Mauro debe aportar, sin secretos:

- Modelo de Raspberry, sistema operativo, servicios y forma de arranque y recuperación.
- Cola CUPS, controlador, conexión y parámetros de etiqueta que dan impresión correcta.
- Modelo de báscula, adaptador serie, puerto, velocidad, protocolo, unidades, tara y señal de lectura estable.
- Software del láser, formatos admitidos, interfaz de envío disponible y confirmación local de ejecución.
- Código actual de los servicios y procedimiento de instalación, con configuración de ejemplo sin credenciales.

Los materiales históricos incluyen `Manual_Zebra_ZT231_Raspberry_CUPS_DGA.pdf`, `lector_sensocar_raspberry (1).zip` y `LASER UV TOUCH (ES).pdf`. Deben contrastarse con la instalación actual; no basta con adjuntarlos para dar una integración por terminada.

### Diseño propuesto para la siguiente implementación

Separar tres operaciones: guardar una medición, imprimir una etiqueta y marcar una pieza. Cada trabajo de equipo debe tener identificador propio, referencia al registro guardado, estado y resultado. Un reintento de impresión no debe volver a guardar el peso. La lectura automática necesita un identificador de medición que permita reconocer peticiones duplicadas.

El puente con Raspberry deberá autenticar los equipos y limitar sus operaciones. No exponer claves de Holded ni convertir las funciones privadas de gestión en una API pública. La elección entre cola de trabajos, servicio intermedio u otro mecanismo sigue pendiente; no existe en el código revisado un endpoint externo que pueda darse por contratado.

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

- Integración reproducible de equipos, protocolo de trabajos, deduplicación y recuperación de errores.
- Revisión de precisión de consumos pequeños de pigmento.
- Resolver el caso de varias OF simultáneas para el mismo SKU si se requiere.
- Registro persistente de paradas e incidencias: actualmente hay interfaz, no backend. Véase [PARADAS-INCIDENCIAS-UI.md](PARADAS-INCIDENCIAS-UI.md).
- No dar por integrados temperatura, tiempos, molde o parámetros de proceso sin revisar su captura y almacenamiento.
- No afirmar automatización de albaranes, facturas ni certificación normativa a partir del flujo de stock o del QR.
- Actualizar progresivamente las páginas antiguas de documentación para retirar instrucciones superadas.

## Instrucciones para los asistentes del proyecto

Lee este archivo y la documentación específica antes de proponer cambios. Comprueba la versión del repositorio: una copia en ChatGPT puede estar desactualizada. Distingue acuerdos, implementación comprobada y propuestas. Revisa código y pruebas antes de afirmar que una función existe.

Conserva los identificadores y URLs de QR ya distribuidos, la separación pública y privada, las instantáneas de lotes y la protección frente a movimientos duplicados. No cambies stock ni datos históricos como efecto secundario de probar impresión o pesaje. No incluyas credenciales en código o conversaciones. Documenta las modificaciones funcionales en este mismo archivo y explica qué se ha probado y qué queda pendiente.
