# Mejoras

Historial de lo que ya quedó en el código, y por qué. Es insumo para seguir la plataforma o para sacar una aplicación independiente de VS Code. No es una lista de ideas.

`LECCIONES.md` guarda dolores de ejecutar. Este archivo guarda mejoras hechas. `GAPS.md` guarda huecos del molde.

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
