# Configuración

## Clave API de Holded

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

## Sincronización automática diaria

Después de publicar el proyecto:

1. Abre Apps Script desde **Extensiones → Apps Script** en la hoja del MES.
2. Selecciona y ejecuta una vez `installDailyHoldedSyncTrigger`.
3. Concede los permisos solicitados por Google.
4. Comprueba en **Activadores** que aparece `syncHoldedProducts` con origen basado en tiempo.

Apps Script ejecutará la función diariamente aproximadamente a las 06:00, según la zona horaria `Europe/Madrid`. Google puede desplazar algunos minutos la hora exacta. Volver a ejecutar el instalador sustituye el activador anterior en lugar de crear duplicados.

El ID de la hoja se guarda en la propiedad `HOLDED_SPREADSHEET_ID`, lo que permite abrirla durante una ejecución automática aunque no haya ninguna pestaña activa. La última sincronización correcta se registra en `HOLDED_LAST_SYNC_AT`.
