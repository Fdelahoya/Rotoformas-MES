# Conexión final Raspberry → MES: piloto de solo báscula

Preparado el 4/11/2026 para la PR #2. No se han subido archivos a Apps Script,
creado versiones, actualizado implementaciones, cambiado propiedades ni arrancado
servicios. La confirmación del usuario acredita las pruebas físicas de Sensocar
sin carga, con inestabilidad y con cambio de peso en la Raspberry; no acredita aún
el recorrido USB → HTTPS → caché de Apps Script → «Pesar pieza».

## Compatibilidad y paquete del piloto

Las tres incompatibilidades eran accesos de `unittest.mock` introducidos en Python
3.8: dos usos de `call_args.args` y uno de `call_args.kwargs`. Se sustituyen por
`call_args[0]` y `call_args[1]`, conservando las comprobaciones originales sobre
argumentos de CUPS, bytes V1, ausencia de comandos de marcado y JSON de telemetría.
Referencia: [documentación de mock](https://docs.python.org/3.8/library/unittest.mock.html).

Reproducción local real con CPython **3.7.3**, binario oficial de Windows aislado:
antes, 16 pruebas con un fallo y dos errores; después, las 16 originales correctas.
Se añaden tres pruebas: importación sin PDF y dos protecciones de la entrada del
piloto. Total actual: **19**, sin omitir PDF, CUPS, V1 ni recuperación de fallos.
Windows no acredita el sistema ARM de la Raspberry; repetir la suite allí en un
entorno separado. CI ejecuta la suite completa en Python 3.7.x y 3.11, sin equipos.

El paquete del piloto contiene:

- `bridge.py`: ReportLab se importa únicamente al generar un PDF, fuera de la
  fase de báscula.
- `scale_pilot.py`: entrada exclusiva; fuerza ambas salidas a `false` si faltan y
  rechaza cualquier intento de habilitarlas antes de llamar al puente.
- `requirements-scale-py37.txt`: USB/HTTPS con dependencias fijadas para Python 3.7.
- `rotoformas-scale-pilot.service`: servicio separado, sin CUPS ni grupo suplementario
  `lp`; usa `/opt/rotoformas-scale-pilot`, estado propio y entorno propio.
- `scale-pilot.env.example`: plantilla sin secretos; ambas salidas `false`.

Para ejecutar todas las pruebas en Python 3.7 usar `requirements-py37.txt`, que
añade ReportLab/Pillow. No instalarlo en el entorno operativo de solo báscula.
El perfil heredado fija compatibilidad, no soporte de seguridad: [Python 3.7 está
fuera de soporte](https://www.python.org/downloads/release/python-373/). La migración
de sistema/Python debe planificarse por separado, sin alterar el equipo validado.

## Estado remoto comprobado

Consulta API de solo lectura a las 09:36 UTC del 4/11/2026:

| Implementación | Versión | Acceso | Ejecuta como | Acción prevista |
| --- | --- | --- | --- | --- |
| Planta | 48 | ANYONE_ANONYMOUS | USER_DEPLOYING | Actualizar solo tras aprobación |
| QR permanente | 49 | DOMAIN | USER_ACCESSING | Conservar sin cambios |
| Gestión | 49 | DOMAIN | USER_ACCESSING | Conservar sin cambios |
| Entrada HEAD | HEAD | ANYONE_ANONYMOUS | USER_DEPLOYING | No utilizar para el piloto |

Los otros cuatro despliegues históricos siguen en v12, v27, v28 y v33. Ninguno se
ha actualizado ni archivado. Otra descarga de los 16 archivos del editor no
detectó cambios desde la auditoría inicial. El manifiesto local sigue siendo
idéntico al remoto; no modificar permisos ni ámbitos como parte del piloto.

IDs que deben conservarse:

```text
PLANTA: AKfycbwZgzx_rFiDZ2ru8hsrmqnAIQO3WypJeGZXRTZpKL9uxQkvsrvvnSdrJ-7dG59qC9Hbsw
QR:     AKfycbw5LAL2__An-gyUsq8qDYNKfYZ5tfJys8INv7__MpmHx32SuZWxonaFiygbsO92tBsN5Q
GESTION: AKfycbyNA69u8JNmcqRaAct4vNMYey5dXCSKa4L-5f9wwcV2FG-zrBjnWnsfUlzKHoIL4ek86w
```

BRIDGE_URL del equipo:

```text
https://script.google.com/macros/s/AKfycbwZgzx_rFiDZ2ru8hsrmqnAIQO3WypJeGZXRTZpKL9uxQkvsrvvnSdrJ-7dG59qC9Hbsw/exec
```

Para la pantalla se añade `?modo=pesaje`; ese parámetro no va en BRIDGE_URL.

### Propiedades: pendientes de comprobación por el propietario

La API de proyectos no expone Script Properties. La revisión visual se detuvo
porque el control del navegador no pudo verificar la URL con suficiente confianza.
**No se conocen los valores remotos actuales y no se han modificado.** No enviar
tokens por chat. El propietario debe comprobar existencia/formato y comunicar
solo los valores de los interruptores, no los secretos.

| Propiedad | Preparación antes de subir | Durante prueba aprobada |
| --- | --- | --- |
| `RPI_BRIDGE_TOKEN` | Conservar si es válido y coincide con el equipo; 64 caracteres hexadecimales | Igual en ambos lados |
| `RPI_SCALE_ENABLED` | `false` | `true` solo al iniciar la prueba |
| `RPI_PRINT_ENABLED` | `false` | `false` |
| `RPI_LASER_ENABLED` | `false` | `false` |
| `RPI_PLANT_KEY` | Sin cambios; no es necesaria para leer peso | Sin cambios; no desbloquear el puesto |
| `HOLDED_SPREADSHEET_ID`, credenciales Holded y restantes | Sin cambios | Sin cambios |

Las propiedades son globales del proyecto, no específicas de una versión o URL.
Los valores ausentes se interpretan como deshabilitados en el código propuesto,
pero se fijarán explícitamente los interruptores para dejar constancia del piloto.
No ejecutar inicializadores ni crear la hoja de trabajos. Revisar también los
propietarios de disparadores, especialmente `syncHoldedProducts`, antes de subir
código: HEAD se usa por menús y disparadores y ya tiene una entrada anónima.

## Autorización A: instalar la actualización en Raspberry, sin arrancarla

Requiere permiso para escribir en `/opt`, `/etc`, preparar dependencias y cargar
la unidad. No es autorización de arranque. Si hay lector/puente activo, acordar
su parada antes de abrir el puerto; no detener servicios por suposición.

Con la revisión aprobada copiada a la Raspberry y el usuario `rotoformas` ya
comprobado, desde la raíz de esa copia:

```bash
sudo install -d -m 755 /opt/rotoformas-scale-pilot
sudo install -m 644 raspberry/bridge.py raspberry/scale_pilot.py raspberry/requirements-scale-py37.txt /opt/rotoformas-scale-pilot/
sudo python3 -m venv /opt/rotoformas-scale-pilot/venv
sudo /opt/rotoformas-scale-pilot/venv/bin/python -m pip install 'pip<24.1'
sudo /opt/rotoformas-scale-pilot/venv/bin/python -m pip install -r /opt/rotoformas-scale-pilot/requirements-scale-py37.txt
sudo install -m 644 raspberry/rotoformas-scale-pilot.service /etc/systemd/system/
sudoedit /etc/rotoformas-scale-pilot.env
sudo chown root:root /etc/rotoformas-scale-pilot.env
sudo chmod 600 /etc/rotoformas-scale-pilot.env
sudo systemctl daemon-reload
sudo systemctl cat rotoformas-scale-pilot.service
```

No se actualizan el Python global, el entorno operativo anterior ni su SQLite.
Si el usuario no existe o no tiene `dialout`, revisar su creación/permisos según
`PRUEBA-BASCULA-USB.md` antes de continuar. La unidad no instala un arranque
automático. No ejecutar `start`, `restart` ni `enable` en este paso.

Contenido del archivo de entorno, sustituyendo marcadores solo localmente:

```dotenv
BRIDGE_URL=URL_EXISTENTE_DE_PLANTA_SIN_PARAMETROS
RPI_BRIDGE_TOKEN=SECRETO_EXISTENTE_VALIDADO_EN_CANAL_PRIVADO
SCALE_PORT=/dev/serial/by-id/ENLACE_FISICAMENTE_VALIDADO
BRIDGE_DB=/var/lib/rotoformas-scale-pilot/jobs.sqlite3
SYNC_INTERVAL_SECONDS=3
ENABLE_PRINT=false
ENABLE_LASER=false
```

No añadir cola de impresión ni host/puerto del láser. El propietario debe revisar
los grupos del usuario de servicio y que no haya otra instancia usando el puerto.
Si falla instalar dependencias, detener la preparación; no habilitar salidas ni
cambiar de intérprete para eludirlo.

## Autorización B: preparar propiedades y subir código al editor

Autoriza explícitamente dos escrituras distintas: establecer los interruptores
iniciales `false`/comprobar el token en propiedades y ejecutar la subida revisada.
No autoriza publicar. Antes de hacerlo:

1. Confirmar propiedades y propietarios de disparadores; detenerse si no se puede
   acreditar que los disparadores críticos conservarán acceso.
2. Descargar de nuevo HEAD, registrar hashes, manifiesto y metadatos de despliegues.
   Si hay ediciones concurrentes, conciliarlas antes de continuar.
3. Revisar una carpeta de entrega nueva con solo los 16 archivos Apps Script.
   `clasp show-file-status` debe excluir tests, Python, auditorías, credenciales y
   duplicados .js/.gs. Conservar appsscript.json y la URL QR histórica.
4. Tras la aprobación concreta, subir el código al proyecto existente. La subida
   afecta inmediatamente a HEAD/menús/disparadores aunque aún no cambie la web v48.
5. Verificar que el editor coincide con el commit aprobado y que las tres
   implementaciones numeradas conservan sus versiones y permisos anteriores.

Ni este documento ni el estado en borrador de la PR autorizan esa subida.

## Autorización C: crear versión y actualizar solo planta

En el editor, **Implementar → Gestionar implementaciones → implementación de
planta con ID terminado en C9Hbsw → Editar → Nueva versión**. Describirla como
piloto de báscula con impresión/láser deshabilitados y guardar el cambio solo
después de autorización. Si la interfaz exige crear primero la versión, esa
creación también queda incluida en esta aprobación, no en la subida de código.

Verificaciones obligatorias tras publicar:

- El ID y la URL de planta son exactamente los indicados arriba.
- Planta referencia la versión nueva y conserva ANYONE_ANONYMOUS/USER_DEPLOYING.
- QR y gestión siguen en **v49**, con sus IDs/URLs, DOMAIN y USER_ACCESSING.
- Se conservan las versiones inmutables 48 y 49; no archivar ni recrear despliegues.
- La nueva versión incorpora backend de materias primas de v49 además de báscula:
  validar antes su compatibilidad con los datos, sin ejecutar movimientos de stock.

No crear otra implementación, no usar `clasp deploy -i`, no modificar QR/gestión.
Si se observa una discrepancia, no arrancar Raspberry.

## Autorización D: habilitar lectura, arrancar el piloto y probar autocompletado

Después de B/C aprobadas y comprobadas, autorizar `RPI_SCALE_ENABLED=true` y el
arranque manual de **rotoformas-scale-pilot.service**. PRINT/LASER siguen `false`
en Apps Script y en `/etc/rotoformas-scale-pilot.env`. No usar `enable`.

```bash
sudo systemctl start rotoformas-scale-pilot.service
sudo systemctl status rotoformas-scale-pilot.service --no-pager
sudo journalctl -u rotoformas-scale-pilot.service --since '5 minutes ago' --no-pager
```

1. Abrir una pestaña nueva de planta con `?modo=pesaje` para evitar una UI antigua.
   Elegir operario y una OF abierta adecuada, y pulsar **Pesar pieza**. No hace
   falta desbloquear el puesto. No pulsar **Guardar pesaje** ni **Preparar etiqueta**.
2. Con carga estable, el campo debe mostrar automáticamente el valor del visor,
   en kg y con tres decimales. Medición local de menos de 1,5 s; el servidor rechaza
   muestras de más de 6,5 s o futuras. Comprobar NTP si se rechazan todas.
3. Repetir sin carga e inestabilidad: no deben rellenarse valores válidos. Cambiar
   la carga estable y pulsar **Leer báscula USB de nuevo**: debe aparecer el peso
   nuevo. La UI hace lecturas bajo petición; no refresca continuamente el diálogo.
4. Desconectar USB o parar el servicio según el permiso del piloto. Tras más de
   6,5 s, solicitar otra lectura: debe rechazarse la muestra anterior. Reconectar
   y solicitar lectura de nuevo: debe recuperarse el dato actual.
5. Editar el campo manualmente durante una petición: ninguna respuesta anterior
   debe sobrescribirlo. No guardar el valor introducido.
6. Comparar antes/después: ningún pesaje guardado, trabajo creado, impresión,
   conexión al láser, consumo, cambio de stock ni modificación de QR/gestión.

El endpoint publica telemetría en caché y responde sin trabajo; no abre Sheets
durante sync de solo báscula. La visualización de OF sigue usando lecturas normales
del MES, así que esto no es un ensayo sin consultas a datos productivos.

Al finalizar el piloto acordado, detener el servicio y devolver SCALE a `false`
si no se autoriza continuidad. Esa parada y deshabilitación deben estar incluidas
en la autorización D. Registrar el resultado sin claves ni datos personales.

```bash
sudo systemctl stop rotoformas-scale-pilot.service
```

## Recuperación y límites de aprobación

Ante problemas: detener el piloto y apagar SCALE; si se autoriza rollback web,
restaurar planta a v48 manteniendo su ID/URL. Restaurar HEAD desde su copia previa
es una acción separada si los menús/disparadores se ven afectados. No borrar datos,
logs o SQLite, y no modificar QR/gestión para reparar planta.

Una actualización de la PR en GitHub no autoriza A, B, C o D. La validación física
de Sensocar tampoco autoriza arrancar el servicio conectado al MES. El arranque
automático, guardado de pesajes y futuras fases Zebra/V1 requieren aprobación
aparte. El marcado físico seguirá siendo manual y no existe comando de disparo.
