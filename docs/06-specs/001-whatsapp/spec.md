---
id: 001-whatsapp
title: WhatsApp desde Conectar
status: implemented
hu: HU-001
runbook: 001-whatsapp
supersedes:
superseded-by:
---

# Spec 001 — WhatsApp desde Conectar

## Insumos

- HU: `docs/05-backlog/01-canales/E-001-llegar/F-001-whatsapp/HU-001-whatsapp.md`
- Línea base: `docs/linea-base.md`
- Voz: `docs/voz.md`
- Gates: constitución I. El valor no entra en la imagen ni en el log.

## Contexto

Telegram ya tiene alta asistida. WhatsApp usa la Cloud API de Meta: un GET de verificación y un POST de mensajes.

## In scope

Canal generado, validación de secretos, comprobar el número, enviar `hello`, instrucciones para el chat en una carpeta nueva.

## Tablero

No aplica.

## Out of scope

Slack, GitHub, GitLab, Bitbucket. Crear una base de datos nueva. Registrar el callback en Meta si faltan el id de la app o el app secret: en ese caso la pantalla muestra la URL para pegarla.

## Comportamiento

- WHEN hay un disparador `whatsapp` THEN `bot/channels/<nombre>.ts` importa `GET` y `POST`, responde `hub.challenge` si `hub.verify_token` coincide con `WHATSAPP_VERIFY_TOKEN`, y envía el texto por `graph.facebook.com`.
- IF `WHATSAPP_APP_SECRET` tiene valor THEN el POST exige `X-Hub-Signature-256`.
- IF el token, el id del número o el verify token no sirven THEN Comprobar y Enviar prueba quedan apagados.
- WHEN Comprobar THEN `GET /v21.0/{phone-number-id}` con el token en `Authorization`.
- WHEN Enviar prueba THEN el JSON lleva `messaging_product: whatsapp` y `text.body: hello`. El token no está en la URL.

## Pantalla

Conectar, tarjeta WhatsApp, debajo de la dirección pública. Mismos controles en español y en inglés. Los `id` no cambian.

## Formulario y validación

Verify token: letras, números, `_` y `-`. Id del número: solo dígitos. Número de prueba: dígitos, se acepta un `+` inicial. Token: sin espacios y de al menos 20 caracteres.

## Mensajes

Éxito de comprobar: Meta contestó por ese número. Éxito de envío: se mandó hello. Error: la frase de Meta o de la red, sin el valor del secreto.

## Autenticación y autorización

El canal es público para que Meta llame. El handler verifica. El token no se escribe en el log.

## Datos

Nombres en el proyecto: `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_APP_SECRET`, `WHATSAPP_APP_ID`. Valores solo en `.env`.

## Contratos

| Método | Ruta | Quién |
| --- | --- | --- |
| GET | `/v1/channels/<nombre>/` | Meta, verificación |
| POST | `/v1/channels/<nombre>/` | Meta, mensajes |
| GET | `https://graph.facebook.com/v21.0/{phone-number-id}` | Comprobar |
| POST | `https://graph.facebook.com/v21.0/{phone-number-id}/messages` | Enviar prueba y la respuesta del agente |

## Pruebas

| AC | Capa | Qué se invoca | Qué falla si se rompe |
| --- | --- | --- | --- |
| El canal verifica y contesta | unit | `emitSdk` con un disparador whatsapp | El archivo no tiene el GET de Meta o no llama a Graph |
| Secretos malos apagan los botones | unit | `whatsappReach` y el HTML de Conectar | Enviar prueba sigue activo con un id que no es numérico |
| El token no va en la URL | unit | `whatsappCheckTarget` y `whatsappSendTarget` | La URL contiene el token |
| Inglés y español no cambian el control | unit | `designerHtml` | Falta `id="whatsapp-send"` en uno de los dos |

Playwright no aplica: la batería es la de `apps/extension`.

## Delta

`ADDED` canal WhatsApp, tarjeta de Conectar, instrucciones del chat.
