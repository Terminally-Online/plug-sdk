import { z } from 'zod'

export const ResponseErrorSchema = z.object({ error: z.string() })

export const createResponseSchema = <DataType extends z.ZodTypeAny>(
    data: DataType,
) => {
    return z.object({
        links: z.object({
            self: z.string(),
            prev: z.string().optional(),
            next: z.string().optional()
        }).optional(),
        data: z.union([data, z.null(),])
    });
}

export type ResponseError = z.infer<typeof ResponseErrorSchema>
