// @vitest-environment jsdom

import React from "react";
import { QueryClient } from "@tanstack/react-query";
import { act, render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PlugSession } from "../../auth/session";
import { memorySessionStore, type SessionStore } from "../../auth/store";
import type { PlugClient } from "../../client";
import { PlugSDKProvider } from "../../provider";
import {
  usePlugAuth,
  type UsePlugAuthOptions,
  type UsePlugAuthResult,
} from "./usePlugAuth";

const ADDRESS = "0x1111111111111111111111111111111111111111";

const NONCE = { data: { nonce: "nonce-1", expires_at: "2026-08-19T13:00:00Z" } };

const tokens = (suffix: string) => ({
  data: {
    access_token: `access-${suffix}`,
    refresh_token: `refresh-${suffix}`,
    expires_in: 3600,
  },
});

const stubClient = (overrides: Partial<PlugClient> = {}): PlugClient =>
  ({
    getNonce: vi.fn(async () => NONCE),
    verify: vi.fn(async () => tokens("initial")),
    refresh: vi.fn(async () => tokens("rotated")),
    ...overrides,
  }) as unknown as PlugClient;

const renderAuth = (
  session: PlugSession | undefined,
  options: UsePlugAuthOptions = {},
) => {
  const seen: UsePlugAuthResult[] = [];

  const Probe = () => {
    seen.push(usePlugAuth(options));
    return null;
  };

  render(
    <PlugSDKProvider
      session={session}
      config={{ baseUrl: "https://api.plug.test" }}
      queryClient={new QueryClient()}
    >
      <Probe />
    </PlugSDKProvider>,
  );

  return {
    get current() {
      return seen[seen.length - 1];
    },
  };
};

describe("usePlugAuth", () => {
  let store: SessionStore;
  let session: PlugSession;

  beforeEach(() => {
    store = memorySessionStore();
    session = new PlugSession({ client: stubClient(), store });
  });

  it("reports signed out before anyone signs in", () => {
    const auth = renderAuth(session, { address: ADDRESS });

    expect(auth.current.authenticated).toBe(false);
    expect(auth.current.session).toBeNull();
    expect(auth.current.authenticating).toBe(false);
  });

  it("signs in and reports the session", async () => {
    const signMessage = vi.fn(async (_message: string) => "0xsignature");
    const auth = renderAuth(session, {
      address: ADDRESS,
      signMessage,
      statement: (address) => `Access as ${address}.`,
    });

    await act(async () => {
      await auth.current.signIn();
    });

    expect(signMessage).toHaveBeenCalledTimes(1);
    expect(signMessage.mock.calls[0][0]).toContain("Access as");
    await waitFor(() => expect(auth.current.authenticated).toBe(true));
    expect(auth.current.session?.accessToken).toBe("access-initial");
    expect(auth.current.authenticating).toBe(false);
  });

  it("re-renders when the session is cleared out from under it", async () => {
    const signMessage = vi.fn(async (_message: string) => "0xsignature");
    const auth = renderAuth(session, { address: ADDRESS, signMessage });

    await act(async () => {
      await auth.current.signIn();
    });
    await waitFor(() => expect(auth.current.authenticated).toBe(true));

    await act(async () => {
      await session.signOut(ADDRESS);
    });

    await waitFor(() => expect(auth.current.authenticated).toBe(false));
    expect(auth.current.session).toBeNull();
  });

  it("refuses to sign in without a way to sign", async () => {
    const auth = renderAuth(session, { address: ADDRESS });

    await expect(auth.current.signIn()).rejects.toThrow(/signMessage/);
  });

  it("refuses to sign in with no address anywhere", async () => {
    const auth = renderAuth(session, {
      signMessage: async () => "0xsignature",
    });

    await expect(auth.current.signIn()).rejects.toThrow(/address/);
  });

  it("refuses to sign in when the provider carries no session", async () => {
    const auth = renderAuth(undefined, {
      address: ADDRESS,
      signMessage: async () => "0xsignature",
    });

    await expect(auth.current.signIn()).rejects.toThrow(/session/);
  });
});
