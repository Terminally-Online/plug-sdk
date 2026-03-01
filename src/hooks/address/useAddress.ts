import { useQuery } from "@tanstack/react-query";

import { usePlugContext } from "@/src/provider";
import { QueryKeys } from "@/src/config";

export type UseAddressOptions = {
  enabled?: boolean;
};

export function useAddress(
  address: string | undefined,
  options: UseAddressOptions = {},
) {
  const { client } = usePlugContext();
  const { enabled = true } = options;

  const result = useQuery({
    queryKey: QueryKeys.address(address || ""),
    queryFn: () => client.getAddress({ address: address! }),
    enabled: enabled && !!address,
  });

  return {
    ...result.data,
    isLoading: result.isLoading,
    isFetching: result.isFetching,
    error: result.error,
    refetch: result.refetch,
  };
}
