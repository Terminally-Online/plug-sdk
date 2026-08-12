import { z } from "zod";

export const AuthNonceResponseSchema = z.object({
  data: z.object({
    nonce: z
      .string()
      .describe("One-time value to embed in the SIWE message before signing."),
    expires_at: z
      .string()
      .describe("RFC 3339 timestamp after which the nonce is rejected."),
  }),
});

export const AuthVerifyBodySchema = z.object({
  message: z
    .string()
    .describe("The exact SIWE message that was signed, verbatim."),
  signature: z
    .string()
    .describe("Hex signature of the SIWE message produced by the wallet."),
});

export const AuthRefreshBodySchema = z.object({
  refresh_token: z
    .string()
    .describe("The refresh token issued by /auth/verify or a prior refresh."),
});

export const AuthTokenResponseSchema = z.object({
  data: z.object({
    access_token: z
      .string()
      .describe("Bearer token for the Authorization header."),
    refresh_token: z
      .string()
      .describe("Token used to rotate the pair once the access token expires."),
    expires_in: z
      .number()
      .describe("Access token lifetime in seconds from issuance."),
  }),
});

export const AuthSessionResponseSchema = z.object({
  data: z.object({
    address: z
      .string()
      .describe("The EVM address the presented access token authenticates."),
  }),
});

export type AuthNonceResponse = z.infer<typeof AuthNonceResponseSchema>;
export type AuthVerifyBody = z.infer<typeof AuthVerifyBodySchema>;
export type AuthRefreshBody = z.infer<typeof AuthRefreshBodySchema>;
export type AuthTokenResponse = z.infer<typeof AuthTokenResponseSchema>;
export type AuthSessionResponse = z.infer<typeof AuthSessionResponseSchema>;
