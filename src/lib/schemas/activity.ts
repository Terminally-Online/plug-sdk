import { z } from "zod";

import { createResponseSchema } from "./response";
import { AddressParams } from "./address";

export const ActivityAddressSchema = z.object({
  address: z.string(),
  name: z.string().optional(),
  icon: z.string().optional(),
});

export const ActivityTransferSchema = z.object({
  address: z.string(),
  name: z.string().optional(),
  symbol: z.string().optional(),
  icon: z.string().optional(),
  decimals: z.number().optional(),
  value: z.string(),
  value_usd: z.string().optional(),
  token_id: z.string().optional(),
  token_ids: z.array(z.string()).optional(),
  standard: z.string().optional(),
  protocol: z.string().optional(),
  protocol_icon: z.string().optional(),
  from: ActivityAddressSchema,
  to: ActivityAddressSchema,
});

export const ActivityApprovalTokenSchema = z.object({
  address: z.string(),
  name: z.string().optional(),
  symbol: z.string().optional(),
  icon: z.string().optional(),
});

export const ActivityApprovalSpenderSchema = z.object({
  address: z.string(),
  name: z.string().optional(),
  icon: z.string().optional(),
  protocol: z.string().optional(),
});

export const ActivityApprovalSchema = z.object({
  token: ActivityApprovalTokenSchema,
  owner: z.string(),
  spender: ActivityApprovalSpenderSchema,
  summary: z.string(),
});

export const ActivitySchema = z.object({
  tx_hash: z.string(),
  block_number: z.number(),
  chain_id: z.number(),
  type: z.string(),
  name: z.string(),
  label: z.string(),
  sender: ActivityAddressSchema.optional(),
  recipient: ActivityAddressSchema.optional(),
  value: z.string(),
  value_usd: z.string().optional(),
  balance_change: z.string().optional(),
  balance_symbol: z.string().optional(),
  balance_direction: z.string().optional(),
  transfers: z.array(ActivityTransferSchema),
  approvals: z.array(ActivityApprovalSchema).optional(),
});

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
export type ActivityTransfer = z.infer<typeof ActivityTransferSchema>;
export type ActivityApproval = z.infer<typeof ActivityApprovalSchema>;
export type Activity = z.infer<typeof ActivitySchema>;
export type GetActivityQueryParams = AddressParams &
  z.infer<typeof GetActivityQueryParamsSchema>;
export type GetActivityResponse = z.infer<typeof GetActivityResponseSchema>;
