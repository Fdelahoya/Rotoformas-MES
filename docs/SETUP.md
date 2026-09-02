# Configuración

## Credenciales de Holded

La clave de Holded no se almacena en los archivos del proyecto. Las funciones de catálogo y stock la leen desde la propiedad privada de Apps Script `HOLDED_API_KEY`.

### Configuración inicial o rotación

1. En Holded, abre **Configuración → Desarrolladores → Credenciales**.
2. Pulsa **Ir a API Keys v1** en el aviso superior. El proyecto usa actualmente la API de Invoicing v1; los API Tokens con permisos por áreas corresponden a la API v2 y no sirven para estos endpoints.
3. Genera una nueva API Key v1, pero todavía no revoques la anterior.
4. Publica los archivos del proyecto con `clasp push`.
5. En el editor de Apps Script, selecciona y ejecuta `configureHoldedApiKey`.
6. Autoriza el script si Google lo solicita.
7. Introduce la clave nueva en el cuadro de diálogo y confirma.
8. Ejecuta `syncHoldedProducts` para comprobar la conexión.
9. Cuando la prueba funcione, revoca la clave anterior en Holded.

La clave queda guardada en las propiedades del script y no se sincroniza mediante Git ni `clasp`.

### Token API v2 para publicar costes

La publicación de costes de fabricación usa la API v2 porque la API v1 no permite actualizar variantes.

1. En Holded, abre **Configuración → Desarrolladores → Credenciales**.
2. Crea un **API Token v2** con acceso de lectura y escritura a **Inventario → Productos** (`inventory:products.read` e `inventory:products.write`).
3. Publica los archivos del proyecto con `clasp push` y recarga la hoja.
4. Ejecuta **Rotoformas → Holded → Configurar token API v2**.
5. Pega el token en el cuadro privado y confirma. No lo copies en el código ni en el chat.

El token se almacena en la propiedad privada `HOLDED_API_V2_TOKEN`. La clave v1 `HOLDED_API_KEY` se mantiene para el catálogo diario y los movimientos de stock actuales.

## Sincronización automática diaria

Después de publicar el proyecto:

1. Abre Apps Script desde **Extensiones → Apps Script** en la hoja del MES.
2. Selecciona y ejecuta una vez `installDailyHoldedSyncTrigger`.
3. Concede los permisos solicitados por Google.
4. Comprueba en **Activadores** que aparece `syncHoldedProducts` con origen basado en tiempo.

Apps Script ejecutará la función diariamente aproximadamente a las 06:00, según la zona horaria `Europe/Madrid`. Google puede desplazar algunos minutos la hora exacta. Volver a ejecutar el instalador sustituye el activador anterior en lugar de crear duplicados.

El ID de la hoja se guarda en la propiedad `HOLDED_SPREADSHEET_ID`, lo que permite abrirla durante una ejecución automática aunque no haya ninguna pestaña activa. La última sincronización correcta se registra en `HOLDED_LAST_SYNC_AT`.

## Publicar costes de fabricación

1. Ejecuta **Rotoformas → Holded → Preparar costes fabricación (60 días)**.
2. Revisa la hoja `Holded Costes Preview`.
3. Para la primera prueba, marca únicamente un SKU que sea una variante.
4. Ejecuta **Rotoformas → Holded → Aplicar costes seleccionados** y confirma.
5. Comprueba el resultado en Holded, `Holded Raw` y `Holded Costes Log`.
6. Cuando la prueba controlada sea correcta, genera otra vista previa y aplica los productos deseados.

La actualización de costes es manual y requiere selección expresa. No forma parte del activador diario de las 06:00. Esta separación evita que un registro anómalo de fabricación modifique automáticamente todo el catálogo.
