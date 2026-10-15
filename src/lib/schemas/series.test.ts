import { describe, expect, it } from "vitest";

import { API_ENDPOINTS } from "../api";
import type { SeriesQueryParams } from "./series";

const OWNER = "0x1111111111111111111111111111111111111111";
const TOKEN = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

describe("SeriesQueryParams", () => {
  it("reads a token's history on the chain the token lives on", () => {
    const scoped: SeriesQueryParams = {
      address: OWNER,
      filter: { address: TOKEN, chain_id: 8453 },
    };
    const unscoped: SeriesQueryParams = {
      address: OWNER,
      // @ts-expect-error a token address means nothing without its chain
      filter: { address: TOKEN },
    };

    expect(scoped.filter?.chain_id).toBe(8453);
    expect(unscoped.filter?.chain_id).toBeUndefined();
  });

  it("documents the chain as the token's, with no chain assumed", () => {
    const series = API_ENDPOINTS.find(
      (endpoint) => endpoint.operationId === "getSeries",
    );
    const chain = series?.params.find(
      (param) => param.name === "filter[chain_id]",
    );

    expect(chain?.description).toBeTruthy();
    expect(chain?.description).not.toMatch(/mainnet|ethereum|defaults/i);
    expect(chain?.description).toMatch(/filter\[address\]/);
  });

  it("reads an asset's history across every chain it is held on", () => {
    const series = API_ENDPOINTS.find(
      (endpoint) => endpoint.operationId === "getSeries",
    );
    const asset = series?.params.find(
      (param) => param.name === "filter[asset]",
    );
    const params: SeriesQueryParams = {
      address: OWNER,
      filter: { address: TOKEN, chain_id: 1, asset: true },
    };

    expect(asset?.description).toMatch(/every/);
    expect(params.filter?.asset).toBe(true);
  });
});
