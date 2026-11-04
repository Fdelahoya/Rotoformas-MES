# Piloto USB: únicamente báscula

Procedimiento preparado el 4/11/2026. **No ejecutado.** No activa impresora ni
comunicación con el láser. Requiere autorización posterior para instalar/arrancar
el servicio y, por separado, para subir/publicar Apps Script. La PR por sí sola
no cambia el MES. Planta sigue en v48; QR y gestión siguen en v49.

## 1. Comprobar la Raspberry antes del piloto

En una sesión local de la Raspberry, con el operario presente:

```bash
cat /etc/os-release
python3 --version
timedatectl status
ls -l /dev/serial/by-id/
```

Anotar sistema/Python, confirmar reloj NTP sincronizado y el enlace correspondiente
a la báscula Sensocar (9600 baudios, 7 bits, paridad impar, un bit de parada).
No asumir `/dev/ttyUSB0`. Identificar y detener, con su responsable, cualquier
lector anterior que abra ese mismo puerto y cualquier puente anterior con salidas
habilitadas. No desconectar otros servicios del MES por suposición. Mantener la
Zebra y el láser fuera de este piloto.

Si el sistema es Buster/Python antiguo, resolver primero compatibilidad y soporte
de dependencias. La verificación local de Windows no acredita esa plataforma.
No actualizar el sistema operativo o recalibrar equipos como parte de este ensayo.

## 2. Instalar los archivos aprobados sin arrancar el servicio

Desde una copia de esta rama o del commit aprobado en la Raspberry:

```bash
sudo apt-get install python3-venv
getent passwd rotoformas
```

Si el usuario no existe, crearlo; si existe, revisar sus grupos sin recrearlo:

```bash
sudo useradd --system --no-create-home --user-group --groups dialout rotoformas
```

Preparar aplicación y un directorio SQLite independiente para el piloto, sin
borrar ni reutilizar registros de trabajos de un puente anterior:

```bash
sudo install -d -m 755 /opt/rotoformas-bridge
sudo install -d -o rotoformas -g rotoformas -m 700 /var/lib/rotoformas-bridge/scale-pilot
sudo install -m 644 raspberry/bridge.py raspberry/requirements.txt /opt/rotoformas-bridge/
sudo python3 -m venv /opt/rotoformas-bridge/venv
sudo /opt/rotoformas-bridge/venv/bin/python -m pip install -r /opt/rotoformas-bridge/requirements.txt
sudo install -m 644 raspberry/rotoformas-bridge.service /etc/systemd/system/
sudo install -d /etc/systemd/system/rotoformas-bridge.service.d
sudoedit /etc/systemd/system/rotoformas-bridge.service.d/scale-only.conf
```

Contenido del último archivo: quitar acceso al grupo de impresión en este piloto.
No añade `lp` ni arranca CUPS.

```ini
[Service]
SupplementaryGroups=
SupplementaryGroups=dialout
```

El usuario también debe carecer de pertenencia persistente al grupo `lp`; si ya
la tiene, acordar su retirada con el responsable antes del piloto. No modificar
los permisos de otros servicios sin revisar su uso.

Crear el entorno protegido con `sudoedit /etc/rotoformas-bridge.env`:

```dotenv
BRIDGE_URL=URL_EXISTENTE_DE_PLANTA_TERMINADA_EN_EXEC
RPI_BRIDGE_TOKEN=TOKEN_HEXADECIMAL_PRIVADO_DE_64_CARACTERES
SCALE_PORT=/dev/serial/by-id/ENLACE_REAL_DE_LA_BASCULA
BRIDGE_DB=/var/lib/rotoformas-bridge/scale-pilot/jobs.sqlite3
SYNC_INTERVAL_SECONDS=3
ENABLE_PRINT=false
ENABLE_LASER=false
```

```bash
sudo chown root:root /etc/rotoformas-bridge.env
sudo chmod 600 /etc/rotoformas-bridge.env
sudo systemctl daemon-reload
sudo systemctl cat rotoformas-bridge.service
```

Usar la URL histórica de **planta**, sin `?modo=pesaje`; no usar QR, gestión o
HEAD. Sustituir los marcadores solo en la Raspberry, nunca en Git. No hacen falta
`ZEBRA_CUPS_QUEUE`, `LASER_HOST` ni `LASER_PORT`: dejarlos ausentes.

El token debe generarse localmente con `secrets.token_hex(32)` y guardarse en el
archivo protegido y en las propiedades del script mediante un canal privado.
No enviarlo por chat, registrarlo en logs ni incluirlo en argumentos de comandos.
No imprimir el archivo `.env` en una sesión grabada. No usar `source` con ese
archivo de root desde una cuenta sin privilegios; systemd lo cargará.

## 3. Probar solo USB, todavía sin acceder al MES

Con el servicio parado y desde una terminal local autorizada, ejecutar una
lectura de 20 segundos. Sustituir el enlace del puerto. Este bloque abre solo el
puerto serie: no llama a `main`, HTTPS, CUPS ni al láser.

