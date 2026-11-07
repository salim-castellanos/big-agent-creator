import { defineAgent } from "@grok/agent-sdk";

// @bigagent generated
export default defineAgent({
  name: "Hello",
  hosting: { secretNames: ["CURSOR_API_KEY", "AGENT_SDK_BEARER_TOKEN"], egressDomains: [] },
});
