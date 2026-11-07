import { defineTool } from "@grok/agent-sdk/tools";
import { z } from "zod/v4";

// @bigagent generated
export default defineTool({
  description: "Read the pull request diff. Does not change the repository.",
  execution: "server",
  effect: "read",
  inputSchema: z.object({
    prUrl: z.string()
  }),
  async execute(input) {
  return { prUrl: input.prUrl };
  },
});
