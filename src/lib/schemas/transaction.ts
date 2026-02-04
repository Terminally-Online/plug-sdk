import { z } from "zod";

import { createResponseSchema } from "@/src/lib/schemas/response";
import { AddressParams } from "@/src/lib/schemas/address";

export const TransactionInputSchema = z.object({
  protocol: z.string(),
  step: z.string(),
  inputs: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])),
});
export const TransactionStepSchema = z.object({
  value: z.string(),
  selector: z.number(),
  to: z.string(),
  data: z.string(),
});
export const TransactionSchema = z.object({
  id: z.string(),
  status: z.string(),
  chain_id: z.number(),
  address: z.string(),
  value: z.number(),
  gas_limit: z.number(),
  inputs: z.array(TransactionInputSchema),
  steps: z.array(TransactionStepSchema),
  created_at: z.string(),
  updated_at: z.string(),
});

export const GetTransactionsFilterSchema = z.object({
  id: z.string().optional(),
  chain_id: z.number().optional(),
  status: z.string().optional(),
});
export const GetTransactionsQueryParamsSchema = z.object({
  filter: GetTransactionsFilterSchema.optional(),
});
export const GetTransactionsResponseSchema =
  createResponseSchema(TransactionSchema);

export const CreateTransactionInputStepSchema = z.object({
  protocol: z.string(),
  step: z.string(),
  inputs: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])),
});
export const CreateTransactionInputSchema = z.object({
  chain_id: z.number(),
  deadline: z.number().optional(),
  steps: z.record(z.number(), CreateTransactionInputStepSchema),
});
export const CreateTransactionQueryParamsSchema = z.object({
  input: CreateTransactionInputSchema,
});
export const CreateTransactionResponseSchema =
  createResponseSchema(TransactionSchema);

export type TransactionInput = z.infer<typeof TransactionInputSchema>;
export type TransactionStep = z.infer<typeof TransactionStepSchema>;
export type Transaction = z.infer<typeof TransactionSchema>;
export type GetTransactionsQueryParams = AddressParams &
  z.infer<typeof GetTransactionsQueryParamsSchema>;
export type GetTransactionsResponse = z.infer<
  typeof GetTransactionsResponseSchema
>;

export type CreateTransactionQueryParams = AddressParams &
  z.infer<typeof CreateTransactionQueryParamsSchema>;
export type CreateTransactionResponse = z.infer<
  typeof CreateTransactionResponseSchema
>;
