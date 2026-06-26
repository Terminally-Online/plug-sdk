import { InputReference, TagKind } from "../types/sentence";
import { ContextActionOption } from "./option";

// A "max" affordance fills an amount field with a referenced token option's full
// held balance. The token option carries the ceiling first-class — `max` is the exact
// base-units literal, `decimals` scales it — so there's no parallel sentinel type.

// formatBaseUnits renders an integer base-units string as a human decimal, scaled
// by `decimals` with trailing fractional zeros trimmed. Dependency-free so the SDK
// owns sentinel rendering without pulling in a bignumber/EVM library.
const formatBaseUnits = (value: string, decimals: number): string => {
  if (!/^-?\d+$/.test(value)) return value;
  if (decimals <= 0) return value;
  const negative = value.startsWith("-");
  const digits = (negative ? value.slice(1) : value).padStart(
    decimals + 1,
    "0",
  );
  const whole = digits.slice(0, digits.length - decimals);
  const fraction = digits.slice(digits.length - decimals).replace(/0+$/, "");
  return `${negative ? "-" : ""}${whole}${fraction ? `.${fraction}` : ""}`;
};

// sentinelAmount is the human max a token option fills into a referenced amount
// field. `max` is exact base units (the displayed balance is rounded, so the client
// scales to full precision), applied through `decimals`. undefined when the option
// carries no max.
export const sentinelAmount = (
  option: ContextActionOption,
): string | undefined => {
  if (!option.max) return undefined;
  if (option.decimals === undefined) return option.max;
  if (!Number.isFinite(option.decimals)) return undefined;
  return formatBaseUnits(option.max, option.decimals);
};

// readInputSentinels resolves the token options an input's sentinel tags reference,
// keeping those that carry a max. Each sentinel-kind tag points (via `reference`) at
// an upstream input; `optionFor` supplies that input's chosen option (the token,
// which now carries `max`/`decimals` first-class). Empty when none apply.
export const readInputSentinels = (
  input: InputReference | undefined,
  optionFor: (referenceIndex: number) => ContextActionOption | undefined,
): ContextActionOption[] => {
  const tags = input?.tags;
  if (!tags?.length) return [];

  const options: ContextActionOption[] = [];
  for (const tag of tags) {
    if (tag.kind !== TagKind.Sentinel) continue;
    if (typeof tag.reference !== "number") continue;

    const option = optionFor(tag.reference);
    if (option?.max) options.push(option);
  }
  return options;
};
