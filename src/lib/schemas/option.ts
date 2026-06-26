import { z } from "zod";

// The option model the context endpoint returns for an action's inputs — mirrors
// gusher's `models.Option`. Identity (label/name/value/icons) and intrinsic token
// data (`decimals`) are present in both intents so the client can always render and
// scale an amount. `max` is the actionable ceiling a "max" affordance fills (base
// units, scaled by `decimals`). Contextual display rides in `facets`, each
// self-describing by `kind` so the client renders by what it is, not by nesting.
// An input's options are either a flat list or a tree keyed by an upstream input's
// value (resolved by resolveInputOptions).

// Facet kinds, mirroring gusher's models constants. The client renders by kind and
// ignores kinds it doesn't recognize.
export const Facet = {
  Value: "value",
  Balance: "balance",
  Price: "price",
  Change: "change",
  Rate: "rate",
  Status: "status",
  Liquidity: "liquidity",
  TokenId: "token_id",
} as const;
export type FacetKind = (typeof Facet)[keyof typeof Facet];

export interface ContextStepFacet {
  kind: string;
  value: string;
}

export interface ContextStepOptionType {
  label?: string;
  part?: string;
  name?: string;
  value?: string;
  icons?: string[];
  decimals?: number;
  max?: string;
  facets?: ContextStepFacet[];
}

const facetSchema = z.object({ kind: z.string(), value: z.string() });

export const ContextStepOptionSchema: z.ZodType<ContextStepOptionType> = z.object({
  label: z.string().optional(),
  part: z.string().optional(),
  name: z.string().optional(),
  value: z.string().optional(),
  icons: z.array(z.string()).optional(),
  decimals: z.number().optional(),
  max: z.string().optional(),
  facets: z.array(facetSchema).optional(),
});

// facetValue reads the first facet of a kind off an option, or undefined.
export const facetValue = (
  option: ContextStepOptionType | undefined,
  kind: string,
): string | undefined => option?.facets?.find((facet) => facet.kind === kind)?.value;

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

export type ContextActionOptions = z.infer<typeof ContextStepOptionsSchema>;
export type ContextActionOption = z.infer<typeof ContextStepOptionSchema>;

// Resolution reads only `.value` off a request's values (indexed by input position)
// and `.values` off a prior action. Typing against these minimal shapes keeps option
// resolution decoupled from any one consumer's request model — a caller's richer
// value/action types are structurally compatible.
export type ResolvableValue = { value?: string | number } | null | undefined;
export type ResolvableValues = ResolvableValue[];
export type ResolvableAction = { values?: ResolvableValues } | undefined;
export type ResolvableActions = ResolvableAction[];

const TAG_REF_REGEX = /^<[~=]\{(\d+)\.(\d+)\}$/;

/**
 * Dereferences a value that may be a tag reference (`<~{actionIndex.inputIndex}`),
 * resolving it to the actual stored value from the source action.
 */
export const derefTagValue = (
  value: string | number | undefined,
  actions: ResolvableActions,
): string | number | undefined => {
  if (typeof value !== "string") return value;
  const match = value.match(TAG_REF_REGEX);
  if (!match) return value;
  return actions[parseInt(match[1])]?.values?.[parseInt(match[2])]?.value;
};

/**
 * Finds the option currently resolved for an input — the one whose value matches the
 * threaded value. Used to reach the server-computed sentinel hanging off a referenced
 * input's pick (a token/market option).
 */
export const chosenOption = (
  options: ContextActionOption[] | undefined,
  value: string | number | undefined,
): ContextActionOption | undefined =>
  value === undefined
    ? undefined
    : options?.find((option) => String(option.value) === String(value));

type OptionsNode = ContextActionOption[] | IContextStepOption;

/**
 * Walks a nested options tree for a single input, following the `requires` dependency
 * chain and dereferencing tag values along the way.
 *
 * Returns the resolved flat options array, or undefined if the tree can't be fully resolved.
 */
export const resolveInputOptions = (
  options: OptionsNode | undefined,
  requires: number[] | undefined,
  values: ResolvableValues | undefined,
  actions: ResolvableActions,
): ContextActionOption[] | undefined => {
  if (!options) return undefined;
  if (Array.isArray(options)) return options;

  if (typeof options === "object" && requires) {
    let current: OptionsNode = options;
    for (const depIdx of requires) {
      const depValue = derefTagValue(values?.[depIdx]?.value, actions);
      if (depValue && typeof current === "object" && !Array.isArray(current)) {
        current = current[String(depValue)];
        if (!current) return undefined;
      }
    }
    return Array.isArray(current) ? current : undefined;
  }

  return undefined;
};

export interface ResolvedInputInfo {
  facets: ContextStepFacet[];
  icons?: string[];
}

/**
 * The secondary metadata a row draws beneath its identity: its OWN facets only —
 * the universal signal that helps you pick (price, 24h change, holdings value). A
 * row never borrows the dependent dimension's action-specific data (a market's
 * rate, LTV, cap); the action resolves those on-chain at runtime, and the picker
 * picks identity. Options that carry an icon group (an E-Mode category's member
 * assets) surface those beyond the avatar as the subline icon-row.
 */
export const resolveInputInfo = (
  option: ContextActionOption,
): ResolvedInputInfo => ({
  facets: option.facets ?? [],
  icons: (option.icons?.length ?? 0) > 1 ? option.icons!.slice(1) : undefined,
});
