# Funcionalidades

## Pedidos pendientes para órdenes de fabricación

- Un pedido pendiente de Holded se propone como OF cuando contiene un producto con gestión por lotes en el catálogo vivo de Holded.
- La propuesta ya no depende de una lista de clientes ni de etiquetas comerciales.
- Se siguen excluyendo productos sin gestión por lotes, pedidos no pendientes y líneas que ya tienen una OF.

El lote terminado propuesto por la OF puede auditarse con `previewOxDisairFinishedLot()`. La función consulta el producto real mediante API v2 y construye el reemplazo completo necesario para añadir el lote con stock cero, pero no envía ninguna escritura a Holded.

## F-002 - Sincronización de costes desde Holded

**Estado:** implementada

Al ejecutar **Rotoformas → Holded → Actualizar catálogo Holded**:

- se descarga el catálogo de productos de Holded;
- `Holded Raw` mantiene una fila por SKU, tanto para productos simples como para variantes;
- se guarda el campo `cost` de cada producto simple o variante en la columna `Coste medio`;
- se localizan los SKUs `PE NATURAL`, `PE MASA` y `PE RECICLADO`;
- sus costes se escriben, respectivamente, en `Parametros manuales!H2:J2`.

La actualización valida que los tres costes estén presentes y sean numéricos antes de modificar las hojas. Si falta alguno, conserva los últimos datos válidos y muestra un error con los SKUs pendientes.

La autenticación utiliza la propiedad privada de Apps Script `HOLDED_API_KEY`; la clave no se guarda en el código fuente. Consulta [SETUP.md](SETUP.md) para configurarla o rotarla.

La sincronización puede ejecutarse automáticamente todos los días alrededor de las 06:00 mediante un activador instalable. La instalación elimina previamente otros activadores del mismo proceso para evitar ejecuciones duplicadas y registra la última actualización correcta en la propiedad `HOLDED_LAST_SYNC_AT`.

### Compatibilidad

La columna `Coste medio` se añade al final de `Holded Raw`, de modo que las posiciones de las columnas existentes no cambian y los procesos de stock y validación siguen funcionando sin modificaciones.

## F-003 - Coste real de fabricación por SKU

**Estado:** implementada

La opción **Rotoformas → Holded → Preparar costes fabricación (60 días)** calcula para cada producto fabricado:

```text
Coste unitario = suma de Coste total (€) / suma de Uds
```

El cálculo utiliza las fabricaciones de los últimos 60 días, pondera por unidades y excluye filas de total, registros sin unidades, costes no válidos y materias primas. El resultado se presenta en `Holded Costes Preview` junto con el coste actual de Holded, el número de fabricaciones, las unidades analizadas y la variación.

## F-004 - Publicación de costes de fabricación en Holded

**Estado:** implementada con API v2

La opción **Rotoformas → Holded → Aplicar costes seleccionados** procesa únicamente las filas marcadas en `Holded Costes Preview` y exige una segunda confirmación.

Antes de cada escritura se recalcula el histórico para detectar vistas previas obsoletas. Después de actualizar Holded se vuelve a leer el producto o variante y se comprueba el coste. Solo cuando la verificación coincide se actualiza `Holded Raw`. Todos los intentos quedan registrados en `Holded Costes Log`.

La publicación utiliza la API v2 con los permisos `inventory:products.read` e `inventory:products.write`. Antes de escribir se leen los datos económicos mediante API v1, porque la lectura v2 puede devolver vacíos campos como coste, precio de venta y precio de compra. Para una variante se conserva la configuración completa del producto padre y la lista íntegra de variantes, y se modifica únicamente el coste de la seleccionada. El coste escrito se verifica mediante una nueva lectura v1. Este flujo sustituye al intento de escritura mediante API v1, que Holded rechaza con `Cannot update product variants`.

Como medida de seguridad, la publicación nunca toma de la lectura v2 los campos `price`, `cost` o `purchase_price`: los preserva desde v1 para impedir que una actualización de coste borre precios existentes.

