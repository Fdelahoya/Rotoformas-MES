# Entretenium: preparación de gestión por lotes

9 de noviembre de 2026. Estado: diagnóstico realizado y migración preparada; **no ejecutada**.

Alcance autorizado: versiones -N y -M de BOCA SALIDA, CODO 30, CODO 90, PANEL, TOBOGAN ENT, TOBOGAN INF, TOBOGAN SAL, TOBOGAN SUP, TRAMO R y TUBO T. Son veinte SKU en diez familias con variantes, etiqueta ET.

El usuario excluye expresamente del marcado y de la OF los productos menores del pedido SO260208: ARO-M, SEMIROD B-M, SEMIROD B-N, SEMIROD A-M y SEMIESF 30-M.

## Diagnóstico

- Stock leído: PANEL-N 15 unidades, PANEL-M -6 unidades; los otros dieciocho SKU, cero.
- Peso, precios, costes, etiquetas y almacén se copian por variante.
- El pedido SO260208 contiene identificadores de las familias y variantes originales, además de SKU. El MES agrupa por SKU; después de la migración hay que comprobar el pedido y sus enlaces en Holded, especialmente antes de generar un albarán. No se deben dar esos enlaces por migrados automáticamente.
- El procedimiento anterior elimina cada familia y recrea sus variantes como productos independientes con lotes. Cambian los identificadores; la copia de datos no restaura sus identificadores originales.
- La API de alta utilizada no restaura automáticamente imágenes, campos de categoría ni IVA de compra. BOCA SALIDA tiene IVA de compra configurado. Estos campos requieren revisión posterior; el sufijo N/M permanece.

## Ejecución preparada

`MigrationEntretenium.gs` conserva los helpers de las migraciones previas. `previewMigrationEntretenium` consulta Holded y guarda la copia íntegra en propiedades privadas fragmentadas (`ENT_PREVIEW_*`). No exporta credenciales. `validateMigrationEntretenium` compara las diez familias actuales con la copia, sin escrituras en Holded.

`migrateEntreteniumToLots` es destructiva: solo ejecutarla tras la confirmación del borrado irreversible. Valida todas las familias antes de modificar la primera, bloquea concurrencia y registra operaciones e identificadores en `ENT_MIGRATION_JOURNAL`. Ante un fallo se detiene; no permite repetir ciegamente una ejecución parcial. Una respuesta de red ambigua exige inspección antes de recuperar.

Tras la ejecución: verificar los veinte productos y saldos, sincronizar Holded Raw, comprobar SO260208 en Pedidos pendientes (con productos menores excluidos), revisar enlaces de documentos y campos no copiados. Crear la OF sigue siendo un paso separado.

Prueba: `node tests/entretenium-migration.cjs` comprueba lista exacta, preservación de stock negativo, cambios desde el diagnóstico, detención y diario ante fallos y prevención de duplicados. No modifica Holded.

El código de preparación está en HEAD de Apps Script. No se han cambiado versiones publicadas ni URLs de las aplicaciones.
