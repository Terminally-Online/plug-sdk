import { useQuery } from "@tanstack/react-query";

import { QueryKeys } from "@/src/config";
import { usePlugContext } from "@/src/provider";
import { base64UrlEncode } from "@/src/lib/functions/encoding";

export const DEFAULT_COLOR = "#E9EEE5";
export const DEFAULT_TEXT_COLOR = "#000000";

export interface UseColorOptions {
  enabled?: boolean;
}

function toAbsolute(url: string): string {
  if (
    url.startsWith("http") ||
    url.startsWith("data:") ||
    url.includes("/cdn/")
  )
    return url;
  if (typeof window !== "undefined") return `${window.location.origin}${url}`;
  return url;
}

function toCdnPath(url: string): string {
  const absolute = toAbsolute(url);
  if (absolute.includes("/cdn/")) return absolute;
  return `/cdn/${base64UrlEncode(absolute)}`;
}

export function useColor(
  url: string | undefined,
  options: UseColorOptions = {},
) {
  const { client } = usePlugContext();
  const { enabled = true } = options;

  const cdnUrl = url ? toCdnPath(url) : undefined;

  const result = useQuery({
    queryKey: QueryKeys.color(url || ""),
    queryFn: () => client.getColor({ url: cdnUrl! }),
    enabled: enabled && !!cdnUrl,
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
  });

  return {
    ...result.data,
    isLoading: result.isLoading,
    error: result.error,
    refetch: result.refetch,
  };
}
