import { z } from "zod";

import {
  PlugSDKError,
  PlugNetworkError,
  PlugValidationError,
  type ResolvedPlugSDKConfig,
  type PlugSDKConfig,
} from "./types";
import { createConfig } from "./config";
import { buildQueryParams } from "./client/query";
import { ChainQueryParams, ChainResponseSchema } from "./lib/schemas/chain";
import {
  AddressParams,
  AddressResponseSchema,
  PositionsQueryParams,
  PositionsResponseSchema,
} from "./lib/schemas/address";
import {
  ContextQueryParams,
  ContextResponseSchema,
} from "./lib/schemas/context";
import {
  GetActivityQueryParams,
  GetActivityResponseSchema,
} from "./lib/schemas/activity";
import {
  CompileTransactionQueryParams,
  CompileTransactionResponseSchema,
  CreateTransactionQueryParams,
  CreateTransactionResponseSchema,
  GetTransactionsQueryParams,
  GetTransactionsResponseSchema,
  CancelTransactionParams,
  CancelTransactionResponse,
  CancelTransactionResponseSchema,
  SubmitTransactionParams,
  SubmitTransactionResponse,
  SubmitTransactionResponseSchema,
} from "./lib/schemas/transaction";
import { SeriesQueryParams, SeriesResponseSchema } from "./lib/schemas/series";
import { ColorQueryParams, ColorResponseSchema } from "./lib/schemas/cdn";
import type {
  AuthNonceResponse,
  AuthSessionResponse,
  AuthTokenResponse,
} from "./lib/schemas/auth";
import { StreamManager, type StreamListener } from "./client/manager";
import { StreamConnection } from "./client/stream";
import { applyJsonPatch } from "./client/patch";

type EndpointParams = Record<string, any>;
type EndpointOptions<T> = {
  onData: (data: T) => void;
  onError?: (error: Error) => void;
};

export type EndpointScope = "root" | "address";
export type EndpointMethod = "GET" | "PUT" | "POST" | "DELETE";

export interface EndpointMeta {
  method: EndpointMethod;
  scope: EndpointScope;
  path: string;
  displayPath: string;
  summary: string;
  paramsSchema?: z.ZodSchema;
  responseSchema?: z.ZodSchema;
}

interface EndpointRegistration {
  scope?: EndpointScope;
  summary: string;
  displayPath?: string;
  paramsSchema?: z.ZodSchema;
}

const computeDisplayPath = (
  scope: EndpointScope,
  path: string,
  override?: string,
): string => {
  if (override) return override;
  return scope === "root" ? path : `/address/{address}${path}`;
};

const RESOLUTION_BASE = "https://plug.invalid";

