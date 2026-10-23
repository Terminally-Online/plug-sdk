import { z } from "zod/v4"

export const ExternalLinkSchema = z.object({
    name: z.string(),
    url: z.url(),
})

export const ExternalSchema = z.record(z.string(), ExternalLinkSchema)
