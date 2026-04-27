import { QueryClient } from "@tanstack/react-query";
import { PlugClient } from "./client";
import { QueryKeys } from "./config";
import { PositionsQueryParams } from "./lib/schemas/address";
import { ContextQueryParams } from "./lib/schemas/context";
import { GetActivityQueryParams } from "./lib/schemas/activity";
import { GetTransactionsQueryParams } from "./lib/schemas/transaction";
import { ChainQueryParams } from "./lib/schemas/chain";

export interface PrefetchOptions {
  client: PlugClient;
  queryClient: QueryClient;
}

export const address = async (
  { client, queryClient }: PrefetchOptions,
  address: string,
) => {
  return queryClient.prefetchQuery({
    queryKey: QueryKeys.address(address),
    queryFn: () => client.getAddress({ address }),
  });
};

export const positions = async (
  { client, queryClient }: PrefetchOptions,
  address: string,
  options?: {
    filter?: PositionsQueryParams["filter"];
    search?: PositionsQueryParams["search"];
    history?: PositionsQueryParams["history"];
    action?: PositionsQueryParams["action"];
    sort?: PositionsQueryParams["sort"];
    limit?: PositionsQueryParams["limit"];
  },
) => {
  return queryClient.prefetchQuery({
    queryKey: QueryKeys.positions(
      address,
      options?.filter,
      options?.search,
      options?.history,
      options?.action,
      options?.sort,
      options?.limit,
    ),
    queryFn: () =>
      client.getPositions({
        address,
        filter: options?.filter,
        search: options?.search,
        history: options?.history,
        action: options?.action,
        sort: options?.sort,
        limit: options?.limit,
      }),
  });
};

export const context = async (
  { client, queryClient }: PrefetchOptions,
  address: string,
  options?: {
    filter?: ContextQueryParams["filter"];
    search?: ContextQueryParams["search"];
  },
) => {
  return queryClient.prefetchQuery({
    queryKey: QueryKeys.context(address, options?.filter, options?.search),
    queryFn: () =>
      client.getContext({
        address,
        filter: options?.filter,
        search: options?.search,
      }),
  });
};

export const activity = async (
  { client, queryClient }: PrefetchOptions,
  address: string,
  options?: {
    filter?: GetActivityQueryParams["filter"];
    limit?: GetActivityQueryParams["limit"];
  },
) => {
  return queryClient.prefetchQuery({
    queryKey: QueryKeys.activity(address, options?.filter, options?.limit),
    queryFn: () =>
      client.getActivity({
        address,
        filter: options?.filter,
        limit: options?.limit,
      }),
  });
};

export const transactions = async (
  { client, queryClient }: PrefetchOptions,
  address: string,
  options?: { filter?: GetTransactionsQueryParams["filter"] },
) => {
  return queryClient.prefetchQuery({
    queryKey: QueryKeys.transactions(address, options?.filter),
    queryFn: () => client.getTransactions({ address, filter: options?.filter }),
  });
};

export const chain = async (
  { client, queryClient }: PrefetchOptions,
  options?: { filter?: ChainQueryParams["filter"] },
) => {
  return queryClient.prefetchQuery({
    queryKey: QueryKeys.chain(options?.filter),
    queryFn: () => client.getChain({ filter: options?.filter } as any),
  });
};
