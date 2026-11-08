---
id: HU-001
feature: F-004
epic: E-001
module: 03-usar
needs: [HU-001 de F-003]
screen: flow
status: ai-tested
---

# HU-001 — Preguntar sobre este lienzo

Como persona que ya ve lo que falta, quiero preguntarle al modelo que el editor ya tiene, sin pegar la clave otra vez.

**Aceptación**

- WHEN abre Preguntar THEN el cuadro está apagado hasta que Probar comunicación reciba texto del modelo del editor.
- IF el editor no ofrece un modelo THEN el chat sigue apagado y la frase lo dice.
- WHEN la prueba pasa THEN puede preguntar, y la pregunta lleva los nombres de las tarjetas y lo que falta. No lleva el valor de un secreto.
- El chat no escribe archivos ni mueve tarjetas.

**Tablero**

No aplica.
