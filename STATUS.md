# Estado — BigAgentCreator

Retomar por aquí. No hay épicas. El corte es un MVP para decidir cómo seguir.

## Dónde está

`ecosystem/big-agent-creator/`. No entra al git del molde. Su git propio todavía no está abierto. El método está en `../../docs/`.

## Tienda

La primera ficha es la **0.2.0**. El icono es la opción B (`apps/extension/media/icon.png`). El texto de la tienda es `apps/extension/README.md`. Cómo publicarla está en `README.md`.

## Qué hace 0.1.0

Extensión en `apps/extension`. Compila a `out/extension.js`.

- Actividad **BigAgentCreator** y comando **Open designer**. El flujo abre una pestaña del editor.
- Sin la marca `.bigagent/project.json`: **Initialize workspace**. Muestra qué archivos ya están y cuáles faltan. Solo escribe lo que falta. Si la carpeta ya tiene `instructions.md`, tools o canales, el lienzo los carga y no los pisa.
- Nombres del lienzo: Trigger, Limits, Agent, Action, Guide, Service. Cada uno lleva un icono y una frase de para qué sirve. El archivo en disco sigue siendo channel, tool, skill o mcp.
- Con proyecto: lienzo (canales, agente, tools, skills, MCP). Clic en un nodo abre sus propiedades a la derecha. **Add** es un popup. Guardar escribe la carpeta.
- **Secrets:** el nombre queda en el proyecto; el valor va a `.env`.
- **Deploy:** el ambiente **Local** escribe Dockerfile, compose y `.dockerignore`. El valor de un secreto no entra en la imagen. AWS, GCP, Azure y Kubernetes se ven como siguiente paso, sin formulario.

## Agente de prueba

Tres carpetas. `examples/telegram-desk` es la mesa chica por Telegram: el primer despliegue que se puede probar de verdad. `examples/support-desk` es la mesa con base de conocimiento. `examples/change-gate` recorre toda la plataforma. Abre la carpeta y luego BigAgentCreator.

## Lienzo 0.1.17

La plataforma tiene seis escenarios: Design, Prove, Platform, Secrets, Connect y Ship. Design es el lienzo. Prove son las evaluaciones. Platform abre en el editor el código que el SDK no dibuja. Connect da de alta cada canal. Ship valida y construye la imagen local.

El ejemplo cabe en un óvalo para una foto. El guardado escribe `bot/` con el contrato del Agent SDK: modelo, herramientas del arnés, sandbox, horarios, subagentes, ganchos que solo observan, y servicios que el modelo no ve. Lo que es código queda en el procedimiento del componente.

Ship tiene **Rebuild**: imagen nueva y contenedor nuevo, para que el agente lea el `.env` actual sin copiar secretos a la imagen. El Compose local admite el playground con `--allow-anonymous` porque Docker no es loopback. Connect registra el webhook de Telegram: dirección https del túnel, Register apagado si el secreto tiene un carácter que Telegram rechaza, y el token no sale de `.env`. Ship no arranca una carpeta que `agent-sdk serve` rechazaría. `deliveryCheck` exige `package.json` con `"type": "module"`, dependencias `@grok/agent-sdk` y `zod`, Dockerfile con `npm install` y `--mode single`, `.dockerignore` que excluye `.env`, e imports `zod/v4` en lo generado. Si falta algo, el problema se lista y **Start** queda apagado. La misma regla está en `CONTEXT.md` (qué se considera hecho) y en `LECCIONES.md`.

El número de un paso sale del camino de las flechas, no del orden en que se dibujaron. El mismo número puede correr a la vez. Un número mayor espera a las flechas que llegan. Un ciclo se marca con ↻ y no inventa un orden.

Mover, soltar, conectar, borrar y guardar propiedades se escriben solos en la carpeta. Arriba a la derecha, **Saved** anima el check sin bloquear. **Undo** (Ctrl+Z) y **Redo** (Ctrl+Y) deshacen ese cambio. **Duplicate** (Ctrl+D), copiar y pegar (Ctrl+C, Ctrl+V) y **Delete** actúan sobre el componente seleccionado. Agent y Limits salen al inicializar y se pueden quitar. Una copia queda suelta hasta que la conectas.

## Cómo abrirlo

En `ecosystem/big-agent-creator/apps/extension`: `npm install`, `npm test`, `npm run compile`, F5 (**BigAgentCreator**). La ventana nueva abre `playground/`. Icono BigAgentCreator → **Open designer**. El agente se escribe en esa carpeta, no dentro de la extensión.

## Fuera de este corte

Chat que edita la carpeta, AWS, GCP, Azure, Kubernetes, y un ejecutor de modelo distinto al API de Cursor.