Las materias primas no se actualizan mediante este proceso; sus costes continúan procediendo de Holded a través de F-002.

## F-005 - Panel de lotes activos de materias primas

**Estado:** primera fase publicada

La aplicación web **Lotes activos** está desplegada desde el mismo proyecto de Apps Script e incrustada en la página `Lotes Materia Prima` de la intranet de Google Sites. La aplicación web admite acceso sin iniciar sesión para que pueda utilizarse desde la pantalla táctil de producción; por ello, su enlace directo debe tratarse como un enlace operativo interno.

El panel consulta en Holded los lotes reales de `PE NATURAL`, `PE MASA`, `PE RECICLADO`, `PIG300`, `PIG301` e `INSERTO V4`. Permite seleccionar un lote por su lista, identificador, nombre o código de barras y registra la selección en las hojas `Lotes activos` y `Cambios de lote`.

Esta primera fase no envía movimientos de stock y no modifica `applyStockMovements()`. La integración del lote activo con los consumos del MES se realizará después de validar el uso operativo del panel.

## F-006 - Órdenes de fabricación V1 (F-002 del módulo de planificación)

**Estado:** implementada y publicada

La Web App **Rotoformas MES** incorpora el módulo **Órdenes de fabricación**, manteniendo la misma interfaz del panel de lotes activos. Permite:

- consultar órdenes abiertas, cerradas o todas;
- buscar por número de OF, cliente o SKU;
- crear, consultar y editar órdenes;
- cerrar o reabrir una orden;
- visualizar cantidad objetivo, cantidad fabricada, pendiente y porcentaje de avance.

El control de peso dispone además de una vista pública específica para la pantalla de planta (`?modo=pesaje`). Solo presenta las OF abiertas y registra el peso bruto de cada pieza, el operario y una observación. El operario se selecciona de una lista cerrada y ordenada alfabéticamente: Álvaro, Carlos, Emilio, Llusif y Martha. La planificación, los pedidos, los clientes, la edición de OF y la configuración de lotes permanecen en la aplicación privada.

Cada orden contiene un número anual correlativo (`OF-AAAA-NNNN`), cliente, SKU, producto, cantidad objetivo, color, fecha objetivo, estado y observaciones. El catálogo seleccionable procede de los productos terminados activos de `Holded Raw`.

El cliente se selecciona del catálogo real de contactos de Holded, limitado inicialmente a Contenur, Teyme, Mann+Hummel, Tecnospra, Sola y Solteka. Las nuevas OF solo permiten seleccionar productos terminados que ya estén configurados con gestión por lotes.

Los productos se relacionan con el cliente mediante las etiquetas `#MO`, `#TY`, `#MH`, `#TC`, `#SL` y `#STK`. El menú Holded incluye una auditoría de productos seleccionados que todavía no tienen gestión por lotes; la auditoría solo genera un preview y no modifica Holded.

Los datos se almacenan en las hojas `Ordenes Fabricacion` y `Fabricaciones OF`. La segunda registra las fabricaciones asociadas automáticamente desde el resumen diario.

### Asociación con las fabricaciones

Al ejecutar **Generar resumen del día**, cada SKU fabricado se vincula automáticamente con la OF abierta más antigua del mismo SKU que todavía tenga unidades pendientes. El vínculo se guarda en `Fabricaciones OF` y actualiza las cantidades fabricada y pendiente y el porcentaje de avance mostrado en la Web App.

La sincronización es idempotente por fecha y turno: volver a generar el mismo resumen reemplaza sus vínculos anteriores y no duplica unidades.

Esta funcionalidad no genera movimientos de stock y no cambia `applyStockMovements()`.

### Creación desde pedidos de venta

La pestaña **Pedidos pendientes** consulta en Holded los pedidos de venta abiertos de los clientes incluidos en la planificación y presenta una propuesta de OF por cada línea cuyo producto tenga gestión por lotes. Begoña puede revisar la propuesta y crear la OF conservando el pedido y la línea de origen.

