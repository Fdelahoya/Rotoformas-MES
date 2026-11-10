# Conciliación y activación por fases

> Versión pública: las direcciones, usuarios, identificadores de adaptadores y
> valores de configuración son marcadores o ejemplos. Los datos reales y las
> credenciales se conservan en la documentación operativa privada.

> Para la continuación de la PR #2 con Python 3.7.3 y Sensocar ya validada
> físicamente por el usuario, consultar [Conexión final Raspberry → MES](PUBLICACION-PILOTO-BASCULA.md).
> Recoge la nueva entrada exclusiva de báscula, 19 pruebas Python y las
> autorizaciones pendientes. Las propiedades remotas siguen sin verificar.

Preparado el 4/11/2026 en `reconcile/raspberry-safe-2026-11-04`, desde
`9a1e9af7190726b35ded44fe0be45c15d2641c18` y la auditoría local de esa fecha.
**Cambios locales: sin subida a Apps Script, versiones nuevas ni trabajos reales.**

## Código conservado y permisos comprobados

Se conserva la funcionalidad de GitHub y los cambios manuales del editor:
`Configurar Raspberry`, variable `respuesta`, cancelación y validación hexadecimal,
menú en **Rotoformas → Holded**. Se recupera la advertencia de no compartir el token
y se usa `HARDWARE.tokenProperty`. `appsscript.json` se ha copiado sin cambios de la
instantánea del editor: V8, Madrid, STACKDRIVER y
`webapp: {executeAs: USER_DEPLOYING, access: ANYONE_ANONYMOUS}`.
Esto conserva la configuración remota; no convierte las aplicaciones privadas en públicas.

Consulta de solo lectura a `projects.deployments.list`, 4/11/2026 09:00 UTC:

| Aplicación | Versión actual | Acceso efectivo | Ejecución efectiva |
| --- | --- | --- | --- |
| Planta, ID terminado en `C9Hbsw` | 48 | ANYONE_ANONYMOUS | USER_DEPLOYING |
| QR permanente, ID terminado en `BsN5Q` | 49 | DOMAIN | USER_ACCESSING |
| Gestión, ID terminado en `4ek86w` | 49 | DOMAIN | USER_ACCESSING |
| Entrada HEAD, ID terminado en `CxCmOp9` | HEAD | ANYONE_ANONYMOUS | USER_DEPLOYING |

Evidencia completa: `.local-audit/2026-11-04/deployment-permissions.json`.
Las URLs completas se conservan en `CONTEXTO-MES.md`; no se han modificado IDs,
versiones ni permisos. La entrada HEAD exige revisar su uso: cambiar el editor
puede afectar al desarrollo, menús y disparadores aunque las web sigan en 48/49.
Las versiones 48/49 contienen código anterior y sus vulnerabilidades siguen
existiendo hasta una actualización aprobada; esta rama solo prepara su corrección.

## Auditoría del acceso público

Las funciones terminadas en `_` son internas y no invocables con
`google.script.run`. Las otras funciones administrativas, de stock, costes,
catálogo, migración, validación y configuración exigen ahora
`assertLotsWebAppAccess_()` antes de cualquier acceso a servicios. Se prueban 53
entradas administrativas con usuario anónimo y se comprueba su rechazo.
Se mantiene la lista existente de cuentas autorizadas. No se usa
`getEffectiveUser()` para autorizar al visitante de una web ejecutada como propietario.

Excepciones públicas deliberadas:

| Función | Protección y alcance |
| --- | --- |
| `doGet` | Devuelve planta a anónimos; gestión exige cuenta autorizada. |
| `doPost` | Token del equipo de 64 caracteres hexadecimales, acción `sync`, límite de cuerpo, protocolo 2. |
| `getPlantWeightOrders` | Solo proyección de OF abiertas; devuelve contador de pesajes sin nombres, notas ni histórico individual. No crea hojas. |
| `getPlantScaleWeight` | Solo peso estable reciente; requiere habilitación del servidor. Sin escritura en Sheets. |
| `recordPlantManufacturingPieceWeight` | Sin contraseña de puesto, por decisión del usuario; exige operario, OF y peso válidos. |
| `queuePlantLabelJob` | Sin contraseña de puesto; impresión habilitada, pesaje existente y reciente, resultado CONFORME/ALERTA, bloqueo y clave OF/pieza. |
| `getPlantLabelJobStatus` | Sin contraseña de puesto; consulta sin crear hojas. |
| `onOpen` | Solo construye el menú de la hoja. |
| `normalizarSoloFechaString` | Conversión pura de fecha, sin acceso a datos. |

