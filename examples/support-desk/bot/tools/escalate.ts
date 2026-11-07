import { defineTool } from "@grok/agent-sdk/tools";
import { z } from "zod/v4";

// @bigagent generated
export default defineTool({
  description: "Place an open case in the human queue. A person must take it from here.",
  execution: "server",
  effect: "write",
  needsApproval: true,
  inputSchema: z.object({
    caseId: z.string(),
    reason: z.string()
  }),
  async execute(input) {
  return input;
  },
});
