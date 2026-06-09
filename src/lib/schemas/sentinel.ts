import { InputReference, TagKind } from "../types/sentence";
import { ContextActionOption } from "./option";

// A sentinel is just an option (gusher hangs `Option.Sentinel *Option` off the
// option that resolves the reference), so it flows through the same
// `ContextActionOption` model — no parallel type. `label` names it (and renders the
// chip), `value` is the exact base-units literal, and `info.value` carries the
// decimals to scale it. Nothing is special-cased to "max".

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

// sentinelAmount is the human value a sentinel option fills into its field. The
// value is exact base units (the displayed balance is rounded, so the client scales
// to full precision); when the server pairs a decimals scalar in `info.value` it is
// applied, otherwise the value is already display-ready. undefined when there is no
// usable value to fill.
export const sentinelAmount = (
  sentinel: ContextActionOption,
): string | undefined => {
  if (sentinel.value === undefined) return undefined;
  const decimals = sentinel.info?.value;
  if (decimals === undefined) return sentinel.value;
  const scale = Number(decimals);
  if (!Number.isFinite(scale)) return undefined;
  return formatBaseUnits(sentinel.value, scale);
};

// readInputSentinels resolves the sentinel option an input offers per sentinel tag.
// Each of the input's sentinel-kind tags points (via `reference`) at an upstream
// input; `optionFor` supplies that input's currently chosen option, which carries
// the server-computed sentinel. Returns the sentinel options that carry a value —
// empty when none apply.
export const readInputSentinels = (
  input: InputReference | undefined,
  optionFor: (referenceIndex: number) => ContextActionOption | undefined,
): ContextActionOption[] => {
  const tags = input?.tags;
  if (!tags?.length) return [];

  const sentinels: ContextActionOption[] = [];
  for (const tag of tags) {
    if (tag.kind !== TagKind.Sentinel) continue;
    if (typeof tag.reference !== "number") continue;

    const sentinel = optionFor(tag.reference)?.sentinel;
    if (sentinel?.value === undefined) continue;

    sentinels.push(sentinel);
  }
  return sentinels;
};
