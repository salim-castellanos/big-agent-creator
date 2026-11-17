# Demoras

Tiempos medidos de un agente ya desplegado, y qué hacer con ellos. Sirve para seguir este producto y para escribir otro runtime. Las mejoras que ya entraron al plugin están en `docs/mejoras.md`. Aquí queda la evidencia y lo que todavía no está cerrado.

No se pegan secretos, cuerpos de mensajes ni tokens.

## La llamada que se midió

Servicio `bigagent-telegram-desk`, revisión `bigagent-telegram-desk-00001-zt9`, proyecto `mistratos`, región `us-central1`. El proceso escribió `Telegram desk listening (@grok/agent-sdk 0.6.0)`. La instancia llevaba encendida desde las 02:26 (hora de Bogotá, UTC−5) por `min-instances`. No fue un arranque en frío.

Un mensaje de Telegram entró a las 02:40:40. El runtime terminó el turno a las 02:47:14. `replied in 393454ms` (6 min 33 s). No hubo línea `turn failed`.

| Hora | Línea | Duración | Qué contó |
| --- | --- | --- | --- |
| 02:40:40 | `[telegram] turn started` | — | Nuestro canal. El webhook ya había respondido 200. |
| 02:40:40 → 02:44:19 | ninguna | ~3 min 40 s | El proceso no escribió qué hacía. |
| 02:44:57 | `LocalCursorRulesService load completed` | 37,4 s | 1 regla. |
| 02:45:08 | `AgentSkillsCursorRulesService load completed` | 48,8 s | 13 reglas, 2 skills, `servedFromCache: false`. Empezó junto con el anterior: el reloj de pared de los dos es ~49 s, no 86 s. |
| 02:46:14 | `computeGlobalCache: slow` | 14,7 s | `cursorRules` 14,2 s, `subagents` 8,9 s, `codebaseRef` 7,2 s, `cloudRule` 5,3 s. Van en paralelo. `ruleCount` 1. |
| 02:47:14 | `[telegram] replied in` | 393 s desde el inicio | El modelo cerró. Esta línea se escribe antes de `sendMessage` a Telegram, así que no incluye el envío. |

Misma firma en revisiones anteriores (15 nov): `AgentSkillsCursorRulesService` con 13 reglas, 2 skills y `servedFromCache: false`, entre 17 s y 90 s. `ruleCount: 0` en `LocalCursorRulesService` tardó 18 s y 25 s. El costo es el recorrido del disco, no la cantidad de reglas del agente.

Tres mensajes posteriores (02:49:06, 02:49:52, 02:50:29) escribieron `turn started` y no escribieron `replied in` en la ventana leída. Cada uno abre otro turno mientras el anterior sigue adentro.

## Quién es dueño de cada tramo

| Tramo | Dueño | Dónde vive |
| --- | --- | --- |
| Aceptar el webhook (milisegundos) | Cloud Run y nuestro canal | El canal responde 200 y sigue en `waitUntil`. |
| ~3 min 40 s sin línea | `@cursor/sdk` 1.3.0, dentro del turno | No hay nombre de fase. No es Telegram. |
| 37 s y 48 s de preparación | `LocalCursorRulesService` y `AgentSkillsCursorRulesService` | `@cursor/sdk`. Recorren hasta la raíz git más cercana. Sin raíz git llegan a `/` y entran en `node_modules`. |
| 15 s de `computeGlobalCache` | El mismo SDK | Vuelve a pedir reglas, regla de nube, referencia del repo y subagentes. |
| Lo que falta hasta `replied in` | La llamada al modelo | No es el recorrido de reglas. |
| El envío a Telegram | Nuestro `replyTelegram` | No está en `replied in`. |

`.cursorignore` con `node_modules` y `local.cwd` estaban en la carpeta. La revisión igual recorrió 48 s y encontró las 13 reglas y los 2 skills del propio paquete. Esos dos campos no son el directorio que usan estos servicios.

## Qué ya cambió el generador, y qué no está medido

En el plugin 0.2.81, sin desplegar todavía una revisión que lo pruebe:

- `local.workspaceDir` es `/srv/agent/bot`. Un solo directorio para todas las sesiones. El SDK puede calentarlo al arrancar (`prewarmSharedWorkspace`) y la clave del índice deja de cambiar en cada mensaje.
- La imagen instala `git` y hace `git init` de `/srv/agent/bot`. El harness corta el recorrido en esa raíz. `node_modules` queda en `/srv/agent/node_modules`, fuera de ella.

La prueba de que una revisión nueva lo cumplió es una línea `LocalCursorRulesService` con `durationMs` de alrededor de un segundo, y en el arranque `warmed /srv/agent/bot` con un tiempo corto. Hasta ver esas líneas, la revisión que sirve sigue siendo la de 48 s.

Ese cambio no explica los ~3 min 40 s sin línea ni el tramo del modelo. Esos siguen dentro del SDK.

## El SDK no es un código al que podamos mandar un parche

En la imagen corren dos paquetes:

| Paquete | Versión | Papel |
| --- | --- | --- |
| `@grok/agent-sdk` | 0.6.0 | El proceso `agent-sdk serve`, los canales, el generador de sesión. |
| `@cursor/sdk` | 1.3.0 | El harness. Ahí están las dos clases de la preparación y `computeGlobalCache`. |

Los dos traen el mismo `LICENSE.md`: © Anysphere Inc. Todos los derechos reservados. El uso queda bajo las condiciones de Cursor (`https://cursor.com/terms-of-service`). No es una licencia libre. No autoriza a publicar el código ni a tratar un parche nuestro como parte del producto de ellos.

El README de `@grok/agent-sdk` dice que es la versión abierta del motor de Bugbot y de otros bots de Cursor. El paquete publicado no incluye `src/`. Declara un export `anysphere-source` hacia esa carpeta, y la carpeta no viene en el tarball. Lo instalado es `dist/` compilado.

`repository` de los dos apunta a `https://github.com/cursor/cursor`. Ese repositorio es público, tiene los issues apagados y en la raíz solo están `README.md`, `SECURITY.md` y `.github`. No está el código del harness. No hay una rama donde abrir un pull request con el arreglo del recorrido.

Se puede redactar un informe y enviarlo por el canal que Cursor publique para eso. Este archivo es ese informe. Este turno no lo envía.

### Informe para el fabricante

Medido en `@grok/agent-sdk` 0.6.0 con `@cursor/sdk` 1.3.0, Cloud Run, un agente sin reglas propias:

1. Si el directorio de trabajo no tiene raíz git, el recorrido de reglas y skills sigue hasta la raíz del disco. En un contenedor eso entra en `node_modules` y tarda decenas de segundos aunque `ruleCount` sea 0. Un `.cursorignore` con `node_modules` no lo cortó. Hace falta un límite: el directorio de `serve`, y no descender a `node_modules`, cuando no hay raíz git.
2. `local.cwd` arma `<cwd>/<sessionId>`. El comentario del tipo dice que así la caché del índice no pega y cada sesión paga el recorrido. El log lo confirma: `servedFromCache: false` en cada llamada. Un `serve` de larga vida necesita una clave de índice estable, o un fallo de caché que sea barato.
3. `computeGlobalCache` avisa si pasa de 1 s. El tope de 1 s que construye solo se lo pasa a la referencia del repo. Las reglas esperaron 48 s. Un índice viejo, servido al momento, vale más que bloquear a la persona.
4. Las fases escriben al terminar, no al empezar. Entre `turn started` y el primer `load completed` hubo ~3 min 40 s sin una línea. Hace falta el nombre de la fase al entrar, y el directorio que se está recorriendo.
5. El tiempo hasta la respuesta de la persona no existe en el SDK. Nuestro canal de Telegram lo escribe, y lo escribe antes del `sendMessage`. Un turno de cualquier canal debería cerrar con aceptación, preparación, caché, modelo y envío.

## Qué se puede cachear

La caché que ya tiene el SDK es de proceso. `servedFromCache` es la prueba. Una revisión nueva, un despliegue o una instancia que nace pagan el recorrido otra vez. `min-instances` 1 conserva el proceso. No conserva el índice a través de un despliegue.

