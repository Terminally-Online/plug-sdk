import { useQuery } from "@tanstack/react-query";

import { usePlugContext } from "../../provider";
import { QueryKeys } from "../../config";
import { useStream } from "../stream/useStream";
import { GetTransactionsQueryParams } from "../../lib/schemas/transaction";

export interface UseGetTransactionOptions {
  enabled?: boolean;
  stream?: boolean;
  filter?: GetTransactionsQueryParams["filter"];
}

export function useGetTransaction(
  address: string | undefined,
  options: UseGetTransactionOptions = {},
) {
  const { client } = usePlugContext();
  const { enabled = true, stream = false, filter } = options;

  const queryKey = QueryKeys.transactions(address || "", filter);

  const result = useQuery({
    queryKey,
    queryFn: () => client.getTransactions({ address: address!, filter }),
    enabled: enabled && !!address,
  });

  useStream(
    (params, opts) => client.getTransactions(params, opts),
    address ? { address, filter } : undefined,
    queryKey,
    { enabled: enabled && stream && !!address },
  );

  return {
    ...result.data,
    isLoading: result.isLoading,
    isFetching: result.isFetching,
    error: result.error,
    refetch: result.refetch,
  };
}
