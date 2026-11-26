# Almacén de moldes

Herramienta de inventario compartido integrada en el MES de Rotoformas. Se ejecuta
en un proyecto de Google Apps Script independiente; conserva su propio archivo
privado de datos en Google Drive.

## Funciones

- Catálogos de propietarios y tipos con abreviaturas únicas.
- Código automático de molde: propietario-tipo-número, por ejemplo ACM-DEP-001.
- Estanterías, módulos y niveles: E1M1N1. Varios moldes pueden compartir ubicación.
- Referencia y parámetros técnicos opcionales de cada molde.
- Entradas, salidas, traslados y retorno al almacén con historial y responsable.
- Etiquetas de texto imprimibles, exportación CSV y copias completas JSON.
- Bloqueo de escrituras y revisión del inventario para evitar sobrescribir cambios
  guardados por otra persona. El botón Actualizar inventario recarga la vista.

## Acceso y presentación

Por instrucción expresa del propietario, cualquier persona con el enlace puede
consultar y editar sin iniciar sesión. No es una aplicación restringida al dominio.
La cuenta de Google se registra cuando está disponible; de lo contrario aparece
Invitado. El nombre de responsable introducido no implica identidad verificada.

El menú es horizontal y compacto, con fondo #1c1c1c como el menú lateral del sitio
MES. La página es blanca y mantiene la tipografía Arial. El encabezado independiente
es ROTOFORMAS. `?mes=1` muestra el modo integrado sin duplicar la marca del sitio.

## Código

- `dist/index.html`, `style.css`, `app.js`, `model.js`: fuentes de interfaz y modelo.
- `build-google.cjs`: genera los archivos HTML y el modelo de servidor para Google.
- `google/Backend.gs`: lectura/escritura del inventario, revisiones e historial.
- `google/appsscript.json`: manifiesto del proyecto independiente.
- Resto de `google/`: salida generada que se conserva para revisar y publicar.
- `check.cjs` y `check-google.cjs`: pruebas locales sin red, datos reales ni equipos.

La interfaz de `dist/` es la base de generación. La versión desplegada es la salida
de `google/`, que guarda los datos compartidos en el servidor; no usa localStorage.

## Comprobar y generar

Desde la raíz del repositorio:

```text
node almacen-moldes/build-google.cjs
node tests/warehouse.cjs
node tests/warehouse-menu.cjs
```

La integración continua regenera `google/` y comprueba que coincide con lo registrado.

## Publicación

El proyecto del almacén es **independiente del proyecto del MES**. Crear localmente
`almacen-moldes/.clasp.json` con la configuración siguiente; no añadirla a Git:

```json
{
  "scriptId": "1DUcBjAA6saWvfyMrMxiWTnBnnly3QHrCyJyPfrVYeoZmx2FuD6AarmHb",
  "rootDir": "google"
}
```

Tras generar y comprobar, ejecutar `clasp push` desde `almacen-moldes/` y actualizar
el despliegue existente del almacén. Conservar su ID para que el menú del MES y
Google Sites sigan abriendo el mismo inventario:

```text
clasp deploy -i AKfycbxDTssDa-o1lOQ75n55Dh-zc_Wq_Sz1KNsiXGAMOSbWoOcz8t_tQkRAFKn015Bxfw -d "Descripción del cambio"
```

Se ejecuta como propietario con acceso ANYONE_ANONYMOUS y permite incrustación.
No subir estos archivos al proyecto de producción/pesaje ni copiar su manifiesto.
La raíz del repositorio mantiene su lista propia de archivos en `.claspignore`.

## Datos y límites

El ID del archivo de datos se guarda en la propiedad de script
`WAREHOUSE_DATA_FILE_ID`. No copiar propiedades ni datos reales al repositorio.
El archivo se crea en el primer guardado; un error de lectura no lo reemplaza por
un inventario vacío. El límite de esta versión es 8 MB por inventario.

Importar una copia JSON sustituye el inventario compartido para todos los usuarios
y conserva antes una copia del archivo en Drive. Exportar el inventario periódicamente.
No hay actualización automática en tiempo real: usar Actualizar inventario.

Los enlaces de acceso y la configuración del menú principal están documentados en
[Almacén de moldes del MES](../docs/ALMACEN-MOLDES.md).