Calentar al arrancar solo ocurre con `local.workspaceDir`, runtime local, y sin un directorio de sesión distinto. El log es `[bdk] warmed <dir> in Nms` o `[bdk] did not warm <dir>: <motivo>`. Con `cwd`, el directorio no existe hasta que llega la sesión, y el precalentado no corre.

| Pieza | ¿Genérico? | Regla |
| --- | --- | --- |
| Índice de reglas, skills e ignore de un directorio estable | Sí | Misma carpeta para todo el proceso. Cualquier canal lo paga, porque corre dentro del turno, no en el HTTP. |
| Raíz git del directorio de trabajo, con `node_modules` fuera | Sí | Hace el fallo de caché barato. No depende del flujo. |
| Precalentar ese directorio al arrancar el proceso | Sí | La primera persona no espera el recorrido. Hace falta `workspaceDir`. |
| La respuesta del modelo | No | Cada mensaje es otra generación. Guardar la respuesta anterior contesta otra pregunta. |
| Resultados de herramientas que llaman a un sistema vivo | No, salvo que la herramienta lo diga | El runtime no puede decidir que un cobro, un ticket o un mensaje son estables. |
| El envío a Telegram, Slack u otro canal | No | Es un efecto. No se reutiliza. |
| Estado de la conversación (`continuationToken`, historial) | No entre personas | Se guarda por conversación. Compartirlo mezcla chats. |
| Árbol de archivos de trabajo | Depende del flujo | `workspaceDir` lo comparte: un archivo que escribe un turno lo ve el siguiente. Sirve para un mostrador que no edita un repo por persona. Un flujo que edita un checkout distinto por usuario necesita un directorio por sesión, y entonces la clave del índice cambia. El recorrido de esa sesión tiene que ser corto (su propia raíz git, sin `node_modules`). |
| Skills y reglas que van dentro de la imagen | Sí, con el índice del directorio | No cambian hasta el próximo despliegue. No se vuelven a leer en cada mensaje si el índice pegó. |
| Regla de nube (`cloudRule` en `computeGlobalCache`) | Con caducidad, no para siempre | En la medición tardó 5,3 s. Es una consulta, no el disco. No vimos el plazo que usa el SDK. Un runtime nuestro le pondría un plazo y serviría la copia anterior. |
| MCP y conexiones con identidad | No al arrancar el proceso | El precalentado del SDK omite las conexiones autenticadas porque todavía no hay sesión. Cada identidad las resuelve en su turno. |

La regla genérica: hacer barato el fallo de caché, y compartir el índice solo cuando las sesiones pueden compartir el árbol. Lo que no se cachea es lo que cambia con la persona, con el mensaje o con un sistema de afuera.

## Qué mirar en el monitor, y qué no

Hace falta para decidir el siguiente arreglo:

- La espera de la persona desde el último mensaje sin `replied in`. La aceptación del webhook no es esa espera.
- La barra por interacción: aceptación, preparación, modelo, lo que sigue en curso. Los trozos tienen que sumar el tiempo de esa interacción.
- Estas líneas, cuando el log las traiga: `durationMs` de los dos servicios de reglas, `servedFromCache`, `skillCount`, el desglose de `computeGlobalCache`, `turn started`, `replied in`, `turn failed`, y al arrancar `warmed` o `did not warm`.
- Si otro mensaje abrió un turno nuevo antes de `replied in`. Con `maxRunningTurns` los demás esperan o se reemplazan. Sin esa marca, una preparación de 48 s puede ser el turno anterior.

No hace falta para este problema:

- El p95 del `httpRequest.latency`. En esta llamada fue de milisegundos y la persona esperó minutos.
- `ruleCount` como si midiera costo. Cero reglas tardó decenas de segundos.

Todavía no está en el monitor, y un runtime nuestro lo escribiría en una sola línea por mensaje:

