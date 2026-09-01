import { z } from "zod/v4";

// ActionCapability is the capability that granted the action — its key plus the
// user-facing verb — so clients can group a node's actions by capability.
export const ActionCapabilitySchema = z.object({
  value: z.string(),
  label: z.string(),
  description: z.string(),
});

// Action references a protocol action by its protocol/action pair — the same key
// the context endpoint exposes actions under. Mirrors gusher's `models.Action`. A
// node (token/position) lists the actions it affords as these references, resolved
// server-side from its capabilities. `pins` are the inputs the launching node
// fills, keyed by input index and authored by the server from the node itself (a
// token pins itself, a position pins its market): the frontend hands them to
// useContext as-is and the frame opens already bound.
export const ActionSchema = z.object({
  protocol: z.string(),
  action: z.string(),
  capability: ActionCapabilitySchema.optional(),
  pins: z.record(z.string(), z.string()).optional(),
});

export type ActionCapability = z.infer<typeof ActionCapabilitySchema>;
export type Action = z.infer<typeof ActionSchema>;
