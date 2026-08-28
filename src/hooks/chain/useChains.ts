import { useQuery } from "@tanstack/react-query";

import { usePlugContext } from "../../provider";
import { QueryKeys } from "../../config";
import { ChainQueryParams } from "../../lib/schemas/chain";

export interface UseChainsOptions {
  enabled?: boolean;
  filter?: ChainQueryParams["filter"];
}

export function useChains(options: UseChainsOptions = {}) {
  const { client } = usePlugContext();
  const { filter, enabled = true } = options;

  const result = useQuery({
    queryKey: QueryKeys.chain(filter),
    queryFn: () => client.getChains({ filter } as any),
    enabled: enabled,
  });

  return {
    ...result.data,
    isLoading: result.isLoading,
    isFetching: result.isFetching,
    error: result.error,
    refetch: result.refetch,
  };
}
