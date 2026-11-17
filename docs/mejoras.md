# Mejoras

Historial de lo que ya quedó en el código, y por qué. Es insumo para seguir la plataforma o para sacar una aplicación independiente de VS Code. No es una lista de ideas.

`LECCIONES.md` guarda dolores de ejecutar. Este archivo guarda mejoras hechas. `GAPS.md` guarda huecos del molde. `docs/demoras.md` guarda los tiempos medidos del runtime y lo que un SDK futuro tiene que hacer distinto.

## Cómo se anota

Una mejora entra aquí en el mismo cambio que entra en `apps/`. Sin versión, sin prueba y sin porqué, no se anota.

| Campo | Qué va |
| --- | --- |
| id | `tipo-número`. No se reutiliza. |
| versión | La del `package.json` de la extensión en la que quedó. |
| tipo | Uno de la lista cerrada de abajo. |
| qué | El comportamiento que quedó. |
| por qué | El síntoma real que lo provocó. |
| dónde | Archivo que lo sostiene. |
| prueba | Qué afirma `npm test`, o la comprobación a mano si la prueba no puede ver la nube. |
| producto | Qué pieza se lleva si la extensión se vuelve una aplicación. |

## Tipos

| tipo | Qué es | En una aplicación independiente |
| --- | --- | --- |
| lienzo | Tarjetas, flechas, guardado, lo que la persona diseña | El editor del flujo |
| agente | La carpeta que el lienzo escribe y el proceso que contesta | El runtime |
| conectar | Alta de canales hacia fuera | Integraciones |
| despliegue | Imagen, máquina local, Cloud Run, secretos | Operación |
| monitor | Qué se ve de un agente ya en marcha | Observabilidad |
| plataforma | La extensión, el empaquetado, este método | El cascarón. Hoy es un plugin. Una aplicación no hereda el cascarón: hereda los otros cinco tipos |

## Hechas

### lienzo-001

| Campo | Valor |
| --- | --- |
| versión | 0.2.66 |
| tipo | lienzo |
| qué | **Guardar** en una tarjeta reescribe `bot/agent.ts` con `local: { cwd: "/srv/agent/bot" }` y crea `.cursorignore` con `node_modules`. No hace falta cambiar el texto de la tarjeta. |
| por qué | En Cloud Run cada turno recorría `/srv/agent`, incluido `node_modules`, buscando reglas. El log mostró 0 reglas y 18 s. |
| dónde | `apps/extension/src/project.ts` (`emitSdk`) |
| prueba | `a telegram chat verifies the secret and answers in the same conversation` afirma el `cwd` y el ignore, y que el sandbox sigue apagado. |
| producto | Generador del runtime. El botón Guardar es de la pantalla. |

### lienzo-002

| Campo | Valor |
| --- | --- |
| versión | 0.2.67 |
| tipo | lienzo |
| qué | **Guardar** queda fijo al fondo del panel de propiedades. El formulario sigue bajando. El botón no. |
| por qué | En el agente, Guardar estaba al final del scroll y no se veía. Mover la tarjeta solo guarda la posición y no reescribe `bot/`. |
| dónde | `.savebar` en `designer.ts` |
| prueba | La prueba del agente en el lienzo afirma `class="row savebar"` junto a `save-agent`. |
| producto | Editor del flujo. Cualquier panel largo deja la acción principal a la vista. No hace falta que la persona lo pida otra vez. |

### lienzo-003

| Campo | Valor |
| --- | --- |
| versión | 0.2.68 |
| tipo | lienzo |
| qué | Al pulsar **Guardar**, el botón pasa a **Guardando…** y, al escribir la carpeta, a **Guardado** en verde. Luego vuelve a **Guardar**. |
| por qué | El clic no se notaba. El check de guardado está en la barra del lienzo, lejos del botón fijo del panel. |
| dónde | `armSave` y `markSaved` en `designer.ts` |
| prueba | La prueba del agente afirma el texto `Saving…` en la página. |
| producto | Editor del flujo. Una acción principal confirma en el mismo control. |

### lienzo-006

