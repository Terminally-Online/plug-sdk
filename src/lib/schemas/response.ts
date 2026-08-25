import { z } from "zod/v4";

export const ResponseErrorSchema = z.object({ error: z.string() });

// Constrained to z.ZodType rather than the deprecated z.ZodTypeAny: under Zod 4
// ZodTypeAny no longer carries an inferable output, so every response built
// through here reported its data as unknown and each consumer lost the shape
// the schema had already described.
export const createResponseSchema = <
  DataType extends z.ZodType,
  HeadersType extends z.ZodType = z.ZodUnknown,
>(
  data: DataType,
  headers?: HeadersType,
) => {
  return z.object({
    links: z
      .object({
        self: z.string(),
        prev: z.string().optional(),
        next: z.string().optional(),
      })
      .optional(),
    headers: ((headers ?? z.unknown()) as HeadersType).optional(),
    data: z.union([data, z.null()]),
  });
};

export type ResponseError = z.infer<typeof ResponseErrorSchema>;
