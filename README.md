# Rotoformas MES

Sistema MES desarrollado para Rotoformas S.L.

## Documentación para continuar el desarrollo

El [contexto vivo del MES](docs/CONTEXTO-MES.md) recoge las reglas vigentes, arquitectura, accesos, despliegues, integración de equipos y pendientes. Es el punto de entrada para desarrolladores y asistentes de IA. Actualizarlo junto con los cambios funcionales; las copias en proyectos de ChatGPT son instantáneas.

## Funcionalidades actuales

- Captura de producción mediante Google Forms
- Resumen diario de producción
- Histórico de producción
- Cálculo de márgenes
- Integración con Holded
- Actualización automática de stock
- Consumo automático de materias primas
- Gestión de variantes (Natural / Masa)
- Consumos especiales (insertos, pigmentos, etc.)

## Tecnologías

- Google Apps Script
- Google Sheets
- Holded API
- Git
- clasp
- prueba

## Estado

Proyecto en desarrollo activo.

## Puente Raspberry Pi

El usuario ha confirmado el funcionamiento de báscula USB, impresión automática Zebra y actualización del QR del láser mediante V1 el 5/11/2026. Consulta la [configuración operativa y los pasos de instalación](docs/EQUIPOS-OPERATIVOS-2026-11-05.md). El marcado sigue siendo manual. Las instrucciones históricas están en [Integración Raspberry](docs/INTEGRACION-RASPBERRY.md); guardar código en GitHub no configura ni despliega otro equipo automáticamente.
