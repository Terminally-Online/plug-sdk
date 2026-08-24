import { z } from "zod"

import { createResponseSchema } from "./response"

export const SeriesBalanceSchema = z.object({
	int: z.string().optional().describe("Raw balance in base units."),
	float: z.string().optional().describe("Balance scaled by the token's decimals."),
	value: z.string().optional().describe("Balance valued in USD."),
})

export const SeriesPriceSchema = z.object({
	open: z.string().optional(),
	high: z.string().optional(),
	low: z.string().optional(),
	close: z.string().optional(),
	change: z.string().optional(),
})

export const SeriesPositionSchema = z.object({
	deposit_value: z.string().optional().describe("USD value supplied to the position."),
	debt_value: z.string().optional().describe("USD value borrowed against it."),
	assets: z
		.record(z.string(), z.record(z.string(), z.string()))
		.optional()
		.describe("Per-asset attributes keyed by asset address."),
})

export const SeriesPortfolioSchema = z.object({
	value: z.string().optional().describe("Total portfolio value in USD."),
})

/**
 * One bucket of history.
 *
 * Which attributes a bucket carries is decided by what was asked for, not by
 * anything in the bucket itself: a portfolio query fills `portfolio`, a
 * fungible token fills `balance` and `price`, a position fills `balance` and
 * `position`, and a collection or collectible fills only `balance.int`. The
 * server resolves that from the entity's standard, so a caller cannot always
 * know in advance — every group is optional and callers narrow.
 *
 * Unknown keys pass through rather than being stripped, so an attribute added
 * server-side survives the round trip and reaches callers as `unknown`.
 */
export const SeriesEntrySchema = z
	.object({
		timestamp: z.number(),
		balance: SeriesBalanceSchema.optional(),
		price: SeriesPriceSchema.optional(),
		position: SeriesPositionSchema.optional(),
		portfolio: SeriesPortfolioSchema.optional(),
	})
	.passthrough()

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
		.describe("Start unix timestamp. Defaults to 24h before to."),
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
