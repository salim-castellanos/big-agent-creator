import { defineAgent } from "@grok/agent-sdk";

// @bigagent generated
export default defineAgent({
  name: "Telegram desk",
  tools: [],
  concurrency: { maxRunningTurns: 2 },
  hosting: { secretNames: ["CURSOR_API_KEY","AGENT_SDK_BEARER_TOKEN","TELEGRAM_BOT_TOKEN","TELEGRAM_WEBHOOK_SECRET"], egressDomains: ["api.telegram.org"] },
});
