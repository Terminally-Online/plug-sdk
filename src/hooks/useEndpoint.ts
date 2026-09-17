import { useCallback, useEffect, useRef, useState } from "react";

import { isApiResponse, isErrorResponse } from "../lib/functions/response";

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

  const latest = useRef({ endpoint, params });
  useEffect(() => {
    latest.current = { endpoint, params };
  });

  const fetch = useCallback(async () => {
    if (!enabled) return;

    setIsLoading(true);
    setError(null);

    try {
      const result = await latest.current.endpoint(latest.current.params);

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
  }, [enabled]);

  const paramsKey = JSON.stringify(params);
  useEffect(() => {
    if (!enabled) {
      setIsLoading(false);
      return;
    }

    fetch();
  }, [enabled, paramsKey, fetch]);

  return {
    data,
    isLoading,
    error,
    refetch: fetch,
  };
}
