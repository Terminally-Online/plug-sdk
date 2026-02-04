import { useEffect, useState } from "react";

import { isApiResponse, isErrorResponse } from "@/src/lib/functions/response";

export interface UseEndpointOptions {
  enabled?: boolean;
}

export interface UseEndpointReturn<T> {
  data: T | undefined;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function useEndpoint<TParams, TData>(
  endpoint: (params: TParams) => Promise<TData>,
  params: TParams,
  options: UseEndpointOptions = {},
): UseEndpointReturn<TData> {
  const { enabled = true } = options;

  const [data, setData] = useState<TData | undefined>();
  const [isLoading, setIsLoading] = useState(enabled);
  const [error, setError] = useState<Error | null>(null);

  const fetch = async () => {
    if (!enabled) return;

    setIsLoading(true);
    setError(null);

    try {
      const result = await endpoint(params);

      if (isApiResponse(result) && isErrorResponse(result.data)) {
        setError(new Error(result.data.error));
        setData(undefined);
      } else {
        setData(result);
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!enabled) {
      setIsLoading(false);
      return;
    }

    fetch();
  }, [enabled, JSON.stringify(params)]);

  return {
    data,
    isLoading,
    error,
    refetch: fetch,
  };
}
