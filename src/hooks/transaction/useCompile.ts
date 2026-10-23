import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { usePlugContext } from "../../provider";
import { keepPreviousOnSameChain, QueryKeys } from "../../config";
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
  /** The account the draft executes for; with it a complete draft lowers to the owner's batch and the typed data to sign. */
  owner?: string;
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
  const { enabled = true, chainId, steps, owner } = options;

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
    return {
      chain_id: chainId,
      ...(owner ? { owner } : {}),
      steps: stepsRecord,
    };
  }, [chainId, steps, owner]);

  const queryKey = QueryKeys.compile(input as Record<string, unknown>);

  const result = useQuery({
    queryKey,
    queryFn: () => client.compileTransaction({ input: input! }),
    enabled: enabled && !!input,
    placeholderData: keepPreviousOnSameChain(queryKey),
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
