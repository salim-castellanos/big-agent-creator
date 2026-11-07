import { defineChannel, POST, publicEndpoint } from "@grok/agent-sdk/channels";
import { z } from "zod/v4";
import { replyTelegram } from "../lib/telegram.js";
// @bigagent generated
type TelegramUpdate = { message?: { text?: string; chat?: { id?: number } } };
export default defineChannel<{ chatId: string }>({
  auth: [publicEndpoint()],
  state: { chatId: "" },
  routes: [
    POST("/", {
      description: "A person writes in the Telegram chat. The same chat keeps one conversation.",
      bodySchema: z.unknown(),
      handler: async (request, { send, waitUntil, body }) => {
        const got = request.headers.get("x-telegram-bot-api-secret-token");
        if (got !== process.env.TELEGRAM_WEBHOOK_SECRET) return new Response(null, { status: 401 });
        const update = body as TelegramUpdate;
        const text = update.message?.text?.trim();
        const chatId = update.message?.chat?.id;
        if (!text || typeof chatId !== "number") return new Response(null, { status: 200 });
        waitUntil(send(text, {
          continuationToken: `telegram:${chatId}`,
          state: { chatId: String(chatId) },
          title: `Telegram ${chatId}`,
        }));
        return new Response(null, { status: 200 });
      },
    }),
  ],
  events: {
    async "message.completed"(event, channel) {
      if (event.data.finishReason === "tool_call" || !event.data.text) return;
      await replyTelegram(channel.state.chatId, event.data.text);
    },
  },
});