| Campo | Valor |
| --- | --- |
| versión | 0.2.94 |
| tipo | lienzo |
| qué | La llamada generada al MCP devuelve `{ ok, text }` y compila con el SDK. Una herramienta puede nombrar una conexión de host (`mcp:pager:send`) además de un MCP. Tres agentes de prueba (reloj, operaciones y revisión) salen del lienzo con modelo, esfuerzo, CPU siempre asignada o recortada, y el comando de Cloud Run. |
| por qué | Devolver el resultado crudo de `callTool` no pasa el compilador del SDK. Un agente con varias tarjetas no se había probado junto: canal, habilidad, herramienta, MCP, host, agenda, gancho y subagente. |
| dónde | `emitSdk` y la revisión de nombres en `project.ts`, la prueba `three canvas agents` |
| prueba | Los tres agentes quedan listos al poner los secretos, el comando de despliegue lleva el flag de CPU que corresponde, y `tsc --noEmit` sale 0 en los tres. |
| producto | El generador. Un flujo complejo se arma con las mismas tarjetas. |

### lienzo-005

| Campo | Valor |
| --- | --- |
| versión | 0.2.93 |
| tipo | lienzo |
| qué | Una herramienta con `calls` `mcp:servidor:herramienta` genera `ctx.host.mcp.callTool`. El ejemplo **Clock desk** es la mesa de Telegram más el reloj público `https://time.now/mcp`. La habilidad pide la hora y la herramienta llama a `get_current_time`. El host `time.now` entra en la salida de la imagen. |
| por qué | El lienzo ya dibujaba el MCP, y la herramienta generada devolvía la entrada sin llamar al servidor. Hacía falta un ejemplo que se pueda cargar y preguntar la hora. `tools/call` de ese reloj respondió en 516 ms. |
| dónde | `mcpTarget` y `emitSdk` en `project.ts`, `examples/clock-desk` |
| prueba | Guardar en el lienzo un MCP `clock` y una herramienta `mcp:clock:get_current_time` escribe `callTool("clock", "get_current_time", input)` y permite salir a `time.now`. Clock desk queda listo para servir con los mismos secretos que Telegram desk. |
| producto | El generador del flujo y la plantilla. Cualquier canal puede usar la misma flecha hacia un MCP. |

### lienzo-004

| Campo | Valor |
| --- | --- |
| versión | 0.2.69 |
| tipo | lienzo |
| qué | Guardar el agente confirma en el mismo botón, sin reconstruir toda la pantalla. Pasa a Guardado y vuelve a Guardar. |
| por qué | El botón se quedaba en Guardando… hasta otro clic. La confirmación esperaba a rehacer el lienzo completo, y esa pintura no llegaba hasta la siguiente interacción. |
| dónde | El mensaje `instructions` en `extension.ts` llama a `saved()` y no a `render`. |
| prueba | La prueba del agente sigue afirmando el texto de guardado en la página. El aviso en el botón se ve al pulsar. |
| producto | Editor del flujo. Confirmar una acción no redibuja toda la superficie. |

### agente-001

| Campo | Valor |
| --- | --- |
| versión | 0.2.63 |
| tipo | agente |
| qué | Al terminar un turno de Telegram, el proceso escribe `[telegram] replied in <ms>ms`. No escribe el texto ni el token. |
| por qué | El webhook responde 200 en milisegundos y el modelo contesta después. Sin esa línea, el monitor no puede medir la espera de la persona. |
| dónde | `telegramChannel` en `project.ts` |
| prueba | La misma prueba de Telegram afirma `replied in`. |
| producto | El canal. Entra en la imagen al guardar, construir y desplegar. La imagen ya publicada no lo tiene hasta ese ciclo. |

### agente-002

| Campo | Valor |
| --- | --- |
| versión | 0.2.66 |
| tipo | agente |
| qué | El mismo `cwd` y `.cursorignore` de lienzo-001. El runtime deja de caminar `node_modules`. |
| por qué | La demora era del proceso del agente, no del lienzo. Se anota también aquí porque una aplicación se lleva el runtime aunque cambie la pantalla. |
| dónde | `bot/agent.ts` generado y `.cursorignore` |
| prueba | La de lienzo-001. |
| producto | Runtime. Los ejemplos lo reciben al cargarlos, porque `loadExample` vuelve a emitir la carpeta. |

### conectar-001

| Campo | Valor |
| --- | --- |
| versión | 0.2.56 |
| tipo | conectar |
| qué | Registrar el webhook de Telegram acepta la base `https://….run.app` y arma `/v1/channels/telegram/`. No exige el agente local ni lo reinicia. |
| por qué | El botón estaba apagado si Docker no corría, y el registro reiniciaba el contenedor local antes de avisar a Telegram. |
| dónde | `designer.ts`, `registerWebhook` en `extension.ts` |
| prueba | `a tunnel address becomes the telegram route` |
| producto | Integración Telegram. El túnel local sigue siendo otro camino. |

