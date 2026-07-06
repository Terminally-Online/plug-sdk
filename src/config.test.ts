import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createConfig,
  DEFAULT_SDK_CONFIG,
  QueryKeys,
  resolveBrowserBaseUrl,
} from "./config";

describe("createConfig", () => {
  it("should return defaults when no config provided", () => {
    const config = createConfig();
    expect(config.baseUrl).toBe(DEFAULT_SDK_CONFIG.baseUrl);
    expect(config.timeout).toBe(DEFAULT_SDK_CONFIG.timeout);
    expect(config.retries).toBe(DEFAULT_SDK_CONFIG.retries);
    expect(config.cache.staleTime).toBe(DEFAULT_SDK_CONFIG.cache.staleTime);
    expect(config.cache.gcTime).toBe(DEFAULT_SDK_CONFIG.cache.gcTime);
  });

  it("should return defaults when empty object provided", () => {
    const config = createConfig({});
    expect(config.baseUrl).toBe(DEFAULT_SDK_CONFIG.baseUrl);
    expect(config.timeout).toBe(DEFAULT_SDK_CONFIG.timeout);
  });

  it("should override top-level properties", () => {
    const config = createConfig({ baseUrl: "https://custom.api", timeout: 5000 });
    expect(config.baseUrl).toBe("https://custom.api");
    expect(config.timeout).toBe(5000);
    expect(config.retries).toBe(DEFAULT_SDK_CONFIG.retries);
  });

  it("should deep merge cache config", () => {
    const config = createConfig({ cache: { staleTime: 1000 } });
    expect(config.cache.staleTime).toBe(1000);
    expect(config.cache.gcTime).toBe(DEFAULT_SDK_CONFIG.cache.gcTime);
  });

  it("should allow overriding both cache properties", () => {
    const config = createConfig({ cache: { staleTime: 1000, gcTime: 2000 } });
    expect(config.cache.staleTime).toBe(1000);
    expect(config.cache.gcTime).toBe(2000);
  });

  it("should override callbacks", () => {
    const onError = () => {};
    const config = createConfig({ onError });
    expect(config.onError).toBe(onError);
    expect(config.onSuccess).toBe(DEFAULT_SDK_CONFIG.onSuccess);
  });
});

describe("resolveBrowserBaseUrl", () => {
  const stubWindow = (hostname: string) => {
    vi.stubGlobal("window", { location: { hostname } });
  };

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("should pass through server-side", () => {
    expect(resolveBrowserBaseUrl("http://localhost:8080")).toBe(
      "http://localhost:8080",
    );
  });

  it("should pass through non-loopback baseUrls", () => {
    stubWindow("peepaw-mbp.tailnet.ts.net");
    expect(resolveBrowserBaseUrl("https://api.plug.to")).toBe(
      "https://api.plug.to",
    );
  });

  it("should pass through when the page itself is on loopback", () => {
    stubWindow("localhost");
    expect(resolveBrowserBaseUrl("http://localhost:8080")).toBe(
      "http://localhost:8080",
    );
  });

  it("should remap loopback baseUrl to the page hostname", () => {
    stubWindow("peepaw-mbp.tailnet.ts.net");
    expect(resolveBrowserBaseUrl("http://localhost:8080")).toBe(
      "http://peepaw-mbp.tailnet.ts.net:8080",
    );
  });

  it("should remap 127.0.0.1 and preserve the port", () => {
    stubWindow("100.64.0.7");
    expect(resolveBrowserBaseUrl("http://127.0.0.1:8080")).toBe(
      "http://100.64.0.7:8080",
    );
  });

  it("should pass through invalid URLs", () => {
    stubWindow("peepaw-mbp.tailnet.ts.net");
    expect(resolveBrowserBaseUrl("not-a-url")).toBe("not-a-url");
  });

  it("should apply inside createConfig", () => {
    stubWindow("peepaw-mbp.tailnet.ts.net");
    const config = createConfig({ baseUrl: "http://localhost:8080" });
    expect(config.baseUrl).toBe("http://peepaw-mbp.tailnet.ts.net:8080");
  });
});

describe("QueryKeys", () => {
  it("should produce stable base key", () => {
    expect(QueryKeys.all).toEqual(["plug"]);
  });

  it("should produce chain key with filter", () => {
    const key = QueryKeys.chain({ chain_id: 1 });
    expect(key[0]).toBe("plug");
    expect(key[1]).toBe("chain");
    expect(key[2]).toBe(JSON.stringify({ chain_id: 1 }));
  });

  it("should produce chain key without filter", () => {
    const key = QueryKeys.chain();
    expect(key[2]).toBeUndefined();
  });

  it("should produce address key", () => {
    const key = QueryKeys.address("0xabc");
    expect(key).toEqual(["plug", "address", "0xabc"]);
  });

  it("should produce stable keys for identical inputs", () => {
    const a = QueryKeys.context("0xabc", { chain_id: 1 });
    const b = QueryKeys.context("0xabc", { chain_id: 1 });
    expect(a).toEqual(b);
  });

  it("should produce different keys for different inputs", () => {
    const a = QueryKeys.context("0xabc", { chain_id: 1 });
    const b = QueryKeys.context("0xabc", { chain_id: 10 });
    expect(a).not.toEqual(b);
  });

  it("should handle undefined optional params in positions", () => {
    const key = QueryKeys.positions("0xabc");
    expect(key[0]).toBe("plug");
    expect(key[1]).toBe("positions");
    expect(key[2]).toBe("0xabc");
    expect(key[3]).toBeUndefined();
  });
});
