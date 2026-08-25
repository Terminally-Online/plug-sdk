import { z } from "zod/v4";

import { createResponseSchema } from "./response";
import { AddressBalanceSchema, AddressParams } from "./address";

export const ActivityAddressSchema = z.object({
  address: z.string(),
  name: z.string().optional(),
  icon: z.string().optional(),
  protocol: z.string().optional(),
});

// Amounts ride the same {int, float, value} shape every balance in the API
// uses: signed base units, the precision-scaled decimal, and the signed USD
// value where a price is known. The server resolves all math — consumers
// render.
export const ActivityAmountSchema = AddressBalanceSchema;

export const ActivityTokenSchema = z.object({
  address: z.string(),
  name: z.string().optional(),
  symbol: z.string().optional(),
  icon: z.string().optional(),
  decimals: z.number().optional(),
  standard: z.string().optional(),
  protocol: z.string().optional(),
  protocol_icon: z.string().optional(),
});

// One movement of a token: a signed amount against a single counterparty,
// with the token id for non-fungibles.
export const ActivityFlowSchema = z.object({
  amount: ActivityAmountSchema,
  token_id: z.string().optional(),
  // Gas legs carry the category the chain assigned them: the burned base fee
  // or the fee recipient's tip.
  role: z.enum(["burn", "tip"]).optional(),
  peer: ActivityAddressSchema,
});

// One line item: everything a transaction did with one token — the net
// across its flows, and each flow as a subline.
export const ActivityTokenFlowsSchema = z.object({
  token: ActivityTokenSchema,
  net: ActivityAmountSchema,
  flows: z.array(ActivityFlowSchema),
});

export const ActivityApprovalTokenSchema = ActivityTokenSchema.omit({
  standard: true,
  protocol: true,
  protocol_icon: true,
});

export const ActivityApprovalSchema = z.object({
  token: ActivityApprovalTokenSchema,
  owner: z.string(),
  spender: ActivityAddressSchema,
  token_id: z.string().optional(),
  // Absent for unlimited allowances and operator grants — `unlimited` is the
  // discriminating flag; a revoke carries an amount of 0.
  amount: ActivityAmountSchema.optional(),
  unlimited: z.boolean().optional(),
});

const activitySpine = {
  tx_hash: z.string(),
  block_number: z.number(),
  block_timestamp: z.number(),
  chain_id: z.number(),
  title: z.string(),
  status: z.enum(["complete", "failed"]).optional(),
  peer: ActivityAddressSchema.optional(),
  gas: ActivityAmountSchema.optional(),
};

// The kinds whose payload is token flows. Classification comes from the
// server; every flow kind shares the tokens payload.
export const ACTIVITY_FLOW_KINDS = [
  "swap",
  "send",
  "receive",
  "mint",
  "burn",
  "deposit",
  "withdraw",
  "borrow",
  "repay",
  "nft_transfer",
] as const;

const flowActivitySchemas = ACTIVITY_FLOW_KINDS.map((kind) =>
  z.object({
    ...activitySpine,
    kind: z.literal(kind),
    tokens: z.array(ActivityTokenFlowsSchema).optional(),
  }),
);

const approvalActivitySchemas = (["approval", "revoke"] as const).map((kind) =>
  z.object({
    ...activitySpine,
    kind: z.literal(kind),
    approvals: z.array(ActivityApprovalSchema),
  }),
);

const executeActivitySchema = z.object({
  ...activitySpine,
  kind: z.literal("execute"),
});

type ActivityOptionSchema =
  | (typeof flowActivitySchemas)[number]
  | (typeof approvalActivitySchemas)[number]
  | typeof executeActivitySchema;

// Activity is a kind-discriminated union: flow kinds carry `tokens` (one
// entry per token, primary first), approval kinds carry `approvals`, and
// execute carries only the spine (gas).
export const ActivitySchema = z.discriminatedUnion("kind", [
  ...flowActivitySchemas,
  ...approvalActivitySchemas,
  executeActivitySchema,
] as unknown as [ActivityOptionSchema, ...ActivityOptionSchema[]]);

export const GetActivityFilterSchema = z.object({
  chain_id: z
    .number()
    .optional()
    .describe(
      "Filter results to a specific chain from the listed of supported options.",
    ),
});
export const GetActivityLimitSchema = z.object({
  count: z
    .number()
    .optional()
    .describe("Maximum number of results to return (1-200, default 50)."),
  offset: z
    .number()
    .optional()
    .describe("Number of results to skip for pagination."),
});
export const GetActivityQueryParamsSchema = z.object({
  filter: GetActivityFilterSchema.optional(),
  limit: GetActivityLimitSchema.optional(),
});
export const GetActivityResponseSchema = createResponseSchema(
  z.array(ActivitySchema),
);

export type ActivityAddress = z.infer<typeof ActivityAddressSchema>;
export type ActivityAmount = z.infer<typeof ActivityAmountSchema>;
export type ActivityToken = z.infer<typeof ActivityTokenSchema>;
export type ActivityFlow = z.infer<typeof ActivityFlowSchema>;
export type ActivityTokenFlows = z.infer<typeof ActivityTokenFlowsSchema>;
export type ActivityApproval = z.infer<typeof ActivityApprovalSchema>;
export type Activity = z.infer<typeof ActivitySchema>;
export type ActivityKind = Activity["kind"];
export type GetActivityQueryParams = AddressParams &
  z.infer<typeof GetActivityQueryParamsSchema>;
export type GetActivityResponse = z.infer<typeof GetActivityResponseSchema>;
