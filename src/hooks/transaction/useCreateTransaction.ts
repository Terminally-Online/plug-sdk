import { useMutation, useQueryClient } from "@tanstack/react-query";

import { usePlugContext } from "@/src/provider";
import { QueryKeys } from "@/src/config";
import { CreateTransactionQueryParams } from "@/src/lib/schemas/transaction";

export interface UseCreateTransactionOptions {
  onSuccess?: (data: any) => void;
  onError?: (error: Error) => void;
}

export function useCreateTransaction(
  address: string | undefined,
  options: UseCreateTransactionOptions = {},
) {
  const { client } = usePlugContext();
  const queryClient = useQueryClient();
  const { onSuccess, onError } = options;

  const mutation = useMutation({
    mutationFn: (input: CreateTransactionQueryParams["input"]) =>
      client.createTransaction({ address: address!, input }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: QueryKeys.transactions(address || ""),
      });
      onSuccess?.(data);
    },
    onError,
  });

  return {
    ...mutation.data,
    createTransaction: mutation.mutate,
    createTransactionAsync: mutation.mutateAsync,
    isLoading: mutation.isPending,
    error: mutation.error,
    reset: mutation.reset,
  };
}
