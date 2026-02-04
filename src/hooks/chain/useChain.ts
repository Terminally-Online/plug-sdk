import { useQuery } from "@tanstack/react-query";

import { usePlugContext } from "@/src/provider";
import { QueryKeys } from "@/src/config";
import { ChainQueryParams } from "@/src/lib/schemas/chain";

export interface UseChainOptions {
  enabled?: boolean;
  filter?: ChainQueryParams["filter"];
}

export function useChain(options: UseChainOptions = {}) {
  const { client } = usePlugContext();
  const { filter, enabled = true } = options;

  const result = useQuery({
    queryKey: QueryKeys.chain(filter),
    queryFn: () => client.getChain({ filter } as any),
    enabled: enabled,
  });

  return {
    ...result.data,
    isLoading: result.isLoading,
    error: result.error,
    refetch: result.refetch,
  };
}
