"use client";

import { useCallback, useEffect, useState } from "react";

import type { StoredSession } from "../../auth/store";
import { usePlugContext } from "../../provider";
import { PlugSDKError } from "../../types";

export interface UsePlugAuthOptions {
  /** Defaults to the session's active address. */
  address?: string;
  /**
   * Signs the SIWE message. Required to call `signIn`, and passed here rather
   * than to the provider because it usually comes from a hook whose identity
   * changes — the provider config must keep one identity for the app's life.
   */
  signMessage?: (message: string) => Promise<string>;
  statement?: string | ((address: string) => string);
  chainId?: number;
}

export interface UsePlugAuthResult {
  address: string | null;
  session: StoredSession | null;
  authenticated: boolean;
  authenticating: boolean;
  signIn: () => Promise<StoredSession>;
  signOut: () => Promise<void>;
}

/**
 * Reads and drives the session held by `PlugSDKProvider`.
 *
 * Re-renders whenever the session changes, including when another tab rotates
 * or clears it, so two windows of the same app never disagree about who is
 * signed in.
 */
export const usePlugAuth = (
  options: UsePlugAuthOptions = {},
): UsePlugAuthResult => {
  const { session: plugSession } = usePlugContext();
  const { address: requested, signMessage, statement, chainId } = options;

  const [session, setSession] = useState<StoredSession | null>(null);
  const [activeAddress, setActiveAddress] = useState<string | null>(null);
  const [authenticating, setAuthenticating] = useState(false);

  useEffect(() => {
    if (!plugSession) return;

    let cancelled = false;
    const sync = () => {
      setActiveAddress(plugSession.getActiveAddress());
      void plugSession.getSession(requested).then((next) => {
        if (!cancelled) setSession(next);
      });
    };

    sync();
    const unsubscribe = plugSession.subscribe(sync);
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [plugSession, requested]);

  const address = requested ?? activeAddress;

  const signIn = useCallback(async () => {
    if (!plugSession) {
      throw new PlugSDKError(
        "usePlugAuth needs a session passed to PlugSDKProvider",
        "SESSION_MISSING",
      );
    }
    if (!signMessage) {
      throw new PlugSDKError(
        "usePlugAuth needs signMessage to sign in",
        "SIGN_MESSAGE_MISSING",
      );
    }

    const target = requested ?? plugSession.getActiveAddress();
    if (!target) {
      throw new PlugSDKError(
        "usePlugAuth has no address to sign in",
        "ADDRESS_MISSING",
      );
    }

    setAuthenticating(true);
    try {
      const next = await plugSession.signIn({
        address: target,
        signMessage,
        statement:
          typeof statement === "function" ? statement(target) : statement,
        chainId,
      });
      setSession(next);
      return next;
    } finally {
      setAuthenticating(false);
    }
  }, [plugSession, requested, signMessage, statement, chainId]);

  const signOut = useCallback(async () => {
    if (!plugSession) return;
    await plugSession.signOut(requested);
    setSession(null);
  }, [plugSession, requested]);

  const authenticated =
    session !== null &&
    address !== null &&
    session.address === address.toLowerCase() &&
    Date.now() < session.refreshExpiresAt;

  return {
    address,
    session,
    authenticated,
    authenticating,
    signIn,
    signOut,
  };
};
