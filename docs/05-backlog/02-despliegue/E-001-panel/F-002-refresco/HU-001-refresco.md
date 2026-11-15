---
id: HU-001
feature: F-002
epic: E-001
module: 02-despliegue
needs: []
screen: Ship
---

# HU-001 — El refresco no mueve el lienzo

Como persona que mira el agente local, quiero que Actualizar cambie el estado y el log sin rehacer la pantalla, para no perder el filtro ni el lugar del log.

**Aceptación**

- WHEN el modo es Desplegar y el estado del contenedor cambia, THEN la fila (estado, CPU, memoria, latencia, errores, tramo del log) y el texto del log se actualizan.
- WHEN eso pasa, THEN el campo de búsqueda del log no se borra y el lienzo no se vuelve a dibujar.
- IF el log trae una línea de error y dos horas, THEN la fila muestra el conteo, el último error y el tramo entre esas horas.
- IF el log no trae un valor de secreto, THEN la fila tampoco lo muestra.
