# Materias primas por orden de fabricación

Actualización: 29/10/2026. Publicada en Apps Script, versión 49, en las dos implementaciones privadas existentes. No se cambian las URL ni los permisos. La implementación pública de pesaje conserva su versión.

## Operación

1. Crear la OF desde el pedido o mediante Nueva OF.
2. Abrir **Materias primas** en su tarjeta. Al crear una orden nueva se abre automáticamente este diálogo.
3. Seleccionar el producto PE y un lote existente en Holded. Debe corresponder al material de la receta (o a la clasificación natural/reciclado/masa del catálogo cuando no hay receta explícita).
4. Elegir **Sin pigmento asociado**, o seleccionar pigmento y lote existentes. El pigmento seleccionado se descuenta; su SKU y cantidad por pieza deben estar definidos en la receta. No se deducen consumos del texto del color.
5. Guardar antes de generar el resumen de fabricación del turno.

Para TC puede seleccionarse PE y **Sin pigmento asociado**. No se crean consumos de pigmentos no registrados en Holded. Cuando la OF no tiene pigmento, las vistas de detalle y trazabilidad omiten su columna. Las etiquetas no incluyen campos de pigmento.

## Separación de flujos

- **Con OF:** PE obligatorio y pigmento opcional de esa OF. No hay sustitución silenciosa por el lote global. Una OF previa sin configuración deberá configurarse antes de vincular fabricación nueva.
- **Sin OF:** se mantienen los lotes activos globales y el comportamiento anterior de stock. La pestaña Lotes activos permanece, con una explicación de su alcance. Incluye PE natural, reciclado y masa; los consumos genéricos existentes no se alteran.
- Si coinciden varias OF abiertas con unidades pendientes para el mismo SKU, se detiene la asignación automática: el resumen agregado no identifica a cuál corresponde cada pieza. Es necesaria una asignación explícita antes de procesar ese caso.

## Persistencia y protección

- OF: se añaden columnas de modo de pigmento, SKU/productId/lotId/nombre de pigmento y SKU/productId/lotId/nombre de PE.
- Fabricación: se guarda la selección de ambos materiales como fotografía del turno. Cambiar la configuración de la OF no cambia los registros anteriores; regenerar un turno conserva sus lotes registrados.
- Los registros históricos sin identificadores de lotes no se rellenan automáticamente. Si se intenta consumir desde uno de esos registros, el proceso pide revisión en lugar de asignarle el lote actual.
- Los consumos se agrupan por material y lote. Las claves de reintento para PE y pigmento incluyen el lote. Se omite una aplicación idéntica y se bloquea un consumo previo del mismo lote con distinta cantidad, o una clave antigua sin lote, para conciliación manual.
- La aplicación de stock está protegida por un bloqueo de documento. Antes de enviar se comprueba la disponibilidad de los lotes; no se cambia de lote si desaparece o se archiva el seleccionado.
- Los errores de Holded durante el envío aún pueden producir un turno parcialmente aplicado: los movimientos confirmados se conservan y se omiten al reintentar. No es una transacción distribuida.

## Verificación

Pruebas locales sin escribir stock: `tests/order-pigment.cjs`, `tests/order-material-flow.cjs` y `tests/plant-events-ui.cjs`.

Cubren selección obligatoria de PE, pigmento opcional, coincidencia con receta, lotes inexistentes, dos OF con distintos lotes del mismo material, mezcla con producción genérica, conservación de instantáneas al reintentar y ausencia de columna de pigmento en la ficha cuando no corresponde.

Se corrige también la detección de componentes PE/pigmento de las recetas para que no dependa de mayúsculas/minúsculas.

No se ejecutan movimientos reales de stock como prueba ni se modifican fabricaciones completadas. Las pruebas de consumo real se realizarán al procesar un turno autorizado.

Verificación en la aplicación publicada: la URL permanente del QR carga la ficha existente de OX; la OF-2026-0003 muestra el botón Materias primas y carga los tres tipos de PE de Holded y sus lotes. La configuración de esa OF se deja pendiente de selección y guardado por el usuario; no se cambia su lote durante las pruebas.
