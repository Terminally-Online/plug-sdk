import type { PlugSDKConfig, ResolvedPlugSDKConfig, CacheConfig } from "./types";

const minute = 60 * 1000;

export const DEFAULT_SDK_CONFIG: ResolvedPlugSDKConfig = {
  baseUrl: "https://api.plug.to",
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
  ) =>
    [
      ...QueryKeys.all,
      "context",
      address,
      stableStringify(filter),
      stableStringify(search),
    ] as const,

  transactions: (address: string, filter?: Record<string, unknown>) =>
    [
      ...QueryKeys.all,
      "transactions",
      address,
      stableStringify(filter),
    ] as const,

  compile: (address: string, input?: Record<string, unknown>) =>
    [...QueryKeys.all, "compile", address, stableStringify(input)] as const,

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
  return {
    ...DEFAULT_SDK_CONFIG,
    ...userConfig,
    cache: {
      ...DEFAULT_SDK_CONFIG.cache,
      ...userConfig?.cache,
    },
    auth: userConfig?.auth,
  };
};
