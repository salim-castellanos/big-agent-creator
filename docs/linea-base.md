# Línea base — BigAgentCreator

Lo que la carpeta hace en la fuente **0.2.8**. No es una HU ni una spec. El cambio nuevo abre las suyas antes de `apps/`.

El git publicado es `https://github.com/salim-castellanos/big-agent-creator`. `origin/main` es el corte de la tienda. El trabajo posterior está en el árbol de trabajo y no en ese commit. `STATUS.md` conserva el relato de versiones. Si discrepa con este archivo, manda este.

Una capacidad de aquí está hecha cuando la carpeta que sale del lienzo la carga `agent-sdk serve` y `npm test` en `apps/extension` lo afirma.

## Dónde se tocan

| Si cambias… | También mira… |
| --- | --- |
| El generador (`apps/extension/src/project.ts`) | `deliveryCheck`, `npm test`, los cuatro ejemplos, el Dockerfile |
| Un rótulo | `apps/extension/src/copy.ts` (en y es). Los `id` y los `data-mode` no cambian |
| Una página del menú | La ayuda (`copy.ts`) y `docs/start.md` / `docs/start.es.md` |
| Secretos o el `.env` | Ship **Rebuild**, Compose, `.dockerignore`. El valor no entra en la imagen ni en el log |
| El contrato de Telegram | Connect, `telegramReach`, el ejemplo `telegram-desk` |
| Agent o Limits en el lienzo | `flowLinks`, el canal que llama o no a `send`, la prueba que los quita |

## La extensión

VS Code o Cursor. No es un fork del editor. Publicador `BigAgentCreator`. Versión de fuente `0.2.6`. Se instala el `.vsix` de `apps/extension/`. Actividad **BigAgentCreator**, comando para abrir el diseñador. El agente se escribe en la carpeta abierta, no dentro de la extensión.

El menú, de izquierda a derecha: **Diseño**, Probar, Plataforma, Secretos, Conectar, Desplegar, Ejemplos. Al final, **English | Español** y **Ayuda**. El idioma cambia rótulos y avisos. No cambia archivos ni identificadores. Ayuda cuenta cómo arrancar Hello, por qué existe `CURSOR_API_KEY` y qué es el Agent SDK. La guía larga es `docs/start.md` y `docs/start.es.md`. Al inicializar se escriben `START.md` y `AGENTS.md` si faltan, y apuntan a esa guía.

El chat del editor no tiene herramientas propias. Lee el `AGENTS.md` de la carpeta del agente. Ahí está el encargo para crear, con archivos, el agente de WhatsApp que consulta una base y guarda la pregunta cuando no hay respuesta. Con el diseñador abierto, ese cambio reescribe `bot/`.

## Lienzo

Design es el lienzo. Soltar una tarjeta no la conecta: hay que dibujar la flecha. El número es el paso al que entra esa flecha. El mismo número puede correr a la vez. Un número mayor espera. Un ciclo se marca ↻.

| Tarjeta | Cuántas | Qué escribe |
| --- | --- | --- |
| Trigger | varias | `channels/` |
| Schedule | varias | `schedules/` |
| Limits | una, se puede quitar | el alcance en `.bigagent/project.json` |
| Agent | una por carpeta, se puede quitar | `bot/agent.ts` e `instructions.md` |
| Action | varias | `tools/` |
| Guide | varias | `skills/` |
| Service | varias | `mcp-connections/` |
| Host | varias | `host-connections/` |
| Subagent | varias | `subagents/` |
| Hook | varias | `hooks/` |

Al inicializar entran Agent y Limits. Un disparador cuya flecha no llega a Agent responde en código y no llama al modelo. Otro razonador es un Subagent.

## Lo que el SDK puede servir

`@grok/agent-sdk` `^0.6.0`. El generador escribe `package.json` con `"type": "module"`, esa dependencia y `zod`. Los archivos generados importan `zod/v4`. El Dockerfile hace `npm install` y arranca `agent-sdk serve --mode single`. La ruta pública de un canal es `POST /v1/channels/<nombre>/`.

No se escribe `local: { sandbox: true }`. Esta imagen no ejecuta el sandbox. Si `bot/agent.ts` lo tiene igual, `deliveryCheck` lo nombra y **Start** queda apagado. Si falta `"type": "module"`, el `npm install` o el modo single, Start también queda apagado.

Un aviso de OpenTelemetry dentro del SDK no se parchea aquí. El SDK 0.6.0 todavía usa el paquete que avisa.

## Secretos, imagen y chat local

Los nombres viven en el proyecto. Los valores viven en `.env`. `.dockerignore` excluye `.env`. Compose lo inyecta al arrancar. El puerto publicado es `127.0.0.1:3000`.

`CURSOR_API_KEY` es la clave de usuario de Cursor. El Agent SDK llama al modelo con ella. No es la licencia del editor ni una clave de administrador. Hace falta cuando una flecha llega a Agent.

Docker no es loopback dentro del contenedor. El Compose local pone `BIGAGENT_ADMIT_LOCAL=1` y el proceso usa `--allow-anonymous` para que el playground de esta máquina entre. Si `AGENT_SDK_BEARER_TOKEN` tiene valor y esa admisión no está, el API exige el bearer.

**Rebuild** crea imagen y contenedor nuevos para leer el `.env` actual. Guardar un secreto avisa que hace falta ese Rebuild. Los logs ocultan los valores.

## Páginas

| Página | Qué hace hoy |
| --- | --- |
| Probar | Casos de evaluación en archivos del editor. |
| Plataforma | Archivos que el lienzo no dibuja: código compartido, semilla, artefactos, recordatorios, extensiones. |
| Secretos | Nombre y valor. El valor no se muestra después. |
| Conectar | Telegram: túnel y webhook. WhatsApp: comprobar el número y enviar `hello`. Slack: comprobar el token del bot. GitHub, GitLab y Bitbucket: en la tarjeta del disparador se escribe el repositorio (`owner/name`, `group/project` o `workspace/repo`) y, al guardar, los secretos aparecen en Secretos y en Conectar. |
| Desplegar | **Start**, **Rebuild**, **Stop**. Cuando corre, muestra `http://127.0.0.1:3000/playground` y lo abre. Kubernetes, AWS, GCP y Azure se nombran. No despliegan. |
| Ejemplos | Hello, Telegram desk, Support desk, Change gate. **Cargar** reemplaza el lienzo. La primera vez guarda la carpeta en `.keep/original` y no vuelve a pisar esa copia. `.env` no se reemplaza. **Restaurar mi carpeta** devuelve esa copia y borra lo que el ejemplo agregó. |

Hello es el primer recorrido: playground, sin Telegram, respuesta `hello` a `hi`. Telegram desk es el que se probó de punta a punta. Support desk y Change gate cumplen el mismo contrato de imagen. Sus servidores extra no están en el Compose.

## Qué no hace esta versión

Desplegar a AWS, GCP, Azure o Kubernetes. Varias tarjetas Limits con textos distintos. Elegir otro ejecutor de modelo. Herramientas para que el chat del editor edite la carpeta.