const normalizeCallPath = (
  path: string,
): { pathname: string; search: URLSearchParams } => {
  const trimmed = path.trim();

  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) {
    throw new PlugSDKError(
      `Path must be rooted at the Plug API, like "/address/0x…/activity" — received "${path}".`,
      "INVALID_PATH",
    );
  }

  if (trimmed.split(/[/?#]/).includes("..")) {
    throw new PlugSDKError(
      `Path may not traverse outside the Plug API — received "${path}".`,
      "INVALID_PATH",
    );
  }

  const resolved = new URL(trimmed, RESOLUTION_BASE);
  if (resolved.origin !== RESOLUTION_BASE) {
    throw new PlugSDKError(
      `Path may not name a host — received "${path}".`,
      "INVALID_PATH",
    );
  }

  return { pathname: resolved.pathname, search: resolved.searchParams };
};

export type RawCallParams = {
  method: EndpointMethod;
  path: string;
  query?: Record<string, unknown>;
  body?: unknown;
};

export class PlugClient {
  private config: ResolvedPlugSDKConfig;
  private streamManager = new StreamManager();

  readonly endpoints: EndpointMeta[] = [];

  constructor(config?: Partial<PlugSDKConfig>) {
    this.config = createConfig(config);

    this.registerEndpoint({
      method: "GET",
      scope: "root",
      path: "/auth/nonce",
      displayPath: "/auth/nonce",
      summary: "Generate a one-time nonce for SIWE message signing.",
    });
    this.registerEndpoint({
      method: "POST",
      scope: "root",
      path: "/auth/verify",
      displayPath: "/auth/verify",
      summary: "Verify a SIWE signature and issue access + refresh tokens.",
    });
    this.registerEndpoint({
      method: "POST",
      scope: "root",
      path: "/auth/refresh",
      displayPath: "/auth/refresh",
      summary: "Rotate the access and refresh token pair.",
    });
    this.registerEndpoint({
      method: "GET",
      scope: "root",
      path: "/auth/session",
      displayPath: "/auth/session",
      summary: "Resolve the authenticated address for the current session.",
    });
  }

  private registerEndpoint(meta: EndpointMeta): void {
    this.endpoints.push(meta);
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

  // Issues an arbitrary request against the configured Plug API and returns the
  // response body exactly as the server sent it. Auth, timeout, retry, and 401
  // rotation are shared with every typed endpoint; response validation is not,
  // because the point of this surface is to see what the API actually returns
  // rather than what a schema expects.
  //
  // The path is resolved against baseUrl and can never leave it: absolute URLs,
  // protocol-relative paths, and traversal segments are rejected rather than
  // normalized, so the host is a boundary and not a default.
  readonly call = async <T = unknown>({
    method,
    path,
    query,
    body,
  }: RawCallParams): Promise<T> => {
    const { pathname, search } = normalizeCallPath(path);
    if (query) {
      buildQueryParams(query).forEach((value, key) => search.append(key, value));
    }
    const serialized = search.toString();
    const endpoint = serialized ? `${pathname}?${serialized}` : pathname;

    return this.request<T>(endpoint, {
      method,
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  };

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
    method: EndpointMethod = "GET",
    registration: EndpointRegistration = { summary: "" },
  ) {
    const scope: EndpointScope = registration.scope ?? "address";
    return <TSchema extends z.ZodSchema>(responseSchema: TSchema) => {
      this.registerEndpoint({
        method,
        scope,
        path,
        displayPath: computeDisplayPath(scope, path, registration.displayPath),
        summary: registration.summary,
        paramsSchema: registration.paramsSchema,
        responseSchema,
      });

      const self = this;

      function endpoint(params: TParams): Promise<z.infer<TSchema>>;
      function endpoint(
        params: TParams,
        options: EndpointOptions<z.infer<TSchema>>,
      ): () => void;
      function endpoint(
        params: TParams,
        options?: EndpointOptions<z.infer<TSchema>>,
      ): Promise<z.infer<TSchema>> | (() => void) {
        if (options) {
          return self.openStream(path, params, responseSchema, scope, options);
        }
        return self.requestEndpoint(
          path,
          params,
          responseSchema,
          method,
          scope,
        );
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

  private resolveUrl<TParams extends EndpointParams>(
    path: string,
    params: TParams,
    scope: EndpointScope,
  ): string {
    const { address, url: full, ...query } = params;
    const processed = buildQueryParams(query);
    const scopedPath = scope === "root" ? path : `/address/${address}${path}`;
    return full
      ? `${
          full.startsWith("http") ? full : `${this.config.baseUrl}${full}`
        }${path}`
      : this.createUrl(scopedPath, processed);
  }

  private openStream<
    TParams extends EndpointParams,
    TSchema extends z.ZodSchema,
  >(
    path: string,
    params: TParams,
    responseSchema: TSchema,
    scope: EndpointScope,
    options: EndpointOptions<z.infer<TSchema>>,
  ): () => void {
    const url = this.resolveUrl(path, params, scope);
    const validate = this.createValidator(responseSchema);

    let current: z.infer<TSchema>;
    const listener: StreamListener = {
      onSnapshot: (data) => {
        current = data as z.infer<TSchema>;
        options.onData(current);
      },
      onPatch: (ops) => {
        current = applyJsonPatch(current, ops);
        options.onData(current);
      },
      onError: (error) => options.onError?.(error),
    };

    return this.streamManager.subscribe(
      url,
      (callbacks) =>
        new StreamConnection({
          url,
          getAuthHeaders: () => this.getAuthHeaders(),
          onTokenExpired: this.config.auth?.onTokenExpired,
          validateSnapshot: (data) => validate(data, url),
          ...callbacks,
        }),
      listener,
    );
  }

  private async requestEndpoint<
    TParams extends EndpointParams,
    TSchema extends z.ZodSchema,
  >(
    path: string,
    params: TParams,
    responseSchema: TSchema,
    method: string = "GET",
    scope: EndpointScope = "address",
  ): Promise<z.infer<TSchema>> {
    try {
      const url = this.resolveUrl(path, params, scope);
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

  readonly getChain = this.endpoint<ChainQueryParams>("/chain", "GET", {
    scope: "root",
    summary: "List supported chains with metadata and protocol coverage.",
  })(ChainResponseSchema);

  readonly getAddress = this.endpoint<AddressParams>("/", "GET", {
    summary: "Address metadata, graph flags, and signal data.",
  })(AddressResponseSchema);
  readonly getPositions = this.endpoint<PositionsQueryParams>("/", "PUT", {
    summary:
      "Fungible, non-fungible, and non-tokenized positions across chains.",
  })(PositionsResponseSchema);
  readonly getContext = this.endpoint<ContextQueryParams>("/", "POST", {
    summary:
      "Action options, valid inputs, and address-scoped context for building transactions.",
  })(ContextResponseSchema);

  readonly getActivity = this.endpoint<GetActivityQueryParams>(
    "/activity",
    "GET",
    { summary: "Activity log with filtering across supported chains." },
  )(GetActivityResponseSchema);

  readonly getTransactions = this.endpoint<GetTransactionsQueryParams>(
    "/transaction/",
    "GET",
    { summary: "Transaction history with filtering across supported chains." },
  )(GetTransactionsResponseSchema);

  readonly cancelTransaction = async (
    params: CancelTransactionParams,
  ): Promise<CancelTransactionResponse> => {
    const { address, id } = params;
    const url = this.createUrl(
      `/address/${address}/transaction/`,
      buildQueryParams({ id }),
    );
    const data = await this.request<unknown>(url, { method: "DELETE" });
    return this.createValidator(CancelTransactionResponseSchema)(data, url);
  };
  readonly createTransaction = this.endpoint<CreateTransactionQueryParams>(
    "/transaction",
    "POST",
    {
      summary:
        "Build and persist transaction calldata ready for signing and submission.",
    },
  )(CreateTransactionResponseSchema);
  readonly compileTransaction = this.endpoint<CompileTransactionQueryParams>(
    "/transaction/",
    "PUT",
    {
      scope: "root",
      summary:
        "Compile a draft action sequence into coil options, output manifests, and simulated slot values.",
    },
  )(CompileTransactionResponseSchema);

  readonly submitTransaction = async ({
    address,
    ...input
  }: SubmitTransactionParams): Promise<SubmitTransactionResponse> => {
    const data = await this.request<unknown>(
      `/address/${address}/transaction/`,
      { method: "PUT", body: JSON.stringify(input) },
    );
    return this.createValidator(SubmitTransactionResponseSchema)(
      data,
      `/address/${address}/transaction/`,
    );
  };

  readonly getSeries = this.endpoint<SeriesQueryParams>("/history", "GET", {
    summary: "Time-series historical data for an address.",
  })(SeriesResponseSchema);

  readonly getColor = this.endpoint<ColorQueryParams>("/color", "GET", {
    scope: "root",
    displayPath: "/cdn/{encoded_url}/color",
    summary: "Dominant color palette for a CDN resource.",
  })(ColorResponseSchema);
}
