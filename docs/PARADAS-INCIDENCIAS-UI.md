# Paradas e incidencias — prototipo de interfaz

Fecha: 28/10/2026. Actuación 2. Estado: **solo interfaz, sin backend**.

## Acceso y alcance

Se añade un panel a `PlantWeightPage.html`, la vista pública de producción
(`?modo=pesaje`) incrustada en Google Sites. Está disponible sin cuenta de Google
en la implementación pública existente; no se modifican permisos, enlaces QR ni
la aplicación administrativa.

Dos botones grandes abren un diálogo accesible: **Parada** e **Incidencia**.
Campos: operario (lista alfabética actual), fecha/hora local del dispositivo,
máquina/zona, OF abierta opcional, motivo y descripción. Parada añade duración
estimada opcional. Los motivos son propuestas de UI pendientes de validación.
La OF reutiliza la lista ya cargada por pesaje, sin nueva consulta. El formulario
también se puede probar si no hay OF o falla la carga de órdenes.

**Ver resumen de prueba** valida los campos requeridos y muestra un resumen
escapando el texto introducido. No se presenta como guardado ni enviado. Cerrar
o recargar descarta la información. Modificar un campo oculta el resumen anterior.

## Límites explícitos

- Sin llamadas al servidor desde el prototipo, hojas nuevas, persistencia local,
  registros compartidos, notificaciones ni cronómetros.
- Sin cambios en `applyStockMovements()`, consumos, producción, pesajes, OF o KPIs.
- El nombre elegido no acredita identidad; no es autenticación.
- La UI avisa que se debe mantener el procedimiento habitual de comunicación.
- No constituye un registro operativo de incidencias ni evidencia de que ese
  requisito de la actuación 2 esté completamente implantado.

## Siguiente fase, después de aprobar el diseño

Definir catálogo real de máquinas/zonas y motivos, eventos de inicio/cierre de
parada, responsable y estados de resolución; persistencia, identificador único,
validación de servidor, prevención de duplicados/abuso en acceso público,
historial y permisos de consulta. Acordar luego los indicadores y alertas.

## Verificación

Publicado como versión 48 de Apps Script en el despliegue público existente
`AKfycbwZgzx_rFiDZ2ru8hsrmqnAIQO3WypJeGZXRTZpKL9uxQkvsrvvnSdrJ-7dG59qC9Hbsw`.
Se mantiene ejecutar como propietario y acceso «Cualquier usuario». Las
implementaciones privadas y las URLs QR no se actualizan.

Para revertir exclusivamente la pantalla publicada, seleccionar la versión 36
en **Gestionar implementaciones**, sin cambiar el ID ni permisos. La versión 46
no contenía la UI nueva (copia anterior del editor); se verificó el contenido de
la versión 48 descargándolo antes de publicarlo. No usar `clasp deploy -i`.

Se comprueban sintaxis, apertura de ambos diálogos, formulario sin OF, resumen
escapado y ausencia de llamadas de escritura del prototipo. Prueba visual de
campos obligatorios, cierre y uso desde el acceso público, sin registrar pesajes
ni modificar datos de producción.

Prueba de regresión local: `node tests/plant-events-ui.cjs` desde la raíz del repo.

Comprobación final: respuesta HTTP 200 sin cookies/sesión, con el texto del nuevo
panel; panel visible en Google Sites y diálogo de incidencia abierto/cerrado en
la aplicación publicada. No se registraron pesajes ni incidencias de prueba.

Las capturas de comprobación se conservan localmente, no se publican en el
repositorio para evitar incluir información interna visible en el entorno.

## Texto para la memoria

Se ha preparado una interfaz de paradas e incidencias integrada en la pantalla
pública de producción, con formularios diferenciados y selección de operario,
zona, motivo y orden de fabricación opcional. Esta fase permite validar la
usabilidad con el equipo de planta. El almacenamiento, seguimiento de las
incidencias y cálculo de tiempos de parada quedan pendientes de conexión al
backend; el prototipo no genera todavía registros operativos ni avisos.
