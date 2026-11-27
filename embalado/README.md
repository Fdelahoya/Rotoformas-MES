# Instrucciones de embalado

Aplicación independiente y de solo lectura, integrada en Google Sites mediante
38 páginas internas de inserción de página completa. Las 39 imágenes del catálogo
enlazan a referencias internas de página, conservando la pestaña y el menú lateral.
El catálogo original contiene dos imágenes con destino Tobogán Abierto - Salida.

Cada ficha conserva fotografía, nombre y cliente, con «Parámetros de embalado»,
materiales, accesorios, soporte e identificación pendientes. Los pasos 1 a 6 están
vacíos hasta recibir y validar las instrucciones reales de entrega.

## Archivos y reproducción

- `src/Code.gs`: selección exacta de pieza con `?p=ID` y modo integrado `mes=1`.
- `src/Ficha.html`: plantilla compartida; el modo integrado evita repetir la cabecera.
- `catalog.json` e `images/`: 38 piezas y sus fotografías JPEG. La construcción
  integra las imágenes en el código de Apps Script. Proceden del catálogo
  de trabajo ya publicado; así no dependen de las URLs temporales de Google Sites.
- `site-pages.json`: rutas de 38 páginas y correspondencia de las 39 imágenes.
  Excluye identificadores de edición y direcciones privadas de despliegue.

Desde la raíz del repositorio:

```sh
node embalado/build.cjs
node embalado/test.cjs
```

La salida `embalado/dist/` contiene únicamente los tres archivos de Apps Script
y su lista de subida. No ejecutar una subida del MES principal para instalar esto.
El manifiesto de este proyecto separado conserva `DOMAIN / USER_DEPLOYING` y no
solicita acceso a hojas, Drive, Holded ni equipos. La inserción requiere iniciar
sesión con una cuenta del dominio Rotoformas.

## Mantenimiento y despliegue

La versión publicada de referencia es v3, del 27/11/2026. Esta PR incorpora las
fuentes reproducibles de esa versión; fusionarla no publica cambios en Google.
El ID del proyecto y la URL de implementación se conservan en el registro operativo
privado. Configurar localmente clasp dentro de `dist/`, revisar sus archivos y
subir exclusivamente al proyecto de embalado. Conservar la implementación web
existente, su identidad y acceso de dominio al publicar una versión nueva.
Los archivos `.clasp.json` y `.clasprc.json` no se versionan.

En Google Sites, cada página de `site-pages.json` inserta la URL de la aplicación
de embalado con `?p=ID&mes=1`. Mantener las páginas ocultas en la navegación y
seleccionarlas como destino interno de las imágenes del catálogo. Pegar el enlace
externo de Apps Script en la imagen vuelve a abrir otra pestaña. Publicar Sites
y comprobar cada destino; el código de Apps Script no modifica ni publica Sites.

Para completar una ficha, extender sus datos por pieza y la plantilla compartida;
los campos actuales son espacios de presentación, no un formulario de guardado.
No introducir cantidades, métodos o parámetros sin los datos del responsable.

## Validación

La prueba local construye la aplicación, renderiza las 38 fichas en modo integrado
y comprueba selección exacta, fotografías, seis pasos, escape del texto, rechazo
de ID desconocido, mapa de 39 enlaces y permisos del manifiesto. La comprobación
visual publicada del 27/11/2026 verificó los 39 destinos internos y la apertura de
una ficha conservando 14 pestañas antes y después, con el menú lateral del MES.
Esta evidencia corresponde a la sesión autenticada; no valida acceso anónimo.
No se cambian instrucciones de trabajo, stock, pedidos ni equipos.
