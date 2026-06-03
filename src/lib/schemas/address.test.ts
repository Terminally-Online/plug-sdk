import { describe, expect, it } from "vitest";

import {
  AddressBalanceSchema,
  AddressPriceSchema,
  AddressRelationshipSchema,
  AddressResponseSchema,
  AddressSchema,
  attr,
  PositionsFilterSchema,
  PositionsResponseSchema,
  PositionsSortSchema,
  RecursiveStringMapSchema,
} from "./address";

describe("RecursiveStringMapSchema", () => {
  it("preserves the wire shape, suffixed keys included", () => {
    const input = {
      metadata: {
        "called_at:time": "1716000000",
        external_uri: "https://example.com",
      },
      socket: { address: "0x123" },
    };
    expect(RecursiveStringMapSchema.parse(input)).toEqual(input);
  });

  it("does not attach a _formats sidecar", () => {
    const parsed = RecursiveStringMapSchema.parse({
      portfolio: { "value:money": "1234.56" },
    });
    expect((parsed as { _formats?: unknown })._formats).toBeUndefined();
  });
});

describe("attr.get", () => {
  const parsed = RecursiveStringMapSchema.parse({
    metadata: {
      "called_at:time": "1716000000",
      external_uri: "https://example.com",
    },
    net: { "value:money": "1234.56" },
    socket: { address: "0x123" },
  });

  it("resolves a bare name onto a suffixed leaf", () => {
    expect(attr.get(parsed, "metadata", "called_at")).toBe("1716000000");
    expect(attr.get(parsed, "net", "value")).toBe("1234.56");
  });

  it("resolves an exact, unsuffixed key", () => {
    expect(attr.get(parsed, "metadata", "external_uri")).toBe(
      "https://example.com",
    );
    expect(attr.get(parsed, "socket", "address")).toBe("0x123");
  });

  it("returns undefined for a missing path", () => {
    expect(attr.get(parsed, "metadata", "missing")).toBeUndefined();
    expect(attr.get(parsed, "absent", "value")).toBeUndefined();
    expect(attr.get(parsed)).toBeUndefined();
  });

  it("does not match a bare name against an unrelated prefix", () => {
    const positions = RecursiveStringMapSchema.parse({
      position: { "net_worth:money": "100" },
    });
    expect(attr.get(positions, "position", "net")).toBeUndefined();
    expect(attr.get(positions, "position", "net_worth")).toBe("100");
  });
});

describe("attr.formatOf", () => {
  const parsed = RecursiveStringMapSchema.parse({
    metadata: {
      "called_at:time": "1716000000",
      external_uri: "https://example.com",
    },
    socket: { address: "0x123" },
  });

  it("returns the format for a typed leaf", () => {
    expect(attr.formatOf(parsed, "metadata", "called_at")).toBe("time");
  });

  it("returns undefined for an untyped leaf", () => {
    expect(attr.formatOf(parsed, "metadata", "external_uri")).toBeUndefined();
    expect(attr.formatOf(parsed, "socket", "address")).toBeUndefined();
  });

  it("returns undefined for a missing leaf", () => {
    expect(attr.formatOf(parsed, "metadata", "missing")).toBeUndefined();
    expect(attr.formatOf(parsed)).toBeUndefined();
  });
});

describe("attr.entries", () => {
  const parsed = RecursiveStringMapSchema.parse({
    metadata: {
      "called_at:time": "1716000000",
      external_uri: "https://example.com",
    },
  });

  it("returns bare names with the format suffix stripped", () => {
    const entries = attr.entries(parsed, "metadata");
    expect(entries).toEqual(
      expect.arrayContaining([
        ["called_at", "1716000000"],
        ["external_uri", "https://example.com"],
      ]),
    );
    expect(entries).toHaveLength(2);
  });

  it("returns an empty list for a non-object path", () => {
    expect(attr.entries(parsed, "metadata", "called_at")).toEqual([]);
    expect(attr.entries(parsed, "absent")).toEqual([]);
  });
});

describe("attr.leaves", () => {
  const parsed = RecursiveStringMapSchema.parse({
    metadata: {
      "called_at:time": "1716000000",
      external_uri: "https://example.com",
    },
    nested: { deeper: { value: "x" } },
  });

  it("returns string leaves with bare names and parsed formats", () => {
    const leaves = attr.leaves(parsed, "metadata");
    expect(leaves).toEqual(
      expect.arrayContaining([
        { name: "called_at", value: "1716000000", format: "time" },
        {
          name: "external_uri",
          value: "https://example.com",
          format: undefined,
        },
      ]),
    );
    expect(leaves).toHaveLength(2);
  });

  it("skips nested objects, keeping only string leaves", () => {
    expect(attr.leaves(parsed, "nested")).toEqual([]);
  });

  it("returns an empty list for a missing or non-object path", () => {
    expect(attr.leaves(parsed, "absent")).toEqual([]);
    expect(attr.leaves(parsed, "metadata", "called_at")).toEqual([]);
  });
});

describe("attr.sections", () => {
  const parsed = RecursiveStringMapSchema.parse({
    position: {
      "net_worth:money": "1234.56",
      "supply_apy:percent": "0.0425",
    },
    flat: "ignored",
    empty: {},
  });

  it("returns nested sections with their format-tagged leaves", () => {
    expect(attr.sections(parsed)).toEqual([
      {
        key: "position",
        leaves: expect.arrayContaining([
          { name: "net_worth", value: "1234.56", format: "money" },
          { name: "supply_apy", value: "0.0425", format: "percent" },
        ]),
      },
    ]);
  });

  it("omits flat leaves and empty sections", () => {
    expect(attr.sections(parsed).map((section) => section.key)).toEqual([
      "position",
    ]);
  });
});

