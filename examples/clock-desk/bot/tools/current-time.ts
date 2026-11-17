import { defineTool } from "@grok/agent-sdk/tools";
import * as z from "zod/v4";

// @bigagent generated
export default defineTool({
  description: "Read the current time in one IANA timezone from the public clock.",
  execution: "server",
  effect: "read",
  inputSchema: z.object({
    timezone: z.string()
  }),
  async execute(input, ctx) {
  const result = await ctx.host.mcp.callTool("clock", "get_current_time", input);
  const part = result.content.find((item) => item.type === "text");
  const text = part && "text" in part && typeof part.text === "string" ? part.text : "";
  return { ok: result.isError !== true, text };
  },
});
