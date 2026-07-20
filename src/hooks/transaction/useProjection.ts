import { useQuery } from "@tanstack/react-query";

import { QueryKeys } from "../../config";
import {
  CompileTransactionData,
  CompileTransactionQueryParams,
  Simulation,
  SimulationOutput,
} from "../../lib/schemas/transaction";
import { usePlugContext } from "../../provider";

export type UseProjectionOptions = {
  enabled?: boolean;
};

export type ProjectionResult = {
  data: CompileTransactionData | undefined;
  simulation: Simulation | undefined;
  outputs: SimulationOutput[];
  isLoading: boolean;
  isFetching: boolean;
  error: Error | null;
  refetch: () => void;
};

export function useProjection(
  input: CompileTransactionQueryParams["input"] | undefined,
  options: UseProjectionOptions = {},
): ProjectionResult {
  const { client } = usePlugContext();
  const { enabled = true } = options;

  const queryKey = QueryKeys.projection(input);

  const result = useQuery({
    queryKey,
    queryFn: () => client.compileTransaction({ input: input! }),
    enabled: enabled && !!input && Object.keys(input.steps ?? {}).length > 0,
    placeholderData: (previous) => previous,
  });

  const data = result.data?.data ?? undefined;

  return {
    data,
    simulation: data?.simulation ?? undefined,
    outputs: data?.simulation?.outputs ?? [],
    isLoading: result.isLoading,
    isFetching: result.isFetching,
    error: result.error,
    refetch: result.refetch,
  };
}
