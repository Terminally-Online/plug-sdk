import { z } from "zod";
import { EvmTypeSchema } from "./evm";

export const ConstantTypeSchema = z.object({
  constant: z.string(),
});

// SentenceMode enumerates every verb a mode-discriminated sentence
// (boolean.predicate today) can take. The list MUST stay in lockstep
// with gusher's `actions.AllModes` constant — adding a mode here
// without the corresponding gusher-side support produces actions the
// compiler can't lower, and adding one in gusher without registering
// it here causes zod validation to fail on every page load.
export const SentenceModeSchema = z.union([
  z.literal("is"),
  z.literal("if"),
  z.literal("unless"),
  z.literal("else_if"),
  z.literal("while"),
  z.literal("until"),
  z.literal("assert"),
  z.literal("require"),
]);

// ModeType is the parsed representation of a `mode(...)` input slot.
// Sentences declare an explicit subset of SentenceMode values in the
// template; the parsed `modes` field carries that subset and the
// renderer dispatches off it to surface a verb picker. Structurally
// distinct from EvmType, ConstantType, CompoundType, etc. — the
// presence of the `modes` key is the discriminator.
export const ModeTypeSchema = z.object({
  modes: z.array(SentenceModeSchema).min(1),
});

export const ComparisonOperatorSchema = z.union([
  z.literal("=="),
  z.literal(">"),
  z.literal("<"),
  z.literal(">="),
  z.literal("<="),
  z.literal("!="),
]);

export const ComparisonValueSchema = z.object({
  literal: z.string().optional(),
  reference: z.number().optional(),
  part: z.number().optional(),
});

export const SimpleUnionTypeSchema = z.object({
  types: z.array(z.union([EvmTypeSchema, ConstantTypeSchema])),
});

export const CompoundTypeSchema = z.object({
  type: z.union([EvmTypeSchema, ConstantTypeSchema, SimpleUnionTypeSchema]),
  metadata: z.array(
    z.union([EvmTypeSchema, ConstantTypeSchema, SimpleUnionTypeSchema]),
  ),
});

export const InputTypeSchema: z.ZodType<any> = z.lazy(() =>
  z.union([
    EvmTypeSchema,
    ConstantTypeSchema,
    ModeTypeSchema,
    CompoundTypeSchema,
    ComparisonTypeSchema,
    UnionTypeSchema,
  ]),
);

export const ComparisonTypeSchema = z.object({
  left: ComparisonValueSchema,
  operator: ComparisonOperatorSchema,
  right: ComparisonValueSchema,
  trueType: InputTypeSchema,
  falseType: InputTypeSchema,
});

export const UnionTypeSchema = z.object({
  types: z.array(InputTypeSchema),
});

export const InputTagSchema = z.object({
  kind: z.string(),
  value: z.string().optional(),
  qualifiers: z.array(z.string()).optional(),
  dynamic: z.boolean().optional(),
  reference: z.number().optional(),
});

export const InputTagsSchema = z.array(InputTagSchema);

export const InputReferenceSchema = z.object({
  name: z.string().optional(),
  type: InputTypeSchema.optional(),
  defaultValue: z.string().optional(),
  requires: z.array(z.number()).optional(),
  delimiter: z.string().optional(),
  coil: z.boolean().optional(),
  tags: InputTagsSchema.optional(),
});

export const ParsedSentenceSchema = z.object({
  raw: z.string(),
  template: z.string(),
  inputs: z.array(InputReferenceSchema),
});

export type InputTag = z.infer<typeof InputTagSchema>;
export type InputTags = z.infer<typeof InputTagsSchema>;
export type ConstantType = z.infer<typeof ConstantTypeSchema>;
export type SentenceMode = z.infer<typeof SentenceModeSchema>;
export type ModeType = z.infer<typeof ModeTypeSchema>;
export type SimpleUnionType = z.infer<typeof SimpleUnionTypeSchema>;
export type CompoundType = z.infer<typeof CompoundTypeSchema>;
export type ComparisonOperator = z.infer<typeof ComparisonOperatorSchema>;
export type ComparisonValue = z.infer<typeof ComparisonValueSchema>;
export type ComparisonType = z.infer<typeof ComparisonTypeSchema>;
export type UnionType = z.infer<typeof UnionTypeSchema>;
export type InputType = z.infer<typeof InputTypeSchema>;
export type InputReference = z.infer<typeof InputReferenceSchema>;
export type ParsedSentence = z.infer<typeof ParsedSentenceSchema>;
