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
  });

  it("yields undefined when the referenced slot is empty", () => {
    expect(derefTagValue("<~{1.5}", actions)).toBeUndefined();
  });

  it("follows a variable binding to the setter's held value, not its name key", () => {
    const withSetter = [{ values: [{ value: "myToken" }, { value: "0xusdc" }] }];
    expect(derefTagValue("<={0.0}", withSetter)).toBe("0xusdc");
  });

  it("returns the setter's output coil as-is for cross-parent projection", () => {
    const withSetter = [{ values: [{ value: "myToken" }, { value: "<-{2.0}" }] }];
    expect(derefTagValue("<={0.0}", withSetter)).toBe("<-{2.0}");
  });

  it("resolves a setter holding a tag reference transitively", () => {
    const chained = [
      { values: [{ value: "0xdai" }, { value: "100" }] },
      { values: [{ value: "myToken" }, { value: "<~{0.0}" }] },
    ];
    expect(derefTagValue("<={1.0}", chained)).toBe("0xdai");
  });

  it("follows set-to-set aliases through the chain", () => {
    const aliased = [
      { values: [{ value: "x" }, { value: "0xweth" }] },
      { values: [{ value: "y" }, { value: "<={0.0}" }] },
    ];
    expect(derefTagValue("<={1.0}", aliased)).toBe("0xweth");
  });

  it("yields undefined on an alias cycle instead of recursing forever", () => {
    const cyclic = [
      { values: [{ value: "x" }, { value: "<={1.0}" }] },
      { values: [{ value: "y" }, { value: "<={0.0}" }] },
    ];
    expect(derefTagValue("<={0.0}", cyclic)).toBeUndefined();
  });

  it("yields undefined when the setter holds no value yet", () => {
    const empty = [{ values: [{ value: "myToken" }] }];
    expect(derefTagValue("<={0.0}", empty)).toBeUndefined();
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

  it("projects the child dimension flat and deduped when the dep is a coil ref", () => {
    const tree = {
      "0xaave": [{ value: "0xusd" }, { value: "0xeth" }],
      "0xlink": [{ value: "0xusd" }, { value: "0xbtc" }],
    };
    const values = [{ value: "<-{0.0}" }];
    expect(resolveInputOptions(tree, [0], values, [])).toEqual([
      { value: "0xusd", facets: undefined, max: undefined },
      { value: "0xeth", facets: undefined, max: undefined },
      { value: "0xbtc", facets: undefined, max: undefined },
    ]);
  });

  it("interleaves the projection by rank so every parent's best options lead", () => {
    const tree = {
      a: [{ value: "a1" }, { value: "a2" }],
      b: [{ value: "b1" }, { value: "b2" }],
    };
    const values = [{ value: "<-{0.0}" }];
    expect(
      resolveInputOptions(tree, [0], values, [])?.map((o) => o.value),
    ).toEqual(["a1", "b1", "a2", "b2"]);
  });

  it("strips per-parent metrics from projected options, leaving identity", () => {
    const tree = {
      "0xaave": [
        { value: "0xusd", max: "1000", facets: [{ kind: "price", value: "$1" }] },
      ],
    };
    const values = [{ value: "<-{0.0}" }];
    const resolved = resolveInputOptions(tree, [0], values, []);
    expect(resolved?.[0].value).toBe("0xusd");
    expect(resolved?.[0].max).toBeUndefined();
    expect(resolved?.[0].facets).toBeUndefined();
    expect(tree["0xaave"][0].max).toBe("1000");
  });

  it("merges record subtrees on a coiled dep so a later dep still keys the chain", () => {
    const tree = {
      "0xvault1": { "1": [{ value: "0xpos1" }] },
      "0xvault2": { "1": [{ value: "0xpos2" }], "2": [{ value: "0xpos3", max: "5" }] },
    };
    const values = [{ value: "<-{0.0}" }, { value: "1" }];
    expect(resolveInputOptions(tree, [0, 1], values, [])).toEqual([
      { value: "0xpos1", facets: undefined, max: undefined },
      { value: "0xpos2", facets: undefined, max: undefined },
    ]);

    const uncollided = resolveInputOptions(tree, [0, 1], [{ value: "<-{0.0}" }, { value: "2" }], []);
    expect(uncollided?.[0].max).toBeUndefined();
  });

  it("a tag ref that dereferences to a coil ref also projects", () => {
    const tree = { "0xaave": [{ value: "0xusd" }] };
    const values = [{ value: "<~{0.0}" }];
    const actions = [{ values: [{ value: "<-{1.0}" }] }];
    expect(resolveInputOptions(tree, [0], values, actions)).toEqual([
      { value: "0xusd" },
    ]);
  });

  it("keys the tree through a variable binding holding a literal", () => {
    const tree = { "0xusdc": [{ value: "0xmarket" }] };
    const values = [{ value: "<={0.0}" }];
    const actions = [{ values: [{ value: "myToken" }, { value: "0xusdc" }] }];
    expect(resolveInputOptions(tree, [0], values, actions)).toEqual([
      { value: "0xmarket" },
    ]);
  });

  it("projects across parents when the variable holds an output coil", () => {
    const tree = {
      "0xaave": [{ value: "0xusd", max: "10" }],
      "0xlink": [{ value: "0xbtc" }],
    };
    const values = [{ value: "<={0.0}" }];
    const actions = [{ values: [{ value: "myToken" }, { value: "<-{2.0}" }] }];
    expect(resolveInputOptions(tree, [0], values, actions)).toEqual([
      { value: "0xusd", facets: undefined, max: undefined },
      { value: "0xbtc", facets: undefined, max: undefined },
    ]);
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
