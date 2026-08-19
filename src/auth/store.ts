import { z } from "zod";

export const StoredSessionSchema = z.object({
  address: z.string(),
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresAt: z.number(),
  refreshExpiresAt: z.number(),
});

export type StoredSession = z.infer<typeof StoredSessionSchema>;

const SessionRecordSchema = z.record(z.string(), StoredSessionSchema);

export interface SessionStore {
  read(address: string): StoredSession | null | Promise<StoredSession | null>;
  write(session: StoredSession): void | Promise<void>;
  clear(address?: string): void | Promise<void>;
  subscribe?(listener: () => void): () => void;
}

const normalize = (address: string): string => address.toLowerCase();

/**
 * In-process session storage. Sessions live for the lifetime of the process
 * and are never persisted — the correct choice on the server and in tests.
 */
export const memorySessionStore = (): SessionStore => {
  const sessions = new Map<string, StoredSession>();
  const listeners = new Set<() => void>();

  const announce = () => {
    for (const listener of listeners) listener();
  };

  return {
    read: (address) => sessions.get(normalize(address)) ?? null,
    write: (session) => {
      sessions.set(normalize(session.address), session);
      announce();
    },
    clear: (address) => {
      if (address === undefined) sessions.clear();
      else sessions.delete(normalize(address));
      announce();
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
};

export interface BrowserSessionStoreOptions {
  /** localStorage key holding the address-keyed session record. */
  key?: string;
}

/**
 * localStorage-backed session storage, keyed by address so one browser can
 * hold sessions for several wallets at once.
 *
 * Subscribers are notified for writes in this tab *and* in every other tab on
 * the origin: sessions rotate, and a tab acting on a session another tab has
 * already rotated away will be rejected as a replay.
 */
export const browserSessionStore = (
  options: BrowserSessionStoreOptions = {},
): SessionStore => {
  const key = options.key ?? "plug.session";
  const listeners = new Set<() => void>();

  const announce = () => {
    for (const listener of listeners) listener();
  };

  const load = (): Record<string, StoredSession> => {
    if (typeof localStorage === "undefined") return {};
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return {};
      const parsed = SessionRecordSchema.safeParse(JSON.parse(raw));
      if (!parsed.success) return {};
      const now = Date.now();
      const live: Record<string, StoredSession> = {};
      for (const [address, session] of Object.entries(parsed.data)) {
        if (now < session.refreshExpiresAt) live[address] = session;
      }
      return live;
    } catch {
      return {};
    }
  };

  const persist = (sessions: Record<string, StoredSession>) => {
    if (typeof localStorage === "undefined") return;
    try {
      if (Object.keys(sessions).length) {
        localStorage.setItem(key, JSON.stringify(sessions));
      } else {
        localStorage.removeItem(key);
      }
    } catch {}
  };

  return {
    read: (address) => load()[normalize(address)] ?? null,
    write: (session) => {
      const sessions = load();
      sessions[normalize(session.address)] = {
        ...session,
        address: normalize(session.address),
      };
      persist(sessions);
      announce();
    },
    clear: (address) => {
      if (address === undefined) {
        persist({});
        announce();
        return;
      }
      const sessions = load();
      if (!(normalize(address) in sessions)) return;
      delete sessions[normalize(address)];
      persist(sessions);
      announce();
    },
    subscribe: (listener) => {
      listeners.add(listener);

      const onStorage = (event: StorageEvent) => {
        if (event.key === null || event.key === key) listener();
      };
      if (typeof window !== "undefined") {
        window.addEventListener("storage", onStorage);
      }

      return () => {
        listeners.delete(listener);
        if (typeof window !== "undefined") {
          window.removeEventListener("storage", onStorage);
        }
      };
    },
  };
};
