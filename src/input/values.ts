import {
  InputReference,
  InputValues,
  ParsedSentence,
  Result,
  SetValueResult,
} from "@/src/lib/types/sentence";
import { compareValues } from "@/src/parse/values";
import { validateCompoundValue, validateEvmValue } from "@/src/validate/evm";

export type InputWithIndex = InputReference & { index: number };
export type ParsedSentenceWithIndex = Omit<ParsedSentence, "inputs"> & {
  inputs: InputWithIndex[];
};

export const setValue = ({
  parsedSentence,
  currentValues,
  index,
  value,
}: {
  parsedSentence: ParsedSentenceWithIndex;
  currentValues: InputValues;
  index: number;
  value: string;
}): SetValueResult => {
  const input = parsedSentence.inputs[index];
  if (!input?.type) {
    return {
      success: true,
      value: currentValues,
      error: "Invalid input",
    };
  }

  let validationError: string | undefined;
  const newValues = new Map(currentValues);

  if (input.type === "null") {
    newValues.delete(index);
    return {
      success: true,
      value: newValues,
    };
  }

  if (typeof input.type === "object" && "left" in input.type) {
    const conditionMet = compareValues(
      input.type.left,
      input.type.operator,
      input.type.right,
      newValues,
    );
    const activeType = conditionMet
      ? input.type.trueType
      : input.type.falseType;

    if (activeType === "null") {
      newValues.delete(index);
      return {
        success: true,
        value: newValues,
      };
    }

    if (!validateEvmValue(value, activeType)) {
      validationError = "Invalid value for conditional type";
    }
  } else if (typeof input.type === "object" && "metadata" in input.type) {
    if (!validateCompoundValue(value, input.type)) {
      validationError = "Invalid compound value";
    }
  } else if (!validateEvmValue(value, input.type)) {
    validationError = "Invalid value";
  }

  const currentValue = currentValues.get(index)?.value;
  if (currentValue === value) {
    return {
      success: true,
      value: currentValues,
      error: validationError,
    };
  }

  if (value) {
    newValues.set(index, { value: value });
  } else {
    newValues.delete(index);
  }

  parsedSentence.inputs.forEach((otherInput) => {
    if (otherInput.index === index) return;

    if (
      otherInput.type &&
      typeof otherInput.type === "object" &&
      "left" in otherInput.type
    ) {
      const conditionMet = compareValues(
        otherInput.type.left,
        otherInput.type.operator,
        otherInput.type.right,
        newValues,
      );
      const resolvedType = conditionMet
        ? otherInput.type.trueType
        : otherInput.type.falseType;

      if (resolvedType === "null") {
        newValues.delete(otherInput.index);
      } else if (
        typeof resolvedType === "object" &&
        "constant" in resolvedType
      ) {
        newValues.set(otherInput.index, {
          value: resolvedType.constant,
          isDisabled: true,
        });
      } else {
        const existingValue = newValues.get(otherInput.index);
        if (existingValue?.isDisabled) {
          newValues.set(otherInput.index, {
            value: existingValue.value,
          });
        }
      }
    }
  });

  return {
    success: true,
    value: newValues,
    error: validationError,
  };
};

export const resolveSentence = (
  parsedSentence: ParsedSentenceWithIndex,
  values: InputValues,
): Result<string> => {
  try {
    const resolved = parsedSentence.template.replace(
      /\{(\d+)\}/g,
      (_: string, index: string) => {
        const numberIndex = Number(index);
        const value = values.get(numberIndex);
        if (value === undefined) {
          throw new Error(`Missing value for input ${index}`);
        }
        if (typeof value === "string") {
          return value;
        }
        if ("value" in value) {
          return value.value;
        }
        throw new Error(`Invalid value format for input ${index}`);
      },
    );
    return { success: true, value: resolved };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Resolution error",
    };
  }
};
