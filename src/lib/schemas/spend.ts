import { InputReference, TagKind } from "../types/sentence";
import { ContextActionOption } from "./option";

// A spend-tagged amount fills one-click with the referenced asset option's full
// held balance. The option carries the ceiling first-class — `max` is the exact
// base-units literal, `decimals` scales it — so there's no parallel type.

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

// optionMaxAmount is the human max an asset option fills into a spend-tagged
// amount field. `max` is exact base units (the displayed balance is rounded, so the
// client scales to full precision), applied through `decimals`. undefined when the
// option carries no max.
export const optionMaxAmount = (
  option: ContextActionOption,
): string | undefined => {
  if (!option.max) return undefined;
  if (option.decimals === undefined) return option.max;
  if (!Number.isFinite(option.decimals)) return undefined;
  return formatBaseUnits(option.max, option.decimals);
};

// readInputSpends resolves the asset options an input's spend tags reference,
// keeping those that carry a max. A spend tag names (via its value) the input
// holding the asset the amount spends; `optionFor` supplies that input's chosen
// option, which carries `max`/`decimals` first-class. Empty when none apply.
export const readInputSpends = (
  input: InputReference | undefined,
  optionFor: (referenceIndex: number) => ContextActionOption | undefined,
): ContextActionOption[] => {
  const tags = input?.tags;
  if (!tags?.length) return [];

  const options: ContextActionOption[] = [];
  for (const tag of tags) {
    if (tag.kind !== TagKind.Spend) continue;
    const reference = Number(tag.value);
    if (!Number.isInteger(reference)) continue;

    const option = optionFor(reference);
    if (option?.max) options.push(option);
  }
  return options;
};
