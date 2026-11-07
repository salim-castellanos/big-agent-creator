# Roadmap — BigAgentCreator

**English** | [Español](#español)

0.2.0 runs the agent as one OCI image on this machine. The next releases take that same image to a cloud and give it a version you can point at. They do not add a second model runner. The model stays the Cursor API.

## Now — 0.2.0

Local Docker. Design, secrets, Telegram connect, playground, rebuild. The test suite in `apps/extension` must stay green before a version is packaged.

## Next — the same image, three clouds

The Dockerfile does not change per cloud. Each destination only starts the image and injects the same variable names.

| Destination | How the image is started | Where the secret value lives |
| --- | --- | --- |
| AWS | ECS or Fargate task | Secrets Manager |
| GCP | Cloud Run | Secret Manager |
| Azure | Container Apps | Key Vault |

Ship already names these. A later version adds the form that creates the empty secret and the task. The local suite does not call those clouds. A contract test will assert the generated manifest uses the same secret names as `.env.example` and does not inline a value.

## After that — a version you can deploy

Today Start builds whatever is in the folder. The next strategy is a version:

1. The folder is built once. The image is tagged with the version and the digest is recorded.
2. Ship can deploy that digest, not an unnamed rebuild.
3. A later direct deploy sends that same digest to AWS, GCP, or Azure.

A version is not "latest". Promoting it is a separate step from designing.

## What the suite protects

`npm test` in `apps/extension` is the gate. It does not need Docker. It fails if a future change:

- writes a secret value into the image or the Dockerfile
- drops `"type": "module"`, `npm install`, or `--mode single`
- turns the local sandbox on
- calls the model from a trigger that does not reach Agent
- registers a Telegram webhook with an illegal secret, or puts the bot token in the request body
- hides Limits and Agent from the library, or refuses to remove them

GitHub Actions runs that battery on every push. A red run is not a version.

## Español

La 0.2.0 corre la imagen en esta máquina. Lo que sigue es la misma imagen en AWS, GCP y Azure, y después un despliegue por versión: se construye una vez, se guarda el digest y se promueve ese digest. No es otro ejecutor de modelo. La batería de `apps/extension` tiene que seguir en verde antes de empaquetar.
