import { z } from "zod";

import { createResponseSchema } from "@/src/lib/schemas/response";

export type ColorQueryParams = {
  url: string;
};

export const ColorSchema = z.object({
  color: z.string(),
  textColor: z.string(),
});

export const ColorResponseSchema = createResponseSchema(ColorSchema);

export type ColorResponse = z.infer<typeof ColorResponseSchema>;