### conectar-002

| Campo | Valor |
| --- | --- |
| versión | 0.2.58 |
| tipo | conectar |
| qué | El log de una conexión vive dentro de la caja de ese canal. WhatsApp y Slack usan la misma caja. |
| por qué | El resultado quedaba al final de Conectar y no se veía. |
| dónde | `noteChannel` en `extension.ts`, `channelLog` en `designer.ts` |
| prueba | La prueba del túnel afirma `data-connect-log="telegram"`. |
| producto | Pantalla de integraciones. |

### despliegue-001

| Campo | Valor |
| --- | --- |
| versión | 0.2.55 |
| tipo | despliegue |
| qué | Antes de publicar, se intenta dar Secret Accessor a la cuenta de Compute solo en los secretos del servicio. Si no se puede, el despliegue sigue. |
| por qué | Cloud Run rechazó la revisión: la cuenta no podía leer `TELEGRAM_WEBHOOK_SECRET` y los demás. |
| dónde | `allowSecretRead`, `secretAccessorArgs` |
| prueba | `a person configures Cloud Run` afirma el comando y que el valor no entra. |
| producto | Operación de GCP. |

### despliegue-002

| Campo | Valor |
| --- | --- |
| versión | 0.2.53 |
| tipo | despliegue |
| qué | En Windows, `gcloud` se arranca por la ruta completa de `gcloud.cmd`, y la salida va a un archivo. |
| por qué | El nombre corto entre comillas hacía que el SDK buscara Python en la carpeta del agente. El panel decía que no había cuenta. |
| dónde | `pickGcloud`, `windowsShell`, `cli` |
| prueba | `a person configures Cloud Run` |
| producto | Adaptador de la CLI en el escritorio. Una aplicación lo conserva si sigue usando `gcloud` local. |

### despliegue-003

| Campo | Valor |
| --- | --- |
| versión | 0.2.61 |
| tipo | despliegue |
| qué | En GCP, el panel principal son las pestañas Estado, Servicio, Escala, Secretos, Variables y Monitor. Se quitó el título «Una imagen. Cuatro lugares». |
| por qué | Escala, secretos y monitor quedaban debajo y había que bajar. El título ocupaba la primera pantalla. |
| dónde | `designer.ts` |
| prueba | `a person configures Cloud Run` afirma la pestaña Estado visible, Servicio oculto, y que el título no está. |
| producto | Pantalla de operación. |

### despliegue-004

| Campo | Valor |
| --- | --- |
| versión | 0.2.70 |
| tipo | despliegue |
| qué | **Subir** oculta el estado y el log de Cloud Run ocupa el alto que queda. El texto largo sigue bajando dentro de ese panel. |
| por qué | El log subía, pero se quedaba al 22 % del alto y había que leerlo en una caja pequeña. |
| dónde | `.ship-stack.fold-top .cloud-bottom` en `designer.ts` |
| prueba | `a person can go from an empty folder through the canvas to ship` afirma `flex: 1` en esa regla. |
| producto | Pantalla de operación. |

### despliegue-005

| Campo | Valor |
| --- | --- |
| versión | 0.2.70 |
| tipo | despliegue |
| qué | Mientras Docker sube la imagen, el botón dice **Subiendo…**. Pasa a **Desplegando…** solo cuando empieza Cloud Run. Si una capa no cambia en 20 s, el estado dice cuántos segundos lleva quieta. |
| por qué | Toda la operación dejaba el botón en Desplegando. Dos capas en Preparing parecían un despliegue colgado, y el aviso no decía desde cuándo. |
| dónde | `deployGcp` y `armGcp` |
| prueba | La frase en español afirma «no se mueven desde hace 40 s». La página incluye `Uploading…`. |
| producto | Operación de GCP. |

### despliegue-006

| Campo | Valor |
| --- | --- |
| versión | 0.2.71 |
| tipo | despliegue |
| qué | **Desplegar** compara la imagen local con la revisión que tiene el tráfico. Si es la misma, no vuelve a subirla y al terminar dice, en verde, que Cloud Run ya está actualizado con esa imagen. **Actualizar** hace solo la comparación. |
| por qué | El botón volvía a Desplegar sin decir qué imagen había quedado. Una URL guardada no prueba que Cloud Run sirva la imagen de ahora. |
| dónde | `cloudRunImageMatch`, `showLiveImage`, `deployGcp` |
| prueba | La etiqueta `abababababab` coincide con el mismo tag y no con otro. La página en español incluye Actualizar. |
| producto | Operación de GCP. |

