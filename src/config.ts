import type {
  PlugSDKConfig,
  ResolvedPlugSDKConfig,
  CacheConfig,
} from "./types";

const minute = 60 * 1000;

const PRODUCTION_URL = "https://api.plug.to";
const DEVELOPMENT_URL = "http://localhost:8080";

function resolveBaseUrl(): string {
  if (process.env.NODE_ENV === "development") return DEVELOPMENT_URL;
  return PRODUCTION_URL;
}

export const DEFAULT_SDK_CONFIG: ResolvedPlugSDKConfig = {
  baseUrl: resolveBaseUrl(),
  timeout: 30000,
  retries: 3,
  cache: {
    staleTime: 5 * minute,
    gcTime: 10 * minute,
  },
  onError: (error: Error) => {
    console.error("[Plug SDK Error]:", error);
  },
  onSuccess: () => {},
};

export const CACHE_CONFIG: CacheConfig = {
  protocols: {
    staleTime: 10 * minute,
    gcTime: 30 * minute,
  },
  actions: {
    staleTime: 5 * minute,
    gcTime: 15 * minute,
  },
  intents: {
    staleTime: 2 * minute,
    gcTime: 10 * minute,
  },
};

const stableStringify = (obj: unknown): string | undefined =>
  obj === undefined ? undefined : JSON.stringify(obj);

export const QueryKeys = {
  all: ["plug"] as const,

  chain: (filter?: Record<string, unknown>) =>
    [...QueryKeys.all, "chain", stableStringify(filter)] as const,

  address: (address: string) => [...QueryKeys.all, "address", address] as const,

  positions: (
    address: string,
    filter?: Record<string, unknown>,
    search?: Record<string, unknown>,
    history?: Record<string, unknown>,
    action?: Record<string, unknown>,
    sort?: Record<string, unknown>,
    limit?: Record<string, unknown>,
  ) =>
    [
      ...QueryKeys.all,
      "positions",
      address,
      stableStringify(filter),
      stableStringify(search),
      stableStringify(history),
      stableStringify(action),
      stableStringify(sort),
      stableStringify(limit),
    ] as const,

  context: (
    address: string,
    filter?: Record<string, unknown>,
    search?: Record<string, unknown>,
    intent?: string,
    draft?: Record<string, unknown>,
  ) =>
    [
      ...QueryKeys.all,
      "context",
      address,
      stableStringify(filter),
      stableStringify(search),
      intent ?? "",
      stableStringify(draft),
    ] as const,

  contextOptions: (
    address: string,
    filter?: Record<string, unknown>,
    input?: number,
    selections?: Record<string, unknown>,
    search?: Record<string, unknown>,
    intent?: string,
  ) =>
    [
      ...QueryKeys.all,
      "context-options",
      address,
      stableStringify(filter),
      input ?? -1,
      stableStringify(selections),
      stableStringify(search),
      intent ?? "",
    ] as const,

  activity: (
    address: string,
    filter?: Record<string, unknown>,
    limit?: Record<string, unknown>,
  ) =>
    [
      ...QueryKeys.all,
      "activity",
      address,
      stableStringify(filter),
      stableStringify(limit),
    ] as const,

  transactions: (address: string, filter?: Record<string, unknown>) =>
    [
      ...QueryKeys.all,
      "transactions",
      address,
      stableStringify(filter),
    ] as const,

  compile: (input?: Record<string, unknown>) =>
    [...QueryKeys.all, "compile", stableStringify(input)] as const,

  series: (
    address: string,
    filter?: Record<string, unknown>,
    time?: Record<string, unknown>,
    sort?: Record<string, unknown>,
    limit?: Record<string, unknown>,
  ) =>
    [
      ...QueryKeys.all,
      "series",
      address,
      stableStringify(filter),
      stableStringify(time),
      stableStringify(sort),
      stableStringify(limit),
    ] as const,

  color: (url: string) => [...QueryKeys.all, "_color", url] as const,
} as const;

export const createConfig = (
  userConfig?: Partial<PlugSDKConfig>,
): ResolvedPlugSDKConfig => {
  const defined = userConfig
    ? Object.fromEntries(
        Object.entries(userConfig).filter(([, v]) => v !== undefined),
      )
    : {};

  return {
    ...DEFAULT_SDK_CONFIG,
    ...defined,
    cache: {
      ...DEFAULT_SDK_CONFIG.cache,
      ...userConfig?.cache,
    },
    auth: userConfig?.auth,
  };
};
