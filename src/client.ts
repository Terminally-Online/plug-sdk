import { z } from "zod";

import {
  PlugSDKError,
  PlugNetworkError,
  PlugValidationError,
  type ResolvedPlugSDKConfig,
  type PlugSDKConfig,
} from "@/src/types";
import { createConfig } from "@/src/config";
import { buildQueryParams } from "@/src/client/query";
import { ChainQueryParams, ChainResponseSchema } from "@/src/lib/schemas/chain";
import {
  AddressParams,
  AddressResponseSchema,
  PositionsQueryParams,
  PositionsResponseSchema,
} from "@/src/lib/schemas/address";
import {
  ContextQueryParams,
  ContextResponseSchema,
} from "@/src/lib/schemas/context";
import {
  GetActivityQueryParams,
  GetActivityResponseSchema,
} from "@/src/lib/schemas/activity";
import {
  CompileTransactionQueryParams,
  CompileTransactionResponseSchema,
  CreateTransactionQueryParams,
  CreateTransactionResponseSchema,
  GetTransactionsQueryParams,
  GetTransactionsResponseSchema,
} from "@/src/lib/schemas/transaction";
import {
  SeriesQueryParams,
  SeriesResponseSchema,
} from "@/src/lib/schemas/series";
import { ColorQueryParams, ColorResponseSchema } from "@/src/lib/schemas/cdn";

type EndpointParams = Record<string, any>;
type EndpointOptions<T> = {
  onData: (data: T) => void;
  onError?: (error: Error) => void;
};

export interface AuthNonceResponse {
  data: {
    nonce: string;
    expires_at: string;
  };
}

export interface AuthTokenResponse {
  data: {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };
}

export interface AuthSessionResponse {
  data: {
    address: string;
  };
}

export class PlugClient {
  private config: ResolvedPlugSDKConfig;

  constructor(config?: Partial<PlugSDKConfig>) {
    this.config = createConfig(config);
  }

  private createUrl(endpoint: string, params?: URLSearchParams): string {
    const url = new URL(`${this.config.baseUrl}${endpoint}`);

    if (params) {
      params.forEach((value, key) => {
        url.searchParams.append(key, value);
      });
    }

    return url.toString();
  }

  private async getAuthHeaders(): Promise<Record<string, string>> {
    if (!this.config.auth?.getAccessToken) return {};

    try {
      const token = await this.config.auth.getAccessToken();
      if (!token) return {};
      return { Authorization: `Bearer ${token}` };
    } catch {
      return {};
    }
  }

