import { z } from "zod";

import { ActionSchema } from "./action";
import { createResponseSchema } from "./response";

export type RecursiveStringMap = { [key: string]: string | RecursiveStringMap };

export const RecursiveStringMapSchema: z.ZodType<RecursiveStringMap> = z.lazy(
  () => z.record(z.string(), z.union([z.string(), RecursiveStringMapSchema])),
);

export type AttributeLeaf = { name: string; value: string; format?: string };
export type AttributeSection = { key: string; leaves: AttributeLeaf[] };

const splitLeafKey = (key: string): { name: string; format?: string } => {
  const idx = key.lastIndexOf(":");
  if (idx > 0 && idx < key.length - 1) {
    return { name: key.slice(0, idx), format: key.slice(idx + 1) };
  }
  return { name: key };
};

const walk = (
  attrs: RecursiveStringMap | undefined,
  path: string[],
): string | RecursiveStringMap | undefined => {
  let current: string | RecursiveStringMap | undefined = attrs;
  for (const key of path) {
    if (typeof current !== "object" || current === null) return undefined;
    current = current[key];
  }
  return current;
};

const findLeafKey = (
  container: RecursiveStringMap,
  name: string,
): string | undefined => {
  if (Object.prototype.hasOwnProperty.call(container, name)) return name;
  for (const key of Object.keys(container)) {
    if (splitLeafKey(key).name === name) return key;
  }
  return undefined;
};

export const attr = {
  get(
    attrs: RecursiveStringMap | undefined,
    ...path: string[]
  ): string | undefined {
    if (path.length === 0) return undefined;
    const parent = walk(attrs, path.slice(0, -1));
    if (typeof parent !== "object" || parent === null) return undefined;
    const key = findLeafKey(parent, path[path.length - 1]);
    const value = key === undefined ? undefined : parent[key];
    return typeof value === "string" ? value : undefined;
  },

  leaves(
    attrs: RecursiveStringMap | undefined,
    ...path: string[]
  ): AttributeLeaf[] {
    const current = walk(attrs, path);
    if (typeof current !== "object" || current === null) return [];
    const result: AttributeLeaf[] = [];
    for (const [key, value] of Object.entries(current)) {
      if (typeof value !== "string") continue;
      const { name, format } = splitLeafKey(key);
      result.push({ name, value, format });
    }
    return result;
  },

  sections(
    attrs: RecursiveStringMap | undefined,
    ...path: string[]
  ): AttributeSection[] {
    const current = walk(attrs, path);
    if (typeof current !== "object" || current === null) return [];
    const result: AttributeSection[] = [];
    for (const [key, value] of Object.entries(current)) {
      if (typeof value !== "object" || value === null) continue;
      const leaves = attr.leaves(value);
      if (leaves.length > 0) result.push({ key, leaves });
    }
    return result;
  },

  entries(
    attrs: RecursiveStringMap | undefined,
    ...path: string[]
  ): [string, string][] {
    return attr
      .leaves(attrs, ...path)
      .map(({ name, value }): [string, string] => [name, value]);
  },

  formatOf(
    attrs: RecursiveStringMap | undefined,
    ...path: string[]
  ): string | undefined {
    if (path.length === 0) return undefined;
    const parent = walk(attrs, path.slice(0, -1));
    if (typeof parent !== "object" || parent === null) return undefined;
    const key = findLeafKey(parent, path[path.length - 1]);
    if (key === undefined || typeof parent[key] !== "string") return undefined;
    return splitLeafKey(key).format;
  },
};

export const AddressBalanceSchema = z.object({
  int: z.string(),
  float: z.string().optional(),
  decimals: z.number().optional(),
  value: z.string().optional(),
});

// Price arrives in one of two legitimate wire shapes: a full OHLC candle for a
// priced token/native, or a change-only quote for a position whose "price" is
// the 24h move in net value (no candle exists for a synthetic position). OHLC
// fields are therefore optional, but the refine still rejects a meaningless
// partial — a payload must be either a complete candle or carry a change.
export const AddressPriceSchema = z
  .object({
    open: z.string().optional(),
    high: z.string().optional(),
    low: z.string().optional(),
    close: z.string().optional(),
    change: z.string().optional(),
    block: z.number().optional(),
    timestamp: z.number().optional(),
  })
  .refine(
    (price) =>
      (price.open !== undefined &&
        price.high !== undefined &&
        price.low !== undefined &&
        price.close !== undefined) ||
      price.change !== undefined,
    {
      message:
        "price must be a full OHLC candle or carry a change (position net-value quote)",
    },
  );

