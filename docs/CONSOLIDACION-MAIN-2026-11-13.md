# Consolidación de las mejoras en main

## Contenido reunido

La consolidación parte de main `c78f8b84cc7c480861fff2984353eaf2d9468984` e integra la rama `reconcile/raspberry-safe-2026-11-04`, cuyo último commit es `9f5446bf22504c210e4313b6e8578a10846a4d02`. Esta rama ya contiene íntegramente el historial de `feat/raspberry-balanza-zebra-laser` (`9a1e9af7190726b35ded44fe0be45c15d2641c18`). Se conservan los dos historiales mediante los padres del commit de consolidación.

Los archivos comunes conservan las ampliaciones posteriores de main: OF por pedido y SKU, materias primas por línea, acceso de invitados, enlaces cortos y controles administrativos. La integración incorpora el agente Raspberry, los instaladores, los perfiles de dependencias y las pruebas que aún estaban en la rama de conciliación. Los documentos históricos conservan la versión pública más reciente de main.

También se incluyen las mejoras trabajadas después:

- Ventana de etiqueta compacta, con acciones visibles antes de la vista previa.
- Ventana de pesaje con botones separados del contenido desplazable.
- Lectura USB al abrir con Pesar y al pulsar el botón interior; hasta tres consultas, con control de caducidad y cancelación al editar o cerrar. La lectura no guarda automáticamente un pesaje.
- Contador de fabricadas a partir de pesajes CONFORME y ALERTA, agrupados por OF, SKU y lote terminado. NO CONFORME no suma. Los números de pieza duplicados no se cuentan dos veces.
- Contador limitado al objetivo de cada modelo. Se conservan los pesajes históricos sobrantes.
- Validación al guardar, dentro del bloqueo del documento, que impide añadir otra pieza aceptada cuando ya se alcanzó el objetivo. Los rechazos pueden registrarse para conservar el historial.
- Puente compatible con enlaces QR cortos y comprobación del contenido B1 después de actualizar V1; no inicia el marcado.
- Fuentes y pruebas del servicio PHP de enlaces cortos, con configuración de ejemplo. Se controla la carrera entre dos primeras peticiones que intenten crear su directorio privado.

## Separación de producción y stock

El contador de pantalla no escribe filas en Fabricaciones OF ni modifica stock. Las funciones base de lectura de fabricaciones y reparto por turno permanecen iguales a main. Los pesajes y partes de turno no se suman entre sí para calcular el contador.

## Publicación y acceso

Las mejoras de contador y límite están publicadas en Apps Script versión 76 en planta y gestión; se verificó el resultado mediante sus páginas reales. La lectura USB y el tamaño de las ventanas ya estaban publicados. Guardar esta consolidación en GitHub no vuelve a desplegar Apps Script, Raspberry ni el servicio PHP.

Se mantiene el manifiesto compartido sin imponer una configuración web pública: las implementaciones privada y pública se administran por separado conservando sus permisos y direcciones. La selección de clasp incluye todos los archivos fuente de Apps Script de la versión consolidada, incluidos MultiPieceOrders, ShortLinks y MigrationEntretenium.

No se incluyen credenciales, propiedades privadas, bases de datos, registros de producción ni capturas de información interna.

## Comprobaciones

- 13 suites Node superadas: migración, OF multilínea, materias primas, QR invitado, seguridad, integración de equipos, USB y límite de fabricadas.
- 27 pruebas Python del agente y su actualizador QR superadas, con equipos simulados.
- 7 pruebas del servicio PHP superadas, incluido registro concurrente de lotes y recuperación del mismo enlace.
- El flujo de GitHub Actions ejecuta las pruebas en main y en solicitudes de integración, con Python 3.7 y 3.11.
- Las verificaciones locales usan Node 26 y Python 3.15; las versiones de Raspberry se comprueban mediante el flujo de GitHub.

## Ajuste HDMI comunicado para la Raspberry

El equipo informa Raspbian 10 Buster, `dtoverlay=vc4-fkms-v3d` y `disable_overscan=0`. Se indicó guardar una copia de `/boot/config.txt`, cambiar a `disable_overscan=1` y reiniciar cuando no hubiera operaciones de pesaje o impresión. No se ha recibido todavía confirmación de ejecución ni del resultado visual. Este ajuste pertenece al equipo, no al código del MES.
