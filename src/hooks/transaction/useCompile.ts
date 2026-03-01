import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { usePlugContext } from "@/src/provider";
import { QueryKeys } from "@/src/config";
import {
  CompileTransactionQueryParams,
  type CoilOption,
} from "@/src/lib/schemas/transaction";

export interface UseCompileOptions {
  enabled?: boolean;
  chainId?: number;
  steps?: Array<{ protocol: string; step: string }>;
}

export function useCompile(
  address: string | undefined,
  options: UseCompileOptions = {},
) {
  const { client } = usePlugContext();
  const { enabled = true, chainId, steps } = options;

  const input = useMemo<
    CompileTransactionQueryParams["input"] | undefined
  >(() => {
    if (!chainId || !steps || steps.length === 0) return undefined;
    const stepsRecord: Record<number, { protocol: string; step: string }> = {};
    steps.forEach((s, i) => {
      stepsRecord[i] = { protocol: s.protocol, step: s.step };
    });
    return { chain_id: chainId, steps: stepsRecord };
  }, [chainId, steps]);

  const result = useQuery({
    queryKey: QueryKeys.compile(
      address || "",
      input as Record<string, unknown>,
    ),
    queryFn: () =>
      client.compileTransaction({ address: address!, input: input! }),
    enabled: enabled && !!address && !!input,
  });

  return {
    data: result.data?.data as
      | Array<Record<string, CoilOption[]>>
      | null
      | undefined,
    isLoading: result.isLoading,
    isFetching: result.isFetching,
    error: result.error,
    refetch: result.refetch,
  };
}
