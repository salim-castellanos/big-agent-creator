# Change gate

The agent that shows the whole platform. Open this folder, then BigAgentCreator.

It reviews a pull request. It can comment. It cannot merge. A person approves.

## Design

The main path starts in Telegram. The other entries are still there.

| Step | What runs |
| --- | --- |
| 1 | `telegram` (the chat), plus `github`, `request`, and `weekday`. |
| 2 | Limits |
| 3 | Think. Grok 4.5, high effort, sandbox on. Built-in tools are only `read`, `grep`, `glob`, `ls`, and `task`. |
| 4 | `read-diff`, and `audit` watching the run |
| 5 | `repository` (the Cursor account) and `pager` (host only) |
| 6 | `product-change` or `dependency-bump` |
| 7 | `security-pass`, only after a product change |
| 8 | `comment` |
| 9 | `approve`, which waits for a person |
| 10 | `review-board` |

## Prove

`evals/desk.eval.ts` has three cases: a copy fix, a lockfile bump, and an attempt to force a merge. None of them may call `approve`.

## Platform

Shared code, the session seed, a `reviewed-pr` artifact, and a reminder that looks again at a pull request. Extensions is an empty folder.

## Secrets

`CURSOR_API_KEY`, `AGENT_SDK_BEARER_TOKEN`, `WEBHOOK_SECRET`, `REVIEW_TOKEN`, `PAGER_TOKEN`. Copy `.env.example` to `.env`.

## Ship

`docker compose up --build` in this folder. `review-board` and `pager` are names on that Docker network. They are not in this compose file yet.

## Try the main path

1. Put `TELEGRAM_BOT_TOKEN` and `TELEGRAM_WEBHOOK_SECRET` in `.env`.
2. Run the image, or `agent-sdk dev` in this folder.
3. Point the bot webhook at `https://<public-host>/v1/channels/telegram/`.
4. Send a pull request URL in that chat. The answer returns to the same chat.

GitHub, the weekday schedule, the security pass, and approval stay on the canvas. They are the next paths after this chat works.
