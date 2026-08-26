import { z } from "zod/v4";

import { createResponseSchema } from "./response";
import { ChainSchema } from "./chain";
import { AddressParams } from "./address";
import { ContextStepOptionsSchema } from "./option";
import { InputReferenceSchema, InputTagsSchema } from "../types/sentence";

export const ContextStepAttributesSchema = z.object({
  "is:user_specific": z.boolean().optional(),
  "is:unlisted": z.boolean().optional(),
  "opens:callback": z
    .boolean()
    .optional()
    .describe(
      "The action opens a callback body (a flash loan) the author's own End closes, on the same frame stack as conditionals and witnesses.",
    ),
});

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
  selectorTags: z.record(z.string(), InputTagsSchema).optional(),
  selectorInput: z.number().optional(),
});

export const ContextStepSentenceSchema = z.object({
  raw: z.string(),
  template: z.string(),
  inputs: z.array(InputReferenceSchema),
  outputs: z.array(ContextStepOutputInfoSchema).optional(),
});

// Meta is request-scoped relevance the server projects over the draft request — a swap
// quote, a live max — keyed by facet name. The map is intentionally open: the frame
// renders the facets it recognizes and ignores the rest, so a new facet ships without a
// schema lockstep. Facets exist at two scopes: the action as a whole, and individual
// inputs (keyed by input index).
export const MetaFacetsSchema = z.record(z.string(), z.unknown());
export const MetaSchema = z.object({
  action: MetaFacetsSchema.optional(),
  inputs: z.record(z.string(), MetaFacetsSchema).optional(),
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
  meta: MetaSchema.optional(),
});

export const ContextActionSchema = ContextStepSchema.extend({
  protocol: z.string(),
  action: z.string(),
});

export const ContextProtocolLinkSchema = z.object({
  kind: z.string(),
  url: z.string(),
});

export const ContextProtocolSchema = z.object({
  name: z.string(),
  symbol: z.string(),
  icon: z.string(),
  description: z.string().optional(),
  tags: z.array(z.string()),
  chains: z.array(ChainSchema),
  links: z.array(ContextProtocolLinkSchema).optional(),
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
    .record(z.string(), z.string())
    .optional()
    .describe(
      "Search within the returned options by input index of an action sentence. This is helpful when letting users refine the options shown for a specific action input such as tokens, vaults or liquidity pools.",
    ),
  intent: z
    .enum(["imperative", "declarative"])
    .optional()
    .describe(
      "Whether an action's options are scoped to the caller's holdings (imperative, acting now) or the full universe of valid targets (declarative, composing a flow). Defaults to declarative.",
    ),
  input: z
    .number()
    .optional()
    .describe(
      "The focused input index whose option list is being paginated. Paired with limit; the response windows only this input's list.",
    ),
  selections: z
    .record(z.string(), z.string())
    .optional()
    .describe(
      "Values already chosen for the focused input's dependency inputs, keyed by input index, so a dependent list (e.g. a market that hangs off a chosen token) windows against its parent.",
    ),
  draft: z
    .record(z.string(), z.string())
    .optional()
    .describe(
      "The full partial assignment, every input the user has filled so far keyed by input index, so the server can project request-scoped meta (a swap quote, a live max) over the complete in-flight request.",
    ),
  limit: z
    .object({ count: z.number(), offset: z.number().optional() })
    .optional()
    .describe(
      "Page window for the focused input's option list. count is the page size; offset skips leading entries. Follow links.next to advance.",
    ),
});
export const ContextResponseSchema = createResponseSchema(ContextSchema);

export type ContextActionAttributes = z.infer<
  typeof ContextStepAttributesSchema
>;
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
export type Meta = z.infer<typeof MetaSchema>;
export type MetaFacets = z.infer<typeof MetaFacetsSchema>;
