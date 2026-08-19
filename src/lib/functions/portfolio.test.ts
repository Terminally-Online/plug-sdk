import { describe, expect, it } from "vitest";

import type { SeriesEntry } from "../schemas/series";
import {
  parsePortfolioHeaders,
  type PortfolioPoint,
  toPortfolioPoints,
} from "./portfolio";

const point = (time: number, value: number): PortfolioPoint => ({
  time,
  value,
});

describe("parsePortfolioHeaders", () => {
  it("returns null for absent headers", () => {
    expect(parsePortfolioHeaders(undefined)).toBeNull();
  });

  it("returns null when no header carries a usable value", () => {
    expect(parsePortfolioHeaders({})).toBeNull();
    expect(
      parsePortfolioHeaders({ "deposit_value:money": "", "net_carry_apy:percent": "nope" }),
    ).toBeNull();
  });

  it("parses every NUMERIC-as-TEXT header", () => {
    expect(
      parsePortfolioHeaders({
        "deposit_value:money": "12345.678901",
        "debt_value:money": "1000",
        "net_worth:money": "11345.678901",
        "net_carry_apy:percent": "3.42",
        "claimable_value:money": "12.5",
      }),
    ).toEqual({
      depositValue: 12345.678901,
      debtValue: 1000,
      netWorth: 11345.678901,
      netCarryApy: 3.42,
      claimableValue: 12.5,
    });
  });

  it("nulls unparseable fields while keeping the rest", () => {
    expect(
      parsePortfolioHeaders({
        "deposit_value:money": "100",
        "debt_value:money": "not-a-number",
        "net_carry_apy:percent": "",
      }),
    ).toEqual({
      depositValue: 100,
      debtValue: null,
      netWorth: null,
      netCarryApy: null,
      claimableValue: null,
    });
  });

  it("keeps zero and negative values", () => {
    expect(
      parsePortfolioHeaders({ "net_worth:money": "0", "net_carry_apy:percent": "-1.25" }),
    ).toMatchObject({ netWorth: 0, netCarryApy: -1.25 });
  });
});

describe("toPortfolioPoints", () => {
  it("returns empty for undefined series", () => {
    expect(toPortfolioPoints(undefined)).toEqual([]);
  });

  it("returns empty for an empty series", () => {
    expect(toPortfolioPoints([])).toEqual([]);
  });

  it("maps portfolio values and sorts by time ascending", () => {
    const series = [
      { timestamp: 300, portfolio: { value: "30" } },
      { timestamp: 100, portfolio: { value: "10" } },
      { timestamp: 200, portfolio: { value: "20" } },
    ];
    expect(toPortfolioPoints(series)).toEqual([
      point(100, 10),
      point(200, 20),
      point(300, 30),
    ]);
  });

  it("drops entries without a parseable portfolio value", () => {
    const series: SeriesEntry[] = [
      { timestamp: 100, portfolio: { value: "10" } },
      { timestamp: 200 },
      { timestamp: 300, portfolio: {} },
      { timestamp: 400, portfolio: { value: "" } },
      { timestamp: 500, portfolio: { value: "not-a-number" } },
      { timestamp: 600, portfolio: { value: { nested: "1" } } },
      { timestamp: 700, portfolio: { value: "70" } },
    ];
    expect(toPortfolioPoints(series)).toEqual([point(100, 10), point(700, 70)]);
  });

  it("keeps zero-valued samples", () => {
    expect(
      toPortfolioPoints([{ timestamp: 100, portfolio: { value: "0" } }]),
    ).toEqual([point(100, 0)]);
  });
});
