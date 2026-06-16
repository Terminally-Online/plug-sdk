import { useEffect, useRef } from "react";

import { usePlugQueryClient } from "../../provider";

export type StreamOptions = {
  onData: (data: unknown) => void;
  onError?: (error: Error) => void;
};

type StreamEndpoint<TParams> = (
  params: TParams,
  options: StreamOptions,
) => () => void;

export type UseStreamOptions = {
  enabled?: boolean;
  infinite?: boolean;
};

type InfinitePages = { pages: unknown[]; pageParams: unknown[] };

export function useStream<TParams>(
  endpoint: StreamEndpoint<TParams>,
  params: TParams | undefined,
  queryKey: readonly unknown[],
  options: UseStreamOptions = {},
): void {
  const queryClient = usePlugQueryClient();
  const { enabled = true, infinite = false } = options;

  const paramsRef = useRef(params);
  paramsRef.current = params;
  const keyRef = useRef(queryKey);
  keyRef.current = queryKey;
  const endpointRef = useRef(endpoint);
  endpointRef.current = endpoint;

  const keyString = JSON.stringify(queryKey);

  useEffect(() => {
    if (!enabled || paramsRef.current === undefined) return;

    let close: (() => void) | undefined;
    let paused = false;

    const writeCache = (data: unknown) => {
      if (!infinite) {
        queryClient.setQueryData(keyRef.current, data);
        return;
      }
      queryClient.setQueryData(keyRef.current, (old: InfinitePages | undefined) =>
        old && Array.isArray(old.pages)
          ? { ...old, pages: [data, ...old.pages.slice(1)] }
          : { pages: [data], pageParams: [undefined] },
      );
    };

    const open = () => {
      if (close) return;
      close = endpointRef.current(paramsRef.current as TParams, {
        onData: writeCache,
      });
    };

    const stop = () => {
      close?.();
      close = undefined;
    };

    const onVisibility = () => {
      if (document.hidden) {
        paused = true;
        stop();
      } else if (paused) {
        paused = false;
        open();
      }
    };

    open();

    const hasDocument = typeof document !== "undefined";
    if (hasDocument) {
      document.addEventListener("visibilitychange", onVisibility);
    }

    return () => {
      if (hasDocument) {
        document.removeEventListener("visibilitychange", onVisibility);
      }
      stop();
    };
  }, [keyString, enabled, infinite, queryClient]);
}
