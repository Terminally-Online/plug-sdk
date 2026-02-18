import { InputType } from "@/src/lib/types/sentence";

export const isConstantType = (
  type: InputType | undefined,
): { isConstant: boolean; value?: string } => {
  if (!type) return { isConstant: false };
  if (typeof type === "object" && "constant" in type) {
    return { isConstant: true, value: type.constant };
  }
  return { isConstant: false };
};

export const getTypeDescription = (type: InputType | undefined): string => {
  if (!type) return "";

  if (typeof type === "string") {
    return `Type: ${type}`;
  }

  if ("constant" in type) {
    return `Must be: "${type.constant}"`;
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

  if ("metadata" in type) {
    return `Enter ${type.type} value`;
  }

  return "Enter value";
};
