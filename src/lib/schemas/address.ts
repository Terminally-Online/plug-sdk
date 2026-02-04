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
  address: z.string(),
});
export const AddressResponseSchema = createResponseSchema(AddressSchema);

export const PositionsFilterSchema = z.object({
  chain_id: z.array(z.number()).optional(),
  standard: z.array(z.string()).optional(),
  protocol: z.array(z.string()).optional(),
  address: z.array(z.string()).optional(),
  token_id: z.array(z.string()).optional(),
  status: z.string().optional(),
});
export const PositionsSearchSchema = z.object({
  all: z.string().optional(),
  name: z.string().optional(),
  symbol: z.string().optional(),
});
export const PositionsPriceSchema = z.object({
  resolution: z.string().optional(),
  limit: z.number().optional(),
  from: z.number().optional(),
  to: z.number().optional(),
  before: z.number().optional(),
});
export const PositionsActionSchema = z.object({
  refresh: z.boolean().optional(),
  hide: z.boolean().optional(),
});
export const PositionsSortSchema = z.object({
  by: z.enum(["value", "name", "symbol"]).optional(),
  direction: z.enum(["asc", "desc"]).optional(),
});
export const PositionsLimitSchema = z.object({
  count: z.number().optional(),
  offset: z.number().optional(),
  groups: z.array(z.array(z.string())).optional(),
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
