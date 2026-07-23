import { useEffect, useMemo } from "react";
import { useQuery, useInfiniteQuery } from "@tanstack/react-query";

import { QueryKeys } from "../../config";

import {
  SeriesQueryParams,
  SeriesResponse,
  SeriesEntry,
} from "../../lib/schemas/series";
import { usePlugContext } from "../../provider";
import { useStream } from "../stream/useStream";

export type UseSeriesOptions = Omit<SeriesQueryParams, "address"> & {
  enabled?: boolean;
  stream?: boolean;
};

export type UseSeriesInfiniteOptions = UseSeriesOptions & {
  infinite: true;
  drain?: boolean;
};

type SeriesLinks = SeriesResponse["links"];

type UseSeriesBaseResult = {
  queryKey: readonly unknown[];
  data: SeriesEntry[];
  links: SeriesLinks;
  isLoading: boolean;
  isFetching: boolean;
  error: Error | null;
  refetch: () => void;
};

type UseSeriesInfiniteResult = UseSeriesBaseResult & {
  pages: SeriesResponse[];
  allData: SeriesEntry[];
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  fetchNextPage: () => Promise<unknown>;
  fetchPreviousPage: () => Promise<unknown>;
  isFetchingNextPage: boolean;
  isFetchingPreviousPage: boolean;
};

export function useSeries(
  address: string | undefined,
  options: UseSeriesInfiniteOptions,
): UseSeriesInfiniteResult;

export function useSeries(
  address: string | undefined,
  options?: UseSeriesOptions,
): UseSeriesBaseResult;

export function useSeries(
  address: string | undefined,
  options: UseSeriesOptions | UseSeriesInfiniteOptions = {},
): UseSeriesBaseResult | UseSeriesInfiniteResult {
  const { client } = usePlugContext();
  const { filter, time, sort, limit, enabled = true, stream = false } = options;

  const isInfinite = "infinite" in options && options.infinite === true;
  const drain = "drain" in options && options.drain === true;

  const infinite = useInfiniteQuery({
    queryKey: [
      ...QueryKeys.series(address || "", filter, time, sort, limit),
      "infinite",
    ],
    queryFn: async ({ pageParam }) => {
      if (pageParam) {
        return client.getSeries.byUrl(pageParam);
      }
      return client.getSeries({
        address: address!,
        filter,
        time,
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
    queryKey: QueryKeys.series(address || "", filter, time, sort, limit),
    queryFn: () =>
      client.getSeries({
        address: address!,
        filter,
        time,
        sort,
        limit,
      }),
    enabled: !isInfinite && enabled && !!address,
  });

  useStream(
    (params, opts) => client.getSeries(params, opts),
    address ? { address, filter, time, sort, limit } : undefined,
    isInfinite
      ? [...QueryKeys.series(address || "", filter, time, sort, limit), "infinite"]
      : QueryKeys.series(address || "", filter, time, sort, limit),
    { enabled: enabled && stream && !!address, infinite: isInfinite },
  );

  useEffect(() => {
    if (
      isInfinite &&
      drain &&
      infinite.hasNextPage &&
      !infinite.isFetchingNextPage
    ) {
      infinite.fetchNextPage();
    }
  }, [
    isInfinite,
    drain,
    infinite.hasNextPage,
    infinite.isFetchingNextPage,
    infinite.fetchNextPage,
  ]);

  const pages = infinite.data?.pages ?? [];
  const firstPage = pages[0];
  const allData = useMemo(() => pages.flatMap((p) => p.data ?? []), [pages]);

  if (isInfinite) {
    return {
      queryKey: [
        ...QueryKeys.series(address || "", filter, time, sort, limit),
        "infinite",
      ],
      data: firstPage?.data ?? [],
      links: firstPage?.links,
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
    queryKey: QueryKeys.series(address || "", filter, time, sort, limit),
    data: single.data?.data ?? [],
    links: single.data?.links,
    isLoading: single.isLoading,
    isFetching: single.isFetching,
    error: single.error,
    refetch: single.refetch,
  };
}
