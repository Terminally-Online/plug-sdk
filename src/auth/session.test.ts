import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PlugClient } from "../client";
import { PlugNetworkError } from "../types";
import { PlugSession } from "./session";
import { memorySessionStore, type SessionStore, type StoredSession } from "./store";

const ADDRESS = "0x1111111111111111111111111111111111111111";

const tokens = (suffix: string, expiresIn = 3600) => ({
  data: {
    access_token: `access-${suffix}`,
    refresh_token: `refresh-${suffix}`,
    expires_in: expiresIn,
  },
});

const stubClient = (overrides: Partial<PlugClient>): PlugClient =>
  ({
    verify: vi.fn(async () => tokens("initial")),
    refresh: vi.fn(async () => tokens("rotated")),
    ...overrides,
  }) as unknown as PlugClient;

const seed = async (
  store: SessionStore,
  session: Partial<StoredSession> = {},
): Promise<void> => {
  await store.write({
    address: ADDRESS.toLowerCase(),
    accessToken: "access-initial",
    refreshToken: "refresh-initial",
    expiresAt: Date.now() + 3600_000,
    refreshExpiresAt: Date.now() + 30 * 86_400_000,
    ...session,
  });
};

describe("PlugSession", () => {
  let store: SessionStore;

  beforeEach(() => {
    store = memorySessionStore();
  });

  it("exchanges a signature for a persisted session", async () => {
    const client = stubClient({});
    const session = new PlugSession({ client, store });

    const result = await session.authenticate({
      address: ADDRESS,
      message: "message",
      signature: "0xsig",
    });

    expect(result.accessToken).toBe("access-initial");
    expect(result.address).toBe(ADDRESS.toLowerCase());
    expect(session.getActiveAddress()).toBe(ADDRESS.toLowerCase());
    expect(await store.read(ADDRESS)).toMatchObject({
      accessToken: "access-initial",
    });
  });

  it("returns the stored token while it is still fresh", async () => {
    const refresh = vi.fn(async () => tokens("rotated"));
    const session = new PlugSession({ client: stubClient({ refresh }), store });
    await seed(store);
    session.setActiveAddress(ADDRESS);

    expect(await session.getAccessToken()).toBe("access-initial");
    expect(refresh).not.toHaveBeenCalled();
  });

  it("rotates proactively once the token enters the refresh skew", async () => {
    const refresh = vi.fn(async () => tokens("rotated"));
    const session = new PlugSession({
      client: stubClient({ refresh }),
      store,
      refreshSkewMs: 60_000,
    });
    await seed(store, { expiresAt: Date.now() + 30_000 });
    session.setActiveAddress(ADDRESS);

    expect(await session.getAccessToken()).toBe("access-rotated");
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(await store.read(ADDRESS)).toMatchObject({
      refreshToken: "refresh-rotated",
    });
  });

  it("collapses concurrent callers onto a single rotation", async () => {
    let resolveRefresh: (value: ReturnType<typeof tokens>) => void = () => {};
    const refresh = vi.fn(
      () =>
        new Promise<ReturnType<typeof tokens>>((resolve) => {
          resolveRefresh = resolve;
        }),
    );
    const session = new PlugSession({ client: stubClient({ refresh }), store });
    await seed(store, { expiresAt: Date.now() - 1 });
    session.setActiveAddress(ADDRESS);

    const pending = Promise.all([
      session.getAccessToken(),
      session.getAccessToken(),
      session.getAccessToken(),
      session.getAccessToken(),
    ]);

    await vi.waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
    resolveRefresh(tokens("rotated"));

    expect(await pending).toEqual([
      "access-rotated",
      "access-rotated",
      "access-rotated",
      "access-rotated",
    ]);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("presents a spent refresh token only once across sequential rotations", async () => {
    const seen: string[] = [];
    const refresh = vi.fn(async ({ refresh_token }: { refresh_token: string }) => {
      seen.push(refresh_token);
      return tokens(`rotated-${seen.length}`);
    });
    const session = new PlugSession({ client: stubClient({ refresh }), store });
    await seed(store, { expiresAt: Date.now() - 1 });
    session.setActiveAddress(ADDRESS);

    await session.refresh();
    await store.write({
      ...(await store.read(ADDRESS))!,
      expiresAt: Date.now() - 1,
    });
    await session.refresh();

    expect(seen).toEqual(["refresh-initial", "refresh-rotated-1"]);
    expect(new Set(seen).size).toBe(seen.length);
  });

  it("evicts the session when the refresh token is rejected", async () => {
    const refresh = vi.fn(async () => {
      throw new PlugNetworkError("HTTP 401", 401);
    });
    const session = new PlugSession({ client: stubClient({ refresh }), store });
    await seed(store, { expiresAt: Date.now() - 1 });
    session.setActiveAddress(ADDRESS);

    expect(await session.getAccessToken()).toBeNull();
    expect(await store.read(ADDRESS)).toBeNull();
  });

  it("keeps the session when refresh fails for a server-side reason", async () => {
    const refresh = vi.fn(async () => {
      throw new PlugNetworkError("HTTP 503", 503);
    });
    const session = new PlugSession({ client: stubClient({ refresh }), store });
    await seed(store, { expiresAt: Date.now() - 1 });
    session.setActiveAddress(ADDRESS);

    expect(await session.getAccessToken()).toBeNull();
    expect(await store.read(ADDRESS)).not.toBeNull();
  });

  it("keeps sessions for separate addresses apart", async () => {
    const other = "0x2222222222222222222222222222222222222222";
    const session = new PlugSession({ client: stubClient({}), store });
    await seed(store);
    await store.write({
      address: other.toLowerCase(),
      accessToken: "access-other",
      refreshToken: "refresh-other",
      expiresAt: Date.now() + 3600_000,
      refreshExpiresAt: Date.now() + 30 * 86_400_000,
    });

    expect(await session.getAccessToken(ADDRESS)).toBe("access-initial");
    expect(await session.getAccessToken(other)).toBe("access-other");

    await session.signOut(other);

    expect(await session.getAccessToken(ADDRESS)).toBe("access-initial");
    expect(await session.getAccessToken(other)).toBeNull();
  });

  it("exposes wiring the client can consume directly", async () => {
    const session = new PlugSession({ client: stubClient({}), store });
    await seed(store);
    session.setActiveAddress(ADDRESS);

    const auth = session.toAuthConfig();

    expect(await auth.getAccessToken()).toBe("access-initial");
    expect(await auth.onTokenExpired?.()).toBe("access-initial");
  });
});
