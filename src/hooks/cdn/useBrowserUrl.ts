import { useSyncExternalStore } from "react";

import { resolveBrowserBaseUrl } from "../../config";

const emptySubscribe = () => () => {};

/**
 * Hydration-safe variant of resolveBrowserBaseUrl. Server render and the
 * initial hydration pass return the URL untouched so the client markup
 * matches the server's; after hydration the loopback remap applies and the
 * component re-renders with the resolved URL. Required because React ignores
 * attribute mismatches during hydration — a plain resolveBrowserBaseUrl call
 * in render leaves the server's loopback URL in the DOM.
 */
export function useBrowserUrl(url: string): string;
export function useBrowserUrl(url?: string): string | undefined;
export function useBrowserUrl(url?: string): string | undefined {
  return useSyncExternalStore(
    emptySubscribe,
    () => (url === undefined ? undefined : resolveBrowserBaseUrl(url)),
    () => url,
  );
}