El usuario solicita retirar las contraseñas de los puestos el 4/11/2026.
Se eliminan el cuadro de desbloqueo, la sesión temporal y sus comprobaciones
en servidor. `RPI_PLANT_KEY` deja de utilizarse. Quien disponga del enlace público
puede guardar pesajes y consultar trabajos; la selección de operario identifica
el registro, pero no autentica a la persona. La preparación de etiquetas sigue
dependiendo de la habilitación de impresión. El token de Raspberry permanece privado.

## Interruptores y protocolo

Todos los interruptores faltantes o con valor distinto de `true` quedan apagados.

| Fase | Propiedades Apps Script | Entorno Raspberry |
| --- | --- | --- |
| Todo apagado | `RPI_SCALE_ENABLED=false`, `RPI_PRINT_ENABLED=false`, `RPI_LASER_ENABLED=false` | `ENABLE_PRINT=false`, `ENABLE_LASER=false` |
| Solo báscula | `RPI_SCALE_ENABLED=true`, las otras dos `false` | Ambas salidas `false` |
| Báscula + Zebra, tras aprobación | SCALE/PRINT `true`, LASER `false` | PRINT `true`, LASER `false` |
| Zebra + actualización V1, tras aprobación | Los tres `true` | Ambas salidas `true` |

El dispositivo declara capacidades explícitas y `protocolVersion: 2`. Un puente
antiguo no recibe trabajos. En fase de solo báscula, el servidor actualiza caché
y retorna `job:null`, sin abrir Sheets, consumir trabajos ni reconocer resultados.
Los resultados no reconocidos permanecen en SQLite para conciliación posterior.

Cada trabajo nuevo conserva sus salidas autorizadas en la columna 16
`Salidas autorizadas`, en JSON. Habilitar el láser después no añade V1 a un trabajo
que nació sin esa autorización. Los trabajos antiguos sin esa columna y los
pendientes de más de 15 minutos no se despachan automáticamente. Revisarlos
manualmente; no borrar su historial ni volverlos a PENDIENTE para forzar reintentos.

La impresora se habilita en servidor y dispositivo. V1 exige además autorización
guardada en el trabajo y habilitación en ambos lados. No existe trabajo de láser
independiente. `print_zebra` y `send_laser_v1` verifican también el interruptor local
si alguien los llama directamente. Deshabilitar una fase detiene despachos nuevos;
no cancela un trabajo ya enviado o que esté ejecutándose.

## Peso, impresión y V1

El lector USB trabaja continuamente en un hilo separado para evitar acumular
lecturas mientras HTTPS/CUPS/láser esperan. Sensocar: 9600/7O1, tramas MOBBA con
ETX. Se rechazan inestabilidad, peso <=0,100 kg, >=100000 kg, errores y desconexión.
La captura local caduca a 1,5 segundos. Se envía la fecha de la lectura original,
no solo su recepción en Google; el servidor rechaza lecturas futuras o de más de
6,5 segundos. Mantener NTP correcto en Raspberry: con reloj adelantado se rechaza
la muestra, en lugar de aceptarla como reciente.

**Pesar pieza** solicita la lectura y rellena el campo automáticamente. Una
respuesta tardía, caducada o anterior a otra petición no sobrescribe una edición
manual. No se guarda nada por leer: guardar sigue siendo una acción del operario,
sin contraseña de puesto. No hay repetición automática de guardados tras fallos
de red; su deduplicación por identificador de medición sigue pendiente.

**Preparar etiqueta** reutiliza el pesaje guardado y crea como máximo un trabajo
por `OF|Pnumero`. Repetir la petición devuelve el existente. Un trabajo ENVIADO no
se vuelve a entregar automáticamente aunque se pierda la respuesta. SQLite
persiste RUNNING antes de las acciones físicas; al reiniciar conserva INCIERTO y
no repite. Esto prioriza evitar duplicados: puede requerir conciliación manual de
un trabajo que nunca llegó a ejecutarse.

El PDF tiene página exacta 100 × 150 mm; CUPS recibe
`lp -d COLA -o media=Custom.100x150mm -t ... etiqueta.pdf`. La cola debe soportar
ese tamaño, su controlador, DPI, sensor y thermal transfer/ribbon deben estar
validados. El envío real y la medida física aún requieren una prueba autorizada.
COLA_CUPS solo acredita aceptación por CUPS, no salida de papel.

