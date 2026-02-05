import { z } from "zod";

import { createResponseSchema } from "@/src/lib/schemas/response";

export type RecursiveStringMap = { [key: string]: string | RecursiveStringMap };

export const RecursiveStringMapSchema: z.ZodType<RecursiveStringMap> = z.lazy(
  () => z.record(z.string(), z.union([z.string(), RecursiveStringMapSchema])),
);

export const attr = {
  get(
    attrs: RecursiveStringMap | undefined,
    ...path: string[]
  ): string | undefined {
    let current: string | RecursiveStringMap | undefined = attrs;
    for (const key of path) {
      if (typeof current !== "object" || current === null) return undefined;
      current = current[key];
    }
    return typeof current === "string" ? current : undefined;
  },

  entries(
    attrs: RecursiveStringMap | undefined,
    ...path: string[]
  ): [string, string][] {
    let current: string | RecursiveStringMap | undefined = attrs;
    for (const key of path) {
      if (typeof current !== "object" || current === null) return [];
      current = current[key];
    }
    if (typeof current !== "object" || current === null) return [];
    return Object.entries(current).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    );
  },
};

export const AddressBalanceSchema = z.object({
  int: z.string(),
  float: z.string(),
});

export const AddressPriceSchema = z.object({
  open: z.string(),
  high: z.string(),
  low: z.string(),
  close: z.string(),
  change: z.string().optional(),
  block: z.number().optional(),
  timestamp: z.number().optional(),
});

export const AddressRelationshipSchema = z.object({
  token_id: z.string(),
  name: z.string().optional(),
  symbol: z.string().optional(),
  decimals: z.number().optional(),
  standard: z.string().optional(),
  status: z.string().optional(),
  icon: z.string().optional(),
  color: z.string().optional(),
  description: z.string().optional(),
  attributes: RecursiveStringMapSchema.optional(),
  balance: AddressBalanceSchema.optional(),
});

export const AddressSchema = z.object({
  chain_id: z.number(),
  address: z.string(),
  token_id: z.string().optional(),
  standard: z.string().optional(),
  name: z.string().optional(),
  symbol: z.string().optional(),
  decimals: z.number().optional(),
  icon: z.string().optional(),
  color: z.string().optional(),
  description: z.string().optional(),
  status: z.string().optional(),
  attributes: RecursiveStringMapSchema.optional(),
  balance: AddressBalanceSchema.optional(),
  price: z.array(AddressPriceSchema).optional(),
  relationships: z
    .record(z.string(), z.array(AddressRelationshipSchema))
    .optional(),
  tokens: z.array(AddressRelationshipSchema).optional(),
});

export const AddressParamsSchema = z.object({
  address: z.string().describe("The EVM address to get information for. In the case that you request an address we have never indexed, we will immediately index it."),
});
export const AddressResponseSchema = createResponseSchema(AddressSchema);

export const PositionsFilterSchema = z.object({
  chain_id: z.array(z.number()).optional().describe("Filter results to specific chains from the listed of supported options."),
  standard: z.array(z.enum(["erc:20", "erc:721", "erc:1155", "erc:4626", "native"])).optional().describe("Filter results to specific token standards."),
  protocol: z.array(z.string()).optional().describe("Filter results to specific protocols from the listed of supported options."),
  address: z.array(z.string()).optional().describe("Filter results to specific contract addresses."),
  token_id: z.array(z.string()).optional().describe("Filter results to specific token ids."),
  verified: z.boolean().optional().describe("Filter results to verified or unverified contracts."),
});
export const PositionsSearchSchema = z.object({
  all: z.string().optional().describe("Search by name or symbol."),
  name: z.string().optional().describe("Search by name only."),
  symbol: z.string().optional().describe("Search by symbol only."),
});
export const PositionsPriceSchema = z.object({
  resolution: z.string().optional().describe("Price data resolution (e.g., 1h, 1d)."),
  limit: z.number().optional().describe("Maximum number of price points to return."),
  from: z.number().optional().describe("Unix timestamp for price data start."),
  to: z.number().optional().describe("Unix timestamp for price data end."),
  before: z.number().optional().describe("Unix timestamp to fetch prices before."),
});
export const PositionsActionSchema = z.object({
  refresh: z.boolean().optional().describe("Refresh underlying metadata of returned items."),
  hide: z.boolean().optional().describe("Hide positions from the response."),
});
export const PositionsSortSchema = z.object({
  by: z.enum(["value", "name", "symbol"]).optional().describe("Field to sort results by."),
  direction: z.enum(["asc", "desc"]).optional().describe("Sort direction (ascending or descending)."),
});
export const PositionsLimitSchema = z.object({
  count: z.number().optional().describe("Maximum number of results to return."),
  offset: z.number().optional().describe("Number of results to skip for pagination."),
  groups: z.array(z.array(z.string())).optional().describe("Group results by specified fields."),
});
export const PositionsQueryParamsSchema = z.object({
  filter: PositionsFilterSchema.optional(),
  search: PositionsSearchSchema.optional(),
  price: PositionsPriceSchema.optional(),
  action: PositionsActionSchema.optional(),
  sort: PositionsSortSchema.optional(),
  limit: PositionsLimitSchema.optional(),
});

export const PositionsResponseSchema = createResponseSchema(
  z.array(AddressSchema),
);

export type AddressBalance = z.infer<typeof AddressBalanceSchema>;
export type AddressRelationship = z.infer<typeof AddressRelationshipSchema>;
export type Address = z.infer<typeof AddressSchema>;
export type AddressParams = z.infer<typeof AddressParamsSchema>;
export type AddressResponse = z.infer<typeof AddressResponseSchema>;

export type PositionsQueryParams = AddressParams &
  z.infer<typeof PositionsQueryParamsSchema>;
export type PositionsResponse = z.infer<typeof PositionsResponseSchema>;
