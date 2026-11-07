# Producto — BigAgentCreator

Un ingeniero diseña un agente en un lienzo. El lienzo escribe la carpeta que el Agent SDK (`@grok/agent-sdk`) puede servir. Docker arma esa carpeta en una imagen y la corre en esta máquina. La misma imagen es la que después corre en AWS, GCP o Azure. Esta versión la ejecuta aquí.

Quien lo usa pega su clave de usuario de Cursor en `CURSOR_API_KEY`. El SDK llama al modelo con esa clave. No es la licencia del editor.

El comportamiento ya construido, y qué toca cada parte, está en `../../linea-base.md`. Se abre cuando hace falta saber qué hay. No es una HU.