### despliegue-007

| Campo | Valor |
| --- | --- |
| versión | 0.2.72 |
| tipo | despliegue |
| qué | En Estado queda un recuadro fijo: verde si Cloud Run sirve la imagen local, ámbar si es otra, rojo si no se pudo leer. Los avisos de cada paso se acumulan debajo y el siguiente no borra el recuadro. |
| por qué | El verde y el «no se pudo leer la imagen» se reemplazaban al segundo siguiente. En la tarjeta no quedaba si la imagen desplegada era la local. |
| dónde | `#gcp-verdict` y `#gcp-trail` en `designer.ts`. `gcpStatus` guarda el veredicto. |
| prueba | La página de despliegue afirma el recuadro, la lista y el fondo `#22C55E`. |
| producto | Pantalla de operación. |

### despliegue-008

| Campo | Valor |
| --- | --- |
| versión | 0.2.73 |
| tipo | despliegue |
| qué | La comparación usa la etiqueta de la plantilla del servicio cuando el tráfico está en esa revisión. Si Cloud Run solo muestra un digest, se compara con el digest de esa etiqueta en Artifact Registry. |
| por qué | La revisión de Telegram desk servía `@sha256:7c34…` y la plantilla tenía `:85f726beedb9`. El panel leía el digest, no lo reconocía como etiqueta y decía que no pudo leer la imagen. |
| dónde | `parseServiceRelease`, `releasedImage`, `matchServing` |
| prueba | La plantilla `:abababababab` con la revisión `desk-00007` en el tráfico devuelve esa etiqueta. Un digest igual al de la etiqueta es la misma imagen; otro digest no. |
| producto | Operación de GCP. |

### monitor-005

| Campo | Valor |
| --- | --- |
| versión | 0.2.74 |
| tipo | monitor |
| qué | El monitor separa la espera de la persona, la carga de reglas, el tiempo del modelo y la aceptación del webhook. La gráfica muestra la etapa que explica la demora. El log que lee deja fuera el ruido y conserva llamadas, `replied in`, reglas y turnos cortados. |
| por qué | Solo quedaba «Carga de reglas». La mediana y la más lenta habían salido, y las barras medían los milisegundos en que Cloud Run acepta el webhook, no la espera del chat. |
| dónde | `monitorFacts`, `channelBars`, `monitorFilter`, `paintChart` |
| prueba | Una respuesta de 20000 ms con reglas de 18063 ms deja modelo 1937 ms y webhook 16 ms. Sin `replied in`, la barra es de reglas y mide 18063. |
| producto | Observabilidad. |

### monitor-006

| Campo | Valor |
| --- | --- |
| versión | 0.2.75 |
| tipo | monitor |
| qué | El monitor muestra solicitudes, errores, latencia mediana y p95, y la gráfica es la latencia de cada llamada. Turno, preparación y cortes quedan en una segunda fila. Sirve para cualquier canal. |
| por qué | La gráfica se había quedado en la carga de reglas y la latencia no se veía. Esas cuatro cifras son las que se miran en un servicio, sea cual sea el agente. |
| dónde | `monitorFacts`, `channelBars`, `paintChart` |
| prueba | Con una llamada de 16 ms, la barra es de aceptación y mide 16. La p95 de esa sola muestra es 16. La preparación sigue en 18063 cuando el log la trae. |
| producto | Observabilidad. |

### despliegue-009

| Campo | Valor |
| --- | --- |
| versión | 0.2.76 |
| tipo | despliegue |
| qué | El despliegue escribe el mínimo y el máximo en el servicio, que es el recuadro «Escalamiento de servicios» de Cloud Run, además del de la revisión. |
| por qué | Con mínimo 1 y máximo 1, la consola seguía en 0 y 20. `--min-instances` y `--max-instances` solo cambian la revisión. La pantalla lee `run.googleapis.com/minScale` y `run.googleapis.com/maxScale`. |
| dónde | `cloudRunArgs` |
| prueba | El comando de un plan con mínimo 1 y máximo 2 incluye `run.googleapis.com/minScale=1,run.googleapis.com/maxScale=2`. |
| producto | Operación de GCP. |

### despliegue-010

