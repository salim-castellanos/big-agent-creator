import { defineAgent } from "@grok/agent-sdk";

// @bigagent generated
export default defineAgent({
  name: "Change gate",
  model: {
    id: "grok-4.5",
    params: [
      { id: "effort", value: "high" },
      { id: "fast", value: "false" },
    ],
  },
  tools: ["read","grep","glob","ls","task"],
  local: { sandbox: true },
  concurrency: { maxRunningTurns: 4 },
  builtinTools: { reminders: true },
  hosting: { secretNames: ["CURSOR_API_KEY","AGENT_SDK_BEARER_TOKEN","TELEGRAM_BOT_TOKEN","TELEGRAM_WEBHOOK_SECRET","WEBHOOK_SECRET","REVIEW_TOKEN","PAGER_TOKEN"], egressDomains: ["github.com","api.github.com","api.telegram.org"] },
});