```bash
cd /opt/rotoformas-bridge
sudo -u rotoformas /opt/rotoformas-bridge/venv/bin/python - <<'PY'
import time
from bridge import ScaleReader
reader = ScaleReader('/dev/serial/by-id/ENLACE_REAL_DE_LA_BASCULA')
try:
    end = time.monotonic() + 20
    next_report = 0
    while time.monotonic() < end:
        reader.poll()
        if time.monotonic() >= next_report:
            print(reader.snapshot(), flush=True)
            next_report = time.monotonic() + 1
        time.sleep(0.05)
finally:
    reader.close()
PY
```

Comprobar: peso estable >0,100 kg igual al visor; movimiento/inestabilidad produce
`stable: false`; retirar carga o desconectar USB produce lectura inválida.
No continuar si unidades, decimal, tara o estabilidad no coinciden con el visor.
No guardar pesajes. Cerrar esta prueba antes de iniciar el servicio: solo un lector
puede usar el puerto.

## 4. Condición previa: publicar la revisión de planta aprobada

**No ejecutar aún.** La integración MES necesita que el endpoint existente de
planta publique el código del protocolo 2; v48 no lo incluye. Seguir
[Conciliación y activación por fases](CONCILIACION-RASPBERRY-2026-11-04.md), con
revisión de disparadores y nueva descarga de HEAD antes de cualquier subida.
Actualizar únicamente planta después de aprobación explícita, conservando URL,
acceso anónimo y ejecución como propietario. QR/gestión permanecen en v49 y se
conserva v48 como referencia de rollback. No usar `clasp deploy -i`.

Propiedades del script para ese piloto:

| Propiedad | Valor |
| --- | --- |
| `RPI_BRIDGE_TOKEN` | El secreto de 64 caracteres del equipo |
| `RPI_SCALE_ENABLED` | `true` |
| `RPI_PRINT_ENABLED` | `false` |
| `RPI_LASER_ENABLED` | `false` |

No ejecutar `initializeRaspberryBridge`: la telemetría solo usa caché, no necesita
crear `Trabajos equipos`. Para comprobar lectura/autocompletado tampoco hace
falta `RPI_PLANT_KEY` ni desbloquear el puesto. El guardado de una pesada sería
otra prueba, con escritura de datos y autorización específica.

## 5. Arranque manual del piloto, solo tras esa aprobación

Comprobar sin mostrar secretos que la configuración efectiva mantiene las salidas
deshabilitadas. Revisar también que no existen overrides que cambien la ruta del
archivo de entorno o ejecuten otro programa. No usar `enable` hasta aceptar el
piloto y aprobar el arranque automático.

```bash
sudo systemctl start rotoformas-bridge.service
sudo systemctl status rotoformas-bridge.service --no-pager
sudo journalctl -u rotoformas-bridge.service --since '5 minutes ago' --no-pager
```

Abrir la URL existente de planta con `?modo=pesaje`, seleccionar operario y una
OF abierta y pulsar **Pesar pieza**. Si no hay una OF adecuada, preparar primero
el escenario en un MES de ensayo; no crear una OF productiva solo para probar.

| Prueba | Resultado exigido |
| --- | --- |
| Carga estable | Peso relleno automáticamente e igual al visor, en kg |
| Báscula inestable | Campo no acepta esa lectura automática y muestra aviso |
| USB desconectado | No se reutiliza una lectura pasada; al repetir lectura se informa del fallo |
| Servicio detenido o red caída | Tras más de 6,5 s se rechaza la muestra anterior |
| USB/red recuperados | Al pedir otra lectura se obtiene el peso actual |
| Peso editado a mano | Una respuesta anterior no sobrescribe la edición |
| Impresora/láser | Ningún trabajo nuevo, llamada a CUPS ni conexión al controlador |

No pulsar **Guardar pesaje**, **Preparar etiqueta** ni desbloquear el puesto en
esta prueba. Verificar antes/después que no hay registros nuevos en Pesajes
calidad, Trabajos equipos o Holded. Registrar fecha, versión de código, modelo,
puerto/protocolo, valor del visor y resultado, sin secretos ni datos personales.

El bloqueo no depende del navegador: `RPI_PRINT_ENABLED=false` impide encolar y
entregar trabajos; `ENABLE_PRINT=false` impide ejecutar impresiones localmente.
El láser queda deshabilitado en servidor y dispositivo. No hay comandos de marcado.

## 6. Parada y aceptación

```bash
sudo systemctl stop rotoformas-bridge.service
sudo systemctl is-active rotoformas-bridge.service
```

Después de más de 6,5 segundos, una nueva lectura del MES debe indicar que no hay
peso reciente. Dejar el servicio parado y `RPI_SCALE_ENABLED=false` si finaliza el
ensayo, hasta acordar continuidad. Ante cualquier salida de equipo o escritura no
prevista, parar el servicio y revisar antes de repetir; no borrar SQLite/logs.

La aceptación del piloto autoriza solo lectura USB. Zebra y V1 requieren pruebas
y aprobaciones posteriores independientes; el marcado físico sigue siendo manual.
