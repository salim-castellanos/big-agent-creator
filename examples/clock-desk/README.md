# Clock desk

The Telegram desk, plus one public clock. Ask the time in a city. The answer comes from [time.now](https://time.now/mcp). That call took about half a second when this example was added. No clock token.

Open this folder, then BigAgentCreator. Or, from any folder, open **Examples** and load **Clock desk**.

The flow is Telegram, then Limits, then Agent. The skill **Ask the clock** loads when the person asks the time, and it calls the tool **current-time**. That tool calls the MCP server **clock**. Hand-off still loads for a payment, a deletion, or a person.

## Run it

1. Create a bot with BotFather and copy the token.
2. Copy `.env.example` to `.env`.
3. Set `CURSOR_API_KEY`, `TELEGRAM_BOT_TOKEN`, and `TELEGRAM_WEBHOOK_SECRET`. `AGENT_SDK_BEARER_TOKEN` can stay empty on this machine.
4. From this folder: `docker compose up --build`.
5. Point a tunnel at port 3000, or deploy to Cloud Run. The image already allows calls to `time.now`.
6. Register the webhook with the same secret as in `.env`.
7. Send the bot "what time is it in Tokyo?" The reply should name the time the clock returned.

A message cannot make it refund, change an account, or invent the time.
