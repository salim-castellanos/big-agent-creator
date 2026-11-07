# Simulación de flujos

`npm test` recorre cada componente de la biblioteca y cada tipo de disparador. No es una captura de una pantalla. Para cada uno comprueba tres cosas:

1. Si falta un dato para que funcione, el flujo queda incompleto.
2. La tarjeta del componente muestra el control que completa ese dato, y el nombre de cada secreto.
3. Al guardar, el secreto aparece en Secretos y el archivo generado contiene lo que se configuró.

La lista de componentes es `LIBRARY_KINDS`. La lista de disparadores es `TRIGGER_TYPES`. Si se agrega uno y no se simula, la prueba falla.

Un repositorio de GitHub, GitLab o Bitbucket vive en `CHANNEL_NEEDS`. Sin `owner/name` el flujo no está terminado.
