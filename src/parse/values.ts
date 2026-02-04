import {
  ComparisonOperator,
  ComparisonValue,
  InputValues,
} from "@/src/lib/types/sentence";

export const resolveValue = (
  value: ComparisonValue,
  values: InputValues,
): string | undefined => {
  if (value.reference !== undefined) {
    const rawValue = values.get(value.reference)?.value;
    if (!rawValue) return undefined;

    if (value.part !== undefined) {
      const parts = rawValue.split(":");
      return parts[value.part] || "";
    }
    return rawValue;
  }

  return value.literal;
};

export const compareValues = (
  left: ComparisonValue,
  operator: ComparisonOperator,
  right: ComparisonValue,
  values: InputValues,
): boolean => {
  const resolve = (value: ComparisonValue): string => {
    if (value.reference !== undefined) {
      const rawValue = values.get(value.reference)?.value;
      if (!rawValue) return "";

      if (value.part !== undefined) {
        const parts = rawValue.split(":");
        return parts[value.part] || "";
      }
      return rawValue;
    }
    return value.literal ?? "";
  };

  const leftValue = resolve(left);
  const rightValue = resolve(right);

  switch (operator) {
    case "==":
      return leftValue === rightValue;
    case "!=":
      return leftValue !== rightValue;
    case ">":
      return Number(leftValue) > Number(rightValue);
    case ">=":
      return Number(leftValue) >= Number(rightValue);
    case "<":
      return Number(leftValue) < Number(rightValue);
    case "<=":
      return Number(leftValue) <= Number(rightValue);
  }
};