| Campo | Valor |
| --- | --- |
| versión | 0.2.77 |
| tipo | despliegue |
| qué | Mientras construye o despliega, **Parar** mata el proceso y el árbol de procesos. **Desplegar** vuelve a empezar desde el principio. Una subida cortada no publica el servicio. |
| por qué | La imagen se quedaba en `Preparing` y no había forma de cortarla. Había que cerrar el editor. |
| dónde | `cancelJob` y `killTree` en `extension.ts`. El mismo corte de árbol vale para el build local. |
| prueba | La página de despliegue afirma `id="gcp-stop"`. En español el aviso de parada dice que empieza otra vez desde el principio. |
| producto | Operación. El mismo control vale para una subida larga en cualquier nube: una etapa a la vez, se puede cortar, y el siguiente intento no hereda el proceso muerto. |

### despliegue-011

| Campo | Valor |
| --- | --- |
| versión | 0.2.78 |
| tipo | despliegue |
| qué | La imagen usa `node:22.13-slim`, instala el Agent SDK una sola vez, borra la caché de npm y corre como el usuario `node`. `.dockerignore` deja fuera `out`, `dist`, `coverage`, `.cursor`, `evals` y los `.vsix`. |
| por qué | La imagen era Node completo y el SDK estaba instalado dos veces, en el proyecto y en global. Eso alarga la subida y el arranque. Los secretos siguen fuera. El bearer y `--allow-anonymous` no cambian. |
| dónde | `dockerFile` y `writeDocker` |
| prueba | El Dockerfile generado afirma `node:22.13-slim`, el binario local y `USER node`, y no afirma `npm install -g`. |
| producto | La imagen que corre el agente, en local y en cualquier nube. |

### monitor-007

| Campo | Valor |
| --- | --- |
| versión | 0.2.79 |
| tipo | monitor |
| qué | La cifra grande es la espera desde el último mensaje sin respuesta. Aceptación y p95 quedan con ese nombre y siguen siendo los milisegundos del webhook. La preparación, si el log la trae, se ve al lado. |
| por qué | p95 de 8 ms se leía como el tiempo de la respuesta. El webhook ya había contestado 200 y la persona seguía esperando. |
| dónde | `monitorFacts`, `agentSignal`, `paintChart` |
| prueba | Un webhook a las 03:13:26 leído a las 03:14:11, sin `replied in`, da 45000 ms de espera y el aviso dice 45 s y 8 ms. |
| producto | Observabilidad. |

### monitor-008

| Campo | Valor |
| --- | --- |
| versión | 0.2.80 |
| tipo | monitor |
| qué | Además de la aceptación, hay una barra por interacción partida en aceptación, preparación, modelo y lo que sigue en curso. Los trozos suman el tiempo de esa interacción. |
| por qué | La aceptación de 8 ms no decía en qué se iba el resto de la espera. |
| dónde | `interactionStages`, `#gcp-stages` |
| prueba | Una llamada de 8 ms con 18000 ms de reglas, leída 45 s después, deja 26992 ms en curso. Con `replied in 20000ms`, el modelo es 1992 ms y ya no queda nada en curso. |
| producto | Observabilidad. Sirve para cualquier canal que deje una llamada HTTP y, si los escribe, los tiempos de reglas y de respuesta. |

### monitor-009

| Campo | Valor |
| --- | --- |
| versión | 0.2.90 |
| tipo | monitor |
| qué | Cada fila es un mensaje, con el canal y la hora local. El total va de `[canal] turn started` al instante del log `replied in`, no al número de milisegundos de esa línea. La fila se parte en aceptación, preparación, modelo y lo que sigue en curso. Las cuatro cifras de arriba son ese último mensaje. La leyenda ya no dice undefined. |
| por qué | El número de `replied in` no se reinicia en cada mensaje, así que la barra verde crecía a 148 s, 245 s y 295 s aunque el mensaje hubiera durado menos. La tercera cifra decía UNDEFINED porque el nombre no estaba en el texto de la pantalla. |
| dónde | `interactionStages` en `project.ts`, `paintStages` en `designer.ts` |
| prueba | Un `replied in 999999ms` a los 20 s del `turn started`, con 4 s de reglas, deja 16 s de modelo. El mensaje de WhatsApp que sigue, sin respuesta, queda en curso 10 s y no hereda los 999999 ms. |
| producto | Observabilidad. La fila sale del canal que escribió el turno (Telegram, WhatsApp o Slack). |

### monitor-010

