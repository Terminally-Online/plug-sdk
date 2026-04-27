import { z } from "zod";

import { createResponseSchema } from "./response";
import { ChainSchema } from "./chain";
import { AddressParams } from "./address";
import {
  InputReferenceSchema,
  InputTagsSchema,
} from "../types/sentence";

export const ContextStepAttributesSchema = z.object({
  "is:user_specific": z.boolean().optional(),
  "is:searchable": z.boolean().optional(),
  "is:unlisted": z.boolean().optional(),
});

const baseContextStepOptionSchema = z.object({
  label: z.string().optional(),
  name: z.string().optional(),
  value: z.string().optional(),
  icons: z.array(z.string()).optional(),
});

export interface ContextStepOptionType {
  label?: string;
  name?: string;
  value?: string;
  icons?: string[];
  info?: ContextStepOptionType;
}

export const ContextStepOptionSchema: z.ZodType<ContextStepOptionType> =
  baseContextStepOptionSchema.extend({
    info: z.lazy(() => ContextStepOptionSchema).optional(),
  });
export interface IContextStepOption {
  [key: string]: ContextStepOptionType[] | IContextStepOption;
}

const contextStepOptionsSchema: z.ZodType<
  ContextStepOptionType[] | IContextStepOption
> = z.union([
  z.array(ContextStepOptionSchema),
  z.lazy(() => z.record(z.string(), contextStepOptionsSchema)),
]);

export const ContextStepOptionsSchema = z.record(
  z.string(),
  contextStepOptionsSchema,
);

// Recursive type structure for tuple/struct return types from Gusher API.
// Type can be a simple string ("uint256") or an array of nested type elements for tuples.
export interface IOutputTypeElement {
  name: string;
  type: string | IOutputTypeElement[];
  offset: number;
  tags?: z.infer<typeof InputTagsSchema> | undefined;
}

const OutputTypeElementSchema: z.ZodType<IOutputTypeElement> = z.lazy(() =>
  z.object({
    name: z.string(),
    type: OutputTypeSchema,
    offset: z.number(),
    tags: InputTagsSchema.optional(),
  }),
);

const OutputTypeSchema: z.ZodType<string | IOutputTypeElement[]> = z.lazy(() =>
  z.union([z.string(), z.array(OutputTypeElementSchema)]),
);

export const ContextStepOutputInfoSchema = z.object({
  name: z.string(),
  type: OutputTypeSchema,
  offset: z.number(),
  dynamic: z.boolean().optional(),
  tags: InputTagsSchema.optional(),
});

export const ContextStepSentenceSchema = z.object({
  raw: z.string(),
  template: z.string(),
  inputs: z.array(InputReferenceSchema),
  outputs: z.array(ContextStepOutputInfoSchema).optional(),
});

export const ContextStepSchema = z.object({
  type: z.string(),
  sentence: ContextStepSentenceSchema,
  name: z.string(),
  description: z.string(),
  icon: z.string(),
  attributes: ContextStepAttributesSchema.optional(),
  feeds: z.array(z.string()).optional(),
  options: ContextStepOptionsSchema.optional(),
});

export const ContextActionSchema = ContextStepSchema.extend({
  protocol: z.string(),
  action: z.string(),
});

export const ContextProtocolSchema = z.object({
  name: z.string(),
  symbol: z.string(),
  icon: z.string(),
  tags: z.array(z.string()),
  chains: z.array(ChainSchema),
  actions: z.record(z.string(), ContextStepSchema).optional(),
});

export const ContextSchema = z.record(z.string(), ContextProtocolSchema);

export const ContextFilterSchema = z.object({
  chain_id: z
    .number()
    .optional()
    .describe(
      "Filter results to specific chains from the listed of supported options.",
    ),
  protocol: z
    .string()
    .optional()
    .describe(
      "Filter results to specific protocols from the listed of supported options.",
    ),
  action: z
    .string()
    .optional()
    .describe(
      "Filter results to specific actions from the listed of supported options.",
    ),
  unlisted: z
    .boolean()
    .optional()
    .describe("Include unlisted contracts in the results."),
});
export const ContextQueryParamsSchema = z.object({
  filter: ContextFilterSchema.optional(),
  search: z
    .record(z.string())
    .optional()
    .describe(
      "Search within the returned options by input index of an action sentence. This is helpful when letting users refine the options shown for a specific action input such as tokens, vaults or liquidity pools.",
    ),
});
export const ContextResponseSchema = createResponseSchema(ContextSchema);

export type ContextActionAttributes = z.infer<
  typeof ContextStepAttributesSchema
>;
export type ContextActionOptions = z.infer<typeof ContextStepOptionsSchema>;
export type ContextActionOption = z.infer<typeof ContextStepOptionSchema>;
export type ContextActionOutputInfo = z.infer<
  typeof ContextStepOutputInfoSchema
>;
export type ContextStep = z.infer<typeof ContextStepSchema>;
export type ContextProtocol = z.infer<typeof ContextProtocolSchema>;
export type Context = z.infer<typeof ContextSchema>;
export type ContextFilter = z.infer<typeof ContextFilterSchema>;
export type ContextQueryParams = AddressParams &
  z.infer<typeof ContextQueryParamsSchema>;
export type ContextResponse = z.infer<typeof ContextResponseSchema>;
export type ContextAction = z.infer<typeof ContextActionSchema>;
