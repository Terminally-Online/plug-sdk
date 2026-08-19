import { PlugClient } from "../client";
import { PlugNetworkError } from "../types";
import type { PlugAuthConfig } from "../types";
import { memorySessionStore, type SessionStore, type StoredSession } from "./store";

const DAY = 24 * 60 * 60 * 1000;

export interface PlugSessionOptions {
  /** Base URL of the Gusher instance. Ignored when `client` is supplied. */
  baseUrl?: string;
  /**
   * Client used for the unauthenticated auth endpoints. Defaults to a bare
   * client; never pass an authenticated one, which would make refresh
   * re-enter itself.
   */
  client?: PlugClient;
  /** Defaults to `memorySessionStore()`. Browsers want `browserSessionStore()`. */
  store?: SessionStore;
  /** Refresh this long before the access token expires. Defaults to 60s. */
  refreshSkewMs?: number;
  /** Assumed refresh token lifetime. Defaults to 30 days. */
  refreshWindowMs?: number;
}

export interface AuthenticateParams {
  address: string;
  message: string;
  signature: string;
}

/**
 * Owns the access/refresh token lifecycle: persistence, proactive rotation,
 * and eviction. Supply `toAuthConfig()` to the SDK config and the client will
 * authenticate every request without further wiring.
 */
export class PlugSession {
  private readonly client: PlugClient;
  private readonly store: SessionStore;
  private readonly refreshSkewMs: number;
  private readonly refreshWindowMs: number;
  private readonly inFlight = new Map<string, Promise<StoredSession | null>>();
  private readonly listeners = new Set<() => void>();
  private activeAddress: string | null = null;

  constructor(options: PlugSessionOptions = {}) {
    this.client =
      options.client ??
      new PlugClient(options.baseUrl ? { baseUrl: options.baseUrl } : undefined);
    this.store = options.store ?? memorySessionStore();
    this.refreshSkewMs = options.refreshSkewMs ?? 60_000;
    this.refreshWindowMs = options.refreshWindowMs ?? 30 * DAY;
  }

  private announce(): void {
    for (const listener of this.listeners) listener();
  }

  private resolveAddress(address?: string): string | null {
    const resolved = address ?? this.activeAddress;
    return resolved ? resolved.toLowerCase() : null;
  }

  private toSession(
    address: string,
    tokens: { access_token: string; refresh_token: string; expires_in: number },
  ): StoredSession {
    return {
      address: address.toLowerCase(),
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: Date.now() + tokens.expires_in * 1000,
      refreshExpiresAt: Date.now() + this.refreshWindowMs,
    };
  }

  setActiveAddress(address: string | null): void {
    this.activeAddress = address ? address.toLowerCase() : null;
    this.announce();
  }

  getActiveAddress(): string | null {
    return this.activeAddress;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    const unsubscribeStore = this.store.subscribe?.(listener);
    return () => {
      this.listeners.delete(listener);
      unsubscribeStore?.();
    };
  }

  async getSession(address?: string): Promise<StoredSession | null> {
    const resolved = this.resolveAddress(address);
    if (!resolved) return null;
    return (await this.store.read(resolved)) ?? null;
  }

  /** Exchanges a signed SIWE message for a token pair and persists it. */
  async authenticate(params: AuthenticateParams): Promise<StoredSession> {
    const response = await this.client.verify({
      message: params.message,
      signature: params.signature,
    });
    const session = this.toSession(params.address, response.data);
    await this.store.write(session);
    this.activeAddress = session.address;
    this.announce();
    return session;
  }

  async signOut(address?: string): Promise<void> {
    if (address === undefined && this.activeAddress === null) {
      await this.store.clear();
      this.announce();
      return;
    }
    const resolved = this.resolveAddress(address);
    if (!resolved) return;
    await this.store.clear(resolved);
    if (this.activeAddress === resolved) this.activeAddress = null;
    this.announce();
  }

  /**
   * Rotates the token pair.
   *
   * Gusher issues refresh tokens one-time-use with replay detection, so a
   * token presented twice revokes the session outright. Two callers racing the
   * same token is therefore not a wasted request but a sign-out. This
   * serializes on the address across every tab on the origin (`navigator.locks`,
   * falling back to an in-process map) and re-reads the store once the lock is
   * held, so a caller that queued behind another tab's rotation returns that
   * tab's result instead of replaying a token that is already spent.
   */
  async refresh(address?: string): Promise<StoredSession | null> {
    const resolved = this.resolveAddress(address);
    if (!resolved) return null;

    const pending = this.inFlight.get(resolved);
    if (pending) return pending;

    const attempt = this.withLock(resolved, () => this.rotate(resolved)).finally(
      () => {
        this.inFlight.delete(resolved);
      },
    );

    this.inFlight.set(resolved, attempt);
    return attempt;
  }

  private async withLock<T>(address: string, run: () => Promise<T>): Promise<T> {
    const locks =
      typeof navigator !== "undefined" ? navigator.locks : undefined;
    if (!locks) return run();
    return locks.request(`plug.session.refresh:${address}`, run) as Promise<T>;
  }

  private async rotate(address: string): Promise<StoredSession | null> {
    const session = await this.store.read(address);
    if (!session) return null;

    if (Date.now() < session.expiresAt - this.refreshSkewMs) return session;

    try {
      const response = await this.client.refresh({
        refresh_token: session.refreshToken,
      });
      const next = this.toSession(address, response.data);
      await this.store.write(next);
      this.announce();
      return next;
    } catch (error) {
      const status =
        error instanceof PlugNetworkError ? error.statusCode : undefined;
      if (status !== undefined && status >= 400 && status < 500) {
        await this.store.clear(address);
        this.announce();
      }
      return null;
    }
  }

  /** Returns a live access token, rotating first when one is about to expire. */
  async getAccessToken(address?: string): Promise<string | null> {
    const resolved = this.resolveAddress(address);
    if (!resolved) return null;

    const session = await this.store.read(resolved);
    if (!session) return null;
    if (Date.now() < session.expiresAt - this.refreshSkewMs) {
      return session.accessToken;
    }

    const rotated = await this.refresh(resolved);
    return rotated?.accessToken ?? null;
  }

  /** Wiring for `PlugSDKConfig.auth`. */
  toAuthConfig(): PlugAuthConfig {
    return {
      getAccessToken: () => this.getAccessToken(),
      onTokenExpired: async () => {
        const rotated = await this.refresh();
        return rotated?.accessToken ?? null;
      },
    };
  }
}
