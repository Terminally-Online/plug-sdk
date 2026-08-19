import { describe, expect, it, vi, afterEach } from "vitest";

import { PlugClient } from "../client";

const BASE_URL = "https://api.plug.test";

const client = () => new PlugClient({ baseUrl: BASE_URL, retries: 0 });

const captureUrl = () => {
  const fetchMock = vi.fn(
    async (_input: RequestInfo | URL, _init?: RequestInit) =>
      new Response(JSON.stringify({ data: null }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
};

afterEach(() => vi.unstubAllGlobals());

describe("PlugClient.call", () => {
  it("resolves a rooted path against the configured base url", async () => {
    const fetchMock = captureUrl();
    await client().call({ method: "GET", path: "/chain" });

    expect(fetchMock.mock.calls[0][0]).toBe(`${BASE_URL}/chain`);
  });

  it("encodes nested query objects the way the API reads them", async () => {
    const fetchMock = captureUrl();
    await client().call({
      method: "PUT",
      path: "/address/0xabc/",
      query: { filter: { chain_id: [1, 8453] }, limit: { count: 25 } },
    });

    const url = new URL(fetchMock.mock.calls[0][0] as string);
    expect(url.searchParams.get("filter[chain_id][0]")).toBe("1");
    expect(url.searchParams.get("filter[chain_id][1]")).toBe("8453");
    expect(url.searchParams.get("limit[count]")).toBe("25");
  });

  it("merges a query object into a query string the path already carries", async () => {
    const fetchMock = captureUrl();
    await client().call({
      method: "GET",
      path: "/address/0xabc/activity?filter[chain_id]=1",
      query: { limit: { count: 5 } },
    });

    const url = new URL(fetchMock.mock.calls[0][0] as string);
    expect(url.pathname).toBe("/address/0xabc/activity");
    expect(url.searchParams.get("filter[chain_id]")).toBe("1");
    expect(url.searchParams.get("limit[count]")).toBe("5");
  });

  it("refuses to leave the configured host", async () => {
    const fetchMock = captureUrl();

    for (const path of [
      "https://evil.test/steal",
      "//evil.test/steal",
      "/../../evil",
      "/address/../../evil",
      "evil.test/steal",
    ]) {
      await expect(client().call({ method: "GET", path })).rejects.toThrow();
    }

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends a body only when one is given", async () => {
    const fetchMock = captureUrl();
    await client().call({ method: "GET", path: "/chain" });
    expect((fetchMock.mock.calls[0][1] as RequestInit).body).toBeUndefined();

    await client().call({ method: "POST", path: "/address/0xabc/", body: { a: 1 } });
    expect((fetchMock.mock.calls[1][1] as RequestInit).body).toBe('{"a":1}');
  });
});
