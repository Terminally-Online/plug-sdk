import { useMemo } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";

import { QueryKeys } from "../../config";
import {
  Activity,
  GetActivityQueryParams,
  GetActivityResponse,
} from "../../lib/schemas/activity";
import { usePlugContext } from "../../provider";
import { useStream } from "../stream/useStream";

export type UseActivityOptions = Omit<GetActivityQueryParams, "address"> & {
  enabled?: boolean;
  stream?: boolean;
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
  const { filter, limit, enabled = true, stream = false } = options;

  const isInfinite = "infinite" in options && options.infinite === true;

  const infinite = useInfiniteQuery({
    queryKey: [...QueryKeys.activity(address || "", filter, limit), "infinite"],
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
    enabled: isInfinite && enabled && !!address,
  });

  const single = useQuery({
    queryKey: QueryKeys.activity(address || "", filter, limit),
    queryFn: () =>
      client.getActivity({
        address: address!,
        filter,
        limit,
      }),
    enabled: !isInfinite && enabled && !!address,
  });

  useStream(
    (params, opts) => client.getActivity(params, opts),
    address ? { address, filter, limit } : undefined,
    isInfinite
      ? [...QueryKeys.activity(address || "", filter, limit), "infinite"]
      : QueryKeys.activity(address || "", filter, limit),
    { enabled: enabled && stream && !!address, infinite: isInfinite },
  );

  const pages = infinite.data?.pages ?? [];
  const firstPage = pages[0];
  const allData = useMemo(() => pages.flatMap((p) => p.data ?? []), [pages]);

  if (isInfinite) {
    return {
      data: firstPage?.data ?? [],
      links: firstPage?.links,
      pages,
      allData,
      hasNextPage: infinite.hasNextPage ?? false,
      fetchNextPage: infinite.fetchNextPage,
      isFetchingNextPage: infinite.isFetchingNextPage,
      isLoading: infinite.isLoading,
      isFetching: infinite.isFetching,
      error: infinite.error,
      refetch: infinite.refetch,
    };
  }

  return {
    data: single.data?.data ?? [],
    links: single.data?.links,
    isLoading: single.isLoading,
    isFetching: single.isFetching,
    error: single.error,
    refetch: single.refetch,
  };
}