| Campo | Para qué | Hoy |
| --- | --- | --- |
| Directorio recorrido y si había raíz git | Saber si el corte del `git init` entró | No se escribe |
| `servedFromCache` | Saber si el índice se reutilizó | Solo en el texto del SDK |
| Milisegundos de `cloudRule`, `codebaseRef`, `subagents`, `cursorRules` por separado | El de 15 s mezcla cuatro cosas | Una sola advertencia si pasa de 1 s |
| Inicio de fase, no solo el final | Los ~3 min 40 s no tienen nombre | El SDK escribe al terminar |
| Envío al canal | `replied in` es antes del `sendMessage` | No se mide |
| Edad del proceso y el `warmed … in Nms` | Separar el primer mensaje del resto | Está en el log de arranque, no en el panel |

## Un agente mínimo no cabe en una máquina pequeña

Impresión de la tarde del 17 nov 2026, con el mismo agente de Telegram: 0 skills propios, 1 regla, sin herramientas (`tools: []`), modelo Composer 2.5 con esfuerzo bajo. La misma imagen en el PC de quien lo construye y en Cloud Run (`us-central1`, mínimo 1, máximo 1). El apuntamiento de Telegram solo cambia la máquina. No cambia el programa.

| Paso | PC local | Cloud Run, 1 CPU, 1 GB | Cloud Run, 2 CPU, 2 GB |
| --- | --- | --- | --- |
| Calentado de `/srv/agent/bot` | 1,2 s y 1,5 s | 73 s y, en una revisión anterior, 89 s | no se volvió a anotar |
| Skills | 45–83 ms, 0 skills | 12 s | 5,2 s, una sola vez |
| Reglas | 70–99 ms, 1 regla | 37 s | 6,1 s, una sola vez |
| Segunda pasada `computeGlobalCache` | no apareció | 33 s, de ellos 32 s otra vez en reglas | no apareció en el 2.º y 3.er mensaje |
| De la entrada a la respuesta | casi inmediata con Composer | 3 min 36 s (revisión `00005-hq9`) | 66 s, 33 s y 65 s (revisión `00008-jkq`) |

Subir de 1 a 2 CPU bajó las reglas de 37 s a 6 s. Subir la memoria a 2 GB no dejó una señal: el proceso no se quedó sin RAM. El recorrido es cálculo y disco, no un almacén grande. De 2 a 4 CPU puede recortar unos segundos de ese trabajo. No convierte el minuto del modelo en la respuesta del PC.

En los mensajes ya calientes de 2 CPU no hubo un segundo `durationMs`. El índice se reutilizó. Aun así cada respuesta tardó medio minuto o un minuto. Ese resto es la llamada al modelo desde `us-central1`. En el PC, la misma imagen y el mismo Composer contestan casi al momento. Más CPU en Cloud Run no compra esa cercanía.

### La estrategia de cargar reglas no sirve para este tamaño

Un agente que no trae skills y tiene una regla no debería pagar un paseo por el disco. Hoy el runtime lo hace igual, y en la máquina de 1 CPU lo hizo dos veces en el mismo turno: al entrar y otra vez dentro de `computeGlobalCache`. `servedFromCache: false` en la primera pasada. `ruleCount` 0 o 1 no abarata el paseo.

Lo que se probó y sí cambió el paseo, sin volverlo barato en Cloud Run:

- `workspaceDir` en `/srv/agent/bot` y un `git init` de esa carpeta, para que el paseo no entre en `node_modules`. Ahí se pasó de ~48 s (13 reglas y 2 skills del propio paquete) a encontrar 0 skills y 1 regla.
- Node 22.23.5 en lugar de 22.13.1. Con 22.13.1 el proceso escuchaba, abría la SQLite experimental y moría con la señal 11 (código 139) en cuanto había credencial. Con 22.23.5 el mismo arranque sigue en pie. En local calentó en 2 s y las reglas tardaron 282 ms.

Lo que un runtime propio haría con un agente tan pequeño:

- No recorrer el disco si el agente no declara reglas ni skills. Un índice vacío es un dato, no una búsqueda.
- Construir ese índice una vez al arrancar el proceso, o hornearlo en la imagen, y no volver a armarlo dentro del turno del modelo.
- Medir CPU y disco del paseo aparte de la espera de red del modelo. Si no, se sube RAM creyendo que el minuto es memoria.

Eso no es cachear la respuesta. La respuesta cambia con cada mensaje. Tampoco es un índice compartido entre personas que editan árboles distintos: ahí cada sesión tiene su carpeta, y el fallo de caché tiene que ser barato.

