import { useMemo } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";

import { QueryKeys } from "@/src/config";
import {
  Activity,
  GetActivityQueryParams,
  GetActivityResponse,
} from "@/src/lib/schemas/activity";
import { usePlugContext } from "@/src/provider";

export type UseActivityOptions = Omit<GetActivityQueryParams, "address"> & {
  enabled?: boolean;
};

export type UseActivityInfiniteOptions = UseActivityOptions & {
  infinite: true;
};

type ActivityLinks = GetActivityResponse["links"];

type UseActivityBaseResult = {
  data: Activity[];
  links: ActivityLinks;
  isLoading: boolean;
  isFetching: boolean;
  error: Error | null;
  refetch: () => void;
};

type UseActivityInfiniteResult = UseActivityBaseResult & {
  pages: GetActivityResponse[];
  allData: Activity[];
  hasNextPage: boolean;
  fetchNextPage: () => Promise<unknown>;
  isFetchingNextPage: boolean;
};

export function useActivity(
  address: string | undefined,
  options: UseActivityInfiniteOptions,
): UseActivityInfiniteResult;

export function useActivity(
  address: string | undefined,
  options?: UseActivityOptions,
): UseActivityBaseResult;

export function useActivity(
  address: string | undefined,
  options: UseActivityOptions | UseActivityInfiniteOptions = {},
): UseActivityBaseResult | UseActivityInfiniteResult {
  const { client } = usePlugContext();
  const { filter, limit, enabled = true } = options;

  const isInfinite = "infinite" in options && options.infinite === true;

  if (isInfinite) {
    const result = useInfiniteQuery({
      queryKey: [
        ...QueryKeys.activity(address || "", filter, limit),
        "infinite",
      ],
      queryFn: async ({ pageParam }) => {
        if (pageParam) {
          return client.getActivity.byUrl(pageParam);
        }
        return client.getActivity({
          address: address!,
          filter,
          limit,
        });
      },
      getNextPageParam: (lastPage) => lastPage.links?.next ?? undefined,
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
      fetchNextPage: result.fetchNextPage,
      isFetchingNextPage: result.isFetchingNextPage,
      isLoading: result.isLoading,
      isFetching: result.isFetching,
      error: result.error,
      refetch: result.refetch,
    };
  }

  const result = useQuery({
    queryKey: QueryKeys.activity(address || "", filter, limit),
    queryFn: () =>
      client.getActivity({
        address: address!,
        filter,
        limit,
      }),
    enabled: enabled && !!address,
  });

  return {
    data: result.data?.data ?? [],
    links: result.data?.links,
    isLoading: result.isLoading,
    isFetching: result.isFetching,
    error: result.error,
    refetch: result.refetch,
  };
}
