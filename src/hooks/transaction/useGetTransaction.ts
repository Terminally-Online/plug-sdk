import { useQuery } from "@tanstack/react-query";

import { usePlugContext } from "@/src/provider";
import { QueryKeys } from "@/src/config";
import { GetTransactionsQueryParams } from "@/src/lib/schemas/transaction";

export interface UseGetTransactionOptions {
  enabled?: boolean;
  filter?: GetTransactionsQueryParams["filter"];
}

export function useGetTransaction(
  address: string | undefined,
  options: UseGetTransactionOptions = {},
) {
  const { client } = usePlugContext();
  const { enabled = true, filter } = options;

  const result = useQuery({
    queryKey: QueryKeys.transactions(address || "", filter),
    queryFn: () => client.getTransactions({ address: address!, filter }),
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
