import { z } from "zod";

import { createResponseSchema } from "./response";

export type ColorQueryParams = {
  url: string;
};

export const ColorParamsSchema = z.object({
  encoded_url: z
    .string()
    .describe(
      "Base64url encoding of the absolute asset URL, the same segment the /cdn proxy serves the image from.",
    ),
});

export const ColorSchema = z.object({
  color: z.string(),
  textColor: z.string(),
});

export const ColorResponseSchema = createResponseSchema(ColorSchema);

export type ColorResponse = z.infer<typeof ColorResponseSchema>;
