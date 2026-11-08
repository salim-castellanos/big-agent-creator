---
id: HU-001
feature: F-001
epic: E-001
module: 02-despliegue
needs: []
screen: deploy
---

# HU-001 — Ver el agente local después de Iniciar

Como persona que despliega en local, quiero ver si el agente arrancó o falló, cómo se llama y qué consume, para no adivinarlo en una terminal.

**Aceptación**

- WHEN el contenedor está en marcha THEN la barra dice En marcha, muestra el nombre del agente y habilita el playground.
- IF Iniciar o Reconstruir no deja el contenedor en marcha THEN la barra dice Falló, el resumen explica el fallo y Iniciar se puede volver a pulsar.
- WHEN el agente está en marcha THEN la fila muestra CPU, memoria y cuánto tarda el playground en responder.
- WHEN la persona busca, elige un tipo o acota fechas THEN el log se filtra dentro del panel y los controles de arriba siguen a la vista.
- Los rótulos existen en inglés y en español. El valor de un secreto no entra en el log.

**Tablero**

No aplica.