| Campo | Valor |
| --- | --- |
| versión | 0.2.91 |
| tipo | monitor |
| qué | Un rango (15 min, 1 h, 6 h, 24 h o desde/hasta) filtra la gráfica de cada mensaje y la de solicitudes. Cada una pagina: 6 mensajes y 12 solicitudes. Al abrir, y al cambiar el rango, se ve la página más reciente. El log se vuelve a leer con esa ventana, hasta 400 líneas. |
| por qué | Las filas crecían hacia abajo y no había forma de mirar solo un tramo. La gráfica de solicitudes no seguía el mismo recorte. |
| dónde | `monitorFreshness` en `project.ts`, el rango y los paginadores en `designer.ts`, `readServiceLogs` en `extension.ts` |
| prueba | Nueve `turn started` siguen siendo nueve filas. `24h` pide frescura `1d`. Un desde de 90 min pide `2h`. La página en español tiene Rango, Anteriores y Recientes, y la gráfica de mensajes queda encima de la de solicitudes. |
| producto | Observabilidad. El mismo rango y la misma página corta sirven para cualquier canal. |

### agente-003

| Campo | Valor |
| --- | --- |
| versión | 0.2.81 |
| tipo | agente |
| qué | Guardar escribe `local: { workspaceDir: "/srv/agent/bot" }`. Si el Dockerfile todavía arranca con `serve --dir /srv/agent`, Guardar también lo reescribe. Un Dockerfile distinto se deja como está. |
| por qué | `cwd` abre `/srv/agent/bot/<sesión>` en cada mensaje. El índice no se reutiliza (`servedFromCache: false`) y, sin raíz git, el runtime camina hasta la raíz del disco. En la revisión `00001-zt9` eso fueron 48 s de preparación y 6 min 33 s hasta terminar el turno. |
| dónde | `emitSdk` en `project.ts` |
| prueba | El canal de Telegram afirma `workspaceDir` y que no queda `local: { cwd:`. Guardar sobre un Dockerfile viejo vuelve a escribir `git init`. Un `FROM scratch` no se toca. |
| producto | La carpeta del agente. Entra en la imagen al guardar, construir y desplegar. La imagen ya publicada no cambia hasta ese ciclo. |

### despliegue-012

| Campo | Valor |
| --- | --- |
| versión | 0.2.81 |
| tipo | despliegue |
| qué | La imagen instala `git` y ejecuta `git init --quiet /srv/agent/bot`. `node_modules` queda al lado, fuera de esa raíz. El `chown` ya no recorre `node_modules`. |
| por qué | El harness corta el recorrido en la raíz git más cercana. La imagen anterior no tenía ninguna, así que cada turno recorría `node_modules`. |
| dónde | `dockerFile` en `project.ts` |
| prueba | El Dockerfile generado contiene `git init --quiet /srv/agent/bot`. Sin esa línea, `deliveryCheck` devuelve `docker-git`. |
| producto | La imagen. Hay que construirla y desplegarla. Instalar el plugin no cambia la revisión que ya sirve. |

### despliegue-013

| Campo | Valor |
| --- | --- |
| versión | 0.2.82 |
| tipo | despliegue |
| qué | Al arrancar, la imagen crea `/var/lib/agent-sdk`, se lo entrega a `node` con `setpriv` y solo entonces ejecuta `serve`. |
| por qué | Compose monta un volumen de root encima de esa carpeta. Con el proceso ya en `node`, el arranque murió con `EACCES` al abrir `platform-schedule-names.json`. El aviso de `--allow-anonymous` y el de GitHub no detienen el proceso. |
| dónde | `dockerFile` en `project.ts` |
| prueba | El Dockerfile generado contiene `setpriv --reuid=node` y `chown node:node /var/lib/agent-sdk`, y no deja `USER node` antes del comando. |
| producto | La imagen. Hay que construirla de nuevo. La revisión que ya sirve no cambia hasta el despliegue. |

### despliegue-014

| Campo | Valor |
| --- | --- |
| versión | 0.2.83 |
| tipo | despliegue |
| qué | La pestaña de GCP y el pliegue del log se recuerdan. Una línea nueva baja el log solo si ya estabas al final. Guardar el mismo Dockerfile no vuelve a escribir el archivo. |
| por qué | Mientras la consola escribía, cada escritura del Dockerfile disparaba otro render. Monitoreo volvía a Estado, Subir se deshacía y el log saltaba al final. |
| dónde | `designer.ts`, `emitSdk`, el vigilante de `extension.ts` |
| prueba | El HTML trae `gcpPane` y `followGcpLog`. Un segundo `emitSdk` no cambia la fecha del Dockerfile. |
| producto | La pantalla de despliegue. Hace falta instalar el plugin. La imagen no cambia. |

