---
id: HU-001
feature: F-001
epic: E-001
module: 01-canales
needs: []
screen: connect
---

# HU-001 — Probar WhatsApp desde Conectar

Como persona que diseña un agente, quiero conectar WhatsApp y enviar un mensaje de prueba desde la plataforma para saber que el canal responde antes de seguir construyendo.

**Aceptación**

- WHEN el lienzo tiene un disparador WhatsApp THEN la carpeta escribe un canal que responde el GET de verificación de Meta y contesta un mensaje de texto por la API de WhatsApp.
- IF faltan el token, el id del número o el verify token THEN Comprobar y Enviar prueba quedan apagados y el problema se nombra sin mostrar el valor.
- WHEN los tres valores son válidos y el agente no hace falta para hablar con Meta THEN Comprobar llama a Graph con el token en el header, no en la URL.
- WHEN la persona escribe un número y pulsa Enviar prueba THEN el cuerpo pide un texto `hello` a ese número y el token no viaja en la URL.
- IF el chat del editor pide un agente que empieza por WhatsApp THEN `AGENTS.md` de una carpeta nueva le dice que eso es un disparador, que una base de conocimiento es una Guía o una Acción, y que guardar la pregunta sin respuesta es una Acción de escritura.

**Tablero**

No aplica.
