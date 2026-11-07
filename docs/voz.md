# Voz de la ayuda

Así se escriben la ayuda de la plataforma, la guía del repo y el texto que lee el chat del editor. El modelo es el de las guías de Cursor y de Botpress: una tarea, el lugar donde se hace, y el primer éxito antes de la arquitectura.

## Cómo se dice

- Segunda persona e imperativo. «Abre Conectar» y no «el usuario deberá».
- Un paso, un clic. El paso nombra la página y el campo.
- El primer éxito es un mensaje que sale o entra. La explicación de por qué va después.
- No hables de la documentación. No digas que la ayuda es un camino corto.
- El mismo texto en español y en inglés. Los nombres de secreto, las URLs y los `id` se quedan en inglés.

## Cómo lo lee el chat

Una carpeta nueva trae `AGENTS.md`. Si la persona pide un agente con una frase, el chat la parte en tarjetas que ya existen. No inventa una base de datos ni un secreto.

- «Empieza por un mensaje de WhatsApp» es un disparador WhatsApp.
- «Responde con esta base de conocimiento» es una Guía o una Acción de lectura, con la flecha hasta Agente.
- «Si no encontró, guarda la pregunta» es una Acción de escritura. El procedimiento dice que corre cuando la búsqueda no trajo nada.
- Después de las tarjetas, el siguiente clic es Secretos, luego Desplegar → Iniciar, luego Conectar.
