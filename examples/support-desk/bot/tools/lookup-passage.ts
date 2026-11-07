import { defineTool } from "@grok/agent-sdk/tools";
import { z } from "zod";

// @bigagent generated
export default defineTool({
  description: "Find one passage in the knowledge base for the customer question.",
  execution: "server",
  effect: "read",
  inputSchema: z.object({
    question: z.string()
  }),
  async execute(input) {
  return input;
  },
});
