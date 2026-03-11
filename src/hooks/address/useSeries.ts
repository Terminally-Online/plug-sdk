import { useMemo } from "react"
import { useQuery, useInfiniteQuery } from "@tanstack/react-query"

import { QueryKeys } from "@/src/config"

import {
	SeriesQueryParams,
	SeriesResponse,
	SeriesEntry,
} from "@/src/lib/schemas/series"
import { usePlugContext } from "@/src/provider"

export type UseSeriesOptions = Omit<SeriesQueryParams, "address"> & {
	enabled?: boolean
}

export type UseSeriesInfiniteOptions = UseSeriesOptions & {
	infinite: true
}

type SeriesLinks = SeriesResponse["links"]

type UseSeriesBaseResult = {
	data: SeriesEntry[]
	links: SeriesLinks
	isLoading: boolean
	isFetching: boolean
	error: Error | null
	refetch: () => void
}

type UseSeriesInfiniteResult = UseSeriesBaseResult & {
	pages: SeriesResponse[]
	allData: SeriesEntry[]
	hasNextPage: boolean
	hasPreviousPage: boolean
	fetchNextPage: () => Promise<unknown>
	fetchPreviousPage: () => Promise<unknown>
	isFetchingNextPage: boolean
	isFetchingPreviousPage: boolean
}

export function useSeries(
	address: string | undefined,
	options: UseSeriesInfiniteOptions,
): UseSeriesInfiniteResult

export function useSeries(
	address: string | undefined,
	options?: UseSeriesOptions,
): UseSeriesBaseResult

export function useSeries(
	address: string | undefined,
	options: UseSeriesOptions | UseSeriesInfiniteOptions = {},
): UseSeriesBaseResult | UseSeriesInfiniteResult {
	const { client } = usePlugContext()
	const { filter, time, sort, limit, enabled = true } = options

	const isInfinite = "infinite" in options && options.infinite === true

	if (isInfinite) {
		const result = useInfiniteQuery({
			queryKey: [
				...QueryKeys.series(address || "", filter, time, sort, limit),
				"infinite",
			],
			queryFn: async ({ pageParam }) => {
				if (pageParam) {
					return client.getSeries.byUrl(pageParam)
				}
				return client.getSeries({
					address: address!,
					filter,
					time,
					sort,
					limit,
				})
			},
			getNextPageParam: (lastPage) => lastPage.links?.next ?? undefined,
			getPreviousPageParam: (firstPage) =>
				firstPage.links?.prev ?? undefined,
			initialPageParam: undefined as string | undefined,
			enabled: enabled && !!address,
		})

		const pages = result.data?.pages ?? []
		const firstPage = pages[0]
		const allData = useMemo(
			() => pages.flatMap((p) => p.data ?? []),
			[pages],
		)

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
			isFetching: result.isFetching,
			error: result.error,
			refetch: result.refetch,
		}
	}

	const result = useQuery({
		queryKey: QueryKeys.series(address || "", filter, time, sort, limit),
		queryFn: () =>
			client.getSeries({
				address: address!,
				filter,
				time,
				sort,
				limit,
			}),
		enabled: enabled && !!address,
	})

	return {
		data: result.data?.data ?? [],
		links: result.data?.links,
		isLoading: result.isLoading,
		isFetching: result.isFetching,
		error: result.error,
		refetch: result.refetch,
	}
}
