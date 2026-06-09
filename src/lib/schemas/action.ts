import { z } from "zod";

// Action references a protocol action by its protocol/action pair — the same key
// the context endpoint exposes actions under. Mirrors gusher's `models.Action`. A
// node (token/position) lists the actions it affords as these references, resolved
// server-side from its capabilities; the frontend renders a launcher per entry and
// fills the action's inputs from the click context.
export const ActionSchema = z.object({
  protocol: z.string(),
  action: z.string(),
});

export type Action = z.infer<typeof ActionSchema>;
