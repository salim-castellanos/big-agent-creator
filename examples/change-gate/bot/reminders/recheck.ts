import { defineReminder } from "@grok/agent-sdk/reminders";

export default defineReminder({
  async run({ args, followup }) {
    await followup({ message: `Look again at ${String(args.prUrl)}. Act only if it is still waiting.` });
    return { action: "delivered" };
  },
});
