import { useMutation, useQueryClient } from "@tanstack/react-query";

import { usePlugContext } from "../../provider";
import { QueryKeys } from "../../config";
import {
  SubmitTransactionInput,
  SubmitTransactionResponse,
} from "../../lib/schemas/transaction";

export interface UseSubmitTransactionOptions {
  onSuccess?: (data: SubmitTransactionResponse) => void;
  onError?: (error: Error) => void;
}

export function useSubmitTransaction(
  address: string | undefined,
  options: UseSubmitTransactionOptions = {},
) {
  const { client } = usePlugContext();
  const queryClient = useQueryClient();
  const { onSuccess, onError } = options;

  const mutation = useMutation({
    mutationFn: (input: SubmitTransactionInput) =>
      client.submitTransaction({ address: address!, ...input }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: QueryKeys.transactions(address || ""),
      });
      queryClient.invalidateQueries({
        queryKey: QueryKeys.activity(address || ""),
      });
      onSuccess?.(data);
    },
    onError,
  });

  return {
    transactionHash: mutation.data?.transaction_hash,
    submitTransaction: mutation.mutate,
    submitTransactionAsync: mutation.mutateAsync,
    isLoading: mutation.isPending,
    error: mutation.error,
    reset: mutation.reset,
  };
}
