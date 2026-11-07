# Support desk

The agent this folder will ship. Open the folder, then BigAgentCreator.

Both triggers pass Limits, then Think looks up one passage. If the base answers, it cites the document and stops. If not, it opens a case and, only when a person must decide, escalates that case.

| Step | What runs |
| --- | --- |
| 1 | `inbox` (signed `POST /hooks/inbox`) and `morning` (Monday at 9, a schedule, not a chat). Neither waits for the other. |
| 2 | Limits |
| 3 | Think, model Strong |
| 4 | `lookup-passage` |
| 5 | `knowledge` at `http://knowledge:7000/mcp` |
| 6 | `answer-from-base` or `hand-off` |
| 7 | `open-case` |
| 8 | `escalate`, only after the case exists |
| 9 | `cases` at `http://cases:7000/mcp` |

Secret names are `CURSOR_API_KEY`, `AGENT_SDK_BEARER_TOKEN`, `WEBHOOK_SECRET`, and `CASES_TOKEN`. Copy `.env.example` to `.env` and fill the values there. The image does not contain them.

`docker compose up --build` builds this folder as one local image and runs `agent-sdk serve` on port 3000. `knowledge` and `cases` are the other two names on that Docker network. They are not in this compose file yet.

Design draws the run. Prove holds the three fixed cases in `evals/desk.eval.ts`. Platform opens the shared code, the session seed, artifacts, and reminders in the editor. Ship checks the project and builds the image.
