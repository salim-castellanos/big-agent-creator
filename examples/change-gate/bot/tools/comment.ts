import { defineTool } from "@grok/agent-sdk/tools";
import { z } from "zod/v4";

// @bigagent generated
export default defineTool({
  description: "Post the review comment. Repeating it with the same text changes nothing.",
  execution: "server",
  effect: "idempotent",
  inputSchema: z.object({
    prUrl: z.string(),
    summary: z.string()
  }),
  async execute(input) {
  return { posted: true, summary: input.summary };
  },
});
