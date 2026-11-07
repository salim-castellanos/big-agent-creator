import { z } from "zod";
import { defineArtifacts } from "@grok/agent-sdk/artifacts";

export default defineArtifacts({
  kinds: {
    case: {
      description: "A support case this agent opened or escalated.",
      schema: z.object({ summary: z.string(), caseId: z.string().optional() }),
    },
  },
  agentTool: true,
});
