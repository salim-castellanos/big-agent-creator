# Despliegue en varias nubes

Local sigue siendo la primera pestaña. GCP, AWS y Azure son las otras. Kubernetes no es un destino de este corte.

## Qué se ve

La pantalla de Desplegar se desplaza cuando la tarjeta de estado es alta. El log conserva su propio scroll. Las otras nubes ya no quedan debajo del log, sin forma de llegar.

En Local, Subir oculta el estado y Bajar oculta el log. En GCP, Subir oculta el formulario de desplegar y Bajar oculta Cloud Run. El panel de abajo muestra lo que escribe el despliegue. No se pueden ocultar los dos a la vez.

La pestaña GCP abre con una tarjeta como la de Local. La lista dice si hay imagen, si el proyecto y la región sirven, y qué secretos no tienen valor local. **Construir imagen** arma la imagen en esta carpeta y deja el comando y el log abajo. **Desplegar esta imagen** publica ese id. Sincronizar secretos queda en Secret Manager.

En GCP la persona configura, antes de desplegar:

| Campo | Qué hace |
| --- | --- |
| Proyecto y región | La conexión. Una cuenta puede tener varias. |
| Internet o solo este proyecto | Quién puede llamar. |
| Instancias mínimas y máximas | Cuántas copias. Un chat público en internet conviene con mínimo 1. |
| Turnos a la vez | Cuántas respuestas acepta cada instancia. |
| CPU, memoria y tiempo | Tamaño de la instancia y cuánto puede durar una petición. |
| Secret Manager | **Sincronizar secretos** queda fijo arriba. Crea los nombres que falten y pone el valor local. Si un nombre no tiene valor en local, lo dice. **Sincronizar esta** envía solo ese, con el valor escrito en su campo. Desplegar no sube valores. |
| Variables planas | Ajustes que no son secretos, por ejemplo `LOG_LEVEL`. Un nombre de secreto se rechaza. `BIGAGENT_ADMIT_LOCAL` no se envía. |

## Una imagen, varias conexiones

Local construye la imagen una vez y guarda el id. Cada nube publica ese id. No vuelve a construir una imagen distinta.

Una cuenta puede tener varias conexiones:

| Nube | Cuenta | Una conexión es |
| --- | --- | --- |
| GCP | Una cuenta de Google | Un proyecto y una región. Cloud Run. |
| AWS | Una cuenta de AWS | Una región. Fargate. Va después de GCP. |
| Azure | Una cuenta de Azure | Una suscripción. Container Apps. Va después de Fargate. |

Los secretos se nombran igual que en local. El valor entra en el almacén de esa nube (Secret Manager, Secrets Manager, Key Vault). No entra en el manifiesto ni en el prompt.

## Quién llama al agente

Dos modos. Se elige por conexión, no para toda la cuenta.

| Modo | Quién llega | Cómo se cierra |
| --- | --- | --- |
| Internet | Telegram, WhatsApp, Slack, GitHub y cualquier webhook. | Cloud Run acepta la llamada. El secreto del canal la verifica. El playground queda en la misma dirección: no se comparte esa URL. |
| Solo este proyecto | Otro servicio del mismo proyecto de GCP. | Cloud Run exige identidad de ese proyecto. Internet, incluido Telegram, no entra. |

Un canal de chat en modo interno no puede recibir mensajes. El panel lo advierte.

Si el modo es internet y hay un canal público, el servicio mantiene una instancia despierta para que el webhook no espere un arranque en frío. El máximo son 4 instancias y 4 respuestas a la vez: un turno de agente es pesado.

## Cómo habla BigAgentCreator con GCP

Usa la CLI `gcloud` de esta máquina. La persona inicia sesión una vez (`gcloud auth login`). El plugin no guarda el token.

Desplegar hace esto, en orden:

1. Revisa la cuenta activa.
2. Crea el repositorio `bigagent` en Artifact Registry si no existe.
3. Sube la imagen que Local ya construyó. El nombre lleva el id local. No usa `latest`.
4. Intenta dar a la cuenta de Compute del proyecto el rol Secret Accessor solo en los secretos que el servicio monta. Si no puede, lo escribe en el log y sigue. No espera a que esa concesión exista.
5. Publica Cloud Run con el mínimo, el máximo, los turnos, la CPU, la memoria y el tiempo elegidos. Los secretos se pasan por nombre (`NAME=NAME:latest`). Las variables planas van en `--set-env-vars`. El valor de un secreto no entra en el comando.
6. No pone `BIGAGENT_ADMIT_LOCAL`. Esa admisión es solo del Compose local.

**Sincronizar secretos** crea el nombre en Secret Manager si no existe y pone el valor local. Si no hay valor en local, el aviso nombra esa variable. **Sincronizar esta** manda solo el valor escrito en ese campo. El valor no queda en la pantalla ni en `gcp.json`. Desplegar no lo sube. Si Cloud Run ya está en marcha, hay que desplegar otra vez para que lea esa versión.

## Qué falta para GCP

La fila de monitor todavía no apunta al servicio publicado. AWS y Azure siguen sin comando.
