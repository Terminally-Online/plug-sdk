import { z } from "zod";

// The option model the context endpoint returns for an action's inputs — mirrors
// gusher's `models.Option`. `info` and `sentinel` are themselves options (nested
// display metadata and a one-click literal). An input's options are either a flat
// list or a tree keyed by an upstream input's value (resolved by resolveInputOptions).

const baseOptionSchema = z.object({
  label: z.string().optional(),
  part: z.string().optional(),
  name: z.string().optional(),
  value: z.string().optional(),
  icons: z.array(z.string()).optional(),
});

export interface ContextStepOptionType {
  label?: string;
  part?: string;
  name?: string;
  value?: string;
  icons?: string[];
  info?: ContextStepOptionType;
  // A server-computed, context-scoped literal the user can one-click (e.g. "max").
  // Itself an option: `label` names it, `value` is the exact base-units literal, and
  // `info.value` carries the decimals to scale it (see sentinel.ts).
  sentinel?: ContextStepOptionType;
}

export const ContextStepOptionSchema: z.ZodType<ContextStepOptionType> =
  baseOptionSchema.extend({
    info: z.lazy(() => ContextStepOptionSchema).optional(),
    sentinel: z.lazy(() => ContextStepOptionSchema).optional(),
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

// Reads the leading number out of a display string (`"3.1%"` → 3.1, `"$1,200"` → 1200),
// preserving nothing but the magnitude — used only to pick the bounds of a range fold.
const parseNumeric = (raw: string | undefined): number | undefined => {
  if (raw === undefined) return undefined;
  const n = Number(String(raw).replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? n : undefined;
};

// Summarizes many same-format display strings into a `min - max` range, carrying each
// bound's ORIGINAL string so formatting (%, $, suffixes) is preserved verbatim. Equal
// bounds collapse to a single value; non-numeric values fall back to the first entry.
const rangeOf = (raw: (string | undefined)[]): string | undefined => {
  const present = raw.filter((v): v is string => v !== undefined && v !== "");
  if (present.length === 0) return undefined;
  const scored = present.map((s) => ({ s, n: parseNumeric(s) }));
  if (scored.some((x) => x.n === undefined)) return present[0];
  let lo = scored[0];
  let hi = scored[0];
  for (const x of scored) {
    if ((x.n as number) < (lo.n as number)) lo = x;
    if ((x.n as number) > (hi.n as number)) hi = x;
  }
  return lo.s === hi.s ? lo.s : `${lo.s} - ${hi.s}`;
};

/**
 * Resolves the secondary metadata a row draws beneath its identity — the dual of
 * resolveInputOptions. Options resolve DOWN, by the values an input depends on; display
 * resolves UP, from the options of the input that depends on this one (its dimension). The
 * dimension is found through the same `requires` the API already ships: the input whose
 * options are keyed by this one. When that dimension has a resolved value (the action frame
 * entered with it, or the user picked it) the row shows that one entry's icon and rate;
 * otherwise the summary — the icon union and the rate range. The row's TOP-LINE figure is
 * the option's own `info.value` (an action-specific USD balance the server sets — what you
 * can supply, your position, your borrow capacity); it rides above the dimension rate and is
 * carried through unchanged in every branch. An input with no dependent dimension simply
 * renders its own `info`, untouched.
 */
export const resolveInputInfo = (
  option: ContextActionOption,
  inputIndex: number,
  inputs: ReadonlyArray<{ requires?: number[] }> | undefined,
  options: ContextActionOptions | undefined,
  values: ReadonlyArray<ResolvableValue> | undefined,
  actions: ResolvableActions,
): ContextActionOption | undefined => {
  const dimIndex = inputs?.findIndex((input) =>
    input.requires?.includes(inputIndex),
  );
  if (dimIndex === undefined || dimIndex < 0) return option.info;

  // The dimension's entries FOR THIS ROW: overlay the row's own value at our position so the
  // dimension tree resolves to this option's branch regardless of the wider selection state.
  const overlay: ResolvableValues = values ? values.slice() : [];
  overlay[inputIndex] = { value: option.value };
  const entries = resolveInputOptions(
    options?.[String(dimIndex)],
    inputs![dimIndex].requires,
    overlay,
    actions,
  );
  if (!entries || entries.length === 0) return option.info;

  // The asset's own top-line figure (USD balance), set by the server and the same whichever
  // market the rate ends up resolving from.
  const top = option.info?.value;

  const dimValue = derefTagValue(values?.[dimIndex]?.value, actions);
  const picked =
    dimValue !== undefined ? chosenOption(entries, dimValue) : undefined;
  if (picked) {
    return {
      value: top,
      icons: picked.icons,
      info: { value: picked.info?.info?.value },
    };
  }

  const icons = Array.from(new Set(entries.flatMap((e) => e.icons ?? [])));
  return {
    value: top,
    icons,
    info: { value: rangeOf(entries.map((e) => e.info?.info?.value)) },
  };
};
