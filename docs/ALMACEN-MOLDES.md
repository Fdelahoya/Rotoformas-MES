# Almacén de moldes en el MES

Implementación incorporada al repositorio el 26/11/2026. El almacén se mantiene
como proyecto de Apps Script independiente con su propio inventario compartido.

## Acceso en el menú principal

Se creó y publicó la página de primer nivel **Almacén de moldes** en el menú
lateral izquierdo de Google Sites, debajo de Instrucciones de trabajo:

https://sites.google.com/rotoformas.com/estandarizacion/almac%C3%A9n-de-moldes

La página incrusta directamente la herramienta con `?mes=1`. Usa el mismo
inventario que el enlace independiente:

https://script.google.com/macros/s/AKfycbxDTssDa-o1lOQ75n55Dh-zc_Wq_Sz1KNsiXGAMOSbWoOcz8t_tQkRAFKn015Bxfw/exec

La publicación en Google Sites se realizó desde su editor. Git conserva el código
y estas instrucciones, pero no modifica ni publica automáticamente Google Sites.
Para reconstruir esa navegación, añadir una página visible de primer nivel con el
nombre anterior e insertar la URL del almacén con `?mes=1`, en un bloque de ancho
completo y altura suficiente para trabajar.

## Acceso desde Producción y trazabilidad

`LotsWebAppPage.html` añade también una pestaña **Almacén de moldes** y una vista
incrustada. Se carga únicamente al abrir esa pestaña. Al cambiar de apartado, la
vista permanece cargada y conserva el formulario. El botón Abrir en pantalla
completa abre el mismo inventario en otra pestaña.

La integración fue publicada en gestión v77 conservando sus permisos
DOMAIN / USER_ACCESSING. El almacén independiente se publicó en v8. Las restantes
funciones y los permisos de producción, pesajes y consulta QR se conservan.

## Funciones y aspecto final

- Catálogos de propietarios y tipos, códigos automáticos y parámetros opcionales.
- Ubicaciones por estantería, módulo y nivel, como E1M1N1.
- Entradas, salidas y traslados con historial y responsable.
- Consulta del inventario, etiquetas y exportaciones CSV/JSON.
- Menú horizontal compacto, de color #1c1c1c, y fondo blanco #ffffff.
- Cabecera ROTOFORMAS sin el prefijo R/. En modo integrado se oculta la marca
  duplicada y se mantiene el submenú del almacén.

## Acceso público solicitado

El propietario solicitó explícitamente que cualquier persona con el enlace pueda
consultar y editar sin cuenta de Google ni ChatGPT. El manifiesto independiente
usa ANYONE_ANONYMOUS / USER_DEPLOYING; el servidor permite invitados y la vista
admite incrustación. La identidad Google es opcional y figura como Invitado si no
está disponible. El responsable declarado del movimiento no es una identidad
verificada. Esto sustituye la restricción inicial a rotoformas.com y no amplía
los permisos del resto del MES ni de la página de Google Sites.

## Código y almacenamiento

El código completo y los pasos de generación/publicación están en
[almacen-moldes](../almacen-moldes/README.md). La carpeta se excluye de la subida
del proyecto principal mediante la lista cerrada existente en `.claspignore`.
El almacén se publica por separado; no copiar su manifiesto al MES.

El inventario se guarda en un archivo privado de Drive del propietario del script.
Lecturas y escrituras pasan por la aplicación pública. Se conserva el mismo archivo
y no se duplican datos al abrir desde distintas páginas. Se usan bloqueo de script,
revisión de inventario y rechazo de guardados basados en una revisión antigua.
Las importaciones conservan antes un respaldo en Drive. El límite es 8 MB.

## Validación

- `node tests/warehouse-menu.cjs`: menú, carga diferida, retorno sin recarga,
  conservación de la navegación previa y sintaxis del cliente del MES.
- `node tests/warehouse.cjs`: códigos, ciclo de movimientos, copias, acceso público,
  lectura compartida, conflictos de revisión y conservación del historial.
- La integración continua regenera los HTML del almacén y exige que coincidan
  con los archivos registrados, además de ejecutar las pruebas existentes del MES.
- Se comprobó visualmente la página publicada de Google Sites, la opción del menú
  lateral y la herramienta incrustada. La vista del almacén respondió HTTP 200
  sin cookies. No se introdujeron moldes ni movimientos ficticios en producción.
