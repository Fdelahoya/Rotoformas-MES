# Instrucciones de embalado en el MES

Implantadas el 27/11/2026, con código y guía en [embalado/](../embalado/README.md).
El catálogo existente conserva su distribución e imágenes. Sus 39 imágenes
apuntan a 38 páginas internas del mismo Google Sites, una por pieza; «Tobogán
Abierto - Salida» aparece dos veces en el catálogo original. Se añadió un destino
para «Tobera cañon 200», que antes no tenía enlace.

Al pulsar una imagen se abre la página interna en la misma pestaña y se conserva
el menú lateral del MES, igual que en las instrucciones de trabajo. Cada página
inserta la aplicación independiente de embalado con el ID exacto de pieza y
`mes=1`. Ese modo evita repetir la cabecera y aprovecha el ancho de la página.

Cada ficha muestra fotografía, nombre, cliente, «Parámetros de embalado»,
materiales, accesorios, soporte e identificación. Los campos están pendientes y
los pasos 1 a 6 quedan numerados en blanco hasta recibir los datos de embalado
para la entrega. No son un formulario editable ni definen todavía el método
autorizado de embalaje.

La aplicación es de solo lectura y su despliegue conserva acceso de dominio
(`DOMAIN / USER_DEPLOYING`). Requiere sesión Google de Rotoformas. No modifica
instrucciones de trabajo, pedidos, stock, pesajes ni equipos. El código principal
del MES y sus despliegues permanecen separados.

## Validación y alcance de Git

Se verificaron los 39 enlaces internos publicados y una apertura real desde el
catálogo: 14 pestañas antes y después, con el menú lateral visible y el contenido
de embalado correcto. Se eliminaron del menú principal las entradas auxiliares
de las fichas; se accede desde el catálogo. Pruebas locales: `node tests/embalado.cjs`.

El mapa de rutas y destinos está versionado en `embalado/site-pages.json`.
Git no administra el estado nativo de Google Sites: para reconstruirlo hay que
crear las páginas de inserción de página completa, ocultarlas del menú y elegir
sus referencias internas como destino de las imágenes. Los identificadores de
edición y despliegue quedan en el registro operativo privado. Fusionar esta PR
no vuelve a publicar Google Sites ni Apps Script.
