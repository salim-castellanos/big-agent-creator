import { defineConnection } from "@grok/agent-sdk/connections";

// @bigagent generated
export default defineConnection({
  url: "http://cases:7000/mcp",
  headers: { authorization: "Bearer ${CASES_TOKEN}" },
  advertiseTools: true,
});