### despliegue-015

| Campo | Valor |
| --- | --- |
| versión | 0.2.84 |
| tipo | despliegue |
| qué | Al arrancar, `chown -R` entrega a `node` la carpeta de estado y los archivos que ya están dentro. |
| por qué | El volumen ya tenía `platform-schedule-names.json` de root, modo 644. Cambiar el dueño de la carpeta no alcanza: `node` no puede abrir ese archivo y `serve` sale con `EACCES`. |
| dónde | `dockerFile` en `project.ts` |
| prueba | El Dockerfile generado contiene `chown -R node:node /var/lib/agent-sdk`. |
| producto | La imagen. Hay que construirla de nuevo. El volumen de PRUEBA-2 ya quedó con el dueño corregido. |

### despliegue-016

| Campo | Valor |
| --- | --- |
| versión | 0.2.85 |
| tipo | despliegue |
| qué | Actualizar distingue tres respuestas de gcloud: el servicio no existe, no hay cuenta activa, o la cuenta no puede leer el proyecto. |
| por qué | `Cannot find service [bigagent-telegram-desk]` se mostraba como «No se pudo leer la imagen que sirve Cloud Run». El servicio se había borrado. La cuenta sí contestó. |
| dónde | `cloudRunDescribeFailure` en `project.ts`, `showLiveImage` en `extension.ts` |
| prueba | Ese error de gcloud es `missing`. Una cuenta ausente es `auth`. `PERMISSION_DENIED` es `denied`. La frase en español nombra el servicio, el proyecto y la región, y dice que no es un error de sesión. |
| producto | La pantalla de GCP. Hace falta instalar el plugin. No cambia la imagen. |

### despliegue-017

| Campo | Valor |
| --- | --- |
| versión | 0.2.86 |
| tipo | despliegue |
| qué | Antes de soltar el proceso a `node`, el arranque pone `HOME=/home/node`. |
| por qué | El servicio ya escuchaba. El calentado de reglas intentó crear `/root/.cursor/...` y `node` no puede escribir en el home de root. El log fue `could not warm /srv/agent/bot: EACCES`. |
| dónde | `dockerFile` en `project.ts` |
| prueba | El Dockerfile generado contiene `HOME=/home/node`. |
| producto | La imagen. Hay que construirla de nuevo. |

### despliegue-018

| Campo | Valor |
| --- | --- |
| versión | 0.2.87 |
| tipo | despliegue |
| qué | La imagen parte de `node:22.23.5-slim`. |
| por qué | Con Node 22.13.1 el proceso escuchaba, abría la SQLite experimental y moría con código 139 (señal 11). La misma carpeta y el mismo estado, con Node 22.23.5, siguen en marcha y calientan `/srv/agent/bot` en 2 s. Las reglas locales tardaron 282 ms. |
| dónde | `dockerFile` en `project.ts` |
| prueba | El Dockerfile generado contiene `node:22.23.5-slim`. El arranque con la credencial, medido aparte, no sale 139. |
| producto | La imagen. Hay que construirla de nuevo. |

### agente-004

| Campo | Valor |
| --- | --- |
| versión | 0.2.88 |
| tipo | agente |
| qué | El menú de modelo incluye Grok 4.7, además de Grok 4.5 y Composer 2.5. Guardar escribe `id: "grok-4.7"`. |
| por qué | Auto ya es grok-4.7 con esfuerzo alto. La lista no dejaba elegir esa versión ni bajar el esfuerzo sobre ella para probar si la espera es el razonamiento. |
| dónde | `NAMED_MODELS` en `project.ts`, el menú de la tarjeta Agente |
| prueba | Guardar `grok-4.7` con esfuerzo bajo deja ese id y `value: "low"` en `bot/agent.ts`. |
| producto | La carpeta del agente. Entra al guardar, construir y desplegar. |

### despliegue-019

