import { useQuery } from "@tanstack/react-query";

import { usePlugContext } from "../../provider";
import { QueryKeys } from "../../config";
import { useStream } from "../stream/useStream";

export type UseAddressOptions = {
  enabled?: boolean;
  stream?: boolean;
};

export function useAddress(
  address: string | undefined,
  options: UseAddressOptions = {},
) {
  const { client } = usePlugContext();
  const { enabled = true, stream = false } = options;

  const queryKey = QueryKeys.address(address || "");

  const result = useQuery({
    queryKey,
    queryFn: () => client.getAddress({ address: address! }),
    enabled: enabled && !!address,
  });

  useStream(
    (params, opts) => client.getAddress(params, opts),
    address ? { address } : undefined,
    queryKey,
    { enabled: enabled && stream && !!address },
  );

  return {
    ...result.data,
    queryKey,
    isLoading: result.isLoading,
    isFetching: result.isFetching,
    error: result.error,
    refetch: result.refetch,
  };
}
