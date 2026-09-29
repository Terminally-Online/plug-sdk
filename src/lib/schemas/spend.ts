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

// readInputCeiling resolves the asset option that bounds an amount input — the
// asset the amount is denominated in. A spend tag is a funding declaration and
// wins when its referenced option carries a max; an amount that spends nothing
// from the wallet (a withdraw or borrow acting through a position on the owner's
// behalf) carries only `decimal:inherit:N`, so the ceiling is the option chosen
// for that reference when it carries a max. An amount that names no asset at
// all — an ERC-1155 count picked within the id chosen before it — is bounded by
// the first of its own options that carries a max, which is the balance held.
// undefined when none applies.
export const readInputCeiling = (
  input: InputReference | undefined,
  optionFor: (referenceIndex: number) => ContextActionOption | undefined,
  own?: ContextActionOption[],
): ContextActionOption | undefined => {
  const [spend] = readInputSpends(input, optionFor);
  if (spend) return spend;

  const inherit = input?.tags?.find(
    (tag) =>
      tag.kind === TagKind.Decimal &&
      tag.value === "inherit" &&
      typeof tag.reference === "number",
  );
  if (!inherit) return own?.find((option) => option.max);

  const option = optionFor(inherit.reference as number);
  return option?.max ? option : undefined;
};