| Campo | Valor |
| --- | --- |
| versión | 0.2.89 |
| tipo | despliegue |
| qué | Desplegar toma la imagen del servicio `agent` de Compose, no la primera fila de `compose images`. |
| por qué | Construir dejó `prueba-2-agent` nueva (Node 22.23.5 y grok-4.7). Desplegar publicó el digest viejo `16198ed5` porque en la lista también estaba otro contenedor. Cloud Run creó la revisión 00003 con esa imagen y siguió muriendo con la señal 11. |
| dónde | `composeImageId` en `project.ts` |
| prueba | Si la primera fila es un contenedor suelto y la segunda es `prueba-2-agent-1`, el id elegido es el de `prueba-2-agent-1`. |
| producto | El botón Desplegar. Hay que instalar el plugin y pulsar Desplegar otra vez. La imagen buena ya está construida en la máquina. |

### despliegue-020

| Campo | Valor |
| --- | --- |
| versión | 0.2.92 |
| tipo | despliegue |
| qué | En Escala hay una casilla, encendida de origen: dejar CPU y memoria asignadas. Desplegar manda `--no-cpu-throttling`. Si se apaga, manda `--cpu-throttling`. |
| por qué | El canal responde 200 y sigue el modelo en `waitUntil`. Con el recorte, Cloud Run quita la CPU en cuanto cierra esa petición. En la revisión `00009-c2c` (4 CPU, recorte activo) los mensajes de las 15:15 a las 15:27 tardaron 14 s a 70 s sin recorrer reglas. |
| dónde | `cpuAlways` en `GcpLink`, la casilla `gcp-cpu-always`, `cloudRunArgs` |
| prueba | Un plan sin el campo pide `--no-cpu-throttling`. La página en español muestra la casilla encendida. |
| producto | La pantalla de escala y el comando de Cloud Run. Sirve en cualquier canal que conteste el webhook y siga trabajando. |

### monitor-001

| Campo | Valor |
| --- | --- |
| versión | 0.2.60 |
| tipo | monitor |
| qué | **Actualizar estado** lee Cloud Logging y dice si el último webhook entró y si el turno se canceló o falló. |
| por qué | El log crudo no decía si la persona había recibido respuesta. Un 200 del webhook no es una respuesta. |
| dónde | `agentSignal`, `parseLogEntries`, `readServiceLogs` |
| prueba | El incidente real (webhook 200 y `turn interrupted`) afirma «reply was not sent». |
| producto | Observabilidad. No depende de que la pantalla sea una extensión. |

### monitor-002

| Campo | Valor |
| --- | --- |
| versión | 0.2.62 |
| tipo | monitor |
| qué | Monitor tiene cifras con nombre, eje en milisegundos, leyenda y refresco de 15, 30 o 60 s. Al salir de la pestaña el refresco se detiene. |
| por qué | La gráfica eran rectángulos sin eje y un texto `4 · 0 · 47 ms`. |
| dónde | `paintChart` en `designer.ts` |
| prueba | La prueba de Cloud Run afirma `#gcp-chart` y el refresco en 30 s. |
| producto | Observabilidad. |

### monitor-003

| Campo | Valor |
| --- | --- |
| versión | 0.2.65 |
| tipo | monitor |
| qué | Llamadas, aceptadas, cortadas y carga de reglas son cifras distintas. Una llamada aceptada no cuenta como sin respuesta. La gráfica, mientras no exista `replied in`, se titula como tiempo de aceptación del webhook. |
| por qué | Doce llamadas aceptadas se mostraron como doce sin respuesta. El log real tenía webhooks 200 en milisegundos, una carga de reglas de 18 s y turnos `turn interrupted` solo cuando llegaba otro mensaje. |
| dónde | `monitorFacts` |
| prueba | Tres webhooks 200, dos líneas `turn interrupted` en el mismo segundo y `durationMs: 18063` dan aceptadas 3, cortadas 1 y carga 18063. |
| producto | Observabilidad. |

### monitor-004

| Campo | Valor |
| --- | --- |
| versión | 0.2.64 |
| tipo | monitor |
| qué | El texto del monitor usa el color de la pantalla. El estado es un punto. Aceptada es verde, sin respuesta es ámbar, rechazada es rojo. |
| por qué | El verde pálido teñía la frase completa y no se leía como un panel. |
| dónde | CSS de `.mon` en `designer.ts` |
| prueba | Revisión de la pantalla. `npm test` no mira el color. |
| producto | Observabilidad. |

## Cómo se usa para una aplicación

Se llevan lienzo, agente, conectar, despliegue y monitor. No se lleva el cascarón de la extensión. Una aplicación independiente de VS Code vuelve a hospedar esas cinco piezas. Este archivo es la lista de lo que ya se aprendió y no hay que volver a descubrir.
