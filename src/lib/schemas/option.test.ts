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
  // An Aave Supply sentence: token (index 1) and market (index 2, keyed by token). The
  // per-(token, market) facts ship ONCE under the market options — the asset option below
  // carries identity only. Nothing market-specific lives in the resolver; the dimension is
  // found through `requires`.
  const inputs = [
    { requires: undefined }, // 0 amount
    { requires: undefined }, // 1 token
    { requires: [1] }, // 2 market — keyed by token value
  ];

  const usdc: ContextActionOption = {
    value: "0xusdc",
    label: "USDC",
    icons: ["usdc.png"],
    // The asset's own top-line figure (e.g. suppliable balance in USD), server-set.
    info: { value: "$1,200" },
  };

  const options = {
    "1": [usdc],
    "2": {
      "0xusdc": [
        {
          value: "0xMarketA",
          icons: ["marketA.png"],
          info: { icons: ["usdc.png"], info: { value: "3.1%", label: "$60" } },
        },
        {
          value: "0xMarketB",
          icons: ["marketB.png"],
          info: { icons: ["usdc.png"], info: { value: "4.2%", label: "$40" } },
        },
      ],
    },
  };

  it("folds the dimension to the subline (rate range), keeping the asset's top-line balance", () => {
    const summary = resolveInputInfo(usdc, 1, inputs, options, [], []);
    expect(summary?.value).toBe("$1,200"); // top line: the asset's own balance
    expect(summary?.icons).toEqual(["marketA.png", "marketB.png"]);
    expect(summary?.info?.value).toBe("3.1% - 4.2%"); // subline: the rate range
  });

  it("picks the one market's rate as the subline, balance still on top, when resolved", () => {
    const values = [undefined, undefined, { value: "0xMarketB" }];
    const picked = resolveInputInfo(usdc, 1, inputs, options, values, []);
    expect(picked?.value).toBe("$1,200");
    expect(picked?.icons).toEqual(["marketB.png"]);
    expect(picked?.info?.value).toBe("4.2%");
  });

  it("returns the option's own info when no input depends on it (non-dimensional)", () => {
    const recipient: ContextActionOption = {
      value: "0xabc",
      info: { value: "ENS", label: "vitalik.eth" },
    };
    // index 0 — nothing in `inputs` requires it.
    expect(resolveInputInfo(recipient, 0, inputs, options, [], [])).toBe(
      recipient.info,
    );
  });

  it("falls back to the summary when the resolved dimension has no entry", () => {
    const values = [undefined, undefined, { value: "0xUnknownMarket" }];
    const summary = resolveInputInfo(usdc, 1, inputs, options, values, []);
    expect(summary?.icons).toEqual(["marketA.png", "marketB.png"]);
    expect(summary?.info?.value).toBe("3.1% - 4.2%");
  });

  it("dereferences a tag-ref dimension value before picking — same rule as options", () => {
    const values = [undefined, undefined, { value: "<~{0.0}" }];
    const actions = [{ values: [{ value: "0xMarketA" }] }];
    const picked = resolveInputInfo(usdc, 1, inputs, options, values, actions);
    expect(picked?.icons).toEqual(["marketA.png"]);
    expect(picked?.info?.value).toBe("3.1%");
  });
});
