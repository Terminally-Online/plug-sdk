import { useMemo } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { usePlugContext } from "../../provider";
import { QueryKeys } from "../../config";
import {
  CompileTransactionQueryParams,
  type CoilOption,
  type CompileTransactionData,
  type IntentGraph,
  type Simulation,
} from "../../lib/schemas/transaction";

export interface CompileStep {
  protocol: string;
  step: string;
  inputs?: Record<string, string | number | boolean>;
}

export interface UseCompileOptions {
  enabled?: boolean;
  chainId?: number;
  steps?: CompileStep[];
}

export interface UseCompileResult {
  queryKey: readonly unknown[];
  data: CompileTransactionData | null | undefined;
  options: Array<Record<string, CoilOption[]>> | null | undefined;
  outputs: unknown[] | null | undefined;
  graph: IntentGraph | null | undefined;
  simulation: Simulation | null | undefined;
  isLoading: boolean;
  isFetching: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useCompile(options: UseCompileOptions = {}): UseCompileResult {
  const { client } = usePlugContext();
  const { enabled = true, chainId, steps } = options;

  const input = useMemo<
    CompileTransactionQueryParams["input"] | undefined
  >(() => {
    if (!chainId || !steps || steps.length === 0) return undefined;
    const stepsRecord: Record<number, CompileStep> = {};
    steps.forEach((s, i) => {
      stepsRecord[i] = {
        protocol: s.protocol,
        step: s.step,
        ...(s.inputs && Object.keys(s.inputs).length > 0
          ? { inputs: s.inputs }
          : {}),
      };
    });
    return { chain_id: chainId, steps: stepsRecord };
  }, [chainId, steps]);

  const queryKey = QueryKeys.compile(input as Record<string, unknown>);

  const result = useQuery({
    queryKey,
    queryFn: () => client.compileTransaction({ input: input! }),
    enabled: enabled && !!input,
    placeholderData: keepPreviousData,
  });

  const data = result.data?.data as CompileTransactionData | null | undefined;

  return {
    queryKey,
    data,
    options: data?.options as
      | Array<Record<string, CoilOption[]>>
      | null
      | undefined,
    outputs: data?.outputs,
    graph: data?.graph,
    simulation: data?.simulation,
    isLoading: result.isLoading,
    isFetching: result.isFetching,
    error: result.error,
    refetch: result.refetch,
  };
}
