# Arquitectura del plugin

Medido el 7 nov 2026 sobre `apps/extension/src` en la fuente **0.2.28** del árbol local. `origin/main` sigue en el commit publicado anterior. Este archivo guarda el corte y la decisión. No autoriza un refactor grande.

## Dónde estamos

Preguntar ya propone un cambio y lo guarda solo con **Aplicar**. La cola de producto, en este orden:

1. Monitor de un recorrido en local (duración, herramienta, error) con lo que el proceso ya expone.
2. Imagen con digest: se construye una vez y Ship apunta a ese digest.
3. Cloud Run publica ese digest, con secretos por nombre.
4. La misma fila de monitor apunta al servicio de Cloud Run.

Slack, GitHub, GitLab, Bitbucket y WhatsApp siguen en prueba manual contra el servicio real. La tienda publicada sigue en 0.2.0.

## Cómo está armado

Cinco archivos. 6 535 líneas.

| Archivo | Líneas | Qué concentra |
| --- | ---: | --- |
| `project.ts` | 2 085 | Modelo de la carpeta, generador del Agent SDK, canales, Docker, lienzo, propuestas |
| `designer.ts` | 1 334 | Todo el HTML del panel. `designerHtml` ocupa unas 940 |
| `extension.ts` | 1 191 | Host de VS Code, procesos, deshacer, chat y unos 36 mensajes en `onMessage` |
| `project.test.ts` | 1 052 | 33 pruebas. Unas 58 leen el HTML |
| `copy.ts` | 873 | Inglés y español |

`render()` relee el proyecto, reordena el lienzo y sustituye el HTML del panel entero. Lo llama casi cada mensaje, incluido el refresco de Ship.

El generador (`emitSdk` y el fuente de cada canal) vive en `project.ts`, junto al modelo que las pruebas ya fijan: `saveItem`, `deliveryCheck`, `flowReport`, `applyProposal`.

## Qué aguanta crecer

El modelo de carpeta y el generador tienen red de seguridad. Una capacidad nueva que llama esas funciones y añade su prueba puede entrar sin partir archivos.

Las pruebas de HTML son el contrato visible: un botón, una clase, una frase. Si el marcado cambia, la prueba que lo nombra cambia en el mismo corte.

`docs/calidad.md` sigue siendo la puerta: simulación de cada tarjeta, `tsc` de la carpeta generada, y el servicio real solo a mano.

## Dónde se traba si seguimos igual

El monitor va a pedir estado seguido. Hoy ese pedido redibuja también el lienzo, las propiedades y el chat. Ahí se van a perder foco, scroll del log y la posición del lienzo.

Cloud Run, metido como otra rama de `onMessage` al lado de Docker, deja el host todavía más largo. El siguiente canal alarga el generador dentro del mismo archivo de 2 085 líneas.

Partir los cinco archivos solo para que pesen menos mueve imports y no quita el redibujado completo. Eso es el cambio que más fácil daña lo ya probado.

## Decisión

El panel sigue en HTML generado por `designer.ts`. Una pantalla nueva es una función que devuelve HTML y una prueba que lee ese HTML.

La costura ya está: en Desplegar, el refresco manda `ship-face` y el panel actualiza estado, cifras y logs. El lienzo no está en esa pantalla y no se vuelve a dibujar. Buscar, filtrar y el scroll del log se quedan. `shipFace` es la misma cara que el HTML inicial. `npm test` la compara.

Cloud Run llena el mismo `ShipStatus` que el local. El generador de canales se mueve a su archivo cuando entre el próximo canal, con la prueba de `tsc` en verde a los dos lados. Un reparto de `onMessage` es un corte propio, con la misma batería, y no se mezcla con una capacidad nueva.
