# Lo que el chat escribe

Una carpeta nueva trae este mismo encargo en su `AGENTS.md`. El chat del editor lo lee ahí. No hace falta abrir este repo.

La frase «empieza por un mensaje de WhatsApp, responde con una base de conocimiento y, si no encontró, guarda la pregunta» se escribe como archivos, no como una explicación:

- `channels/desk.json` con `"type": "whatsapp"`.
- `mcp-connections/knowledge.json` con la URL de la base.
- `tools/lookup.json` que llama a `mcp:knowledge`.
- `tools/save-gap.json` con efecto `write` y la URL donde se guardan las preguntas sin respuesta.
- `skills/when-empty.md` que empieza por `When: the lookup found nothing`.
- `instructions.md` que dice que solo se responde con lo que `lookup` devuelve y que, si no hay nada, se llama a `save-gap`.

La URL de la base la pone quien pide el agente. El chat no inventa un servidor.

Con el diseñador abierto, al guardar esos archivos se reescribe `bot/`. Después: Secretos, Desplegar → Iniciar, Conectar → Comprobar número → Enviar prueba.