export const AddressRelationshipSchema = z.object({
  chain_id: z.number().optional(),
  address: z.string().optional(),
  token_id: z.string(),
  name: z.string().optional(),
  symbol: z.string().optional(),
  decimals: z.number().optional(),
  standard: z.string().optional(),
  status: z.string().optional(),
  icon: z.string().optional(),
  description: z.string().optional(),
  attributes: RecursiveStringMapSchema.optional(),
  balance: AddressBalanceSchema.optional(),
});

export const AddressHistorySchema = z.array(
  z.object({
    price: AddressPriceSchema.optional(),
    balance: AddressBalanceSchema.optional(),
    timestamp: z.number(),
  }),
);

export const AddressSchema = z.object({
  chain_id: z.number(),
  address: z.string(),
  token_id: z.string().optional(),
  standard: z.string().optional(),
  name: z.string().optional(),
  symbol: z.string().optional(),
  decimals: z.number().optional(),
  icon: z.string().optional(),
  description: z.string().optional(),
  status: z.string().optional(),
  attributes: RecursiveStringMapSchema.optional(),
  balance: AddressBalanceSchema.optional(),
  price: AddressPriceSchema.optional(),
  history: AddressHistorySchema.optional(),
  relationships: z
    .record(z.string(), z.array(AddressRelationshipSchema))
    .optional(),
  tokens: z.array(AddressRelationshipSchema).optional(),
  visibility: z.string().optional(),
  actions: z.array(ActionSchema).optional(),
});

export const AddressParamsSchema = z.object({
  address: z
    .string()
    .describe(
      "The EVM address to get information for. In the case that you request an address we have never indexed, we will immediately index it.",
    ),
});
export const AddressResponseSchema = createResponseSchema(AddressSchema);

export const PositionsFilterSchema = z.object({
  chain_id: z
    .array(z.number())
    .optional()
    .describe(
      "Filter results to specific chains from the listed of supported options.",
    ),
  standard: z
    .array(
      z.enum([
        "erc:20",
        "erc:721",
        "erc:1155",
        "erc:4626",
        "native",
        "position",
      ]),
    )
    .optional()
    .describe("Filter results to specific token standards."),
  protocol: z
    .array(z.string())
    .optional()
    .describe(
      "Filter results to specific protocols from the listed of supported options.",
    ),
  address: z
    .array(z.string())
    .optional()
    .describe("Filter results to specific contract addresses."),
  token_id: z
    .array(z.string())
    .optional()
    .describe("Filter results to specific token ids."),
  verified: z
    .boolean()
    .optional()
    .describe("Filter results to verified or unverified contracts."),
  status: z
    .array(z.string())
    .optional()
    .describe(
      "Filter results by status. Supports 'pinned' and 'hidden' as special visibility filters.",
    ),
});
export const PositionsSearchSchema = z.object({
  all: z.string().optional().describe("Search by name or symbol."),
  name: z.string().optional().describe("Search by name only."),
  symbol: z.string().optional().describe("Search by symbol only."),
});
export const PositionsPriceSchema = z.object({
  resolution: z
    .string()
    .optional()
    .describe("Price data resolution (e.g., 1h, 1d)."),
  limit: z
    .number()
    .optional()
    .describe("Maximum number of price points to return."),
  from: z.number().optional().describe("Unix timestamp for price data start."),
  to: z.number().optional().describe("Unix timestamp for price data end."),
  before: z
    .number()
    .optional()
    .describe("Unix timestamp to fetch prices before."),
});
export const PositionsActionSchema = z.object({
  refresh: z
    .boolean()
    .optional()
    .describe("Refresh underlying metadata of returned items."),
  hide: z.boolean().optional().describe("Hide positions from the response."),
  visibility: z
    .string()
    .optional()
    .describe(
      "Set visibility for matched positions. Values: 'pinned', 'hidden', or '' (clear).",
    ),
});
export const PositionsSortSchema = z.object({
  by: z
    .enum(["value", "name", "symbol"])
    .optional()
    .describe("Field to sort results by."),
  direction: z
    .enum(["asc", "desc"])
    .optional()
    .describe("Sort direction (ascending or descending)."),
});
export const PositionsLimitSchema = z.object({
  count: z.number().optional().describe("Maximum number of results to return."),
  offset: z
    .number()
    .optional()
    .describe("Number of results to skip for pagination."),
  groups: z
    .array(z.array(z.string()))
    .optional()
    .describe("Group results by specified fields."),
});
export const PositionsQueryParamsSchema = z.object({
  filter: PositionsFilterSchema.optional(),
  search: PositionsSearchSchema.optional(),
  history: PositionsPriceSchema.optional(),
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
