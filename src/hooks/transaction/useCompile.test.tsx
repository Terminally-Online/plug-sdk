// @vitest-environment jsdom

import React from "react";
import { QueryClient } from "@tanstack/react-query";
import { render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import compileOwnerShort from "../../lib/schemas/fixtures/compile-owner-short.json";
import { PlugSDKProvider } from "../../provider";
import {
  useCompile,
  type UseCompileOptions,
  type UseCompileResult,
} from "./useCompile";

const OWNER = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";

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

const renderCompile = (options: UseCompileOptions) => {
  const seen: UseCompileResult[] = [];
  const Probe = () => {
    seen.push(useCompile(options));
    return null;
  };
  render(
    <PlugSDKProvider
      config={{ baseUrl: "https://api.plug.test", retries: 0 }}
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

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("useCompile", () => {
  it("compiles for the owner it is given", async () => {
    const fetchMock = answer(compileOwnerShort);
    const compile = renderCompile({
      chainId: 8453,
      owner: OWNER,
      steps: [
        { protocol: "evm", step: "transfer_fungible", inputs: { 0: "25" } },
      ],
    });

    await waitFor(() => expect(compile.current.data?.program).toBeDefined());
    const body = JSON.parse(fetchMock.mock.calls[0][1]?.body as string);
    expect(body.input.owner).toBe(OWNER);
    expect(body.input.chain_id).toBe(8453);
  });

  it("compiles again when the program's deadline arrives", async () => {
    const now = Date.parse("2026-10-29T22:10:00Z");
    vi.useFakeTimers({ now });
    const lowered = (deadline: number) => ({
      ...compileOwnerShort,
      data: {
        ...compileOwnerShort.data,
        program: { ...compileOwnerShort.data.program, deadline },
      },
    });
    const first = now / 1000 + 5 * 60;
    const second = first + 5 * 60;
    const fetchMock = answer(lowered(second));
    fetchMock.mockImplementationOnce(
      async () =>
        new Response(JSON.stringify(lowered(first)), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
    );
    const compile = renderCompile({
      chainId: 8453,
      owner: OWNER,
      steps: [
        { protocol: "evm", step: "transfer_fungible", inputs: { 0: "25" } },
      ],
    });

    await vi.waitFor(() =>
      expect(compile.current.data?.program?.deadline).toBe(first),
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(5 * 60 * 1000);

    await vi.waitFor(() =>
      expect(compile.current.data?.program?.deadline).toBe(second),
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
