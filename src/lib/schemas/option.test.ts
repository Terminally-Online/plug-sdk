import { describe, expect, it } from "vitest";
import {
  chosenOption,
  derefTagValue,
  resolveInputInfo,
  resolveInputOptions,
} from "./option";
import { ContextActionOption } from "./option";

describe("derefTagValue", () => {
  const actions = [
    { values: [{ value: "0xfrom" }, { value: "100" }] },
    { values: [{ value: "0xto" }] },
  ];

  it("returns non-string values untouched", () => {
    expect(derefTagValue(42, actions)).toBe(42);
    expect(derefTagValue(undefined, actions)).toBeUndefined();
  });

  it("returns a plain string that is not a tag reference untouched", () => {
    expect(derefTagValue("0xabc", actions)).toBe("0xabc");
  });

  it("resolves a tag reference to the source action's stored value", () => {
    expect(derefTagValue("<~{0.1}", actions)).toBe("100");
    expect(derefTagValue("<={1.0}", actions)).toBe("0xto");
  });

  it("yields undefined when the referenced slot is empty", () => {
    expect(derefTagValue("<~{1.5}", actions)).toBeUndefined();
  });
});

describe("chosenOption", () => {
  const options: ContextActionOption[] = [
    { value: "0xa", label: "A" },
    { value: "0xb", label: "B" },
  ];

  it("finds the option whose value matches, comparing as strings", () => {
    expect(chosenOption(options, "0xb")?.label).toBe("B");
    expect(chosenOption([{ value: "1" }], 1)?.value).toBe("1");
  });

  it("returns undefined for no match, no value, or no options", () => {
    expect(chosenOption(options, "0xc")).toBeUndefined();
    expect(chosenOption(options, undefined)).toBeUndefined();
    expect(chosenOption(undefined, "0xa")).toBeUndefined();
  });
});

describe("resolveInputOptions", () => {
  const flat: ContextActionOption[] = [{ value: "0xa" }, { value: "0xb" }];

  it("returns a flat options array directly", () => {
    expect(resolveInputOptions(flat, undefined, [], [])).toBe(flat);
  });

  it("returns undefined when there are no options", () => {
    expect(resolveInputOptions(undefined, [0], [], [])).toBeUndefined();
  });

  it("walks a nested tree along the requires chain using the dep's value", () => {
    const tree = {
      "1": [{ value: "0xusdc" }],
      "137": [{ value: "0xusdc-poly" }],
    };
    const values = [undefined, { value: "137" }];
    expect(resolveInputOptions(tree, [1], values, [])).toEqual([
      { value: "0xusdc-poly" },
    ]);
  });

  it("dereferences a tag-ref dep value before indexing the tree", () => {
    const tree = { "1": [{ value: "0xusdc" }] };
    const values = [undefined, { value: "<~{0.0}" }];
    const actions = [{ values: [{ value: "1" }] }];
    expect(resolveInputOptions(tree, [1], values, actions)).toEqual([
      { value: "0xusdc" },
    ]);
  });

  it("returns undefined when the dep's value has no branch in the tree", () => {
    const tree = { "1": [{ value: "0xusdc" }] };
    const values = [undefined, { value: "999" }];
    expect(resolveInputOptions(tree, [1], values, [])).toBeUndefined();
  });

  it("returns undefined when a nested tree is reached without requires", () => {
    const tree = { "1": [{ value: "0xusdc" }] };
    expect(resolveInputOptions(tree, undefined, [], [])).toBeUndefined();
  });
});

describe("resolveInputInfo", () => {
  // A row draws ONLY its own facets — the universal pick signal (price, 24h change,
  // holdings). It never borrows a dependent dimension's action-specific data; the
  // action resolves a market's rate/LTV/cap on-chain at runtime, not the picker.
  const usdc: ContextActionOption = {
    value: "0xusdc",
    label: "USDC",
    icons: ["usdc.png"],
    facets: [
      { kind: "price", value: "$1.00" },
      { kind: "change", value: "0.00%" },
    ],
  };

  it("returns the option's own facets, untouched", () => {
    const info = resolveInputInfo(usdc);
    expect(info.facets).toEqual(usdc.facets);
    expect(info.facets.some((f) => f.kind === "rate")).toBe(false);
  });

  it("returns an empty facet list for an option with no own facets (unpriced token)", () => {
    const unpriced: ContextActionOption = { value: "0xpt", label: "PT", icons: ["pt.png"] };
    expect(resolveInputInfo(unpriced).facets).toEqual([]);
  });

  it("surfaces an icon group beyond the avatar on the subline (E-Mode member assets)", () => {
    const category: ContextActionOption = {
      value: "0xcat",
      icons: ["category.png", "a.png", "b.png"],
      facets: [],
    };
    expect(resolveInputInfo(category).icons).toEqual(["a.png", "b.png"]);
  });

  it("surfaces a two-icon option's second icon on the subline (a market's asset)", () => {
    const market: ContextActionOption = {
      value: "0xmarket",
      label: "WETH",
      icons: ["market.png", "weth.png"],
      facets: [],
    };
    expect(resolveInputInfo(market).icons).toEqual(["weth.png"]);
  });

  it("adds no subline icon-row for a single-icon option", () => {
    expect(resolveInputInfo(usdc).icons).toBeUndefined();
  });
});
