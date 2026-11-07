# Start

**English** | [Español](./start.es.md)

BigAgentCreator is where you design an agent, try it on your machine, and leave it ready to run. The canvas is the design. Saving writes a folder. Ship turns that folder into an image.

The program that runs the agent is the Agent SDK (`@grok/agent-sdk`). It reads `bot/agent.ts` and `instructions.md` with `agent-sdk serve`. The canvas writes that folder so the SDK can load it.

The SDK calls Cursor's model. That call uses `CURSOR_API_KEY`, your Cursor user API key. It is not the editor license, and it is not a Team Admin key. A path that reaches the Agent card cannot answer while the key is empty. A trigger that never reaches Agent answers in code and does not use the key. Put the value in Secrets. It stays in `.env` and is not copied into the image.

Docker has to be open. Start uses it to build the image and run the agent. The same image is what AWS, GCP, and Azure run later. This version runs it on this machine.

**English | Español** and **Help** sit at the end of the menu. Help is this page, short. `START.md` in a new folder points here, and `AGENTS.md` points the editor chat at it.

## Your first agent

1. Open a folder and initialize it, or load **Hello** from Examples. Hello has one Agent card and no Telegram.
2. Open **Secrets** and set `CURSOR_API_KEY`.
3. Open **Ship** and press **Start**.
4. Open the playground and type `hi`. The reply is `hello`.
5. Edit a card and save. Load Telegram desk when you want a real chat.

If the folder already has work, the first load keeps it in `.keep/original`. **Restore my folder** brings that copy back. Your `.env` stays.

## Edit

Select a card. The panel on the right is that card. Change it and press **Save**. The file in the folder changes with it. Moves and new cards save on their own.

Dropping a card does not connect it. Draw the arrow. The number on a card is the step that arrow enters. The same number can run together. A higher number waits.

**Agent** is the one definition of the folder: `bot/agent.ts` and `instructions.md`. A trigger calls the model only when its arrow reaches that card. If it does not, the path answers in code and does not call a model. You can remove Agent and Limits. Add them again from the library. There is only one Agent. Another reasoner is a Subagent.

## Configure

| Name | Where the value lives | What it is |
| --- | --- | --- |
| `CURSOR_API_KEY` | `.env` | Cursor user API key. Required when a path calls the model. |
| `TELEGRAM_BOT_TOKEN` | `.env` | The whole BotFather value, including the colon. |
| `TELEGRAM_WEBHOOK_SECRET` | `.env` | A word you invent. Letters, numbers, `_`, and `-` only. |
| `AGENT_SDK_BEARER_TOKEN` | `.env` | Optional. Empty is fine for the first local run. |

Names are in the project. Values are only in `.env`. **Rebuild** on Ship recreates the container so it reads the current `.env`. The value is not copied into the image.

After you change a secret, Rebuild. Then try the playground again.

## Telegram

When Hello answers, load **Telegram desk** or open `examples/telegram-desk`. One chat, business hours, and a refusal for refunds.

1. Create the bot with BotFather. Put the token in `TELEGRAM_BOT_TOKEN`.
2. Invent `TELEGRAM_WEBHOOK_SECRET`.
3. Ship → Start.
4. Point an HTTPS tunnel at port 3000. Leave it open.
5. **Connect → Register webhook**. Paste the `https://….trycloudflare.com` address. Do not put the bot token in `secret_token`.
6. Message the bot `what are your hours?`.

## The other examples

| Example | What it is |
| --- | --- |
| [Hello](../examples/hello/README.md) | Playground only. Start here. |
| [Telegram desk](../examples/telegram-desk/README.md) | One real chat. |
| [Support desk](../examples/support-desk/README.md) | Inbox, a Monday schedule, lookup, a case. The knowledge servers are not started by this compose file. |
| [Change gate](../examples/change-gate/README.md) | The full canvas. Telegram is the path you can talk to. |

Load any of them from **Examples**. **Restore my folder** returns the copy in `.keep/original`.

## If you ask the chat

Open this repository, or a folder created by the extension. Tell the chat to read `AGENTS.md` and `START.md` before it edits. Those files point here. Do not put secret values in the chat.
