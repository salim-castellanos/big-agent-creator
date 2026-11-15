# Plataforma — entrada para un agente

Léelo antes de modificar este repositorio. No abras todas las HUs ni todas las specs. Los identificadores de código quedan en inglés.

## Qué es

BigAgentCreator es una extensión de VS Code y Cursor. El lienzo escribe una carpeta. `agent-sdk serve` la carga. Docker la corre en esta máquina como una imagen. La misma imagen es la que después irá a Cloud Run. El modelo es el API de Cursor, con `CURSOR_API_KEY`. No hay otro ejecutor.

El git es `https://github.com/salim-castellanos/big-agent-creator`. El código está en `apps/extension/src/`.

| Archivo | Qué cambia |
| --- | --- |
| `project.ts` | La carpeta que sale del lienzo: canales, Docker, `deliveryCheck`, huecos del flujo |
| `designer.ts` | La pantalla |
| `extension.ts` | Docker, el chat del editor, secretos |
| `copy.ts` | Rótulos en inglés y en español. Los `id` no cambian |
| `project.test.ts` | `npm test`. Si no está aquí, no está hecho |

Lo que la carpeta ya hace: `docs/linea-base.md`. El orden de lo que sigue: `docs/05-backlog/04-cabeza/E-001-profesional/epic.md`. Cómo se prueba: `docs/calidad.md`.

## Cómo se cambia un comportamiento

1. Una HU en `docs/05-backlog/`.
2. Una spec y un runbook.
3. Después, `apps/`.
4. `npm test` en `apps/extension` en verde.
5. Una fila en `docs/mejoras.md`, con tipo y porqué. Sin esa fila, el cambio no sirve de insumo para la plataforma ni para una aplicación independiente.

Un typo que no cambia el qué no abre HU.

## Reglas que no se negocian

- El valor de un secreto no entra en la imagen, en el Dockerfile, en el log, en un manifiesto ni en el prompt de Preguntar. No leas `.env` para armar ese prompt.
- `CURSOR_API_KEY` llama al modelo. Hace falta cuando una flecha llega a Agent.
- `AGENT_SDK_BEARER_TOKEN` cierra la dirección del agente. En local puede estar vacío: Compose pone `BIGAGENT_ADMIT_LOCAL=1` y el proceso usa `--allow-anonymous`. En un túnel o en Cloud Run, vacío significa que cualquiera puede llamar.
- No escribas `local: { sandbox: true }`. Esta imagen no corre el sandbox.
- No parchees el aviso de OpenTelemetry del SDK.
- Soltar una tarjeta no la conecta.
- Un disparador cuya flecha no llega a Agent responde en código y no llama al modelo.
- Iniciar y Actualizar no se apagan solo porque Docker se está revisando. Se apagan mientras se construye o se detiene, y si `deliveryCheck` no está vacío.
- Si el contenedor está en marcha y el puerto 3000 no está publicado en esta máquina, no está “en marcha”. Iniciar lo publica otra vez.

## Despliegue local

`compose.yaml` publica `127.0.0.1:3000:3000`. El playground es `http://127.0.0.1:3000/playground`. Docker Desktop puede dejar el contenedor arriba sin abrir ese puerto. `composePortClosed` lo detecta.

Cloud Run es la primera nube y todavía no despliega. AWS Fargate es la segunda. No se hacen las tres a la vez. Antes de la nube va una imagen con digest.

## Preguntar

El botón **Asistente** abre el chat del editor con el nombre de las tarjetas, lo que falta y la regla de no inventar secretos. El chat del editor cambia los archivos. El lienzo vuelve a leerlos. Un valor de `.env` no entra en ese contexto.

## Prueba

```bash
cd apps/extension
npm test
```

Eso no llama a Telegram, WhatsApp, Slack, GitHub, GitLab, Bitbucket ni a una nube. Esos cables se prueban a mano, sin imprimir el token.
