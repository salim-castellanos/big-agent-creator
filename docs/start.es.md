# Empezar

[English](./start.md) | **Español**

BigAgentCreator es donde diseñas un agente, lo pruebas en tu máquina y lo dejas listo para correr. El lienzo es el diseño. Al guardar queda una carpeta. Desplegar convierte esa carpeta en una imagen.

El programa que ejecuta el agente es el Agent SDK (`@grok/agent-sdk`). Lee `bot/agent.ts` e `instructions.md` con `agent-sdk serve`. El lienzo escribe esa carpeta para que el SDK pueda cargarla.

El SDK llama al modelo de Cursor. Esa llamada usa `CURSOR_API_KEY`, tu clave de usuario de Cursor. No es la licencia del editor ni una clave de administrador de equipo. Si un camino llega a la tarjeta Agente y la clave está vacía, no puede responder. Si el disparador no llega a Agente, la respuesta sale en código y la clave no se usa. El valor va en Secretos. Queda en `.env` y no se copia a la imagen.

Docker tiene que estar abierto. Iniciar lo usa para construir la imagen y correr el agente. La misma imagen es la que después corre en AWS, GCP o Azure. Esta versión la ejecuta en esta máquina.

**English | Español** y **Ayuda** están al final del menú. Ayuda es esta página, en corto. `START.md` en una carpeta nueva apunta aquí, y `AGENTS.md` lleva al chat del editor.

## Tu primer agente

1. Abre una carpeta e inicialízala, o carga **Hello** desde Ejemplos. Hello tiene una tarjeta Agente y no usa Telegram.
2. Abre **Secretos** y pon `CURSOR_API_KEY`.
3. Abre **Desplegar** y pulsa **Iniciar**.
4. Abre el playground y escribe `hi`. La respuesta es `hello`.
5. Edita una tarjeta y guarda. Carga Telegram desk cuando quieras un chat de verdad.

## WhatsApp

1. En Diseño, agrega un disparador y pon el tipo `whatsapp`. Dibuja la flecha hasta Agente si la respuesta debe usar el modelo.
2. Abre Secretos. Pon `WHATSAPP_TOKEN` y `WHATSAPP_PHONE_NUMBER_ID` desde Meta → WhatsApp → API Setup. Inventa `WHATSAPP_VERIFY_TOKEN` (letras, números, `_`, `-`) y usa esa misma palabra en Meta.
3. Abre Conectar. Pulsa **Comprobar número**. Meta tiene que contestar antes de seguir.
4. Escribe tu número con el código de país y pulsa **Enviar prueba**. WhatsApp debe mostrar `hello`.
5. Abre Desplegar y pulsa **Iniciar**. Abre el túnel. En Meta, pon la dirección https más `/v1/channels/<nombre>/` y suscríbete a `messages`.

Una frase como «empieza por un mensaje de WhatsApp, responde con una base de conocimiento y, si no encontró, guarda la pregunta» son tres tarjetas: un disparador WhatsApp, una Guía o una Acción de lectura, y una Acción de escritura. `AGENTS.md` de una carpeta nueva le dice al chat del editor que haga ese corte.

Si la carpeta ya tiene trabajo, la primera carga lo guarda en `.keep/original`. **Restaurar mi carpeta** trae esa copia. Tu `.env` se queda.

## Editar

Selecciona una tarjeta. El panel de la derecha es esa tarjeta. Cámbiala y pulsa **Save**. El archivo de la carpeta cambia con ella. Mover y soltar se guardan solos.

Soltar una tarjeta no la conecta. Dibuja la flecha. El número de una tarjeta es el paso al que entra esa flecha. El mismo número puede correr a la vez. Un número mayor espera.

**Agent** es la única definición de la carpeta: `bot/agent.ts` e `instructions.md`. Un disparador llama al modelo solo si su flecha llega a esa tarjeta. Si no llega, el camino responde en código y no llama a un modelo. Puedes quitar Agent y Limits. Se vuelven a poner desde la biblioteca. Agent es uno. Otro razonador es un Subagent.

## Configurar

| Nombre | Dónde está el valor | Qué es |
| --- | --- | --- |
| `CURSOR_API_KEY` | `.env` | Clave de usuario de Cursor. Hace falta cuando un camino llama al modelo. |
| `TELEGRAM_BOT_TOKEN` | `.env` | El valor entero de BotFather, con los dos puntos. |
| `TELEGRAM_WEBHOOK_SECRET` | `.env` | Una palabra que inventas. Solo letras, números, `_` y `-`. |
| `AGENT_SDK_BEARER_TOKEN` | `.env` | Opcional. Vacío sirve para el primer arranque local. |

Los nombres viven en el proyecto. Los valores solo en `.env`. **Rebuild** en Ship recrea el contenedor para que lea el `.env` actual. El valor no se copia a la imagen.

Si cambias un secreto, Rebuild. Luego prueba otra vez el playground.

## Telegram

Cuando Hello conteste, carga **Telegram desk** o abre `examples/telegram-desk`. Un chat, el horario, y la negativa a un reembolso.

1. Crea el bot con BotFather. Pon el token en `TELEGRAM_BOT_TOKEN`.
2. Inventa `TELEGRAM_WEBHOOK_SECRET`.
3. Ship → Start.
4. Apunta un túnel HTTPS al puerto 3000. Déjalo abierto.
5. **Connect → Register webhook**. Pega la dirección `https://….trycloudflare.com`. El token del bot no va en `secret_token`.
6. Escríbele al bot `what are your hours?`.

## Los otros ejemplos

| Ejemplo | Qué es |
| --- | --- |
| [Hello](../examples/hello/README.md) | Solo el playground. Empieza aquí. |
| [Telegram desk](../examples/telegram-desk/README.md) | Un chat de verdad. |
| [Support desk](../examples/support-desk/README.md) | Bandeja, un lunes por la mañana, búsqueda y un caso. Esos servidores no los arranca este compose. |
| [Change gate](../examples/change-gate/README.md) | El lienzo completo. Telegram es el camino al que se le puede hablar. |

Cualquiera se carga desde **Examples**. **Restore my folder** devuelve la copia de `.keep/original`.

## Si se lo pides al chat

Abre este repositorio, o una carpeta creada por la extensión. Pídele al chat que lea `AGENTS.md` y `START.md` antes de editar. Esos archivos apuntan aquí. No pegues secretos en el chat.