## Caché, memoria y contexto

Cuatro cosas distintas se mezclaron en la conversación. No son la misma caché.

| Caché | Qué guarda | Qué se vio |
| --- | --- | --- |
| Reglas y skills | El índice del directorio de trabajo | La primera pasada escribe `servedFromCache: false` aunque el calentado ya terminó. El 2.º y 3.er mensaje, con el proceso vivo, no volvieron a escribir `durationMs`. El índice sí se reutilizó ahí. |
| Contexto del turno | `computeGlobalCache`: reglas, regla de nube, referencia del repo y subagentes, en paralelo | En 1 CPU tardó 33 s y 32 s fueron otra vez reglas. El tope de 1 s del SDK solo se lo pasa a la referencia del repo. Las reglas esperan lo que tarde el disco. |
| Sesión | SQLite de Node (`node:sqlite`) en `/var/lib/agent-sdk`: sesiones y el catálogo | Es memoria en disco del proceso, no un Redis. El aviso «experimental» no tumba el proceso. Node 22.13.1 sí se cae al abrirla con credencial (señal 11). 22.23.5 no. |
| Respuesta del modelo | Nada que hayamos guardado | No se debe. Cada mensaje es otra generación. |

`local.cwd` abre una carpeta nueva por sesión (`<cwd>/<sessionId>`). La documentación del SDK dice que así el índice no pega nunca. `workspaceDir` usa una sola carpeta para todas las sesiones y se puede calentar al arrancar. Ese cambio es el que dejó de escribir un segundo `durationMs`. El precio: las sesiones comparten el árbol. Sirve para un mostrador que no edita un repo distinto por persona. No sirve para un flujo en el que cada persona tiene su checkout.

La caché es del proceso. Una revisión nueva, un despliegue o una instancia que nace la pagan otra vez. Mínimo 1 conserva el proceso. `cpu-throttling: true` lo deja sin CPU entre mensajes; al llegar la petición los núcleos vuelven. El índice puede seguir en memoria, pero el primer trabajo de esa petición corre sobre una CPU que acaba de despertar.

`.cursorignore` con `node_modules` no cortó el paseo. El tiempo no bajó al tener 0 reglas. Contar reglas no mide si la caché sirvió. Sirve `servedFromCache` y la ausencia de un segundo `durationMs`.

Memoria RAM: de 1 GB a 2 GB no hubo OOM ni un salto de velocidad atribuible al almacén. El paseo cabe en poca RAM y gasta CPU. Subir RAM para «tener más caché» no acelera este agente. La caché que falta no es un bloque más grande de memoria: es no recalcular el índice dentro del turno, y no pasear el disco cuando el índice está vacío.

Lo que un runtime propio separaría:

- Índice de reglas y skills, de solo lectura, listo antes del primer mensaje. Si el agente no declara nada, el índice es vacío y el turno no lo busca.
- Contexto del turno, armado con ese índice ya hecho. Si el índice se recalcula aquí, la caché de reglas no existió.
- Estado de la conversación, por chat, en disco, sin mezclar el cronómetro ni los archivos de otra persona.
- Cupo del modelo, que no es caché. `resource_exhausted` es capacidad del proveedor. Reintentar enseguida no la crea.

### Otros tropiezos de la misma tarde

