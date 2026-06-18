import { useMemo } from "react";
import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";

import { usePlugContext } from "../../provider";
import { QueryKeys } from "../../config";

import {
  ContextFilter,
  ContextResponse,
} from "../../lib/schemas/context";
import { ContextActionOption } from "../../lib/schemas/option";

const DEFAULT_PAGE_SIZE = 20;

export type UseContextOptionsParams = {
  filter: { protocol: string; action: string } & Omit<
    ContextFilter,
    "protocol" | "action"
  >;
  // The focused input index whose option list is being paginated.
  input: number;
  // Resolved values for the focused input's dependency inputs, keyed by input
  // index — lets a dependent list (e.g. a market hanging off a chosen token)
  // window against its parent. Omit keys whose dependency isn't chosen yet.
  selections?: Record<number, string>;
  // Free-text search for the focused input, applied server-side.
  search?: string;
  pageSize?: number;
  intent?: "imperative" | "declarative";
  enabled?: boolean;
};

export type UseContextOptionsResult = {
  options: ContextActionOption[];
  isLoading: boolean;
  isFetching: boolean;
  hasNextPage: boolean;
  fetchNextPage: () => Promise<unknown>;
  isFetchingNextPage: boolean;
  error: Error | null;
  refetch: () => void;
};

// Pulls the focused input's flat option page out of a context response. A
// windowed response keys the page under the input index (e.g. `{ "2": [...] }`);
// the server has already resolved the dependency, so the node is a flat array.
const pageOptions = (
  page: ContextResponse,
  protocol: string,
  action: string,
  input: number,
): ContextActionOption[] => {
  const node = page.data?.[protocol]?.actions?.[action]?.options?.[
    String(input)
  ];
  return Array.isArray(node) ? (node as ContextActionOption[]) : [];
};

/**
 * Infinite-scroll option list for a single focused action input. Drives the
 * existing context endpoint with a `limit` window and follows `links.next`,
 * appending each page. Mirrors `usePositions({ infinite: true })`.
 */
export function useContextOptions(
  address: string | undefined,
  options: UseContextOptionsParams,
): UseContextOptionsResult {
  const { client } = usePlugContext();
  const {
    filter,
    input,
    selections,
    search,
    pageSize = DEFAULT_PAGE_SIZE,
    intent,
    enabled = true,
  } = options;

  const searchParam = search ? { [String(input)]: search } : undefined;

  const queryKey = QueryKeys.contextOptions(
    address || "",
    filter,
    input,
    selections,
    searchParam,
    intent,
  );

  const query = useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam }) => {
      if (pageParam) return client.getContext.byUrl(pageParam);
      return client.getContext({
        address: address!,
        filter,
        input,
        selections: selections as Record<string, string> | undefined,
        search: searchParam,
        intent,
        limit: { count: pageSize, offset: 0 },
      });
    },
    getNextPageParam: (lastPage) => lastPage.links?.next ?? undefined,
    initialPageParam: undefined as string | undefined,
    enabled: enabled && !!address,
    placeholderData: search ? keepPreviousData : undefined,
  });

  const flat = useMemo(
    () =>
      (query.data?.pages ?? []).flatMap((page) =>
        pageOptions(page, filter.protocol, filter.action, input),
      ),
    [query.data, filter.protocol, filter.action, input],
  );

  return {
    options: flat,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    hasNextPage: query.hasNextPage ?? false,
    fetchNextPage: query.fetchNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
    error: query.error,
    refetch: query.refetch,
  };
}
