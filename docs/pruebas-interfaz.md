# Pruebas de la interfaz

Sí se puede probar el diseñador como una persona. El panel es HTML. Los clics, el texto y los botones apagados se ven en un navegador. El editor solo recibe el mensaje que ese clic ya envió.

Esto va antes de la imagen con digest y de Cloud Run. `npm test` y `npm run live:telegram` siguen. Ninguno de los dos pulsa la pantalla.

## Dos capas

| Capa | Qué hace una persona | Dónde corre | Secreto |
| --- | --- | --- | --- |
| Pantalla | Ve, pulsa, escribe, lee el resultado | Playwright abre el mismo HTML del diseñador | No. El valor de prueba es ficticio |
| Editor | El mensaje llega a la carpeta, Docker y el panel de verdad | Una sola corrida optativa, con la ventana del editor | `.live/.env`, sin imprimirlo |

La capa de pantalla es `npm run test:ui`, desde `apps/extension`. Ocho recorridos: inicio en blanco, lienzo y conexión, secretos, simular flujo, carpeta que el SDK rechaza, Iniciar y el filtro del log, Preguntar, y español más ayuda, casos y conectar. No entra en `npm test`. Si un clic deja de verse, `test:ui` falla.

La capa del editor no se automatiza entera. El webview de Cursor vive en un iframe de Electron y se rompe con facilidad. Una corrida, el camino de Telegram desk hasta Iniciar, basta para saber que el puente responde. El resto de los clics ya quedó fijado en la capa de pantalla.

## Cómo se pulsa sin abrir Cursor

El script del panel llama a `acquireVsCodeApi()`. La prueba lo sustituye por una lista de mensajes. Playwright carga el HTML de `designerHtml`, pulsa, y comprueba dos cosas: lo que quedó visible y el mensaje enviado. La respuesta del editor es el siguiente HTML, generado con el mismo estado que ese mensaje produciría. La prueba lo carga y sigue.

Un valor escrito en Secretos no vuelve a aparecer en el HTML. El campo es de contraseña y la lista solo dice si está puesto.

## Camino de una persona nueva

Uno por uno. El primero que falla detiene el resto.

1. Carpeta en blanco. El recuadro «Agentic flow examples» está primero. Telegram desk es un botón azul con título y una frase. Inicializar en blanco va después y no es el único botón azul.
2. Pulsar Telegram desk envía `create-example` con `telegram-desk`. La pantalla siguiente muestra el lienzo y el nombre del agente.
3. Un secreto vacío se ve en rojo. «Set TELEGRAM_BOT_TOKEN in Secrets» envía `open-secret`. La pantalla de Secretos abre con ese nombre y el foco en el valor.
4. Escribir un valor ficticio y Guardar envía `secret`. El valor no queda en el HTML.
5. Simular flujo abre un diálogo legible, con listo o con grupos (secretos, tarjetas, carpeta). No pinta una sombra roja sobre el lienzo. Cerrar lo oculta.
6. En Desplegar, Iniciar está activo si la carpeta sirve. El clic envía `ship` / `start`. Un mensaje `ship-face` cambia la etiqueta a Running y deja escrito el filtro del log.
7. Preguntar muestra Aplicar y Ahora no cuando hay una propuesta. Aplicar envía `apply-proposal`. Ahora no no escribe.
8. El cambio a español cambia los rótulos y deja los mismos controles.

Inglés y español se miran en los pasos 1, 5 y 6. El resto corre en inglés.

## La corrida dentro del editor

Una sola, optativa, después de que `test:ui` esté verde: `npm run live:ui`.

Abre el editor de pruebas con la extensión, sobre `.live/workspace` ya cargado con Telegram desk. Pulsa Desplegar e Iniciar. Ve la etiqueta En marcha, el playground en el texto y una línea del log que dice que Telegram desk escucha. No registra el webhook. Si el puerto 3000 está tomado, se para el otro agente local antes.

El mensaje escrito en la app de Telegram sigue siendo de la persona.

## Qué no entra

Una foto del panel sin pulsar. Debilitar una prueba de `npm test` para que esta pase. Lanzar Cursor en cada `npm test`. Llamar a `setWebhook`.