PDF, vista previa y V1 usan la URL histórica QR con `?lote=` codificado. El
cliente Python exige la URL canónica exacta y rechaza duplicados de parámetros,
fragmentos y caracteres de control. El único paquete de escritura del láser es:

```text
STX ENQ seta:data#V1=URL_QR ETX
```

Se exige la confirmación exacta de V1. No se implementan comandos de carga,
inicio, parada ni disparo. La plantilla y el marcado los prepara y ejecuta
manualmente un operario. La URL identifica el lote, no una pieza única.

Timeout de CUPS o envío V1 sin confirmación: INCIERTO, sin repetición automática.
Una salida no satisfactoria de `lp` también se considera INCIERTO: un error de
respuesta no prueba que CUPS no haya recibido el trabajo.
La impresión manual solo se ofrece tras ERROR definitivo confirmado por servidor;
un error al encolar o consultar no la habilita, para evitar duplicar un envío de
resultado desconocido. Toda salida física incierta requiere revisión humana.

## Instalación preparada: primera fase de solo báscula

Para comandos concretos, pruebas de aceptación y parada del piloto, seguir
[Piloto USB: únicamente báscula](PRUEBA-BASCULA-USB.md).

Procedimiento pendiente de autorización de publicación y de instalación. No se
ha ejecutado contra producción ni equipos.

1. Comprobar Raspberry, sistema/Python compatibles, NTP, puerto estable
   `/dev/serial/by-id/ADAPTADOR_BASCULA` y protocolo real de la báscula. Cerrar el lector USB
   anterior: solo un servicio debe abrir el puerto. No activar CUPS ni conectar
   al láser para esta fase. Mantener parado cualquier puente anterior con salidas.
2. Instalar `bridge.py`, `requirements.txt` y la unidad systemd en
   `/ruta/ejemplo/puente`; crear usuario de servicio, directorio de estado
   `/ruta/ejemplo/datos` y entorno virtual. Seguir los comandos de
   `INTEGRACION-RASPBERRY.md`, pero omitir su antiguo paso de arranque hasta
   completar esta lista. No usar su antiguo orden de publicación sin las fases.
3. Instalar dependencias en ese entorno, no en el Python del sistema. Usar el
   usuario de servicio con acceso `dialout`; el permiso `lp` puede reservarse para
   la fase Zebra. La unidad propuesta incluye `lp`: retirarlo para el piloto de
   solo báscula si ese grupo no existe o no se concede todavía.
4. Conservar el token privado del equipo ya validado. Si se prepara otro equipo,
   generar su secreto de 64 caracteres hexadecimales con `secrets.token_hex(32)`
   en una sesión local protegida. No se necesita clave de puesto. No copiar el
   token a chat, Git o documentación.
5. Archivo `/ruta/ejemplo/bridge.env`, permisos 600 y propietario root:
   `RPI_BRIDGE_TOKEN`, `SCALE_PORT`, `BRIDGE_DB`, `SYNC_INTERVAL_SECONDS=3`,
   `ENABLE_PRINT=false`, `ENABLE_LASER=false`. BRIDGE_URL será la URL existente de
   planta terminada en `/exec`, sin `?modo=pesaje`; no la de QR, gestión ni HEAD.
   No hacen falta cola ni host láser para arrancar la fase de báscula.
6. Cuando se apruebe la publicación, configurar propiedades del script:
   `RPI_BRIDGE_TOKEN` (mismo secreto del equipo),
   `RPI_SCALE_ENABLED=true`, `RPI_PRINT_ENABLED=false`, `RPI_LASER_ENABLED=false`.
   La telemetría sola no necesita inicializar la hoja Trabajos equipos ni ejecutar
   `initializeRaspberryBridge`. Esta función ahora solo vincula la hoja, no activa
   salidas ni crea trabajos. El guardado manual usa las hojas existentes del MES.
7. Iniciar el servicio solo tras comprobar que planta publica el protocolo 2
   autorizado y que los dos interruptores locales y los dos remotos de salida
   están apagados. Verificar lecturas estable/inestable/desconectada, coincidencia
   con visor y autocompletado de **Pesar pieza**, sin guardar ni preparar etiquetas.
   Comprobar que no cambia la cola, que no se invoca `lp` ni se abre TCP al láser.
8. Para validar el guardado después, acordar primero una
   pesada real controlada: esa acción sí escribe un registro del MES. No usar una
   OF de producción como ensayo automático.

## Subida y despliegue controlado posteriores

1. Volver a descargar HEAD y listar permisos/implementaciones justo antes de
   publicar. Comparar con las copias de auditoría; conciliar cualquier edición
   concurrente. No usar pull sobre archivos de trabajo que no se hayan guardado.
