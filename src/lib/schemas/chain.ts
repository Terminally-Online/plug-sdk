import { z } from "zod/v4";

import { ExternalSchema } from "./external";
import { createResponseSchema } from "./response";

export const ChainSchema = z.object({
  chain_id: z.number(),
  address: z.string(),
  name: z.string(),
  symbol: z.string(),
  decimals: z.number(),
  icon: z.string().url(),
  external: ExternalSchema,
  block_time: z.number(),
  warming: z.boolean().optional(),
});

export const ChainFilterSchema = z.object({
  chain_id: z.array(z.number()).optional().describe("Filter results to specific chains from the listed of supported options."),
});

export const ChainQueryParamsSchema = z.object({
  filter: ChainFilterSchema.optional(),
});
export const ChainResponseSchema = createResponseSchema(z.array(ChainSchema));

export type Chain = z.infer<typeof ChainSchema>;
export type ChainQueryParams = z.infer<typeof ChainQueryParamsSchema>;
export type ChainResponse = z.infer<typeof ChainResponseSchema>;
