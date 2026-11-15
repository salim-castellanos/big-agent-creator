# Pruebas reales

Optativas. No entran en `npm test`. El secreto vive en este workspace, que es donde se construye el plugin. La prueba crea una carpeta en blanco y desde ahí recorre el plugin. El valor no se imprime, no se commitea y no entra en la extensión empaquetada.

## Dónde lo pones

Un solo archivo, en el repo del plugin:

`ecosystem/big-agent-creator/.live/.env`

`.live/` está en `.gitignore`. No uses `examples/telegram-desk/.env`: ese ejemplo se copia a la extensión y no es el banco de la prueba. Si ya escribiste los valores ahí, muévelos a `.live/.env`.

Nombres. El que no tengas, déjalo vacío. La prueba dirá `vacío` y no llamará a ese servicio.

```
CURSOR_API_KEY=
AGENT_SDK_BEARER_TOKEN=
TELEGRAM_BOT_TOKEN=
TELEGRAM_WEBHOOK_SECRET=
WEBHOOK_SECRET=
CASES_TOKEN=
REVIEW_TOKEN=
PAGER_TOKEN=
GITHUB_WEBHOOK_SECRET=
GITHUB_TOKEN=
```

`AGENT_SDK_BEARER_TOKEN` puede quedar vacío en local. No pegues los valores en el chat.

## La carpeta que se prueba

Cada corrida crea `ecosystem/big-agent-creator/.live/workspace` vacía. Esa carpeta tampoco se versiona.

Desde ahí, el mismo camino que una persona:

1. Inicializar en blanco, o cargar un ejemplo (Hello, Telegram desk, Support desk, Change gate). Cargar un ejemplo no copia un `.env`.
2. Copiar a `workspace/.env` solo los nombres que ese proyecto pide y que en `.live/.env` tienen valor.
3. Simular flujo. Lo que falte queda nombrado. Lo que está, deja de salir en rojo.
4. Si el ejemplo es servible, Desplegar → Iniciar en esa carpeta. El Compose lee el `.env` de la carpeta nueva, no el de `.live`.

Hello, Support y Change gate se quedan en el paso 3 mientras sus secretos estén vacíos. Telegram sigue al servicio porque ese bot ya existe.

## Telegram, sin tocar el bot de producción

No se llama a `setWebhook` ni a **Register webhook**. Eso le quitaría la dirección al bot que ya funciona.

Sobre la carpeta nueva:

1. Los nombres obligatorios dicen `presente` o `vacío`. Nunca el valor.
2. `deliveryCheck` queda vacío.
3. `docker compose up --build -d`. Publica `127.0.0.1:3000`. Si ese puerto ya está tomado, se para el otro agente local antes. No se levantan dos.
4. `GET /playground` y `GET /v1/health` responden.
5. `getMe` lee el token. La salida es `telegram: ok` o el código HTTP.
6. `POST` al route local de Telegram con `X-Telegram-Bot-Api-Secret-Token`. Otro secreto recibe 401. El correcto no.
7. El log pasa por el filtro de Ship. Un valor de `.env` no aparece.

El mensaje desde la app de Telegram lo escribe la persona.

## Cómo se corre

Desde `apps/extension`:

`npm run live:telegram`

Eso lee `.live/.env`, vacía `.live/workspace`, carga Telegram desk y sigue el orden de arriba. No forma parte de `npm test`.

## Lo que este banco no reemplaza

`npm test` sigue siendo la puerta de cada cambio de código. Esta corrida es la capa del servicio. No pulsa el diseñador. Eso está en [pruebas-interfaz.md](pruebas-interfaz.md).
