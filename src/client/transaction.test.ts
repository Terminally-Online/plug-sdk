import { describe, expect, it, vi, afterEach } from "vitest";

import { PlugClient } from "../client";
import relayCreate from "../lib/schemas/fixtures/relay-create.json";
import relaySubmitManual from "../lib/schemas/fixtures/relay-submit-manual.json";
import relaySubmitScheduled from "../lib/schemas/fixtures/relay-submit-scheduled.json";

const BASE_URL = "https://api.plug.test";
const ACCOUNT = "0x6a1C5bd0b8D9A3F8B7B3a9c1E7c2A4F1d5E3B2C9";

const client = () => new PlugClient({ baseUrl: BASE_URL, retries: 0 });

const answer = (body: unknown) => {
  const fetchMock = vi.fn(
    async (_input: RequestInfo | URL, _init?: RequestInit) =>
      new Response(JSON.stringify(body), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
};

const signed = {
  chain_id: 8453,
  owner: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
  plugs: relayCreate.data.relay.plugs,
  state: relayCreate.data.relay.state,
  signature: `0x${"11".repeat(65)}`,
};

afterEach(() => vi.unstubAllGlobals());

describe("PlugClient.createTransaction", () => {
  it("posts the draft as a query on the route gusher registers", async () => {
    const fetchMock = answer(relayCreate);
    const created = await client().createTransaction({
      address: ACCOUNT,
      input: {
        chain_id: 8453,
        steps: { 0: { protocol: "evm", step: "transfer_fungible", inputs: { 0: "1" } } },
      },
    });

    const url = new URL(fetchMock.mock.calls[0][0] as string);
    expect(fetchMock.mock.calls[0][1]?.method).toBe("POST");
    expect(url.pathname).toBe(`/address/${ACCOUNT}/transaction/`);
    expect(url.searchParams.get("input[chain_id]")).toBe("8453");
    expect(url.searchParams.get("input[steps][0][step]")).toBe("transfer_fungible");
    expect(created.data?.relay?.solutions).toEqual(relayCreate.data.relay.solutions);
  });
});

describe("PlugClient.submitTransaction", () => {
  it("relays a manual submission and answers with its hash and intent", async () => {
    const fetchMock = answer(relaySubmitManual);
    const submitted = await client().submitTransaction({ address: ACCOUNT, ...signed, mode: "manual" });

    expect(fetchMock.mock.calls[0][0]).toBe(`${BASE_URL}/address/${ACCOUNT}/transaction/`);
    expect(fetchMock.mock.calls[0][1]?.method).toBe("PUT");
    expect(JSON.parse(fetchMock.mock.calls[0][1]?.body as string)).toEqual({ ...signed, mode: "manual" });
    expect(submitted).toEqual(relaySubmitManual);
  });

  it("arms a scheduled submission and answers with the armed row", async () => {
    answer(relaySubmitScheduled);
    const armed = await client().submitTransaction({ address: ACCOUNT, ...signed, mode: "scheduled" });

    expect(armed.id).toBe(relaySubmitScheduled.id);
  });
});

describe("PlugClient.compileTransaction", () => {
  it("rejects a refused draft with gusher's own words and its status", async () => {
    const refusal =
      "unknown action chainlink:feed on chain 1: protocol chainlink has no action feed";
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({ links: { self: "/transaction/" }, data: { error: refusal } }),
            { status: 422, headers: { "Content-Type": "application/json" } },
          ),
      ),
    );

    const compiling = client().compileTransaction({
      input: { chain_id: 1, steps: { 0: { protocol: "chainlink", step: "feed" } } },
    });

    await expect(compiling).rejects.toMatchObject({ message: refusal, statusCode: 422 });
  });

  it("rejects a bare error body with its error text", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ error: "invalid request body: unexpected EOF" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }),
      ),
    );

    const compiling = client().compileTransaction({ input: { chain_id: 1, steps: {} } });

    await expect(compiling).rejects.toMatchObject({
      message: "invalid request body: unexpected EOF",
      statusCode: 400,
    });
  });
});
