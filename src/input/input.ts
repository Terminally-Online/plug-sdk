import { InputType, SentenceMode } from "../lib/types/sentence";

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
  if (typeof type === "object" && "modes" in type && Array.isArray(type.modes)) {
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

export const getInputPlaceholder = (type: InputType | undefined): string => {
  if (!type) return "";

  if (typeof type === "string") {
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
    return `Must be: ${type.constant}`;
  }

  if ("modes" in type) {
    return "Pick a verb";
  }

  if ("metadata" in type) {
    return `Enter ${type.type} value`;
  }

  return "Enter value";
};
