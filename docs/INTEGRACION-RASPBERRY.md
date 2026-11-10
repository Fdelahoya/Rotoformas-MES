# Integración MES ↔ Raspberry Pi ↔ báscula, Zebra y láser

> Versión pública: las direcciones, usuarios, identificadores de adaptadores y
> valores de configuración son marcadores o ejemplos. Los datos reales y las
> credenciales se conservan en la documentación operativa privada.

Este documento conserva el diseño y procedimiento iniciales. Estado vigente:
puente instalado y equipos operativos según las verificaciones fechadas en
[Equipos operativos](EQUIPOS-OPERATIVOS-2026-11-05.md); enlaces cortos activos
desde el 9/11 según [Enlaces cortos](ENLACES-CORTOS.md). Los apartados de
instalación siguientes son históricos: no reinstalar un piloto sobre el servicio
activo ni tratar sus antiguos pendientes como ausencia de la integración actual.

> Revisión 4/11/2026: para instalar y publicar, seguir primero
> [Conciliación y activación por fases](CONCILIACION-RASPBERRY-2026-11-04.md).
> Esa revisión sustituye el orden de activación descrito abajo: protocolo 2,
> puestos sin contraseña y salidas apagadas por defecto. La primera fase habilita
> únicamente la báscula; no arrancar el puente antiguo ni habilitar equipos al
> seguir los pasos históricos de este documento.

## Funcionamiento

1. Raspberry lee Sensocar SCA1-CRT por USB virtual: 9600 baudios, 7 bits, paridad impar, 1 stop; tramas MOBBA terminadas en ETX. Rechaza la bandera ? (inestable), lecturas inválidas, ausencia de bytes, valores no positivos y pesos <= 0,100 kg.
2. Cada 3 segundos (configurable), la Raspberry solicita el siguiente trabajo al Apps Script público mediante HTTPS con un token secreto y transmite la última medición estable. No es necesario exponer la Raspberry a Internet.
3. Al pulsar **Pesar pieza** se rellena automáticamente el campo del peso con la última medición USB reciente (<6,5 s). El operario compara con el visor y pulsa **Guardar pesaje**. Se conserva la entrada manual como contingencia autorizada.
4. Al pulsar **Preparar etiqueta**, el servidor busca el pesaje ya guardado en Google Sheets. Si fue CONFORME o ALERTA, y tiene menos de 15 minutos, crea un solo trabajo por OF y número de pieza. Pulsar dos veces no duplica el trabajo. El peso no se guarda de nuevo y el stock no cambia.
5. La Raspberry genera PDF de 100 x 150 mm con producto, SKU, lote, peso bruto, fecha, OF, número de pieza y QR del lote. Envía el archivo con lp a la cola CUPS de la Zebra.
6. Independientemente, envía la URL QR exacta al láser con protocolo LC por TCP: seta:data#V1=URL. Requiere respuesta seta:1. El código **NUNCA envía start:, load: ni ninguna orden para disparar el láser**. El operario sigue preparando y marcando el diseño de forma manual conforme a las protecciones y procedimientos del fabricante.
7. Los resultados se registran por separado en la hoja Trabajos equipos: COLA_CUPS / ERROR e V1_ACEPTADA / ERROR. COLA_CUPS significa aceptación por el servicio CUPS, no que salió papel; V1_ACEPTADA es aceptación de la variable, NO marcado físico.

La Raspberry persiste trabajos en SQLite antes de iniciar acciones físicas. Si se interrumpe durante una operación, no repite automáticamente el trabajo incierto; lo deja para revisión humana.

La URL QR es la histórica del MES, con parámetro lote; identifica al lote, no de forma única a la pieza. No se cambian despliegues ni QR existentes desde esta rama.

## Apps Script: pasos de publicación

1. Revisar y aprobar los cambios. Subir código y publicar nueva versión sobre el **despliegue público de planta existente**, sin cambiar su URL, identidad de ejecución ni permisos. Conservar los despliegues privados y QR. No utilizar clasp deploy -i.
2. En Propiedades del script, configurar RPI_BRIDGE_TOKEN con un secreto aleatorio de al menos 32 caracteres; se recomienda generar 64 caracteres con Python secrets.token_hex(32). No incluir el secreto en Git, HTML ni en la URL.
3. Abrir el editor de Apps Script vinculado a la hoja principal y ejecutar initializeRaspberryBridge() como usuario autorizado. Esto establece HOLDED_SPREADSHEET_ID y prepara la hoja Trabajos equipos. Verificar tokenConfigured true.
4. Usar para BRIDGE_URL la URL /exec **del despliegue público de planta** SIN ?modo=pesaje. doPost debe estar incluido en la versión actualizada.
5. Probar que doPost rechaza el token incorrecto antes de conectar los equipos. La pantalla pública de pesaje sigue siendo anónima según el diseño previo; auditar autorización, acceso físico y otras funciones globales antes de ampliar la exposición.

## Raspberry: instalación

Requiere Python 3, pip, pyserial, requests, reportlab, CUPS y el servicio de red del láser. La Raspberry del manual usa Raspbian Buster heredado: comprobar compatibilidad de las versiones de los paquetes instalados antes de cambiar Python o el sistema operativo.

