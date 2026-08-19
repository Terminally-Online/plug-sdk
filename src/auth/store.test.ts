import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { browserSessionStore, memorySessionStore, type StoredSession } from "./store";

const ADDRESS = "0x1111111111111111111111111111111111111111";

const session = (overrides: Partial<StoredSession> = {}): StoredSession => ({
  address: ADDRESS.toLowerCase(),
  accessToken: "access",
  refreshToken: "refresh",
  expiresAt: Date.now() + 3600_000,
  refreshExpiresAt: Date.now() + 30 * 86_400_000,
  ...overrides,
});

const installLocalStorage = () => {
  const backing = new Map<string, string>();
  const storage = {
    getItem: (key: string) => backing.get(key) ?? null,
    setItem: (key: string, value: string) => void backing.set(key, value),
    removeItem: (key: string) => void backing.delete(key),
  };
  vi.stubGlobal("localStorage", storage);
  return backing;
};

describe("memorySessionStore", () => {
  it("round-trips a session by address, case-insensitively", async () => {
    const store = memorySessionStore();
    await store.write(session());

    expect(await store.read(ADDRESS.toUpperCase())).toMatchObject({
      accessToken: "access",
    });
  });

  it("clears one address without disturbing the others", async () => {
    const other = "0x2222222222222222222222222222222222222222";
    const store = memorySessionStore();
    await store.write(session());
    await store.write(session({ address: other, accessToken: "other" }));

    await store.clear(ADDRESS);

    expect(await store.read(ADDRESS)).toBeNull();
    expect(await store.read(other)).toMatchObject({ accessToken: "other" });
  });

  it("notifies subscribers on write and clear", async () => {
    const store = memorySessionStore();
    const listener = vi.fn();
    const unsubscribe = store.subscribe!(listener);

    await store.write(session());
    await store.clear();
    expect(listener).toHaveBeenCalledTimes(2);

    unsubscribe();
    await store.write(session());
    expect(listener).toHaveBeenCalledTimes(2);
  });
});

describe("browserSessionStore", () => {
  let backing: Map<string, string>;

  beforeEach(() => {
    backing = installLocalStorage();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("persists sessions under the configured key", async () => {
    const store = browserSessionStore({ key: "poof.session" });
    await store.write(session());

    expect(backing.has("poof.session")).toBe(true);
    expect(await store.read(ADDRESS)).toMatchObject({ accessToken: "access" });
  });

  it("drops sessions whose refresh window has closed", async () => {
    const store = browserSessionStore();
    await store.write(session({ refreshExpiresAt: Date.now() - 1 }));

    expect(await store.read(ADDRESS)).toBeNull();
  });

  it("survives a corrupt payload rather than throwing", async () => {
    const store = browserSessionStore();
    backing.set("plug.session", "{not json");

    expect(await store.read(ADDRESS)).toBeNull();
  });

  it("discards a payload that does not match the schema", async () => {
    const store = browserSessionStore();
    backing.set("plug.session", JSON.stringify({ [ADDRESS]: { nope: true } }));

    expect(await store.read(ADDRESS)).toBeNull();
  });

  it("removes the key entirely once the last session is cleared", async () => {
    const store = browserSessionStore();
    await store.write(session());
    await store.clear(ADDRESS);

    expect(backing.has("plug.session")).toBe(false);
  });
});

describe("SyncSessionStore", () => {
  it("resolves reads without awaiting, as sendBeacon callers require", () => {
    const store = memorySessionStore();
    store.write(session());

    const read: StoredSession | null = store.read(ADDRESS);

    expect(read).not.toBeInstanceOf(Promise);
    expect(read?.accessToken).toBe("access");
  });
});
