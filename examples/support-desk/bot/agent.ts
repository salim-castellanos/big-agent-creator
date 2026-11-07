import { defineAgent } from "@grok/agent-sdk";

// @bigagent generated
export default defineAgent({
  name: "Support desk",
  model: {
    id: "grok-4.5",
    params: [
      { id: "effort", value: "high" },
      { id: "fast", value: "false" },
    ],
  },
  local: { sandbox: true },
  hosting: { secretNames: ["CURSOR_API_KEY","AGENT_SDK_BEARER_TOKEN","WEBHOOK_SECRET","CASES_TOKEN"], egressDomains: [] },
});
