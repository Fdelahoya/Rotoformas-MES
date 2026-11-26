# Almacén de moldes en el MES

## Alcance de esta PR

Código completo del proyecto independiente de Apps Script, entrada en el menú del
MES y documentación de la página ya creada en Google Sites. La revisión solicitada
por Fidel separa consulta, planta y administración y añade pruebas con inventario
ficticio. No se han ejecutado escrituras ni restauraciones sobre el inventario real.

## Accesos y navegación

Página de primer nivel del menú lateral izquierdo de Google Sites, debajo de
Instrucciones de trabajo:

https://sites.google.com/rotoformas.com/estandarizacion/almac%C3%A9n-de-moldes

La página incrusta la herramienta con `?mes=1`. También hay una pestaña con carga
diferida en Producción y trazabilidad. Ambos accesos y la pantalla completa usan
el mismo inventario:

https://script.google.com/macros/s/AKfycbxDTssDa-o1lOQ75n55Dh-zc_Wq_Sz1KNsiXGAMOSbWoOcz8t_tQkRAFKn015Bxfw/exec

La navegación de Google Sites se configuró en su editor; Git no publica ese sitio.
El modo integrado oculta la marca duplicada. Se conservan menú horizontal compacto,
fondo #ffffff y menú #1c1c1c. El resto del MES conserva sus permisos y despliegues.

## Permisos y trazabilidad

- Consulta pública sin sesión. La respuesta pública omite las identidades y los
  nombres de responsables del historial; no expone la auditoría administrativa.
- Movimientos solo para una cuenta Google acreditada autorizada por lista o dominio de planta,
  o una cuenta de administración. `warehouseRecordMovement` acepta la intención y
  calcula en servidor ubicación, historial, fecha e identidad. No acepta estado ni
  identidad acreditada del cliente.
- Administración para editar catálogos/fichas/ubicaciones, exportar copias completas
  o restaurarlas. `warehousePutState` no permite cambiar ubicaciones ni historiales
  por esa vía. `warehouseRestoreBackup` y la antigua variante de restauración
  comprueban administración antes de acceder al archivo.
- Permisos comprobados de nuevo en cada llamada, con denegación por defecto.
  La configuración está en propiedades del servidor, nunca en el inventario importado.
- El historial distingue `actor`/`actorVerified`/`actorRole` (identidad acreditada por
  Google en esa operación) de `person` (responsable escrito a mano). Las copias
  importadas no acreditan autores históricos. La restauración deja una auditoría
  independiente con la cuenta de administración y la revisión anterior.

Configuración, restricciones de identidad de Apps Script y despliegue:
[almacen-moldes/README.md](../almacen-moldes/README.md). No se crean cuentas Google.
Por decisión expresa del propietario, todas las cuentas acreditadas de
`rotoformas.com` reciben planta y administración, incluida restauración de copias.
Se configuraron ambas propiedades de dominio del servidor. Los roles siguen
separados en código y pueden restringirse después. Si Google no facilita el correo
o no hay una regla válida, solo se permite consulta; no se usa la identidad del
propietario como sustituto.

## Relación real con Instrucciones de trabajo

**Actualmente solo comparten el menú de Google Sites.** Las páginas de Instrucciones
de trabajo no llaman al almacén, no leen su ubicación ni se actualizan al mover un
molde. Las notas de las OF del MES tampoco constituyen ese enlace. Esta PR no
rehace instrucciones ni añade una integración que no existe.

El molde ya tiene un identificador único `mold.id`, distinto del código visible
(CLI-DEP-001) y de la ubicación (E1M1N1). La edición de fichas y los movimientos
conservan ese ID. Para una futura integración, la instrucción guardaría únicamente
la referencia a ese ID y consultaría la ubicación actual del almacén. No se
copiaría una ubicación dentro de la instrucción ni se resolvería por nombre libre.

Ejemplo ficticio del flujo futuro, todavía no implantado:

1. Molde `id=mold-unique-001`, código CLI-DEP-001, ubicado en E1M1N1.
2. Una instrucción referencia `mold-unique-001`; al abrirla consulta el almacén y
   muestra E1M1N1. El texto de la instrucción no contiene una copia de la ubicación.
3. Planta registra un traslado a E1M2N1 con el mismo ID. Solo cambia el almacén.
4. Al abrir de nuevo la instrucción se resuelve ese mismo ID y se muestra E1M2N1.
   Si no existe el ID o la consulta falla, se indica que no se puede localizar el
   molde; no se usa una ubicación copiada o antigua.

Este diseño se limita a documentar el vínculo futuro y la fuente única; no se ha
modificado el contenido de ninguna instrucción real.

## Validación y puesta en servicio

- `node tests/warehouse.cjs`: inventario ficticio con consulta sin sesión, rechazo
  de todas las escrituras anónimas y de cuentas no autorizadas, movimientos de
  planta, revocación de permisos, configuración inválida y restauración solo admin.
- Intenta falsificar identidad/rol/fecha, mover por el método de administración y
  reescribir historial; verifica que el servidor rechaza los atajos o ignora esos
  datos del cliente. Comprueba auditoría, copias previas, conflictos y errores.
- El mismo molde conserva su ID y cambia de ubicación tras el traslado ficticio.
- `node tests/warehouse-menu.cjs`: carga diferida, navegación y sintaxis del MES.
- CI regenera los HTML y ejecuta las pruebas existentes del repositorio.

La corrección se publicó el 26/11/2026: almacén v9 y gestión MES v78, conservando
las URLs y los permisos del resto del MES. Se verificó visualmente el acceso de
administración con la cuenta corporativa. Las escrituras y restauraciones se
validaron con inventario ficticio, sin ejecutar esas operaciones en el real.
