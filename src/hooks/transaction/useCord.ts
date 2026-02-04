import { useCallback, useMemo } from "react";

import { shouldRenderInput } from "@/src/input/input";
import { resolveSentence, setValue } from "@/src/input/values";
import {
  InputError,
  InputState,
  ParsedSentence,
} from "@/src/lib/types/sentence";

const createStateFromValues = (values: Record<string, string | undefined>) => {
  const state = new Map<number, InputState>();
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined) {
      state.set(Number(key), { value });
    }
  });
  return state;
};

export const useCord = (
  sentence: ParsedSentence | undefined | null,
  values: Record<string, string | undefined>,
  onUpdateValue?: (
    index: number,
    value: string | undefined,
    error?: string,
  ) => void,
) => {
  const valuesMap = useMemo(() => createStateFromValues(values), [values]);

  const validationErrors = useMemo(() => {
    const errors = new Map<number, InputError>();
    return errors;
  }, []);

  const inputsWithIndex = useMemo(
    () => sentence?.inputs?.map((input, index) => ({ ...input, index })) ?? [],
    [sentence?.inputs],
  );

  const filteredInputs = useMemo(
    () =>
      inputsWithIndex.filter((input) =>
        shouldRenderInput(input.type, inputsWithIndex, (index) =>
          valuesMap.get(index),
        ),
      ),
    [inputsWithIndex, valuesMap],
  );

  const parts = useMemo(
    () =>
      sentence?.template
        ?.split(/(\{[^}]+\})/g)
        .map((part) => {
          if (part.match(/\{[^}]+\}/)) return [part];
          return part.split(/(\s+)/g);
        })
        .flat() ?? [],
    [sentence?.template],
  );

  const resolvedSentence = useMemo(() => {
    if (!sentence) return null;
    const allInputsHaveValues = inputsWithIndex.every((input) =>
      valuesMap.has(input.index),
    );
    if (!allInputsHaveValues) return null;

    const result = resolveSentence(
      { ...sentence, inputs: inputsWithIndex },
      valuesMap,
    );
    return result.success ? result.value : null;
  }, [sentence, inputsWithIndex, valuesMap]);

  const actions = {
    setValue: useCallback(
      (index: number, value: string | undefined) => {
        if (!sentence || !onUpdateValue) return;

        const result = setValue({
          parsedSentence: { ...sentence, inputs: inputsWithIndex },
          currentValues: valuesMap,
          index,
          value: value ?? "",
        });

        onUpdateValue(index, value, result.error);
      },
      [sentence, inputsWithIndex, valuesMap, onUpdateValue],
    ),
  };

  const helpers = {
    getInputName: useCallback(
      (index: number) => inputsWithIndex[index]?.name,
      [inputsWithIndex],
    ),
    getInputValue: useCallback(
      (index: number) => valuesMap.get(index),
      [valuesMap],
    ),
    getInputError: useCallback(
      (index: number) => validationErrors.get(index),
      [validationErrors],
    ),
    getDependentInputs: useCallback(
      (index: number) =>
        inputsWithIndex.filter(
          (input) => input.requires && input.requires.includes(index),
        ),
      [inputsWithIndex],
    ),
    hasDependency: useCallback(
      (index: number) =>
        inputsWithIndex.some(
          (input) => input.requires && input.requires.includes(index),
        ),
      [inputsWithIndex],
    ),
    isComplete: useMemo(
      () =>
        filteredInputs.every((input) => {
          const value = valuesMap.get(input.index);
          return value !== undefined;
        }),
      [filteredInputs, valuesMap],
    ),
    isValid: useMemo(() => {
      if (validationErrors.size > 0) return false;
      return !Array.from(valuesMap.values()).some(
        (value) => !value || value.value === "",
      );
    }, [validationErrors, valuesMap]),
  };

  return {
    state: {
      parsed: sentence ? { ...sentence, inputs: filteredInputs } : null,
      parts,
      resolvedSentence,
      values: valuesMap,
      error: null,
      validationErrors,
    },
    actions,
    helpers,
  };
};
