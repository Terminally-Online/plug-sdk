import { useMutation, useQueryClient } from "@tanstack/react-query";

import { usePlugContext } from "../../provider";
import { QueryKeys } from "../../config";
import {
  CancelTransactionInput,
  CancelTransactionResponse,
} from "../../lib/schemas/transaction";

export interface UseCancelTransactionOptions {
  onMutate?: (input: CancelTransactionInput) => void;
  onSuccess?: (
    data: CancelTransactionResponse,
    input: CancelTransactionInput,
  ) => void;
  onError?: (error: Error, input: CancelTransactionInput) => void;
  onSettled?: () => void;
}

// useCancelTransaction refuses execution of a standing scheduled intent,
// invalidating the transactions query on settle so the stream reconciles truth.
export function useCancelTransaction(
  address: string | undefined,
  options: UseCancelTransactionOptions = {},
) {
  const { client } = usePlugContext();
  const queryClient = useQueryClient();
  const { onMutate, onSuccess, onError, onSettled } = options;

  const mutation = useMutation({
    mutationFn: (input: CancelTransactionInput) =>
      client.cancelTransaction({ address: address!, ...input }),
    onMutate,
    onSuccess,
    onError,
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: QueryKeys.transactions(address || ""),
      });
      onSettled?.();
    },
  });

  return {
    cancelTransaction: mutation.mutate,
    cancelTransactionAsync: mutation.mutateAsync,
    canceled: mutation.data,
    isLoading: mutation.isPending,
    error: mutation.error,
    reset: mutation.reset,
  };
}
