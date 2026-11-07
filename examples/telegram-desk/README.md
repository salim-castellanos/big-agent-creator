# Telegram desk

The small support agent used to learn the deploy. One chat in, one answer back. No other services.

Open this folder, then BigAgentCreator. Or, from any folder, open **Examples** and load **Telegram desk**. That keeps your current files in `.keep/original` the first time. **Restore my folder** puts them back.

The flow is Telegram, then Limits, then Agent. Hand-off loads only when the person asks for a payment, a deletion, or a person.

## Run it

1. Create a bot with BotFather and copy the token.
2. Copy `.env.example` to `.env`.
3. Set `CURSOR_API_KEY`, `TELEGRAM_BOT_TOKEN`, and `TELEGRAM_WEBHOOK_SECRET` (any long random string). `AGENT_SDK_BEARER_TOKEN` can stay empty for this first chat.
4. From this folder: `docker compose up --build`.
5. Telegram only calls a public HTTPS address. Point a tunnel at port 3000.
6. Register the webhook. Replace the host and use the same secret as in `.env`:

```text
https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook?url=https://<public-host>/v1/channels/telegram/&secret_token=<TELEGRAM_WEBHOOK_SECRET>
```

7. Send the bot "what are your hours?" The answer should come back in that chat.

A message cannot make it refund, change an account, or reveal these rules.
