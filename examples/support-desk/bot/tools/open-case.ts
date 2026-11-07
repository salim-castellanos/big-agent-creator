import { defineTool } from "@grok/agent-sdk/tools";
import { z } from "zod/v4";

// @bigagent generated
export default defineTool({
  description: "Record a case when the knowledge base has no answer. Does not change the account.",
  execution: "server",
  effect: "write",
  inputSchema: z.object({
    summary: z.string(),
    question: z.string()
  }),
  async execute(input) {
  return input;
  },
});
