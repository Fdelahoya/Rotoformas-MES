# Báscula, Zebra y láser V1 operativos

> Versión pública: las direcciones, usuarios, identificadores de adaptadores y
> valores de configuración son marcadores o ejemplos. Los datos reales y las
> credenciales se conservan en la documentación operativa privada.

## Actualización documentada el 10/11/2026

La configuración del 5/11 se conserva debajo como registro de puesta en marcha.
Desde el 9/11 el servicio admite enlaces únicos por lote de qr.rotoformas.com;
véanse [Enlaces cortos](ENLACES-CORTOS.md) y [Trazabilidad y QR](TRAZABILIDAD-QR.md).
El marcado continúa siendo manual. El QR láser puede tener otro dibujo que el
de Zebra, pero debe codificar la misma URL.

Raspberry confirmada por el usuario: IP_INTERNA_EQUIPO, usuario SSH autorizado; láser
IP_INTERNA_EQUIPO. El 6/11 el usuario comunicó Zebra en IP_INTERNA_EQUIPO, entonces
desconectada. El destino CUPS inicial de la tabla inferior es el verificado en
la instalación inicial; no se cambió la cola ni se verificó una migración al nuevo destino.
Consultar lpstat antes de atribuir una incidencia al destino actual.

El programa exige confirmación exacta de V1 y después comprueba B1 mediante
get_currtext. ACK de recepción no equivale a contenido aplicado ni marcado.
Se corrigió el truncamiento de URLs largas con `=` usando la ruta `?lote/`;
el formato corto actual también es aceptado estrictamente. La recuperación de
QR PRUEBA y la distinción entre objeto y variable están en la guía de QR.

Instalación del 9/11: servicio activo y respaldo previo conservado en el equipo.
La huella del programa y sus respaldos se conservan en el registro operativo privado.
La normalización de saltos de línea da el mismo contenido que el checkout local;
no interpretar una diferencia CRLF/LF como una diferencia funcional.

Se validó la aceptación del enlace corto con el Python instalado, sin enviar
salidas físicas. Las 27 pruebas Python locales usan equipos simulados. El
usuario confirmó la igualdad del enlace largo Zebra/láser el 6/11 y el acceso
correcto del enlace corto el 9/11; no hay una comprobación física documentada
de una nueva etiqueta corta en ambos equipos.

## Registro de puesta en marcha del 5/11/2026

Estado confirmado por el usuario el 5/11/2026: guardar el pesaje y pulsar
**Preparar etiqueta** imprime por Zebra y actualiza V1 en el láser. El marcado
de la pieza se realiza manualmente. La impresión y el envío de V1 reutilizan
el pesaje guardado; no generan producción ni movimientos de stock.

## Configuración verificada

| Elemento | Configuración |
| --- | --- |
| Servicio activo y habilitado al arrancar | `rotoformas-bridge.service` |
| Servicio anterior sustituido | `rotoformas-scale-pilot.service`, deshabilitado |
| Programa | `/ruta/ejemplo/puente/bridge.py` |
| Entorno privado | `/ruta/ejemplo/bridge.env`, permisos 600 |
| Estado persistente | `/ruta/ejemplo/datos/jobs.sqlite3` |
| Báscula | `/dev/serial/by-id/ADAPTADOR_BASCULA`, 9600/7O1 |
| Cola CUPS | `COLA_ZEBRA` |
| Destino Zebra | `socket://IP_INTERNA_EQUIPO` |
| Etiqueta | PDF de 100 × 150 mm |
| Láser | `IP_INTERNA_EQUIPO` |
| Contenido del QR del diseño láser | Variable `V1`, con la URL completa del lote |

Apps Script mantiene `RPI_SCALE_ENABLED=true`, `RPI_PRINT_ENABLED=true` y
`RPI_LASER_ENABLED=true`. En Raspberry: `ENABLE_PRINT=true`, `ENABLE_LASER=true`,
`LASER_HOST=IP_INTERNA_EQUIPO`, `LASER_PORT=8050` y la cola CUPS indicada.
El token y la URL de conexión se conservan de la configuración privada del piloto;
no se incluyen archivos de entorno reales en el repositorio.

