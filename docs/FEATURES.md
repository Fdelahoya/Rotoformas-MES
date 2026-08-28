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
