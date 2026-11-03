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

## Puente Raspberry Pi (rama de desarrollo)

La integración de báscula USB, impresión CUPS/Zebra y envío de URL QR a la variable V1 del láser se documenta en [Integración Raspberry](docs/INTEGRACION-RASPBERRY.md). Requiere instalación, configuración de secretos y validación física; no está desplegada por el hecho de existir en GitHub.
