import { useMemo, useCallback } from "react";

import {
  keepPreviousData,
  QueryObserverResult,
  RefetchOptions,
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { usePlugContext } from "../../provider";
import { QueryKeys } from "../../config";
import { useStream } from "../stream/useStream";

import {
  Context,
  ContextAction,
  ContextFilter,
  ContextProtocol,
  ContextQueryParams,
  ContextResponse,
  ContextStep,
} from "../../lib/schemas/context";
import { ContextActionOption, resolveInputOptions } from "../../lib/schemas/option";

// The page size every focused option list is windowed to — mirrors gusher's
// DefaultOptionPageSize so the first page the shape call returns lines up exactly
// with where focused pagination resumes.
export const OPTION_PAGE_SIZE = 50;

// How long a fetched context stays fresh. Options change on indexer cadence,
// not keystrokes — within this window a hover prefetch fully absorbs the
// focus fetch and re-opening a part costs nothing.
const CONTEXT_STALE_TIME_MS = 30_000;

// Reshapes the focused input's chosen dependency values into the (requires, values)
// pair resolveInputOptions walks, so a dependent (tree) input resolves to the same
// subtree the server windowed.
function selectionsToValues(selections?: Record<string, string>): {
  requires: number[];
  values: ({ value?: string } | undefined)[];
} {
  const requires: number[] = [];
  const values: ({ value?: string } | undefined)[] = [];
  for (const [key, value] of Object.entries(selections ?? {})) {
    const index = Number(key);
    if (Number.isNaN(index)) continue;
    requires.push(index);
    values[index] = { value };
  }
  requires.sort((a, b) => a - b);
  return { requires, values };
}

export type UseContextOptions = Omit<ContextQueryParams, "address" | "limit"> & {
  enabled?: boolean;
  stream?: boolean;
};

type UseContextBase = {
  isLoading: boolean;
  isFetching: boolean;
  error: Error | null;
  refetch: (
    options?: RefetchOptions,
  ) => Promise<QueryObserverResult<ContextResponse, Error>>;
  // Focused-input pagination. When `input` is supplied the focused list windows
  // to OPTION_PAGE_SIZE and these advance it; otherwise hasNextPage is false and
  // fetchNextPage is a no-op.
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => Promise<unknown>;
};

export type UseContextActionResult = UseContextBase & {
  protocol: ContextProtocol | undefined;
  action: ContextStep | undefined;
};

export type UseContextProtocolResult = UseContextBase & {
  protocol: ContextProtocol | undefined;
  actions: Record<string, ContextStep> | undefined;
};

export type UseContextFullResult = UseContextBase & {
  protocols: Context | undefined;
  actions: ContextAction[] | undefined;
};

type FilterWithAction = {
  filter: { protocol: string; action: string } & Omit<
    ContextFilter,
    "protocol" | "action"
  >;
};

type FilterWithProtocol = {
  filter: { protocol: string } & Omit<ContextFilter, "protocol">;
};

export function useContext(
  address: string | undefined,
  options: UseContextOptions & FilterWithAction,
): UseContextActionResult;

export function useContext(
  address: string | undefined,
  options: UseContextOptions & FilterWithProtocol,
): UseContextProtocolResult;

export function useContext(
  address: string | undefined,
  options?: UseContextOptions,
): UseContextFullResult;

export function useContext(
  address: string | undefined,
  options: UseContextOptions = {},
): UseContextActionResult | UseContextProtocolResult | UseContextFullResult {
  const { client } = usePlugContext();
  const { filter, search, intent, draft, selections, input, enabled = true, stream = false } = options;

  const queryKey = QueryKeys.context(address || "", filter, search, intent, draft, selections);

  const result = useQuery({
    queryKey,
    queryFn: () =>
      client.getContext({ address: address!, filter, search, intent, draft, selections }),
    enabled: enabled && !!address,
    staleTime: CONTEXT_STALE_TIME_MS,
    placeholderData: search || draft ? keepPreviousData : undefined,
  });

  useStream(
    (params, opts) => client.getContext(params, opts),
    address ? { address, filter, search, intent, draft, selections } : undefined,
    queryKey,
    { enabled: enabled && stream && !!address },
  );

  const shape = result.data?.data ?? undefined;

  // A dependency filled by a runtime coil ref makes the focused list a server
  // projection: the client's local projection over the shape call's capped
  // subtrees is only a preview, so the focused list always fetches from the
  // server (offset 0) and replaces it — the server is the single source of
  // truth for the projected set, its order, and its pagination.
  const coiled = useMemo(
    () => Object.values(selections ?? {}).some((value) => /^<-\{/.test(String(value))),
    [selections],
  );

  // The shape call already returns the focused input's first OPTION_PAGE_SIZE
  // entries, so there is only a further page to fetch when that first page came
  // back full. Resolving against `selections` lets a dependent (tree) input check
  // the right subtree, not the whole map. A coiled dependency always fetches —
  // the server owns the projection.
  const focusedFull = useMemo(() => {
    if (input == null || !filter?.protocol || !filter?.action || !shape) return false;
    if (coiled) return true;
    const node = shape[filter.protocol]?.actions?.[filter.action]?.options?.[String(input)];
    if (!node) return false;
    const { requires, values } = selectionsToValues(selections);
    const leaf = resolveInputOptions(node, requires, values, []);
    return (leaf?.length ?? 0) >= OPTION_PAGE_SIZE;
  }, [shape, input, filter?.protocol, filter?.action, selections, coiled]);

  // Focused pagination: continues the focused input's list past the first page.
  // It resumes at OPTION_PAGE_SIZE (the shape call owns page one) and then follows
  // the server's `links.next` cursor. Disabled until the first page proves full so
  // short lists never pay for a second round-trip.
  const focusedKey = QueryKeys.contextOptions(address || "", filter, input, selections, search, intent);
  const pages = useInfiniteQuery({
    queryKey: focusedKey,
    queryFn: ({ pageParam }) =>
      typeof pageParam === "string"
        ? client.getContext.byUrl(pageParam)
        : client.getContext({
            address: address!,
            filter,
            search,
            intent,
            selections,
            input,
            limit: { count: OPTION_PAGE_SIZE, offset: pageParam },
          }),
    getNextPageParam: (lastPage) => lastPage.links?.next ?? undefined,
    initialPageParam: (coiled ? 0 : OPTION_PAGE_SIZE) as number | string,
    enabled: enabled && !!address && input != null && focusedFull,
    placeholderData: keepPreviousData,
  });

  // Merge the focused pages onto the shape: the focused input's node is replaced
  // with one continuous flat list. Replacement, not leaf mutation: a coiled
  // dependency resolves to a freshly built projection rather than a reference
  // into the tree, so pushing into the resolved leaf would drop the pages. A
  // coiled focused list is the server pages alone (fetched from offset 0 — the
  // client projection is only the pre-fetch preview); a literal one is its
  // shape-call first page plus the pages that resume after it. Cloned so the
  // cached shape is never mutated.
  const raw = useMemo(() => {
    if (!shape || input == null || !filter?.protocol || !filter?.action) return shape;
    const extra: ContextActionOption[] = [];
    for (const page of pages.data?.pages ?? []) {
      const slice = page.data?.[filter.protocol]?.actions?.[filter.action]?.options?.[String(input)];
      if (Array.isArray(slice)) extra.push(...slice);
    }
    if (extra.length === 0) return shape;
    const cloned = structuredClone(shape) as Context;
    const options = cloned[filter.protocol]?.actions?.[filter.action]?.options;
    const node = options?.[String(input)];
    if (!options || !node) return shape;
    if (coiled) {
      options[String(input)] = extra;
      return cloned;
    }
    const { requires, values } = selectionsToValues(selections);
    const leaf = resolveInputOptions(node, requires, values, []);
    if (!leaf) return shape;
    options[String(input)] = [...leaf.slice(0, OPTION_PAGE_SIZE), ...extra];
    return cloned;
  }, [shape, pages.data, input, filter?.protocol, filter?.action, selections, coiled]);

  const base: UseContextBase = {
    isLoading: result.isLoading,
    isFetching: result.isFetching,
    error: result.error,
    refetch: result.refetch,
    hasNextPage: input != null && (pages.data?.pages.length ? pages.hasNextPage : focusedFull),
    isFetchingNextPage: pages.isFetchingNextPage,
    fetchNextPage: pages.fetchNextPage,
  };

  if (filter?.protocol && filter?.action) {
    const protocol = raw?.[filter.protocol];
    return {
      ...base,
      protocol,
      action: protocol?.actions?.[filter.action],
    };
  }

  if (filter?.protocol) {
    const protocol = raw?.[filter.protocol];
    return {
      ...base,
      protocol,
      actions: protocol?.actions,
    };
  }

  const actions = raw
    ? Object.entries(raw).flatMap(([protocolName, protocolData]) =>
        Object.entries(protocolData.actions ?? {}).map(
          ([actionName, step]) => ({
            ...step,
            protocol: protocolName,
            action: actionName,
          }),
        ),
      )
    : undefined;

  return {
    ...base,
    protocols: raw,
    actions,
  };
}

// useContextPrefetch returns a prefetch for the exact query useContext mounts
// with the same arguments — warm it on hover and the focus fetch is a cache
// read. In-flight prefetches dedupe with the mount fetch, so even a click that
// beats the response pays only the remaining latency.
export function useContextPrefetch() {
  const { client } = usePlugContext();
  const queryClient = useQueryClient();
  return useCallback(
    (address: string, options: Omit<UseContextOptions, "enabled" | "stream"> = {}) => {
      const { filter, search, intent, draft, selections } = options;
      return queryClient.prefetchQuery({
        queryKey: QueryKeys.context(address, filter, search, intent, draft, selections),
        queryFn: () => client.getContext({ address, filter, search, intent, draft, selections }),
        staleTime: CONTEXT_STALE_TIME_MS,
      });
    },
    [client, queryClient],
  );
}
