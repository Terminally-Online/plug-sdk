import { useMemo } from "react";
import { useQuery, useInfiniteQuery } from "@tanstack/react-query";

import { QueryKeys } from "@/src/config";

import {
  PositionsQueryParams,
  PositionsResponse,
  Address,
} from "@/src/lib/schemas/address";
import { usePlugContext } from "@/src/provider";

export type UsePositionsOptions = Omit<PositionsQueryParams, "address"> & {
  enabled?: boolean;
};

export type UsePositionsInfiniteOptions = UsePositionsOptions & {
  infinite: true;
};

type PositionsLinks = PositionsResponse["links"];

type UsePositionsBaseResult = {
  data: Address[];
  links: PositionsLinks;
  isLoading: boolean;
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
    history,
    action,
    sort,
    limit,
    enabled = true,
  } = options;

  const isInfinite = "infinite" in options && options.infinite === true;

  if (isInfinite) {
    const result = useInfiniteQuery({
      queryKey: [
        ...QueryKeys.positions(
          address || "",
          filter,
          search,
          history,
          action,
          sort,
          limit,
        ),
        "infinite",
      ],
      queryFn: async ({ pageParam }) => {
        if (pageParam) {
          return client.getPositions.byUrl(pageParam);
        }
        return client.getPositions({
          address: address!,
          filter,
          search,
          history,
          action,
          sort,
          limit,
        });
      },
      getNextPageParam: (lastPage) => lastPage.links?.next ?? undefined,
      getPreviousPageParam: (firstPage) => firstPage.links?.prev ?? undefined,
      initialPageParam: undefined as string | undefined,
      enabled: enabled && !!address,
    });

    const pages = result.data?.pages ?? [];
    const firstPage = pages[0];
    const allData = useMemo(() => pages.flatMap((p) => p.data ?? []), [pages]);

    return {
      data: firstPage?.data ?? [],
      links: firstPage?.links,
      pages,
      allData,
      hasNextPage: result.hasNextPage ?? false,
      hasPreviousPage: result.hasPreviousPage ?? false,
      fetchNextPage: result.fetchNextPage,
      fetchPreviousPage: result.fetchPreviousPage,
      isFetchingNextPage: result.isFetchingNextPage,
      isFetchingPreviousPage: result.isFetchingPreviousPage,
      isLoading: result.isLoading,
      error: result.error,
      refetch: result.refetch,
    };
  }

  const result = useQuery({
    queryKey: QueryKeys.positions(
      address || "",
      filter,
      search,
      history,
      action,
      sort,
      limit,
    ),
    queryFn: () =>
      client.getPositions({
        address: address!,
        filter,
        search,
        history,
        action,
        sort,
        limit,
      }),
    enabled: enabled && !!address,
  });

  return {
    data: result.data?.data ?? [],
    links: result.data?.links,
    isLoading: result.isLoading,
    error: result.error,
    refetch: result.refetch,
  };
}
