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

// Timers wait at most 2^31 - 1 ms; asked to wait longer, they fire at once.
const LONGEST_WAIT = 2 ** 31 - 1;

// gusher stamps a lowered program with a deadline a few minutes out, past which
// the signature it asks for no longer holds. The compile is asked again when
// that deadline arrives, open in the background or not, so a screen left open
// never shows a program, or a deadline, that has passed. A program that was
// already past its deadline when it arrived is not asked after again: that is
// a clock that disagrees with gusher's, and asking again would never end.
const untilDeadline = (query: {
  state: {
    data: { data?: CompileTransactionData | null } | undefined;
    dataUpdatedAt: number;
  };
}): number | false => {
  const deadline = query.state.data?.data?.program?.deadline;
  if (!deadline) return false;
  const expires = deadline * 1000;
  if (expires <= query.state.dataUpdatedAt) return false;
  return Math.min(Math.max(expires - Date.now(), 1), LONGEST_WAIT);
};

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
    refetchInterval: untilDeadline,
    refetchIntervalInBackground: true,
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
