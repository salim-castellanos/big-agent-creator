---
id: HU-001
feature: F-001
epic: E-001
module: 03-usar
needs: []
screen: init
status: ai-tested
---

# HU-001 — Inicializar con un ejemplo

Como persona que abre una carpeta vacía, quiero inicializar en blanco o con un ejemplo ya cargado para no empezar desde cero.

**Aceptación**

- WHEN la carpeta no es un agente THEN la pantalla ofrece Inicializar y un botón por cada ejemplo.
- WHEN pulsa un ejemplo THEN la carpeta queda con ese lienzo y, la primera vez, la copia anterior queda en `.keep/original`.

**Tablero**

No aplica.
