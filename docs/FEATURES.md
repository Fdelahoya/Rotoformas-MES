# Funcionalidades

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

Cada orden contiene un número anual correlativo (`OF-AAAA-NNNN`), cliente, SKU, producto, cantidad objetivo, color, fecha objetivo, estado y observaciones. El catálogo seleccionable procede de los productos terminados activos de `Holded Raw`.

Los datos se almacenan en las hojas `Ordenes Fabricacion` y `Fabricaciones OF`. La segunda registra las fabricaciones asociadas automáticamente desde el resumen diario.

### Asociación con las fabricaciones

Al ejecutar **Generar resumen del día**, cada SKU fabricado se vincula automáticamente con la OF abierta más antigua del mismo SKU que todavía tenga unidades pendientes. El vínculo se guarda en `Fabricaciones OF` y actualiza las cantidades fabricada y pendiente y el porcentaje de avance mostrado en la Web App.

La sincronización es idempotente por fecha y turno: volver a generar el mismo resumen reemplaza sus vínculos anteriores y no duplica unidades.

Esta funcionalidad no genera movimientos de stock y no cambia `applyStockMovements()`.