describe("AddressBalanceSchema", () => {
  it("requires int and accepts the optional fields", () => {
    expect(AddressBalanceSchema.parse({ int: "1000" })).toEqual({
      int: "1000",
    });
    expect(
      AddressBalanceSchema.parse({
        int: "1000",
        float: "1.0",
        decimals: 18,
        value: "1234.56",
      }),
    ).toMatchObject({ int: "1000", decimals: 18 });
  });

  it("rejects a missing or mistyped int", () => {
    expect(AddressBalanceSchema.safeParse({}).success).toBe(false);
    expect(AddressBalanceSchema.safeParse({ int: 1000 }).success).toBe(false);
  });
});

describe("AddressPriceSchema", () => {
  it("requires the full OHLC set", () => {
    expect(
      AddressPriceSchema.parse({
        open: "1",
        high: "2",
        low: "0.5",
        close: "1.5",
      }),
    ).toMatchObject({ open: "1", close: "1.5" });
  });

  it("rejects a partial OHLC set with no change", () => {
    expect(
      AddressPriceSchema.safeParse({ open: "1", high: "2", low: "0.5" })
        .success,
    ).toBe(false);
  });

  it("accepts a change-only position quote", () => {
    expect(AddressPriceSchema.parse({ change: "2.41" })).toEqual({
      change: "2.41",
    });
  });

  it("rejects an empty quote", () => {
    expect(AddressPriceSchema.safeParse({}).success).toBe(false);
  });
});

describe("AddressRelationshipSchema", () => {
  it("requires token_id while leaving address optional", () => {
    expect(AddressRelationshipSchema.parse({ token_id: "1" })).toEqual({
      token_id: "1",
    });
    expect(
      AddressRelationshipSchema.safeParse({ address: "0x123" }).success,
    ).toBe(false);
  });

  it("passes attributes through the recursive map", () => {
    const parsed = AddressRelationshipSchema.parse({
      token_id: "1",
      attributes: { trait: { background: "blue" } },
    });
    expect(parsed.attributes).toEqual({ trait: { background: "blue" } });
  });
});

describe("AddressSchema", () => {
  it("requires chain_id and address with correct types", () => {
    expect(AddressSchema.parse({ chain_id: 1, address: "0x0" })).toMatchObject({
      chain_id: 1,
      address: "0x0",
    });
    expect(AddressSchema.safeParse({ address: "0x0" }).success).toBe(false);
    expect(
      AddressSchema.safeParse({ chain_id: "1", address: "0x0" }).success,
    ).toBe(false);
  });

  it("preserves suffixed attribute keys end to end with formatOf", () => {
    const parsed = AddressSchema.parse({
      chain_id: 1,
      address: "0x0",
      attributes: { portfolio: { "value:money": "1234.56" } },
    });
    expect(
      (parsed.attributes as Record<string, Record<string, string>>).portfolio[
        "value:money"
      ],
    ).toBe("1234.56");
    expect(attr.formatOf(parsed.attributes, "portfolio", "value")).toBe(
      "money",
    );
  });

  it("accepts a relationships record of arrays", () => {
    const parsed = AddressSchema.parse({
      chain_id: 1,
      address: "0x0",
      relationships: { assets: [{ token_id: "1" }] },
    });
    expect(parsed.relationships?.assets).toHaveLength(1);
  });
});

describe("AddressResponseSchema", () => {
  it("wraps data, allows null, and carries optional links", () => {
    expect(
      AddressResponseSchema.parse({ data: { chain_id: 1, address: "0x0" } }),
    ).toMatchObject({ data: { chain_id: 1 } });
    expect(AddressResponseSchema.parse({ data: null })).toEqual({ data: null });
    expect(
      AddressResponseSchema.parse({ links: { self: "/v1/x" }, data: null }),
    ).toMatchObject({ links: { self: "/v1/x" } });
  });

  it("requires the data key", () => {
    expect(AddressResponseSchema.safeParse({}).success).toBe(false);
  });
});

describe("PositionsFilterSchema", () => {
  it("accepts the supported token standards and rejects unknown ones", () => {
    expect(
      PositionsFilterSchema.parse({ standard: ["erc:20", "native"] }),
    ).toEqual({ standard: ["erc:20", "native"] });
    expect(
      PositionsFilterSchema.safeParse({ standard: ["erc:999"] }).success,
    ).toBe(false);
  });

  it("is fully optional and types verified as a boolean", () => {
    expect(PositionsFilterSchema.parse({})).toEqual({});
    expect(PositionsFilterSchema.safeParse({ verified: "yes" }).success).toBe(
      false,
    );
  });
});

describe("PositionsSortSchema", () => {
  it("constrains by and direction to their enums", () => {
    expect(
      PositionsSortSchema.parse({ by: "value", direction: "desc" }),
    ).toEqual({
      by: "value",
      direction: "desc",
    });
    expect(PositionsSortSchema.safeParse({ by: "price" }).success).toBe(false);
    expect(PositionsSortSchema.safeParse({ direction: "up" }).success).toBe(
      false,
    );
  });
});

describe("PositionsResponseSchema", () => {
  it("wraps an array of addresses and allows null", () => {
    const parsed = PositionsResponseSchema.parse({
      data: [{ chain_id: 1, address: "0x0" }],
    });
    expect(Array.isArray(parsed.data) ? parsed.data : []).toHaveLength(1);
    expect(PositionsResponseSchema.parse({ data: null })).toEqual({
      data: null,
    });
  });
});
