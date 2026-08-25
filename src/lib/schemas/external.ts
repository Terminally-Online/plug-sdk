import { z } from "zod/v4"

export const ExternalLinkSchema = z.object({
    name: z.string(),
    url: z.string().url(),
})

export const ExternalSchema = z.record(z.string(), ExternalLinkSchema)