Antes de guardar, el servidor vuelve a leer el pedido en Holded. Cada línea solo puede originar una OF, lo que evita duplicados incluso si dos usuarios trabajan a la vez. La creación manual permanece disponible para fabricación para stock, pruebas y casos internos sin pedido de venta.

### Lote terminado y ficha de trazabilidad

Cada OF genera un único lote de producto terminado con el formato `SKU-MMYYYY-OFNNNN`. Todas las fabricaciones vinculadas a esa OF comparten el mismo lote, incluso si se realizan en varios turnos.

La pestaña **Trazabilidad** permite consultar el lote o el número de OF y muestra producto, estado, cliente, pedido de Holded, cantidades, fechas, color y el detalle de cada fabricación con sus lotes de PE y pigmento. Una URL con el parámetro `?lote=` abre directamente la ficha y será el destino de los futuros códigos QR.

### Control de peso por pieza

Las órdenes de fabricación permiten registrar el peso bruto individual de cada pieza al salir del horno, antes de mecanizado, recorte o retrabajo. El peso teórico se obtiene de la columna `Peso` de `Holded Raw`, sincronizada con el campo de peso del producto en Holded.

Cada medición queda vinculada internamente a la OF y al lote terminado, con número correlativo de pieza, peso teórico, peso real, diferencia, desviación porcentual, fecha, operario y observaciones. Todas las piezas de la OF comparten el mismo QR de lote; el correlativo de pieza se utiliza únicamente para el control interno de calidad.

La clasificación utiliza la desviación absoluta respecto al peso teórico:

- `CONFORME`: desviación menor o igual al 3 %;
- `ALERTA`: desviación superior al 3 % e inferior al 6 %;
- `NO CONFORME`: desviación igual o superior al 6 %.

Una medición no conforme genera una alerta roja muy visible para apartar la pieza y revisar el proceso. Los pesajes se almacenan en la hoja `Pesajes calidad`, y la ficha de trazabilidad muestra el resumen del lote, la media, mínimo, máximo y el detalle de todas las mediciones.

## Movimientos de stock con lotes

- Los productos con gestión por lotes se actualizan usando un `lotId` real de Holded.
- Prioridad de selección: lote activo declarado en el MES; si no existe o dejó de ser válido, lote de Holded cuyo nombre coincide exactamente con el SKU.
- Los productos sin gestión por lotes mantienen el flujo anterior.
- Los movimientos ya registrados como correctos para la misma fecha, turno, SKU y cantidad se omiten al reintentar, evitando duplicados.
- `Holded Log` registra el lote, el origen de la selección y una clave única del movimiento.

## F-007 - Recetas MES y unidades rechazadas

**Estado:** implementada

Las composiciones de producto se mantienen en la hoja `Recetas MES`, con una fila por componente. La receta inicial de `OX DISAIR BASIC` consume por cada pieza moldeada:

- 63 uds de `INSERTO ALU M4`;
- 4 uds de `INSERTO ALU M10`;
- 8,8 kg de `PE NATURAL`;
- 0,044 kg de `PIG RTF073`.

El formulario puede registrar las piezas rechazadas en la pregunta `OX DISAIR BASIC [RECHAZADAS]`. El resumen diferencia unidades conformes, rechazadas y moldeadas. Los consumos de todos los componentes se calculan sobre las unidades moldeadas; el stock de producto terminado y el avance de la OF aumentan únicamente con las unidades conformes.

Si todavía no existe la pregunta, se instala una sola vez mediante **Rotoformas → Preparar captura de rechazos OX Disair**. La misma acción crea y precarga `Recetas MES` sin duplicar filas existentes.

`PE NATURAL` y `PIG RTF073` utilizan el lote activo configurado en el MES. Los dos insertos se descuentan como stock normal, sin trazabilidad por lote, conforme al alcance acordado.
