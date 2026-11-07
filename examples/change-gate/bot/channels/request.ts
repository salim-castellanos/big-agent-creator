import { defineChannel, POST } from "@grok/agent-sdk/channels";
import { z } from "zod/v4";

// @bigagent generated
// Preset: webhook. Signature secret: WEBHOOK_SECRET.
export default defineChannel({
  routes: [
    POST("/hooks/review", {
      description: "Someone posts a pull request URL. The signature is checked before the run starts.",
      bodySchema: z.object({ text: z.string() }),
      handler: async (_request, { send, waitUntil, body }) => {
        waitUntil(send(body.text));
        return new Response(null, { status: 202 });
      },
    }),
  ],
});
