# Lecciones — BigAgentCreator

Dolores de ejecutar esta instancia. El método no se copia: la tabla del molde solo apunta aquí.

| id | Síntoma | Regla |
| --- | --- | --- |
| sandbox-silent | El mensaje de Telegram llegó y no hubo respuesta. El turno falló: `Local SDK sandboxing was requested, but sandboxing is not supported in this environment`. El log del contenedor no mostraba esa frase. | El generador no escribe `local: { sandbox: true }`. `deliveryCheck` apaga **Start** si el archivo lo tiene. La prueba afirma que pedirlo en el lienzo no lo activa en `bot/agent.ts`. Un turno fallido se escribe en el log como `[telegram] turn failed`. |
| playground-401 | El playground decía `Could not list evals (401)`: `No auth policy admitted this request`. Docker publica el puerto, así que dentro del contenedor la llamada no es loopback y `localDevStrict()` la rechaza. | Si `AGENT_SDK_BEARER_TOKEN` está vacío, el CMD local usa `--allow-anonymous`. Si tiene valor, el API exige ese bearer. **Rebuild** recrea el contenedor para leer el `.env` nuevo. El valor no se escribe en la imagen. |
| serve-esm-cycle | `agent-sdk serve` se negó a arrancar: `Cannot require() ES Module /srv/agent/bot/agent.ts in a cycle` (y el canal de Telegram igual). La imagen tenía el TypeScript y el CLI global, sin `package.json` `"type": "module"` y sin `npm install` del paquete local. | Cada guardado escribe ese `package.json`, instala `@grok/agent-sdk` y `zod`, y el Dockerfile corre `npm install` antes de `serve --mode single`. `deliveryCheck` lo afirma en Ship (**Start** apagado) y en `npm test`, incluido `examples/telegram-desk`. Una capacidad nueva no está hecha si el lienzo la muestra y esta comprobación no la nombra. |
