import { useMemo } from "react";
import { useQuery, useInfiniteQuery } from "@tanstack/react-query";

import { QueryKeys } from "../../config";

import {
  PositionsQueryParams,
  PositionsResponse,
  Address,
} from "../../lib/schemas/address";
import { usePlugContext } from "../../provider";
import { useStream } from "../stream/useStream";

export type UsePositionsOptions = Omit<PositionsQueryParams, "address"> & {
  enabled?: boolean;
  stream?: boolean;
};

export type UsePositionsInfiniteOptions = UsePositionsOptions & {
  infinite: true;
};

type PositionsLinks = PositionsResponse["links"];
type PositionsHeaders = PositionsResponse["headers"];

type UsePositionsBaseResult = {
  data: Address[];
  links: PositionsLinks;
  headers: PositionsHeaders;
  isLoading: boolean;
  isFetching: boolean;
  error: Error | null;
  refetch: () => void;
};

type UsePositionsInfiniteResult = UsePositionsBaseResult & {
  pages: PositionsResponse[];
  allData: Address[];
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  fetchNextPage: () => Promise<unknown>;
  fetchPreviousPage: () => Promise<unknown>;
  isFetchingNextPage: boolean;
  isFetchingPreviousPage: boolean;
};

export function usePositions(
  address: string | undefined,
  options: UsePositionsInfiniteOptions,
): UsePositionsInfiniteResult;

export function usePositions(
  address: string | undefined,
  options?: UsePositionsOptions,
): UsePositionsBaseResult;

export function usePositions(
  address: string | undefined,
  options: UsePositionsOptions | UsePositionsInfiniteOptions = {},
): UsePositionsBaseResult | UsePositionsInfiniteResult {
  const { client } = usePlugContext();
  const {
    filter,
    search,
    action,
    sort,
    limit,
    enabled = true,
    stream = false,
  } = options;

  const isInfinite = "infinite" in options && options.infinite === true;

  const queryKey = QueryKeys.positions(
    address || "",
    filter,
    search,
    action,
    sort,
    limit,
  );

  const infinite = useInfiniteQuery({
    queryKey: [...queryKey, "infinite"],
    queryFn: async ({ pageParam }) => {
      if (pageParam) {
        return client.getPositions.byUrl(pageParam);
      }
      return client.getPositions({
        address: address!,
        filter,
        search,
        action,
        sort,
        limit,
      });
    },
    getNextPageParam: (lastPage) => lastPage.links?.next ?? undefined,
    getPreviousPageParam: (firstPage) => firstPage.links?.prev ?? undefined,
    initialPageParam: undefined as string | undefined,
    enabled: isInfinite && enabled && !!address,
  });

  const single = useQuery({
    queryKey,
    queryFn: () =>
      client.getPositions({
        address: address!,
        filter,
        search,
        action,
        sort,
        limit,
      }),
    enabled: !isInfinite && enabled && !!address,
  });

  useStream(
    (params, opts) => client.getPositions(params, opts),
    address ? { address, filter, search, action, sort, limit } : undefined,
    isInfinite ? [...queryKey, "infinite"] : queryKey,
    { enabled: enabled && stream && !!address, infinite: isInfinite },
  );

  const pages = infinite.data?.pages ?? [];
  const firstPage = pages[0];
  const allData = useMemo(() => pages.flatMap((p) => p.data ?? []), [pages]);

  if (isInfinite) {
    return {
      data: firstPage?.data ?? [],
      links: firstPage?.links,
      headers: firstPage?.headers,
      pages,
      allData,
      hasNextPage: infinite.hasNextPage ?? false,
      hasPreviousPage: infinite.hasPreviousPage ?? false,
      fetchNextPage: infinite.fetchNextPage,
      fetchPreviousPage: infinite.fetchPreviousPage,
      isFetchingNextPage: infinite.isFetchingNextPage,
      isFetchingPreviousPage: infinite.isFetchingPreviousPage,
      isLoading: infinite.isLoading,
      isFetching: infinite.isFetching,
      error: infinite.error,
      refetch: infinite.refetch,
    };
  }

  return {
    data: single.data?.data ?? [],
    links: single.data?.links,
    headers: single.data?.headers,
    isLoading: single.isLoading,
    isFetching: single.isFetching,
    error: single.error,
    refetch: single.refetch,
  };
}
