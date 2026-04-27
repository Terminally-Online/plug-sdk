import { describe, expect, it } from "vitest";
import { buildQueryParams } from "./query";

const toObject = (params: URLSearchParams): Record<string, string[]> => {
  const result: Record<string, string[]> = {};
  params.forEach((value, key) => {
    if (!result[key]) result[key] = [];
    result[key].push(value);
  });
  return result;
};

describe("buildQueryParams", () => {
  it("should handle flat primitives", () => {
    const params = buildQueryParams({ a: "hello", b: 42, c: true });
    expect(params.get("a")).toBe("hello");
    expect(params.get("b")).toBe("42");
    expect(params.get("c")).toBe("true");
  });

  it("should skip null and undefined values", () => {
    const params = buildQueryParams({ a: "keep", b: null, c: undefined });
    expect(params.get("a")).toBe("keep");
    expect(params.has("b")).toBe(false);
    expect(params.has("c")).toBe(false);
  });

  it("should serialize nested objects with bracket notation", () => {
    const params = buildQueryParams({ filter: { chain_id: 1, protocol: "aave" } });
    expect(params.get("filter[chain_id]")).toBe("1");
    expect(params.get("filter[protocol]")).toBe("aave");
  });

  it("should serialize arrays with indexed brackets", () => {
    const params = buildQueryParams({ ids: [10, 20, 30] });
    expect(params.get("ids[0]")).toBe("10");
    expect(params.get("ids[1]")).toBe("20");
    expect(params.get("ids[2]")).toBe("30");
  });

  it("should serialize arrays of objects", () => {
    const params = buildQueryParams({ items: [{ a: "x" }, { a: "y" }] });
    expect(params.get("items[0][a]")).toBe("x");
    expect(params.get("items[1][a]")).toBe("y");
  });

  it("should skip null and undefined within arrays", () => {
    const params = buildQueryParams({ ids: [1, null, undefined, 4] });
    expect(params.get("ids[0]")).toBe("1");
    expect(params.has("ids[1]")).toBe(false);
    expect(params.has("ids[2]")).toBe(false);
    expect(params.get("ids[3]")).toBe("4");
  });

  it("should skip null and undefined within nested objects", () => {
    const params = buildQueryParams({ filter: { a: "keep", b: null, c: undefined } });
    expect(params.get("filter[a]")).toBe("keep");
    expect(params.has("filter[b]")).toBe(false);
    expect(params.has("filter[c]")).toBe(false);
  });

  it("should handle deeply nested objects", () => {
    const params = buildQueryParams({ a: { b: { c: { d: "deep" } } } });
    expect(params.get("a[b][c][d]")).toBe("deep");
  });

  it("should handle nested arrays (arrays of arrays)", () => {
    const params = buildQueryParams({ matrix: [[1, 2], [3, 4]] });
    const obj = toObject(params);
    expect(obj["matrix[0]"]).toEqual(["1", "2"]);
    expect(obj["matrix[1]"]).toEqual(["3", "4"]);
  });

  it("should return empty params for empty object", () => {
    const params = buildQueryParams({});
    expect(params.toString()).toBe("");
  });

  it("should handle mixed nesting", () => {
    const params = buildQueryParams({
      name: "test",
      filter: { chain_id: 1 },
      ids: [10, 20],
      skip: null,
    });
    expect(params.get("name")).toBe("test");
    expect(params.get("filter[chain_id]")).toBe("1");
    expect(params.get("ids[0]")).toBe("10");
    expect(params.get("ids[1]")).toBe("20");
    expect(params.has("skip")).toBe(false);
  });
});
