import { defineConnection } from "@grok/agent-sdk/connections";

// @bigagent generated
export default defineConnection({
  url: "http://review-board:7000/mcp",
  headers: { authorization: "Bearer ${REVIEW_TOKEN}" },
  advertiseTools: true,
});
