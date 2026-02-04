import { z } from 'zod'

export const ExternalLinkSchema = z.object({
    name: z.string(),
    url: z.string().url(),
})

export const ExternalSchema = z.record(z.string(), ExternalLinkSchema)
