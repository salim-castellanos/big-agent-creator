# BigAgentCreator — contexto

Iniciativa del mismo ecosistema que BigSwarmAI. Vive en `ecosystem/big-agent-creator/`, con su propio git cuando se abra. No entra al repo del molde ni al de `ecosystem/bigswarmai/`.

Todavía no hay épicas ni HUs. Este archivo fija cómo se construye y el primer corte.

## Qué es

Una plataforma para que un ingeniero o un FDE diseñe un agente o un flujo, lo versione, lo pruebe y lo despliegue. El estándar de base es el Agent SDK de Cursor (notas del 20 de octubre de 2026): un agente es una carpeta.

| Pieza | Rol |
| --- | --- |
| `instructions.md` | Prompt. |
| `tools/` | Acciones tipadas. |
| `skills/` | Procedimientos que se cargan cuando hacen falta. |
| `mcp-connections/` | Herramientas de servidores MCP. |
| `channels/` | Dónde escucha y responde. |

El dibujo y el chat escriben esa carpeta. El explorador la muestra. El grafo es una vista, no el producto.

## Qué se considera hecho

La capacidad que distingue a la plataforma es esta: mientras la persona diseña, la carpeta del agente, las relaciones del flujo y los archivos de despliegue se escriben solos. Guardar, refrescar un enlace y reescribir el Docker local no son extras. Son el producto.

Una capacidad no está hecha porque el lienzo la muestre. Está hecha cuando la carpeta que sale de ese dibujo es una que `agent-sdk serve` carga, y cuando una prueba lo afirma. Si el dibujo se ve bien y el proceso se niega a servir, la entrega falló.

Al describir una capacidad nueva, el mismo texto dice cómo se comprueba. La comprobación vive en tres sitios que no pueden divergir:

| Sitio | Qué afirma |
| --- | --- |
| El generador | Cada guardado escribe `package.json` con `"type": "module"`, las dependencias que el archivo importa, y un Dockerfile que hace `npm install` antes de `agent-sdk serve`. |
| Ship | `deliveryCheck` lee la carpeta. Si `serve` la rechazaría, el problema se ve y **Start** queda apagado. |
| `npm test` | Un proyecto recién escrito pasa el contrato. Una carpeta rota (sin `"type": "module"`, sin `npm install`, con `from "zod"`) nombra el fallo. El ejemplo `examples/telegram-desk` también tiene que pasar. |

Lección ya pagada: Node 22, sin `"type": "module"` y sin instalar el paquete local, responde `Cannot require() ES Module … in a cycle` y `agent-sdk serve` no arranca. El valor de un secreto no entra en esa comprobación ni en la imagen.

La tarjeta se llama **Agent**: es la única definición de la carpeta (`bot/agent.ts` e `instructions.md`). Al inicializar un workspace queda en el lienzo. Se puede quitar y volver a poner. Un disparador que no llega hasta ella responde en código y no llama al modelo. Limits también se puede quitar. La prueba quita las dos tarjetas y afirma que el canal de Telegram deja de llamar a `send`.

Otra lección: el proceso puede estar escuchando y el chat quedarse mudo. Esta imagen no ejecuta el sandbox del SDK. Si `bot/agent.ts` lleva `local: { sandbox: true }`, cada turno falla con `sandboxing is not supported` y Telegram no recibe respuesta. El generador no escribe esa línea. Si el archivo la tiene igual, `deliveryCheck` lo nombra y **Start** queda apagado. La prueba guarda el proyecto con sandbox pedido y afirma que `bot/agent.ts` no lo activa.

## Qué versión se usa

La plataforma se queda en la última estable del Agent SDK que ya sabemos servir. Hoy el generador escribe `@grok/agent-sdk` `^0.6.0`. Esa es la última publicada (3 de noviembre de 2026). El CLI de la imagen se instala en esa misma línea. Un `npm install` no se queda en un 0.5 a propósito.

Un `npm warn deprecated` de una dependencia interna del SDK no se parchea en la imagen. `@opentelemetry/sdk-trace-node@2.12.0` avisa que el paquete pasó a `@opentelemetry/sdk-trace` (línea 3). El SDK 0.6.0 todavía importa el paquete 2. Sustituirlo aquí adelantaría una mayor que el SDK no ha adoptado, y el arranque dejaría de ser el que ya se probó. Cuando el SDK publique una estable que use el paquete nuevo, el generador sube el rango y se vuelve a comprobar con `deliveryCheck` y con el arranque de `examples/telegram-desk`.

## Llegar al chat

**Rebuild** en Ship reconstruye la imagen y recrea el contenedor para que el proceso lea el `.env` actual. El valor de un secreto no entra en la imagen: `.dockerignore` excluye `.env`, y Compose lo inyecta al arrancar. Guardar un secreto avisa que hace falta ese Rebuild.

Por Docker, el navegador no es loopback dentro del contenedor, y el SDK responde 401 (`No auth policy admitted this request`) en el playground. El Compose local pone `BIGAGENT_ADMIT_LOCAL=1`, y el proceso arranca con `--allow-anonymous` para que esta máquina entre. Sin esa variable, un `AGENT_SDK_BEARER_TOKEN` con valor exige ese bearer. El puerto local queda en `127.0.0.1`. Un túnel público llega a ese mismo puerto: se cierra al terminar la prueba.

