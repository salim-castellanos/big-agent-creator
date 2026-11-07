import { defineTool } from "@grok/agent-sdk/tools";
import { z } from "zod/v4";

// @bigagent generated
export default defineTool({
  description: "Ask a person to approve. You do not merge.",
  execution: "server",
  effect: "write",
  needsApproval: true,
  inputSchema: z.object({
    prUrl: z.string(),
    verdict: z.string()
  }),
  async execute(input) {
  return { waitingFor: "person", prUrl: input.prUrl };
  },
});
