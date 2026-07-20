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

const TAG_REF_REGEX = /^<([~=])\{(\d+)\.(\d+)\}$/;

/**
 * Dereferences a value that may be a tag reference (`<~{actionIndex.inputIndex}`)
 * or a variable binding (`<={actionIndex.keyIndex}`), resolving it to the actual
 * stored value from the source action. A tag reference reads the referenced input
 * directly. A variable binding names the setter's key input; the value the
 * variable holds is the setter's non-key input, so the binding follows through to
 * it. Either resolution may land on another reference (`set X to Y` chains) and
 * follows transitively, cycle-guarded; a runtime output coil (`<-{}`) is returned
 * as-is for the caller's cross-parent projection.
 */
export const derefTagValue = (
  value: string | number | undefined,
  actions: ResolvableActions,
  seen: Set<string> = new Set(),
): string | number | undefined => {
  if (typeof value !== "string") return value;
  const match = value.match(TAG_REF_REGEX);
  if (!match) return value;
  if (seen.has(value)) return undefined;
  seen.add(value);

  const values = actions[parseInt(match[2])]?.values;
  const index = parseInt(match[3]);
  if (match[1] === "=") {
    const payload = Object.entries(values ?? {}).find(
      ([key, candidate]) =>
        key !== String(index) && candidate?.value !== undefined,
    )?.[1];
    return derefTagValue(payload?.value, actions, seen);
  }
  return derefTagValue(values?.[index]?.value, actions, seen);
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

const COIL_REF_REGEX = /^<-\{/;

/**
 * Strips per-parent metrics down to the option's identity — facets and max
 * were computed under a specific parent that a runtime coil no longer names.
 */
const projectedOption = (option: ContextActionOption): ContextActionOption => ({
  ...option,
  facets: undefined,
  max: undefined,
});

/**
 * Interleaves ranked lists rank-by-rank: every list keeps its builder ranking
 * and the union takes each rank across all lists before descending, so each
 * parent's best options lead the projection.
 */
const interleaveByRank = (lists: ContextActionOption[][]): ContextActionOption[] => {
  const out: ContextActionOption[] = [];
  for (let rank = 0; ; rank++) {
    let advanced = false;
    for (const list of lists) {
      if (rank >= list.length) continue;
      advanced = true;
      out.push(list[rank]);
    }
    if (!advanced) break;
  }
  return out;
};

/**
 * Collapses a subtree to a single ranked list; nested trees arise from chained
 * dependencies and collapse by the same rank interleave, key-sorted for
 * stability.
 */
const collectRanked = (node: ContextActionOption[] | IContextStepOption): ContextActionOption[] => {
  if (Array.isArray(node)) return node;
  return interleaveByRank(
    Object.keys(node)
      .sort()
      .map((key) => collectRanked(node[key]))
      .filter((list) => list.length > 0),
  );
};

/**
 * Merges a dependent tree across every parent key — the resolution when a
 * dependency is filled by a runtime coil ref and no single subtree can be
 * chosen. Array subtrees union into the child dimension's flat deduped
 * rank-interleaved projection, identity only; record subtrees merge key-wise
 * so a later dependency in the chain can still resolve. Keys iterate sorted
 * so the projection is stable. Mirrors gusher's projectAcrossKeys
 * (internal/options/search.go).
 */
const mergeAcrossParent = (node: IContextStepOption): OptionsNode => {
  const children = Object.keys(node)
    .sort()
    .map((key) => node[key]);

  if (children.every(Array.isArray)) {
    const seen = new Set<string>();
    const out: ContextActionOption[] = [];
    for (const option of interleaveByRank(children.filter((list) => list.length > 0))) {
      const value = String(option.value);
      if (seen.has(value)) continue;
      seen.add(value);
      out.push(projectedOption(option));
    }
    return out;
  }

  const merged: IContextStepOption = {};
  for (const child of children) {
    if (Array.isArray(child)) continue;
    for (const key of Object.keys(child)) {
      const existing = merged[key];
      if (!existing) {
        merged[key] = projectLeaves(child[key]);
        continue;
      }
      merged[key] = mergeAcrossParent({ a: existing, b: child[key] } as IContextStepOption);
    }
  }
  return merged;
};

/**
 * Strips every leaf option below a node to identity — the treatment all
 * options reached through a coiled dependency receive, whether or not their
 * branch collided during the merge.
 */
const projectLeaves = (node: ContextActionOption[] | IContextStepOption): ContextActionOption[] | IContextStepOption => {
  if (Array.isArray(node)) return node.map(projectedOption);
  const out: IContextStepOption = {};
  for (const key of Object.keys(node)) out[key] = projectLeaves(node[key]);
  return out;
};

/**
 * Walks a nested options tree for a single input, following the `requires` dependency
 * chain and dereferencing tag values along the way. A dependency filled by a runtime
 * coil ref (`<-{a.k}`) has no literal key, so the tree resolves across every parent
 * key — the child dimension's flat deduped projection — mirroring gusher's
 * resolveFocusedList (internal/options/search.go).
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
        if (COIL_REF_REGEX.test(String(depValue))) {
          current = mergeAcrossParent(current);
          continue;
        }
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
