import { useQuery } from "@tanstack/react-query";

import { usePlugContext } from "@/src/provider";
import { QueryKeys } from "@/src/config";

import { ContextQueryParams } from "@/src/lib/schemas/context";

export type UseContextOptions = Omit<ContextQueryParams, "address"> & {
  enabled?: boolean;
};

export function useContext(
  address: string | undefined,
  options: UseContextOptions = {},
) {
  const { client } = usePlugContext();
  const { filter, search, enabled = true } = options;

  const result = useQuery({
    queryKey: QueryKeys.context(address || "", filter, search),
    queryFn: () => client.getContext({ address: address!, filter, search }),
    enabled: enabled && !!address,
  });

  return {
    ...result.data,
    isLoading: result.isLoading,
    error: result.error,
    refetch: result.refetch,
  };
}