Con más de 50 propiedades, la pantalla de configuración de Apps Script solo
muestra las primeras y no permite editarlas. `ConfiguracionZebra.gs` conserva
las funciones administrativas utilizadas: `activarZebraMES()` habilita báscula
y Zebra y apaga V1; `activarLaserV1MES()` habilita V1 con Zebra ya activa.
Ambas comprueban acceso administrativo y solo muestran los tres interruptores.
La configuración final se obtiene ejecutándolas en ese orden. No es necesario
publicar una nueva versión web para cambiar propiedades compartidas del script.

## Instalación y actualización reproducibles

Los programas siguientes requieren `sudo`, un puente instalado con su entorno
virtual y CUPS previamente configurado. No son instaladores desde cero. Usan
los archivos de la carpeta `raspberry` del mismo checkout: copiar esa carpeta
a Raspberry manteniendo su contenido antes de ejecutarlos.

- `sudo python3 install_from_scale_pilot.py`: migración desde el piloto activo al
  puente completo. Reutiliza su conexión y puerto USB, valida dependencias y
  cola, comprueba MES con salidas deshabilitadas, guarda respaldo y cambia de
  servicio. Habilita Zebra y deja V1 apagada. Solo para equipos aún en el piloto.
- `sudo python3 update_bridge.py`: actualización del puente activo. Ejecuta la suite
  Python simulada, respalda el programa y reinicia el servicio. Conserva el
  archivo de entorno y SQLite. Es el procedimiento utilizado para la fecha.
- `sudo python3 enable_laser_v1.py`: habilita V1 para la dirección y puerto indicados,
  comprueba TCP sin enviar datos, respalda el entorno y reinicia el puente.
  Mantiene el resto de la configuración, incluida la impresión activa.

No ejecutar de nuevo una migración sobre un equipo ya operativo. Los programas
intentan restaurar la configuración anterior si falla el arranque; revisar
siempre el estado final del servicio. Los respaldos de entorno son privados y
permanecen en Raspberry. No borrar SQLite ni cambiar estados de trabajos para
forzar reintentos.

## Corrección de fecha y pruebas

Las primeras etiquetas fallaron antes de contactar con CUPS: Apps Script enviaba
`Thu Nov 05 2026 06:41:00 GMT+0100 (hora estándar de Europa central)`, que no
cabía en la línea de fecha. `label_date()` convierte esa representación a
`05/11/2026 06:41`, conserva la hora local de origen y valida el calendario.
También admite el formato compacto anterior. No altera el registro de pesaje.

Pasan 21 pruebas Python tanto localmente como en la Raspberry del usuario,
incluido el PDF con la fecha real que falló. Las salidas CUPS y TCP se simulan
en las pruebas. Después de instalar, el usuario confirmó la impresión real y,
posteriormente, el funcionamiento del láser. La conexión USB y ambos servicios
se verificaron mediante los resultados de terminal aportados por el usuario.
No se ha aportado una lectura escaneada del QR para verificar su URL de forma
independiente. El QR identifica el lote, no una pieza única.

El paquete de V1 es `STX ENQ seta:data#V1=URL_QR ETX`. El puente exige la
confirmación exacta de la misma URL. No envía comandos de inicio ni de marcado.
MES registra por separado `COLA_CUPS` y `V1_ACEPTADA`: la aceptación del servicio
no demuestra por sí sola salida de papel ni marcado físico. Los estados
inciertos y los trabajos ya conocidos no se ejecutan de nuevo automáticamente.

Para revisar un fallo, consultar `sudo journalctl -u rotoformas-bridge -n 100
--no-pager -l` y el detalle del trabajo en MES. No solicitar otra impresión de
una etiqueta que ya haya salido manualmente.
