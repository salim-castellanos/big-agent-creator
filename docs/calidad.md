# Calidad

Tres capas. Las dos primeras corren en `npm test`. La tercera es manual y solo cuando el cambio toca el cable de un servicio.

## 1. La tarjeta

Cada componente de `LIBRARY_KINDS` y cada tipo de `TRIGGER_TYPES` se simula. Si falta un dato para usarlo, el flujo queda incompleto y la tarjeta muestra el control. Un componente nuevo que no entra en esa prueba hace fallar `npm test`.

Otra prueba recorre el camino de una persona: carpeta vacía, inicializar, agente, secreto, deshacer, caso de prueba, archivo de plataforma, ejemplos y Desplegar. **Iniciar** permanece apagado hasta que Docker está listo y la carpeta pasa `deliveryCheck`.

## 2. La carpeta frente al SDK

El mismo `npm test` arma una carpeta con todos los componentes ya llenos. `deliveryCheck` tiene que quedar vacío: es lo que `agent-sdk serve` rechazaría. Después `tsc --noEmit` compila `bot/**/*.ts` contra `@grok/agent-sdk`. Si el canal generado no coincide con el paquete del SDK, esta capa falla antes de que alguien abra el diseñador.

## 3. El servicio de verdad

Telegram, WhatsApp, Slack, GitHub, GitLab y Bitbucket no se llaman desde `npm test`: hace falta un token y no se imprime. Cuando el cambio toca cómo se verifica o cómo se responde, la persona hace esta lista una vez:

1. Secretos con un valor de prueba.
2. Desplegar → Iniciar.
3. Conectar: comprobar o registrar, y un mensaje de ida y vuelta.

Sin esa lista, el corte de ese canal no pasa a `closed`.
