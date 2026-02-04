import { InputValues } from "@/src/lib/types/sentence";
import { InputWithIndex, ParsedSentenceWithIndex } from "@/src/input/values";

export const isComplete = (
  parsedSentence: ParsedSentenceWithIndex,
  values: InputValues,
): boolean => {
  return parsedSentence.inputs.every((input) => values.has(input.index));
};

export const validateInputSequence = (inputs: InputWithIndex[]): boolean => {
  const indices = inputs.map((input) => input.index).sort((a, b) => a - b);
  return indices.every((idx, i) => idx === i);
};
