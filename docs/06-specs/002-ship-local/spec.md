---
id: 002-ship-local
title: Estado del agente local
status: implemented
hu: HU-001
runbook: 002-ship-local
supersedes:
superseded-by:
---

# Spec 002 — Estado del agente local

## Insumos

- HU: `docs/05-backlog/02-despliegue/E-001-panel/F-001-local/HU-001-estado.md`
- Línea base: `docs/linea-base.md`
- Gates: constitución I. El valor no entra en la imagen ni en el log.

## Contexto

Ship ya construye la imagen local. El estado se leía con una expresión que solo reconocía `"State":"running"`. Si el arranque fallaba, la fase volvía a idle y la etiqueta decía Detenido.

## In scope

Estado en marcha o falló, nombre del agente, CPU, memoria, latencia del playground, log con búsqueda, tipo y fechas, dentro del panel y con su propio scroll.

## Tablero

No aplica.

## Out of scope

Desplegar en nube. Inventar un contador de peticiones que el proceso no expone. Parchear OpenTelemetry.

## Comportamiento

- WHEN `docker compose ps --format json` trae `State` o `Status` `running`, o un `Status` que empieza por `Up` THEN el agente está en marcha y el botón dice En marcha y no se puede pulsar otra vez. Actualizar vuelve a leer la máquina y muestra ese estado. Vale una línea JSON o un arreglo.
- IF Iniciar o Reconstruir termina y el contenedor no está en marcha THEN `failed` es verdadero y el resumen es `The container is not running. Read the log.`
- IF el comando de Docker devuelve error y el daemon sí está THEN `failed` es verdadero y el resumen nombra el paso que se detuvo.
- WHEN está en marcha THEN se leen CPU y memoria con `docker stats --no-stream` y la latencia es el tiempo de `GET http://127.0.0.1:3000/playground`. Si no responde, la salud queda en `—`.
- El log pide marcas de tiempo (`compose logs -t`). Buscar, tipo y fechas corren en el panel. El panel no crece la página: el log usa el alto que queda y hace scroll él.
- WHILE Ship pregunta a Docker THEN se ve la franja de carga y el log dice que está revisando. Iniciar y Actualizar siguen disponibles. Si Docker no contesta en 12 segundos, la franja se cambia por el aviso de error. Iniciar y Reconstruir se apagan solo mientras construyen o detienen, y si la carpeta no se puede servir.

## Pruebas

`npm test` afirma el lector de `compose ps`, el nivel y la fecha de una línea, y el HTML de en marcha, falló e inglés y español.
