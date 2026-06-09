import {
  InputReference,
  InputType,
  SentenceMode,
  Standard,
  TagKind,
  WalletVariant,
} from "../lib/types/sentence";

// isNumberType identifies an input whose value is a number the user types (an
// integer or fixed-point EVM type), as opposed to an address/string/bool. Drives
// the numeric-vs-text rendering split for free inputs.
export const isNumberType = (type: InputType | undefined): boolean => {
  const name = typeof type === "string" ? type : "";
  return name.includes("int") || name.includes("float");
};

// isAddressType identifies an input whose value is an EVM address the user
// supplies (a recipient, a contract). Drives address-shape validation for free
// inputs, the address counterpart to isNumberType.
export const isAddressType = (type: InputType | undefined): boolean => {
  return type === "address";
};

// walletVariant reads a wallet-standard input's intent: `self` (the caller's own
// address, resolved silently) or `external` (an address the caller provides via a
// searchable field). Returns undefined when the input is not a wallet slot. A
// wallet tag with no qualifier resolves to external — the safe default that never
// auto-commits the caller's own address to a recipient or spender.
export const walletVariant = (
  input: InputReference | undefined,
): WalletVariant | undefined => {
  const tag = input?.tags?.find(
    (t) => t.kind === TagKind.Standard && t.value === Standard.Wallet,
  );
  if (!tag) return undefined;
  return tag.qualifiers?.includes(WalletVariant.Self)
    ? WalletVariant.Self
    : WalletVariant.External;
};

export const isConstantType = (
  type: InputType | undefined,
): { isConstant: boolean; value?: string } => {
  if (!type) return { isConstant: false };
  if (typeof type === "object" && "constant" in type) {
    return { isConstant: true, value: type.constant };
  }
  return { isConstant: false };
};

// isModeType identifies a mode-discriminated input slot — the verb
// at index 0 of boolean.predicate's sentence today, but the helper
// is shape-driven so any future mode-typed slot benefits automatically.
// Returns the declared mode set so callers can render a picker
// without re-parsing the type field.
export const isModeType = (
  type: InputType | undefined,
): { isMode: boolean; modes?: SentenceMode[] } => {
  if (!type) return { isMode: false };
  if (
    typeof type === "object" &&
    "modes" in type &&
    Array.isArray(type.modes)
  ) {
    return { isMode: true, modes: type.modes as SentenceMode[] };
  }
  return { isMode: false };
};

export const getTypeDescription = (type: InputType | undefined): string => {
  if (!type) return "";

  if (typeof type === "string") {
    return `Type: ${type}`;
  }

  if ("constant" in type) {
    return `Must be: "${type.constant}"`;
  }

  if ("modes" in type) {
    return `Verb (${type.modes.join(" | ")})`;
  }

  if ("metadata" in type) {
    return `Type: ${type.type} with ${type.metadata.join(", ")}`;
  }

  if ("left" in type) {
    return "Conditional type";
  }

  return "";
};

const VOWEL_SOUND_LETTERS = new Set([
  "a",
  "e",
  "f",
  "h",
  "i",
  "l",
  "m",
  "n",
  "o",
  "r",
  "s",
  "x",
]);

const CONSONANT_SOUND_PREFIXES = [
  "uni",
  "use",
  "usu",
  "uti",
  "ubi",
  "eu",
  "ewe",
  "one",
  "once",
  "url",
  "uri",
  "usd",
  "usb",
  "ufo",
];
const VOWEL_SOUND_PREFIXES = ["honest", "honor", "hour", "heir"];

const indefiniteArticle = (word: string): "a" | "an" => {
  const lower = word.toLowerCase();
  if (!lower) return "a";
  if (VOWEL_SOUND_PREFIXES.some((prefix) => lower.startsWith(prefix)))
    return "an";
  if (CONSONANT_SOUND_PREFIXES.some((prefix) => lower.startsWith(prefix)))
    return "a";
  const isAcronym =
    word.length === 1 || (word === word.toUpperCase() && /[A-Z]/.test(word));
  if (isAcronym) return VOWEL_SOUND_LETTERS.has(lower[0]) ? "an" : "a";
  return "aeiou".includes(lower[0]) ? "an" : "a";
};

const splitSlotName = (name: string): string[] =>
  name
    .replace(/[_-]/g, " ")
    .replace(/([a-z])([A-Z])|([A-Z])([A-Z][a-z])/g, "$1$3 $2$4")
    .split(" ")
    .filter((word) => word.length > 0);

type NamedSlot = { label: string; article: "a" | "an" };

const describeSlot = (name: string | undefined): NamedSlot | null => {
  if (!name) return null;
  const words = splitSlotName(name);
  if (words.length === 0) return null;
  const label = words
    .map((word) =>
      word.length > 1 && word === word.toUpperCase()
        ? word
        : word.toLowerCase(),
    )
    .join(" ");
  return { label, article: indefiniteArticle(words[0]) };
};

const capitalize = (value: string): string =>
  value.length === 0 ? value : value.charAt(0).toUpperCase() + value.slice(1);

export const getInputPlaceholder = (
  type: InputType | undefined,
  name: string | undefined = undefined,
): string => {
  if (!type) return "";

  const slot = describeSlot(name);

  if (typeof type === "string") {
    if (slot) {
      if (type === "bool") return `Enter ${slot.label} (true or false)`;
      return `Enter ${slot.article} ${slot.label}`;
    }

    switch (type) {
      case "uint256":
        return "Enter a positive number";
      case "address":
        return "0x...";
      case "bool":
        return "true or false";
      case "string":
        return "Enter text";
      default:
        return `Enter ${type}`;
    }
  }

  if ("constant" in type) {
    if (slot) return `${capitalize(slot.label)} must be ${type.constant}`;
    return `Must be: ${type.constant}`;
  }

  if ("modes" in type) {
    if (slot) return `Pick ${slot.article} ${slot.label}`;
    return "Pick a verb";
  }

  if ("metadata" in type) {
    if (slot) return `Enter ${slot.article} ${slot.label}`;
    return `Enter ${type.type} value`;
  }

  if (slot) return `Enter ${slot.article} ${slot.label}`;
  return "Enter value";
};
