import { defineChannel, POST } from "@grok/agent-sdk/channels";
import { z } from "zod";

// @bigagent generated
// Preset: github. Signature secret: none.
export default defineChannel({
  routes: [
    POST("/github", {
      description: "A pull request was opened or updated. GitHub reaches the agent through the connected Cursor account.",
      bodySchema: z.object({ text: z.string() }),
      handler: async (_request, { send, waitUntil, body }) => {
        waitUntil(send(body.text));
        return new Response(null, { status: 202 });
      },
    }),
  ],
});
