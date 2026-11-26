# Almacén de moldes

Inventario compartido de Rotoformas, integrado en el MES y en su menú lateral de
Google Sites. Se ejecuta en un proyecto independiente de Google Apps Script y usa
un archivo privado de Google Drive como única fuente de ubicaciones.

## Funciones

Catálogos de propietarios y tipos, códigos automáticos de molde, parámetros
opcionales, ubicaciones E1M1N1, entradas, salidas, traslados, etiquetas, CSV y
copias JSON. El menú horizontal usa #1c1c1c y la página es blanca, como el sitio MES.

## Permisos comprobados en el servidor

| Acceso | Operaciones |
| --- | --- |
| Consulta, sin sesión o cuenta no autorizada | Consultar fichas, ubicaciones e historial con los campos actor/person ocultos; etiquetas y CSV de consulta |
| Planta, cuenta Google acreditada y autorizada | Consulta y registro de entradas, salidas y traslados |
| Administración, cuenta Google acreditada y autorizada | Planta, catálogos, fichas, ubicaciones, exportación completa y restauración de copias |

No basta escribir un nombre o correo en la interfaz.
`Session.getActiveUser().getEmail()` acredita la cuenta y una lista explícita del
servidor concede el rol, por cuenta o por dominio exacto configurado. No se usa `getEffectiveUser()` ni se confía en roles,
identidades, fechas o historiales recibidos del navegador. Si Google no proporciona
identidad, la aplicación permanece en consulta. Los permisos se revisan en cada
operación, aunque la interfaz conserve controles de una sesión anterior.

Los movimientos guardan por separado `actor` (cuenta acreditada), `actorVerified`
y `actorRole`, frente a `person` (responsable declarado a mano). El servidor calcula
el movimiento y su fecha. Un registro antiguo sin marca de acreditación o un
movimiento importado aparece como histórico/importado sin acreditar. Restaurar una
copia no acredita sus autores: la restauración tiene su propia auditoría del servidor.

## Configuración de acceso

En **Configuración del proyecto > Propiedades del script** del proyecto independiente:

| Propiedad | Formato y finalidad |
| --- | --- |
| `WAREHOUSE_PLANT_USERS` | Array JSON de correos exactos autorizados para movimientos |
| `WAREHOUSE_ADMIN_USERS` | Array JSON de correos exactos de administración; incluye las capacidades de planta |
| `WAREHOUSE_PLANT_DOMAIN` | Dominio exacto autorizado para movimientos, sin @ ni comodines |
| `WAREHOUSE_ADMIN_DOMAIN` | Dominio exacto autorizado para administración; incluye planta |
| `WAREHOUSE_DATA_FILE_ID` | ID del archivo privado de datos; se crea en el primer guardado |

Las listas y dominios ausentes, vacíos o mal formados no conceden permisos. No se asignan roles
por defecto al propietario ni a ningún dominio. Configurar las listas con las cuentas
que apruebe el responsable; no guardar listas reales, propiedades ni credenciales
en Git. Por decisión expresa del propietario, la configuración publicada concede
planta y administración a todas las cuentas Google acreditadas de `rotoformas.com`:
ambas propiedades `WAREHOUSE_PLANT_DOMAIN` y `WAREHOUSE_ADMIN_DOMAIN` tienen ese valor.
Para restringir administración a personas concretas, retirar `WAREHOUSE_ADMIN_DOMAIN`
y configurar `WAREHOUSE_ADMIN_USERS`. Quitar un correo de una lista no revoca el
acceso si su dominio sigue autorizado.

El despliegue público ejecuta como propietario para mantener privado el archivo de
Drive. Google puede no devolver el correo del visitante en este modo. Dentro del
mismo Workspace suele estar disponible, pero hay que comprobarlo antes de habilitar
planta; si devuelve vacío o falla, no se habilita escritura. No sustituir esa
comprobación por un correo enviado desde el cliente ni por la cuenta efectiva del
propietario. Véase la [documentación de Session](https://developers.google.com/apps-script/reference/base/session).

## Código y generación

- `dist/`: fuentes de interfaz y modelo; `access-client.js` controla la presentación
  de capacidades. Las comprobaciones que autorizan operaciones están en el servidor.
- `google/Backend.gs`: permisos, lectura, movimientos, administración y restauración.
- `build-google.cjs`: genera los HTML y el modelo del servidor en `google/`.
- Resto de `google/`: salida generada que se conserva para revisión y publicación.
- `check.cjs`, `check-google.cjs`: pruebas aisladas, sin red ni datos reales.

La interfaz de `dist/app.js` es una base local de generación. La versión compartida
y con roles es `google/`; no servir `dist/` como sustituto del servidor autenticado.

Desde la raíz del repositorio:

```text
node almacen-moldes/build-google.cjs
node tests/warehouse.cjs
node tests/warehouse-menu.cjs
```

La integración continua regenera `google/` y comprueba que coincide con Git.

## Publicación y cambios posteriores

La corrección se publicó el 26/11/2026: almacén versión 9 y gestión MES versión 78,
conservando los despliegues existentes. Se comprobó en consulta que la cuenta
corporativa recibe administración. Las pruebas de movimientos y restauración usan
inventario ficticio; no se realizaron esas operaciones sobre datos reales.
Fusionar la PR no vuelve a publicar Apps Script automáticamente.

El almacén es un proyecto independiente del MES. Crear localmente
`almacen-moldes/.clasp.json` (ignorado por Git) con:

```json
{
  "scriptId": "1DUcBjAA6saWvfyMrMxiWTnBnnly3QHrCyJyPfrVYeoZmx2FuD6AarmHb",
  "rootDir": "google"
}
```

Tras generar y comprobar, ejecutar `clasp push` desde `almacen-moldes/` y actualizar
el despliegue existente del almacén, conservando su ID:

```text
clasp deploy -i AKfycbxDTssDa-o1lOQ75n55Dh-zc_Wq_Sz1KNsiXGAMOSbWoOcz8t_tQkRAFKn015Bxfw -d "Permisos de consulta, planta y administración"
```

El manifiesto sigue siendo ANYONE_ANONYMOUS / USER_DEPLOYING para la consulta pública;
esto **no autoriza escritura**: los métodos de servidor aplican los roles. No copiar
este manifiesto al proyecto de producción/pesaje. La lista cerrada `.claspignore`
de la raíz conserva separados ambos proyectos.

## Datos y copias

El límite de esta versión es 8 MB, incluida la auditoría. Bloqueo de script y revisión
impiden sobrescribir cambios ajenos. Actualizar inventario recarga la consulta.
Un error de lectura no crea un inventario vacío. Solo administración exporta copias
completas y restaura. La restauración conserva antes un respaldo de Drive y una
entrada de auditoría; si no se puede crear el respaldo, no se escribe el inventario.
El CSV público es una exportación de consulta, no una copia administrativa.

La relación con Instrucciones de trabajo y las pruebas de aceptación están en
[Almacén de moldes del MES](../docs/ALMACEN-MOLDES.md).
