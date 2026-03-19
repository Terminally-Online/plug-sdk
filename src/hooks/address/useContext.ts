import {
  keepPreviousData,
  QueryObserverResult,
  RefetchOptions,
  useQuery,
} from "@tanstack/react-query";

import { usePlugContext } from "@/src/provider";
import { QueryKeys } from "@/src/config";

import {
  Context,
  ContextAction,
  ContextFilter,
  ContextProtocol,
  ContextQueryParams,
  ContextResponse,
  ContextStep,
} from "@/src/lib/schemas/context";

export type UseContextOptions = Omit<ContextQueryParams, "address"> & {
  enabled?: boolean;
};

type UseContextBase = {
  isLoading: boolean;
  isFetching: boolean;
  error: Error | null;
  refetch: (
    options?: RefetchOptions,
  ) => Promise<QueryObserverResult<ContextResponse, Error>>;
};

export type UseContextActionResult = UseContextBase & {
  protocol: ContextProtocol | undefined;
  action: ContextStep | undefined;
};

export type UseContextProtocolResult = UseContextBase & {
  protocol: ContextProtocol | undefined;
  actions: Record<string, ContextStep> | undefined;
};

export type UseContextFullResult = UseContextBase & {
  protocols: Context | undefined;
  actions: ContextAction[] | undefined;
};

type FilterWithAction = {
  filter: { protocol: string; action: string } & Omit<
    ContextFilter,
    "protocol" | "action"
  >;
};

type FilterWithProtocol = {
  filter: { protocol: string } & Omit<ContextFilter, "protocol">;
};

export function useContext(
  address: string | undefined,
  options: UseContextOptions & FilterWithAction,
): UseContextActionResult;

export function useContext(
  address: string | undefined,
  options: UseContextOptions & FilterWithProtocol,
): UseContextProtocolResult;

export function useContext(
  address: string | undefined,
  options?: UseContextOptions,
): UseContextFullResult;

export function useContext(
  address: string | undefined,
  options: UseContextOptions = {},
): UseContextActionResult | UseContextProtocolResult | UseContextFullResult {
  const { client } = usePlugContext();
  const { filter, search, enabled = true } = options;

  const result = useQuery({
    queryKey: QueryKeys.context(address || "", filter, search),
    queryFn: () => client.getContext({ address: address!, filter, search }),
    enabled: enabled && !!address,
    placeholderData: search ? keepPreviousData : undefined,
  });

  const raw = result.data?.data ?? undefined;
  const base: UseContextBase = {
    isLoading: result.isLoading,
    isFetching: result.isFetching,
    error: result.error,
    refetch: result.refetch,
  };

  if (filter?.protocol && filter?.action) {
    const protocol = raw?.[filter.protocol];
    return {
      ...base,
      protocol,
      action: protocol?.actions?.[filter.action],
    };
  }

  if (filter?.protocol) {
    const protocol = raw?.[filter.protocol];
    return {
      ...base,
      protocol,
      actions: protocol?.actions,
    };
  }

  const actions = raw
    ? Object.entries(raw).flatMap(([protocolName, protocolData]) =>
        Object.entries(protocolData.actions ?? {}).map(
          ([actionName, step]) => ({
            ...step,
            protocol: protocolName,
            action: actionName,
          }),
        ),
      )
    : undefined;

  return {
    ...base,
    protocols: raw,
    actions,
  };
}
