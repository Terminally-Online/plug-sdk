import { z } from "zod";

export const ResponseErrorSchema = z.object({ error: z.string() });

export const createResponseSchema = <
  DataType extends z.ZodTypeAny,
  HeadersType extends z.ZodTypeAny = z.ZodUnknown,
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
