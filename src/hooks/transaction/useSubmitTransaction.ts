import { useMutation, useQueryClient } from "@tanstack/react-query";

import { usePlugContext } from "../../provider";
import { QueryKeys } from "../../config";
import {
  ExecutionMode,
  SubmitTransactionInput,
  SubmitTransactionResponse,
} from "../../lib/schemas/transaction";

export interface UseSubmitTransactionOptions<TMode extends ExecutionMode> {
  onSuccess?: (data: SubmitTransactionResponse<TMode>) => void;
  onError?: (error: Error) => void;
}

/**
 * Submits a signed program for the Plug Account at `address` in one mode:
 * manual relays it now and resolves with the transaction hash and intent id,
 * scheduled arms the stored intent and resolves with the armed row.
 */
export function useSubmitTransaction<TMode extends ExecutionMode>(
  address: string | undefined,
  mode: TMode,
  options: UseSubmitTransactionOptions<TMode> = {},
) {
  const { client } = usePlugContext();
  const queryClient = useQueryClient();
  const { onSuccess, onError } = options;

  const mutation = useMutation({
    mutationFn: (input: Omit<SubmitTransactionInput, "mode">) =>
      client.submitTransaction({ address: address!, ...input, mode }),
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
    data: mutation.data,
    submitTransaction: mutation.mutate,
    submitTransactionAsync: mutation.mutateAsync,
    isLoading: mutation.isPending,
    error: mutation.error,
    reset: mutation.reset,
  };
}
