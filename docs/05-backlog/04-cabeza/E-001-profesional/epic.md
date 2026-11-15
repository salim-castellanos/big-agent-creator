---
id: E-001
module: 04-cabeza
---

# Épica E-001 — La plataforma que un profesional termina en el editor

El lienzo sigue siendo la fuente. Un agente del editor puede proponer un cambio y la persona lo confirma. Un recorrido se puede medir aquí y, después, en la misma imagen publicada.

## Orden

| # | Feature | Qué es | Estado |
| --- | --- | --- | --- |
| 1 | Documentación de la plataforma | Una entrada que dice qué leer para modificar este repo: código, pruebas, secretos, despliegue. La usa Preguntar y cualquier otro agente. No incluye valores de `.env`. | hecho: `docs/plataforma.md` |
| 2 | Preguntar escribe | Propone tarjetas. No escribe hasta confirmar. El guardado es el del lienzo. Simular flujo vuelve a leer. No inventa secretos. | hecho: Aplicar / Ahora no |
| 3 | Monitor de un recorrido | En local: CPU, memoria, latencia, errores del log y el tramo entre la primera hora y la última. El refresco pinta esa fila y no redibuja el lienzo. La duración de cada acción entra cuando el proceso imprime esa línea. | hecho: fila y refresco en 0.2.29 |
| 4 | Imagen con digest | Se construye una vez. El siguiente Iniciar usa ese id. Rebuild es el que construye otra. | hecho: pin en 0.2.30 |
| 5 | Cloud Run | La primera nube. Publica ese digest, inyecta los mismos nombres de secreto, entrega HTTPS. El valor no entra en el manifiesto. Sincronizar secretos es un botón: sube el valor local, o el que se escriba para ese ambiente, y no corre al desplegar. | después de 4 |
| 6 | El mismo monitor en Cloud Run | La fila de local apunta al servicio. | después de 5 |

## Por qué Cloud Run primero

Una sola imagen, una dirección HTTPS, secretos por nombre, sin clúster. Telegram y WhatsApp necesitan esa dirección. AWS Fargate es la segunda, con el mismo digest. Azure después. No se hacen las tres a la vez.

## Fuera

Otro ejecutor de modelo. Un recolector de telemetría paralelo al que el Agent SDK ya expone. Escribir un secreto desde el chat.
