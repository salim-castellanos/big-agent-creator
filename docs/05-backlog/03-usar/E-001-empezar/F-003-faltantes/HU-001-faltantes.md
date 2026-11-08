---
id: HU-001
feature: F-003
epic: E-001
module: 03-usar
needs: []
screen: flow
status: ai-tested
---

# HU-001 — Ver qué le falta a una tarjeta

Como persona que arma un flujo, quiero ver qué tarjeta está incompleta y qué campo falta, sin abrir una terminal.

**Aceptación**

- WHEN a una tarjeta le falta un secreto, un repositorio o el mínimo de esa tarjeta THEN la tarjeta se pinta en rojo.
- WHEN el cursor está sobre ella THEN el texto dice para qué sirve y qué falta.
- WHEN está seleccionada y las propiedades están abiertas THEN el campo vacío se pinta en rojo y la lista de arriba nombra el faltante.
- WHEN pulsa Simular flujo THEN ve los secretos, las tarjetas y la carpeta por separado, o la frase de que el mínimo ya está.
- WHEN se carga Hello, Telegram desk o Support desk sin `.env` THEN lo único que falta son secretos. Change gate pide además el repositorio. Al ponerlos, Simular flujo queda listo.

**Tablero**

No aplica.
