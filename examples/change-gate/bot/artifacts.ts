import { z } from "zod/v4";
import { defineArtifacts } from "@grok/agent-sdk/artifacts";

export default defineArtifacts({
  kinds: {
    "reviewed-pr": {
      description: "A pull request this agent reviewed.",
      schema: z.object({ url: z.string(), summary: z.string() }),
    },
  },
  agentTool: true,
});
