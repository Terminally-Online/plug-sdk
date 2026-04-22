import { z } from "zod"

import { RecursiveStringMapSchema } from "./address"
import { createResponseSchema } from "./response"

export const SeriesEntrySchema = z
	.object({ timestamp: z.number() })
	.catchall(z.union([z.string(), RecursiveStringMapSchema]))

export const SeriesSchema = z.array(SeriesEntrySchema)

export const SeriesFilterSchema = z.object({
	address: z
		.string()
		.optional()
		.describe("Token or contract address for token/collectible history."),
	token_id: z
		.string()
		.optional()
		.describe("Token ID for collectible history."),
	chain_id: z
		.number()
		.optional()
		.describe("Chain ID to query. Defaults to mainnet."),
})

export const SeriesTimeSchema = z.object({
	before: z
		.number()
		.optional()
		.describe("Upper bound unix timestamp for the time window."),
	from: z
		.number()
		.optional()
		.describe("Start unix timestamp. Defaults to 24h before `to`."),
	to: z
		.number()
		.optional()
		.describe("End unix timestamp. Defaults to now."),
	resolution: z
		.string()
		.optional()
		.describe(
			"Time bucket resolution (e.g., 1h, 1d, all). Auto-selected if omitted.",
		),
})

export const SeriesSortSchema = z.object({
	direction: z
		.enum(["asc", "desc"])
		.optional()
		.describe("Sort direction for results."),
})

export const SeriesLimitSchema = z.object({
	count: z
		.number()
		.optional()
		.describe("Maximum number of results to return (max 500)."),
	offset: z
		.number()
		.optional()
		.describe("Number of results to skip for pagination."),
})

export const SeriesQueryParamsSchema = z.object({
	filter: SeriesFilterSchema.optional(),
	time: SeriesTimeSchema.optional(),
	sort: SeriesSortSchema.optional(),
	limit: SeriesLimitSchema.optional(),
})

export const SeriesResponseSchema = createResponseSchema(SeriesSchema)

export type SeriesEntry = z.infer<typeof SeriesEntrySchema>
export type Series = z.infer<typeof SeriesSchema>
export type SeriesQueryParams = { address: string } & z.infer<
	typeof SeriesQueryParamsSchema
>
export type SeriesResponse = z.infer<typeof SeriesResponseSchema>
