"use client";

import React, { createContext, useContext, useMemo } from "react";
import {
  QueryClient,
  QueryClientProvider,
  useQueryClient,
} from "@tanstack/react-query";

import { PlugClient } from "./client";
import { createConfig } from "./config";
import type { PlugSDKConfig, ResolvedPlugSDKConfig } from "./types";

interface PlugSDKContextValue {
  client: PlugClient;
  config: ResolvedPlugSDKConfig;
}

const PlugSDKContext = createContext<PlugSDKContextValue | null>(null);

interface PlugSDKProviderProps {
  children: React.ReactNode;
  config?: Partial<PlugSDKConfig>;
  queryClient?: QueryClient;
}

const createPlugQueryClient = (
  sdkConfig: ResolvedPlugSDKConfig,
): QueryClient => {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: sdkConfig.cache.staleTime,
        gcTime: sdkConfig.cache.gcTime,
        retry: (failureCount, error) => {
          if (
            error?.message?.includes("validation") ||
            error?.message?.includes("Invalid")
          ) {
            return false;
          }
          return failureCount < sdkConfig.retries;
        },
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
        refetchOnWindowFocus: false,
        refetchOnMount: true,
        refetchOnReconnect: true,
      },
      mutations: {
        retry: sdkConfig.retries,
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      },
    },
  });
};

export const PlugSDKProvider: React.FC<PlugSDKProviderProps> = ({
  children,
  config,
  queryClient: userQueryClient,
}) => {
  const sdk = useMemo(() => createConfig(config), [config]);

  const client = useMemo(() => new PlugClient(sdk), [sdk]);

  const queryClient = useMemo(() => {
    return userQueryClient || createPlugQueryClient(sdk);
  }, [userQueryClient, sdk]);

  const contextValue = useMemo(
    () => ({
      client,
      config: sdk,
    }),
    [client, sdk],
  );

  return (
    <PlugSDKContext.Provider value={contextValue}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </PlugSDKContext.Provider>
  );
};

export const usePlugContext = (): PlugSDKContextValue => {
  const context = useContext(PlugSDKContext);

  if (!context) {
    throw new Error("usePlugContext must be used within a PlugSDKProvider");
  }

  return context;
};

export const usePlugQueryClient = (): QueryClient => {
  return useQueryClient();
};

export const withPlug = <P extends object>(
  Component: React.ComponentType<P>,
  config?: Partial<PlugSDKConfig>,
) => {
  const WrappedComponent: React.FC<P> = (props) => (
    <PlugSDKProvider config={config}>
      <Component {...props} />
    </PlugSDKProvider>
  );

  WrappedComponent.displayName = `withPlug(${Component.displayName || Component.name})`;

  return WrappedComponent;
};
