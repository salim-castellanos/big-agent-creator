---
id: HU-001
feature: F-002
epic: E-001
module: 03-usar
needs: []
screen: deploy
status: ai-tested
---

# HU-001 — Decir si falta Docker

Como persona que quiere desplegar en local, quiero que Ship diga si Docker no está instalado o si está instalado y no corre.

**Aceptación**

- IF el comando `docker` no se reconoce o no se puede ejecutar THEN la barra dice Falta Docker y pide instalarlo y dejarlo en marcha.
- IF el motor no responde THEN la barra dice que Docker Desktop no está en marcha.
- Start sigue apagado en los dos casos.

**Tablero**

No aplica.
