import { z } from "zod/v4";

// Action references a protocol action by its protocol/action pair — the same key
// the context endpoint exposes actions under. Mirrors gusher's `models.Action`. A
// node (token/position) lists the actions it affords as these references, resolved
// server-side from its capabilities; the frontend renders a launcher per entry and
// fills the action's inputs from the click context.
// ActionCapability is the capability that granted the action — its key plus the
// user-facing verb — so clients can group a node's actions by capability.
export const ActionCapabilitySchema = z.object({
  value: z.string(),
  label: z.string(),
  description: z.string(),
});

export const ActionSchema = z.object({
  protocol: z.string(),
  action: z.string(),
  capability: ActionCapabilitySchema.optional(),
});

export type ActionCapability = z.infer<typeof ActionCapabilitySchema>;
export type Action = z.infer<typeof ActionSchema>;