1. Confirmar puerto real de la báscula con lsusb y /dev/serial/by-id; usar /dev/ttyUSB0 solamente si corresponde. Cerrar el lector peso_directo.py, ya que el puerto serial no debe ser utilizado por dos procesos simultáneamente.
2. Confirmar que lpstat -p -d y lpstat -v muestran la cola Zebra y que imprime PDF. En CUPS configurar tamaño **exacto 100 x 150 mm**, thermal transfer con ribbon, sensor y dpi correctos según el manual. Calibrar.
3. Confirmar IP y puerto del láser (en el manual IP_INTERNA_EQUIPO). En la plantilla láser, el QR debe tener **únicamente V1**; eliminar WWW.DATAMARK.ES del primer objeto y revisar B2/B3.
4. Copiar los archivos raspberry/bridge.py, requirements.txt y la unidad systemd a la Raspberry. En un terminal, desde la raíz del repositorio:

    sudo apt-get install -y python3 python3-venv python3-pip cups-client
    sudo useradd --system --no-create-home --groups dialout,lp rotoformas
    sudo mkdir -p /ruta/ejemplo/puente /ruta/ejemplo/datos
    sudo cp raspberry/bridge.py raspberry/requirements.txt /ruta/ejemplo/puente/
    sudo python3 -m venv /ruta/ejemplo/puente/venv
    sudo /ruta/ejemplo/puente/venv/bin/pip install -r /ruta/ejemplo/puente/requirements.txt
    sudo cp raspberry/bridge.env.example /ruta/ejemplo/bridge.env
    sudo chmod 600 /ruta/ejemplo/bridge.env
    sudo chown rotoformas:rotoformas /ruta/ejemplo/datos
    sudo cp raspberry/rotoformas-bridge.service /etc/systemd/system/

5. Editar /ruta/ejemplo/bridge.env como root: BRIDGE_URL, RPI_BRIDGE_TOKEN (exactamente el mismo de Apps Script), SCALE_PORT, ZEBRA_CUPS_QUEUE y LASER_HOST/LASER_PORT. Nunca subir secretos a Git.
6. Activar y comprobar:

    sudo systemctl daemon-reload
    sudo systemctl enable --now rotoformas-bridge.service
    sudo systemctl status rotoformas-bridge.service --no-pager -l
    sudo journalctl -u rotoformas-bridge -n 50 --no-pager

Usar una ruta estable para la báscula cuando sea posible (por-id). Si las bibliotecas fallan por incompatibilidad en Buster, usar versiones compatibles o migración planificada; no modificar el calibrado de báscula para solucionar paquetes.

## Etiqueta y láser

El PDF conserva los **datos y QR** de la etiqueta actual, pero puede no reproducir exactamente el aspecto HTML: por defecto muestra ROTOFORMAS en texto en lugar de logotipo. Para incluir PNG local, configurar ROTOFORMAS_LOGO_PNG=/ruta/logo.png. Imprimir una sola etiqueta, comprobar medidas 100 x 150 mm y escanear el QR. La aceptación CUPS no verifica la salida física.

El comando de comunicación con el láser **solo actualiza V1**, sin marcar. Antes de usarlo, confirmar que el láser convierte la URL completa en QR, no concatena texto fijo y el operador dispone de las protecciones. Confirmar mediante lectura del QR definitivo una vez marcado manualmente.

## Lista de validación

- Báscula estable, peso USB coincidente con visor; lectura inestable o desconectada no aparece.
- Registro de una pieza en Pesajes calidad; no se vuelve a registrar al preparar etiqueta.
- Preparar etiqueta genera un único trabajo; la repetición no imprime dos veces.
- Zebra imprime PDF de 100 x 150 mm con los datos correctos y QR legible.
- Láser acepta exactamente la misma URL QR en V1; **no se envía start:**.
- Fallo de Zebra y fallo del láser se registran independientemente; no hay repetición física automática ante incertidumbre.
- La ficha QR antigua abre con una cuenta autorizada; producción y stock de Holded no cambian.
- El endpoint de sincronización rechaza un token inválido; las funciones privadas siguen restringidas.

## Limitaciones

- Polling cada ~3 s; la medida es la última lectura estable publicada, no acceso USB directo del navegador. Vigilar las cuotas de Apps Script; limitar horas del servicio a turnos si procede.
- No hay sensor de confirmación de impresión, ni confirmación de QR físicamente marcado.
- La reimpresión automática tras errores inciertos se bloquea y requiere conciliación manual.
- Para la puesta en producción es necesario reforzar la seguridad de funciones del despliegue público, si la pantalla está accesible fuera del puesto. La acción de poner un trabajo en cola reutiliza el acceso público previo de pesaje y su exposición debe evaluarse antes de publicar.
- Es necesario comprobar el envío de la **URL completa** a V1 con el trabajo final. Las pruebas documentadas por el manual del láser acreditan el envío de ROTOFORMAS-PRUEBA-001 y la respuesta seta:1, no el marcado físico ni el QR final.
- La puesta en servicio requiere ensayos sobre los equipos. No inferir éxito de las tres comunicaciones independientes.

Fuentes: Manual_Bascula_USB_Raspberry_Pi_Rotoformas.pdf, Manual_Zebra_ZT231_Raspberry_CUPS_DGA.pdf, Manual_laser_Rotoformas_Raspberry_Pi.pdf, docs/CONTEXTO-MES.md.
