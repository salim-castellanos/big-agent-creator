---
id: E-001
module: 02-despliegue
---

# Épica E-001 — Ver el agente local

Después de Iniciar, la persona ve si el agente arrancó, cómo se llama y qué está haciendo el contenedor.

## Por qué este módulo

dominio. Un botón que no cambia de estado no dice si el agente está en marcha.

## Features

| Feature | Outcome |
| --- | --- |
| F-001 Local | Ship muestra en marcha o falló, el nombre, CPU, memoria, latencia y un log que se filtra sin tapar los controles. |

## Fuera de la épica

Desplegar en AWS, GCP, Azure o Kubernetes. Un segundo recolector de telemetría.

## Runbook

[002-ship-local](../../../07-runbooks/002-ship-local/runbook.md)
