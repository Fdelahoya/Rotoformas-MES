# Rotoformas MES - Registro de funcionalidades

Este documento recoge las funcionalidades implementadas en el MES de Rotoformas.

---

# F-001 - Soporte para Portatapas Oval2000

**Estado:** ✅ Completada

**Fecha:** 28/08/2026

## Objetivo

Añadir soporte para el nuevo producto de Contenur:

SKU:

PORTATAPAS OVAL2000

## Consumos

| Material | Consumo |
|----------|---------:|
| PE NATURAL | 15 kg |
| INSERTO V4 | 20 ud |
| PIG301 | 0,90 kg |

## Archivos modificados

- Stock.gs

## Observaciones

El consumo de PE Natural no requiere lógica específica, ya que se calcula automáticamente a partir del peso indicado en el Resumen.

## Prueba de aceptación

Fabricando 2 unidades:

- FG → +2
- PE NATURAL → -30 kg
- INSERTO V4 → -40 ud
- PIG301 → -1,8 kg