| Qué se vio | Qué significa |
| --- | --- |
| Auto ya es `grok-4.7` con esfuerzo alto, según la documentación del SDK 0.6.0 | Pedir «la última Grok» en Auto no cambia el modelo. El esfuerzo alto alarga la espera. |
| Escrito `grok-4.7` con esfuerzo bajo, el turno murió al momento: `AI Model Not Found` / `Invalid parameters for registry model: "grok-4.7"` | El registro que atiende esta clave no acepta ese nombre. La doc y el registro no coinciden. |
| `grok-4.5` con esfuerzo bajo: `[resource_exhausted]` | El SDK dice que, en el primer turno, eso es falta de capacidad del modelo. La carpeta, la imagen y Telegram ya habían hecho su parte. |
| Composer 2.5 con esfuerzo bajo sí contesta | Es el modelo con el que se comparó local y Cloud Run. |
| `replied in` de los mensajes siguientes cuenta desde el primer `startedAt` del chat | El número miente. El reloj de pared hay que sacarlo de `turn started` a `replied in`. |
| Construir dejó `prueba-2-agent` nueva y Desplegar publicó el digest viejo `16198ed5` | `compose images` devuelve varias filas. La primera no era el servicio `agent`. La revisión `00003` siguió en Node 22.13.1 y con señal 11. |
| `cpu-throttling: true` con mínimo 1 | La instancia espera encendida, pero Cloud Run solo da CPU mientras la petición HTTP sigue abierta. El canal de Telegram responde 200 en milisegundos y sigue el modelo en `waitUntil`. Esa continuación queda fuera de la petición. |

## Los mensajes de las 15:15 a las 15:27

Revisión `bigagent-telegram-desk-00009-c2c`, 4 CPU, 2 GB, `cpu-throttling: true`, `us-central1`, imagen `f1ac3430110f`. Leído el log de 45 minutos. No hay `resource_exhausted`, ni timeout, ni `ECONN`, ni 429. El webhook aceptó en 5–12 ms. En estos mensajes no hay `durationMs`: el índice de reglas ya no se recorrió.

El número de `replied in` sigue contando desde el primer mensaje (621 s, 843 s, 1 068 s, 1 238 s). El reloj de pared, de `turn started` al sello de `replied in`, es este:

| Hora Bogotá | Pared |
| --- | --- |
| 15:15:45 | 70 s |
| 15:20:23 | 14 s |
| 15:20:46 | 15 s |
| 15:21:15 | 29 s |
| 15:23:25 | 57 s |
| 15:26:35 | 38 s |

Esa dispersión, sin errores de red, es tiempo de generación o de un proceso que no puede leer la respuesta a tiempo. Un salto de región mueve la ida y vuelta en décimas de segundo. No explica 14 s ni 70 s. `us-central1` ya está en Estados Unidos, que es donde atiende el registro del modelo. Acercar el servicio a Bogotá alarga ese tramo si el modelo sigue en Estados Unidos.

La prueba que toca es quitar el recorte de CPU (`cpu-throttling: false`) y bajar a 1 CPU para no pagar 4 núcleos todo el día. Si esos mensajes caen cerca del tiempo local, el recorte era la causa. Si siguen en decenas de segundos y el log sigue limpio, el tiempo es del modelo y otra región no lo baja.

## Con la CPU siempre asignada, 1 CPU y 1 GB bastan

Revisión `bigagent-telegram-desk-00010-pg4`, desde las 15:35 (Bogotá). `cpu-throttling: false`, 1 CPU, 1 GB, mínimo 1. Al arrancar, antes de cualquier mensaje: `warmed /srv/agent/bot in 1072ms`, reglas en 112 ms y 145 ms. En la revisión anterior, con 4 CPU y el recorte activo, ese mismo calentado tardó 69 s y ocurría dentro del primer mensaje.

El número de `replied in` sigue sin reiniciarse. El reloj de pared, de `turn started` al sello de `replied in`:

| Hora Bogotá | Pared |
| --- | --- |
| 15:40:54 | 2,2 s |
| 15:41:06 | 1,6 s |
| 15:41:23 | 5,8 s |
| 15:41:55 | 1,9 s |
| 15:42:18 | 4,8 s |
| 15:42:47 | 3,4 s |
| 15:44:10 | 3,7 s |

El webhook siguió en 3–10 ms. No hubo `durationMs` dentro de estos turnos ni `turn failed`. El mismo agente, con 4 CPU recortadas, había tardado 14–70 s. La causa era el recorte, no el tamaño de la máquina ni la región.

`gcloud run deploy` acepta `--[no-]cpu-throttling`. Desplegar, con la casilla encendida, arma ese flag `--no-cpu-throttling` a partir de `cpuAlways` guardado en `.bigagent/gcp.json`. Con la casilla apagada arma `--cpu-throttling`. Un plugin anterior no manda el flag: el próximo Desplegar puede volver a recortar la CPU.
