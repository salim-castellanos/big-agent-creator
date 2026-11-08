---
id: 003-usar
title: Empezar, Docker, faltantes y preguntar
status: implemented
hu: HU-001
runbook: 003-usar
supersedes:
superseded-by:
---

# Spec 003 — Empezar, Docker, faltantes y preguntar

## Insumos

- HUs de `docs/05-backlog/03-usar/E-001-empezar/`
- Línea base: `docs/linea-base.md`
- Gates: constitución I. El valor no entra en la imagen, el log ni el prompt del chat.

## In scope

Inicializar con cada ejemplo. Distinguir Docker ausente de Docker apagado. Pintar la tarjeta y el campo que faltan. Simular flujo. Probar el modelo del editor y preguntar en solo lectura.

## Out of scope

Que el chat escriba el lienzo. Eso es F-005. Desplegar en nube.

## Comportamiento

- WHEN no hay `.bigagent/project.json` THEN hay un botón `data-init-example` por cada id de `EXAMPLES`, además de Inicializar.
- WHEN ese botón corre THEN se usa `loadExample` de la carpeta del ejemplo.
- IF el texto de `docker` trae `not recognized`, `ENOENT` o `Could not start Docker` THEN `dockerProblem` es `missing` y el resumen es la frase de instalar Docker y dejarlo en marcha.
- IF el texto trae el fallo del motor THEN `dockerProblem` es `down`.
- `cardNeeds` junta el review de la tarjeta, el repositorio `owner/name` si el canal lo pide, cada secreto del canal (los del tipo y el nombre puesto en la tarjeta), el secreto nombrado en una acción o un servicio, y `CURSOR_API_KEY` si el agente está en el lienzo.
- `flowReport` separa eso en secretos que la persona debe poner, tarjetas sin terminar y problemas de la carpeta. Simular flujo abre un cuadro, fuera del lienzo, con el veredicto y esa lista. Un ejemplo servible solo debe secretos, más el repositorio en Change gate. Al ponerlos, el reporte queda listo.
- La tarjeta con una fila en `cardNeeds` lleva la clase `gap` y un `title` con el propósito y el faltante.
- El campo nombrado en `fields` queda con `data-need` y su etiqueta con la clase `need`.
- Simular flujo lista esas frases más `deliveryCheck`. Si la lista está vacía, dice que el mínimo está.
- `lmGate` deja el chat apagado si no hay API, si no hay modelos o si la prueba no devolvió texto. Si devolvió texto, el cuadro se habilita.
- El prompt de una pregunta lleva nombres de tarjetas y frases de faltante. No lee `.env`.

## Pruebas

`npm test` recorre la pantalla en blanco, los cuatro ejemplos, la tarjeta roja, el campo rojo, Simular flujo en inglés y en español, las dos lecturas de Docker y las cuatro puertas del chat. Cada ejemplo se copia sin `.env`: la carpeta se puede servir, y lo único que falta son los secretos (y el repositorio en Change gate). Al ponerlos, Simular flujo queda listo.
