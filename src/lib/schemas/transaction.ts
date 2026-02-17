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
  id: z.string().optional().describe("Filter results to a specific transaction id."),
  chain_id: z.number().optional().describe("Filter results to specific chains from the listed of supported options."),
  status: z.enum(["pending", "confirmed", "failed"]).optional().describe("Filter results to specific transaction statuses."),
});
export const GetTransactionsQueryParamsSchema = z.object({
  filter: GetTransactionsFilterSchema.optional(),
});
export const GetTransactionsResponseSchema =
  createResponseSchema(TransactionSchema);

export const CreateTransactionInputStepSchema = z.object({
  protocol: z.string().describe("Specify the protocol of the action to create the transaction for."),
  step: z.string().describe("Specify the action/step to create the transaction for."),
  inputs: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).describe("The values for each input within the action sentence."),
});
export const CreateTransactionInputSchema = z.object({
  chain_id: z.number().describe("The chain to create the transaction for."),
  deadline: z.number().optional().describe("A unix timestamp after which the transaction is no longer valid."),
  steps: z.record(z.number(), CreateTransactionInputStepSchema).describe("The steps/actions to include in the transaction."),
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

export const CoilOptionSchema = z.object({
  name: z.string(),
  type: z.string(),
  ref: z.string(),
});

export const CompileTransactionStepSchema = z.object({
  protocol: z.string().describe("Specify the protocol of the action to compile."),
  step: z.string().describe("Specify the action/step to compile."),
});
export const CompileTransactionInputSchema = z.object({
  chain_id: z.number().describe("The chain to compile the transaction for."),
  steps: z.record(z.number(), CompileTransactionStepSchema).describe("The steps/actions to compile."),
});
export const CompileTransactionQueryParamsSchema = z.object({
  input: CompileTransactionInputSchema,
});
export const CompileTransactionResponseSchema = createResponseSchema(
  z.array(z.record(z.string(), z.array(CoilOptionSchema))),
);

export type CoilOption = z.infer<typeof CoilOptionSchema>;
export type CompileTransactionQueryParams = AddressParams &
  z.infer<typeof CompileTransactionQueryParamsSchema>;
export type CompileTransactionResponse = z.infer<
  typeof CompileTransactionResponseSchema
>;
