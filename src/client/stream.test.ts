import { afterEach, describe, expect, it, vi } from "vitest";

import { StreamConnection } from "./stream";

const streamFrom = (chunks: string[]): ReadableStream<Uint8Array> => {
  const encoder = new TextEncoder();
  let i = 0;
  return new ReadableStream({
    pull(controller) {
      if (i < chunks.length) {
        controller.enqueue(encoder.encode(chunks[i++]));
      } else {
        controller.close();
      }
    },
  });
};

const sseResponse = (body: string, status = 200) =>
  ({
    ok: status >= 200 && status < 300,
    status,
    body: streamFrom([body]),
  }) as Response;

const flush = () => new Promise((resolve) => setTimeout(resolve, 20));

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("StreamConnection", () => {
  it("dispatches snapshot then patch from the stream", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        sseResponse(
          'event: snapshot\nid: e-1\ndata: {"n":1}\n\n' +
            'event: patch\nid: e-2\ndata: [{"op":"replace","path":"/n","value":2}]\n\n',
        ),
      ),
    );

    const onSnapshot = vi.fn();
    const onPatch = vi.fn();
    const conn = new StreamConnection({
      url: "http://x/stream",
      getAuthHeaders: async () => ({}),
      onSnapshot,
      onPatch,
    });

    conn.open();
    await flush();
    conn.close();

    expect(onSnapshot).toHaveBeenCalledWith({ n: 1 });
    expect(onPatch).toHaveBeenCalledWith([
      { op: "replace", path: "/n", value: 2 },
    ]);
  });

  it("stops with onError on a 403 without reconnecting", async () => {
    const fetchMock = vi.fn().mockResolvedValue(sseResponse("", 403));
    vi.stubGlobal("fetch", fetchMock);

    const onError = vi.fn();
    const conn = new StreamConnection({
      url: "http://x/stream",
      getAuthHeaders: async () => ({}),
      onSnapshot: vi.fn(),
      onPatch: vi.fn(),
      onError,
    });

    conn.open();
    await flush();
    conn.close();

    expect(onError).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("refreshes the token and retries once on a 401", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(sseResponse("", 401))
      .mockResolvedValueOnce(sseResponse('event: snapshot\ndata: {"n":1}\n\n'));
    vi.stubGlobal("fetch", fetchMock);

    const onTokenExpired = vi.fn().mockResolvedValue("fresh-token");
    const onSnapshot = vi.fn();
    const conn = new StreamConnection({
      url: "http://x/stream",
      getAuthHeaders: async () => ({}),
      onTokenExpired,
      onSnapshot,
      onPatch: vi.fn(),
    });

    conn.open();
    await flush();
    conn.close();

    expect(onTokenExpired).toHaveBeenCalledTimes(1);
    expect(onSnapshot).toHaveBeenCalledWith({ n: 1 });
    const lastCall = fetchMock.mock.calls[fetchMock.mock.calls.length - 1];
    expect(lastCall[1].headers.Authorization).toBe("Bearer fresh-token");
  });
});
