# Rotoformas MES

Sistema MES desarrollado para Rotoformas S.L.

## Documentación para continuar el desarrollo

El [contexto vivo del MES](docs/CONTEXTO-MES.md) recoge las reglas vigentes, arquitectura, accesos, despliegues, integración de equipos y pendientes. Es el punto de entrada para desarrolladores y asistentes de IA. Actualizarlo junto con los cambios funcionales; las copias en proyectos de ChatGPT son instantáneas.

La [guía de OF con varias piezas](docs/OF-VARIAS-PIEZAS.md) explica cómo crear una OF por pedido, pesar cada modelo y conservar su trazabilidad.

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

## QR de lotes y equipos

- [Índice de documentación](docs/README.md).
- [Trazabilidad y QR](docs/TRAZABILIDAD-QR.md): invitados, empresa, foto Holded, etiquetas Zebra, variable V1 y recuperación de QR PRUEBA.
- [Enlaces cortos](docs/ENLACES-CORTOS.md): qr.rotoformas.com, DNS de Sulime, alojamiento Raiola, HTTPS, API privada, permanencia por lote y copias de seguridad.
- [Equipos operativos](docs/EQUIPOS-OPERATIVOS-2026-11-05.md): Raspberry, báscula USB, CUPS y láser, con las comprobaciones fechadas y sus límites.

Los QR de un lote comparten un enlace permanente. El invitado accede sin contraseña a la ficha reducida y la cuenta autorizada conserva la trazabilidad completa. La preparación de etiqueta no mueve stock; el marcado del láser sigue siendo manual.
