import { defineConnection } from "@grok/agent-sdk/connections";

// @bigagent generated
export default defineConnection({
  url: "http://pager:7000/hook",
  headers: { authorization: "Bearer ${PAGER_TOKEN}" },
});