  private async request<T>(
    urlOrEndpoint: string,
    options: RequestInit = {},
    retries = this.config.retries,
    isRetryAfter401 = false,
  ): Promise<T> {
    const url = urlOrEndpoint.startsWith("http")
      ? urlOrEndpoint
      : `${this.config.baseUrl}${urlOrEndpoint}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    const authHeaders = await this.getAuthHeaders();

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          ...authHeaders,
          ...options.headers,
          ...(options.method &&
            ["POST", "PUT", "PATCH"].includes(options.method.toUpperCase()) && {
              "Content-Type": "application/json",
            }),
        },
      });

      clearTimeout(timeoutId);

      if (
        response.status === 401 &&
        !isRetryAfter401 &&
        this.config.auth?.onTokenExpired
      ) {
        const newToken = await this.config.auth.onTokenExpired();
        if (newToken) {
          return this.request<T>(
            urlOrEndpoint,
            {
              ...options,
              headers: {
                ...options.headers,
                Authorization: `Bearer ${newToken}`,
              },
            },
            retries,
            true,
          );
        }
      }

      if (!response.ok) {
        const errorData = await response.text();
        throw new PlugNetworkError(
          `HTTP ${response.status}: ${errorData}`,
          response.status,
        );
      }

      return await response.json();
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof PlugSDKError) {
        throw error;
      }

      if (retries > 0 && this.shouldRetry(error)) {
        await this.delay(1000 * (this.config.retries - retries + 1));
        return this.request<T>(urlOrEndpoint, options, retries - 1);
      }

      if (error instanceof Error) {
        throw new PlugNetworkError(
          `Connection failed: ${error.message}`,
          error.name === "AbortError" ? 408 : undefined,
        );
      }

      throw new PlugNetworkError(`Network request failed: ${String(error)}`);
    }
  }

  private shouldRetry(error: unknown): boolean {
    if (error instanceof PlugNetworkError) {
      return !error.statusCode || error.statusCode >= 500;
    }

    return (
      error instanceof TypeError ||
      (error instanceof Error && error.name === "AbortError")
    );
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private createValidator<T>(schema: z.ZodSchema<T>) {
    return (data: unknown, url?: string): T => {
      const result = schema.safeParse(data);
      if (!result.success) {
        throw new PlugValidationError(
          `Invalid response format for ${url ? ` for ${url}` : ""} : ` +
            JSON.stringify(result.error.issues),
          result.error.issues,
        );
      }
      return result.data;
    };
  }

  private endpoint<TParams extends EndpointParams>(
    path: string,
    method: "GET" | "PUT" | "POST" | "DELETE" = "GET",
  ) {
    return <TSchema extends z.ZodSchema>(responseSchema: TSchema) => {
      const self = this;

      function endpoint(params: TParams): Promise<z.infer<TSchema>>;
      function endpoint(
        params: TParams,
        options: EndpointOptions<z.infer<TSchema>>,
      ): () => void;
      function endpoint(
        params: TParams,
        _?: EndpointOptions<z.infer<TSchema>>,
      ): Promise<z.infer<TSchema>> | (() => void) {
        return self.requestEndpoint(path, params, responseSchema, method);
      }

      return Object.assign(endpoint, {
        byUrl: async (urlPath: string): Promise<z.infer<TSchema>> => {
          const url = urlPath.startsWith("http")
            ? urlPath
            : `${self.config.baseUrl}${urlPath}`;
          const data = await self.request<unknown>(url, { method });
          return self.createValidator(responseSchema)(data, url);
        },
      });
    };
  }

  private async requestEndpoint<
    TParams extends EndpointParams,
    TSchema extends z.ZodSchema,
  >(
    path: string,
    params: TParams,
    responseSchema: TSchema,
    method: string = "GET",
  ): Promise<z.infer<TSchema>> {
    try {
      const { address, url: full, ...query } = params;
      const processed = buildQueryParams(query);
      const url = full
        ? `${
            full.startsWith("http") ? full : `${this.config.baseUrl}${full}`
          }${path}`
        : this.createUrl(`/address/${address}${path}`, processed);
      const data = await this.request<unknown>(url, { method });
      const validated = this.createValidator(responseSchema)(data, url);

      this.config.onSuccess(validated);

      return validated;
    } catch (error) {
      if (error instanceof PlugSDKError) {
        this.config.onError(error);
        throw error;
      }

      const sdkError = new PlugSDKError(
        error instanceof Error ? error.message : "Unknown error occurred",
        "REQUEST_FAILED",
      );
      this.config.onError(sdkError);
      throw sdkError;
    }
  }

  // -- Auth endpoints --

  readonly getNonce = async (): Promise<AuthNonceResponse> => {
    return this.request<AuthNonceResponse>("/auth/nonce", { method: "GET" });
  };

  readonly verify = async (params: {
    message: string;
    signature: string;
  }): Promise<AuthTokenResponse> => {
    return this.request<AuthTokenResponse>("/auth/verify", {
      method: "POST",
      body: JSON.stringify(params),
    });
  };

  readonly refresh = async (params: {
    refresh_token: string;
  }): Promise<AuthTokenResponse> => {
    return this.request<AuthTokenResponse>("/auth/refresh", {
      method: "POST",
      body: JSON.stringify(params),
    });
  };

  readonly getSession = async (): Promise<AuthSessionResponse> => {
    return this.request<AuthSessionResponse>("/auth/session", {
      method: "GET",
    });
  };

  // -- Data endpoints --

  readonly getChain =
    this.endpoint<ChainQueryParams>("/chain")(ChainResponseSchema);

  readonly getAddress = this.endpoint<AddressParams>(
    "/",
    "GET",
  )(AddressResponseSchema);
  readonly getPositions = this.endpoint<PositionsQueryParams>(
    "/",
    "PUT",
  )(PositionsResponseSchema);
  readonly getContext = this.endpoint<ContextQueryParams>(
    "/",
    "POST",
  )(ContextResponseSchema);

  readonly getActivity = this.endpoint<GetActivityQueryParams>(
    "/activity",
    "GET",
  )(GetActivityResponseSchema);

  readonly getTransactions = this.endpoint<GetTransactionsQueryParams>(
    "/transaction",
    "GET",
  )(GetTransactionsResponseSchema);
  readonly createTransaction = this.endpoint<CreateTransactionQueryParams>(
    "/transaction",
    "POST",
  )(CreateTransactionResponseSchema);
  readonly compileTransaction = this.endpoint<CompileTransactionQueryParams>(
    "/transaction/",
    "PUT",
  )(CompileTransactionResponseSchema);

  readonly getSeries = this.endpoint<SeriesQueryParams>(
    "/history",
    "GET",
  )(SeriesResponseSchema);

  readonly getColor = this.endpoint<ColorQueryParams>(
    "/color",
    "GET",
  )(ColorResponseSchema);
}
