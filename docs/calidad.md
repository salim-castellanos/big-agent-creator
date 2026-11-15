# Calidad

Tres capas. Las dos primeras corren en `npm test`. La tercera es manual y solo cuando el cambio toca el cable de un servicio.

## 1. La tarjeta

Cada componente de `LIBRARY_KINDS` y cada tipo de `TRIGGER_TYPES` se simula. Si falta un dato para usarlo, el flujo queda incompleto y la tarjeta muestra el control. Un componente nuevo que no entra en esa prueba hace fallar `npm test`.

Otra prueba recorre el camino de una persona: carpeta vacía, inicializar, agente, secreto, deshacer, caso de prueba, archivo de plataforma, ejemplos y Desplegar. **Iniciar** se apaga si `deliveryCheck` no está vacío, o mientras construye o detiene. Revisar Docker no lo apaga. Un refresco de Desplegar pinta la fila y el log, y no sustituye el HTML del lienzo.

## 2. La carpeta frente al SDK

El mismo `npm test` arma una carpeta con todos los componentes ya llenos. `deliveryCheck` tiene que quedar vacío: es lo que `agent-sdk serve` rechazaría. Después `tsc --noEmit` compila `bot/**/*.ts` contra `@grok/agent-sdk`. Si el canal generado no coincide con el paquete del SDK, esta capa falla antes de que alguien abra el diseñador.

La interfaz se pulsa como una persona en [pruebas-interfaz.md](pruebas-interfaz.md). Esa capa va antes de seguir con la imagen y la nube. No sustituye las dos de arriba.

## 3. El servicio de verdad

Telegram, WhatsApp, Slack, GitHub, GitLab y Bitbucket no se llaman desde `npm test`: hace falta un token y no se imprime. El orden y el archivo están en [pruebas-reales.md](pruebas-reales.md). Cuando el cambio toca cómo se verifica o cómo se responde, la persona hace esta lista una vez:

1. Secretos con un valor de prueba.
2. Desplegar → Iniciar.
3. Conectar: comprobar o registrar, y un mensaje de ida y vuelta.

Sin esa lista, el corte de ese canal no pasa a `closed`.