2. Revisar el diff final, conservar el manifiesto actual, y preparar una carpeta
   de entrega limpia. `.claspignore` enumera solo 16 archivos Apps Script; verificar
   con `clasp show-file-status` que no entren auditorías, tests, Python, secretos
   ni duplicados .gs/.js. No copiar el .clasp.json de producción a un sandbox.
   La candidata local `.local-audit/2026-11-04/delivery-candidate/` ya contiene
   esos 16 archivos. `clasp show-file-status` confirmó exclusivamente ese conjunto;
   los hashes están en `candidate-hashes.json`. Su `.clasp.json` apunta al proyecto
   real: es material de revisión, no un entorno de ensayo ni autorización de push.
   Ejecutar la comprobación desde esa carpeta; clasp 3.4.1 rechazó las rutas
   relativas pasadas mediante `--project` en esta sesión. Regenerar la candidata
   tras cualquier edición, antes de una futura publicación.
3. Validar primero en proyecto/hoja de ensayo sin secretos de Holded productivos,
   disparadores operativos ni equipos. Probar acceso anónimo y no autorizado,
   guardado sin contraseña de puesto, reintentos, rechazo de token y estado incierto.
4. Inventariar disparadores instalables y sus propietarios. Las operaciones de
   catálogo/resumen ahora exigen cuenta autorizada: verificar especialmente la
   identidad del disparador `syncHoldedProducts` antes de subir HEAD. Si no puede
   acreditar usuario autorizado, diseñar su migración a un manejador privado
   antes de publicar; nunca aceptar un `triggerUid` enviado por el navegador como
   autorización. No cambiar ni reinstalar disparadores durante esta preparación.
5. Obtener aprobación explícita para la subida: puede afectar hoja/disparadores
   y entrada HEAD incluso sin una versión web nueva. No se ha ejecutado.
6. Tras otra aprobación de publicación, actualizar **solo la implementación
   existente de planta** desde Gestionar implementaciones, manteniendo ID/URL,
   USER_DEPLOYING y ANYONE_ANONYMOUS. No utilizar `clasp deploy -i`. Dejar QR y
   gestión en v49 hasta su propia actualización aprobada. Conservar v48 y v49,
   no borrarlas ni archivar las implementaciones. Mantener la URL del QR antiguo.
7. Actualizar planta desde v48 también incorpora el backend de materias primas
   de v49; revisar compatibilidad de PE/pigmento y datos antes de esa actualización.
   Confirmar esta fase con PRINT/LASER apagados, no mediante una impresión.
8. Rollback: detener primero el servicio del equipo; devolver planta a v48 y
   QR/gestión a v49 si se hubieran actualizado. Restaurar HEAD desde la copia
   previa por separado si procede. El rollback de código no revierte datos,
   etiquetas impresas ni V1; no borrar log/SQLite para repetir trabajos inciertos.

Activación posterior Zebra: revisar pendientes antiguos y columna 16, validar
cola/tamaño, habilitar PRINT en ambos lados, mantener LASER apagado y autorizar
una sola etiqueta. Activación V1: nueva aprobación, red/host/puerto y plantilla
con únicamente V1, sin texto fijo añadido; habilitar LASER en ambos lados y crear
un trabajo nuevo. Validar por lectura de QR con operario, sin automatizar marcado.

## Verificación local

Seis suites Node: pigmento por OF, flujo de materiales, prototipo de incidencias,
integración del puente, seguridad/cola y respuestas USB de la pantalla.
Dieciséis pruebas Python: protocolo USB, vigencia de muestra, PDF, URL, argumentos
CUPS y paquete V1 simulados, doble bloqueo de salidas, fases, deduplicación,
recuperación de caída y estados inciertos. CUPS, TCP y HTTPS se simulan en pruebas;
no se inicia `main()` ni se contacta con equipos.

Entorno local usado: Node 26.13.0, Python 3.15, pyserial 3.5, requests 2.34.2 y
reportlab 4.5.1, con dependencias en `.local-audit/2026-11-04/venv`. CI mantiene
Node 20/Python 3.11; requiere ejecutar el workflow en GitHub cuando se publique
la rama. Estas pruebas no acreditan compatibilidad con Raspbian Buster ni salida
física o respuesta real del controlador Datamark.

Fuentes oficiales sobre funciones privadas y acceso a identidad:
[Comunicación HTML/servidor](https://developers.google.com/apps-script/guides/html/communication),
[Session](https://developers.google.com/apps-script/reference/base/session).