Ship, cuando el agente local está en marcha, muestra `http://127.0.0.1:3000/playground` y un botón para abrirlo. Esa página prueba el agente sin pasar por Telegram.

**Connect** es la página de esas acciones. Cada canal del lienzo tiene ahí su tarjeta de alta: hoy Telegram (túnel y webhook); el siguiente canal recibe otra tarjeta en la misma página, no un botón suelto en Ship. Secrets guarda el valor. Ship construye y arranca la imagen. **Register webhook** recrea el contenedor para que lea el secreto actual y llama a `setWebhook`. El token no se muestra, no se escribe en el log y no se pega en el navegador.

Si `TELEGRAM_WEBHOOK_SECRET` no es solo letras, números, `_` y `-`, Register queda apagado y el problema se lista. El token de BotFather, que lleva `:`, vive en `TELEGRAM_BOT_TOKEN`. La prueba cubre ese rechazo sin imprimir el valor, y que la dirección del túnel queda en `POST /v1/channels/telegram/`.

## Cómo se construye

Extensión sobre VS Code o Cursor. El editor central es el flujo. Se conservan el explorador de archivos y el chat. No se hace un fork del IDE: la base se actualiza sola y el producto no hereda el costo de mezclarla cada mes.

El chat diseña con pocas herramientas: leer el proyecto, crear o editar un archivo de `tools/`, `skills/`, `mcp-connections/` o `channels/`, y correr `validate`, `dev` y `eval`. Esas herramientas viven en la extensión. Un MCP aparte solo si el diseñador se usa fuera de Cursor.

## Qué se despliega

Una imagen OCI. Dentro va el proyecto del agente y el proceso `agent-sdk serve` (Node 22.13 o más nuevo, un solo proceso). La misma imagen, el mismo digest, corre en Docker local, Kubernetes, AWS, GCP o Azure. Cada plataforma solo la arranca y le inyecta variables.

El modelo, con este SDK, se consulta por el API de Cursor. La imagen lleva `CURSOR_API_KEY` inyectada, nunca escrita en el Dockerfile. Hace falta un volumen para `/var/lib/agent-sdk` y un token para quien llama al proceso. Llevar el modelo a la cuenta de Azure, AWS o GCP del cliente sería otro ejecutor, no este.

## Secretos y ambientes

En el repo del agente solo viven los **nombres** de los secretos y si son obligatorios. Los valores no.

| Ambiente | Dónde está el valor |
| --- | --- |
| Local, Docker | Un archivo de entorno que no se versiona. Compose lo inyecta al arrancar. |
| Nube, más adelante | El almacén de esa plataforma. El mismo nombre de variable. |

Al elegir un destino, la plataforma puede crear el secreto vacío para que la persona pegue el valor, o enlazar un nombre que ya existe. El proceso solo lee la variable.

| Destino futuro | Almacén |
| --- | --- |
| Kubernetes | ConfigMap para lo plano, Secret para lo sensible. En producción, External Secrets desde el almacén de la nube. |
| AWS | Secrets Manager, inyectado en la tarea de ECS o Fargate. |
| GCP | Secret Manager, inyectado en Cloud Run. |
| Azure | Key Vault, `secretref` en Container Apps. |

Corte inicial: solo Docker local. Los otros destinos no se implementan todavía. El contrato de nombres queda igual para cuando existan.

## Primer agente de prueba

Atención al cliente por un canal de mensajería, por ejemplo WhatsApp. Responde una consulta o una PQR leyendo una base de información. Declara sobre qué puede responder y sobre qué no.

Prácticas de este tipo de agente:

- Responde solo con pasajes recuperados de esa base. Si no están, lo dice y ofrece pasar a una persona.
- El mensaje del cliente no puede cambiar el prompt, ni pedir que revele las instrucciones, ni activar una herramienta que no esté en el flujo.
- Cada respuesta cita el documento de la base.
- No ejecuta acciones de cuenta, dinero o borrado a partir del texto del usuario.
- El webhook del canal se verifica por firma. Hay límite de tasa.
- Los logs no guardan el secreto ni más datos personales de los necesarios.
- Hay evaluaciones fijas: pregunta dentro de alcance, pregunta fuera de alcance, intento de cambiar las instrucciones.

## Otros dos agentes para probar la plataforma

1. Revisor de un pull request contra las reglas del equipo. Canal de GitHub. Sirve para probar canales, evaluaciones sobre qué herramienta se usó, y un agente que no habla con el público.
2. Ayudante de incidente. Lee el runbook interno y propone los pasos. No ejecuta el cambio en producción sin una persona. Sirve para probar el trabajo de un FDE: soporte, mantenimiento y una acción que se detiene a esperar aprobación.

## Fuera de este corte

Épicas, HUs, AWS, GCP, Azure, Kubernetes y un ejecutor de modelo distinto al API de Cursor.
