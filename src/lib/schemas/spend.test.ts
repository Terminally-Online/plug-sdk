import { describe, expect, it } from "vitest";
import { optionMaxAmount, readInputCeiling, readInputSpends } from "./spend";
import { InputReference } from "../types/sentence";
import { ContextActionOption } from "./option";

// A spend-tagged amount input whose one-click fill sources from the asset option
// chosen for the upstream token input at index 0.
const amountInput: InputReference = {
  name: "amount",
  type: "uint256",
  tags: [{ kind: "spend", value: "0" }],
};

describe("optionMaxAmount", () => {
  it("scales the base-units max by decimals and trims zeros", () => {
    expect(optionMaxAmount({ value: "0xtoken", max: "1500000", decimals: 6 })).toBe("1.5");
    expect(
      optionMaxAmount({ value: "0xtoken", max: "1000000000000000000", decimals: 18 }),
    ).toBe("1");
  });

  it("treats a max with no decimals as already display-ready", () => {
    expect(optionMaxAmount({ value: "0xtoken", max: "42" })).toBe("42");
  });

  it("yields undefined when the option carries no max", () => {
    expect(optionMaxAmount({ value: "0xtoken", label: "USDC" })).toBeUndefined();
  });
});

describe("readInputSpends", () => {
  it("returns the referenced token option when it carries a max", () => {
    const token: ContextActionOption = {
      value: "0xtoken",
      label: "USDC",
      max: "1500000",
      decimals: 6,
    };
    const result = readInputSpends(amountInput, () => token);
    expect(result).toEqual([token]);
    expect(optionMaxAmount(result[0])).toBe("1.5");
  });

  it("returns one option per spend tag the input declares", () => {
    const input: InputReference = {
      name: "amount",
      type: "uint256",
      tags: [
        { kind: "spend", value: "0" },
        { kind: "spend", value: "1" },
      ],
    };
    const options: Record<number, ContextActionOption> = {
      0: { value: "0xa", label: "A", max: "1000000", decimals: 6 },
      1: { value: "0xb", label: "B", max: "500000", decimals: 6 },
    };
    expect(readInputSpends(input, (ref) => options[ref])).toEqual([
      options[0],
      options[1],
    ]);
  });

  it("skips a spend whose referenced option is unresolved", () => {
    expect(readInputSpends(amountInput, () => undefined)).toEqual([]);
  });

  it("skips a referenced option that carries no max", () => {
    expect(
      readInputSpends(amountInput, () => ({ value: "0xtoken", label: "USDC" })),
    ).toEqual([]);
  });

  it("ignores non-spend tags and inputs without tags", () => {
    const tokenInput: InputReference = {
      name: "token",
      type: "address",
      tags: [{ kind: "standard", value: "token" }],
    };
    expect(
      readInputSpends(tokenInput, () => ({ value: "0xt", max: "1", decimals: 6 })),
    ).toEqual([]);
    expect(
      readInputSpends({ name: "x", type: "uint256" }, () => undefined),
    ).toEqual([]);
    expect(readInputSpends(undefined, () => undefined)).toEqual([]);
  });
});

describe("readInputCeiling", () => {
  // The Aave V4 withdraw shape: the amount spends nothing from the wallet, so it
  // carries only the decimal:inherit reference to the market row, which carries
  // the supplied balance as its max.
  const withdrawAmount: InputReference = {
    name: "amount",
    type: "uint256",
    tags: [
      { kind: "decimal", value: "inherit", reference: 1 },
      { kind: "constraint", value: "nonzero" },
    ],
  };
  const market: ContextActionOption = {
    value: "0xmarket",
    label: "USDC",
    max: "17907668532",
    decimals: 6,
  };

  it("prefers the spend reference when both a spend and an inherit reference exist", () => {
    const input: InputReference = {
      name: "amount",
      type: "uint256",
      tags: [
        { kind: "decimal", value: "inherit", reference: 1 },
        { kind: "spend", value: "0" },
      ],
    };
    const options: Record<number, ContextActionOption> = {
      0: { value: "0xatoken", label: "aUSDC", max: "1000000", decimals: 6 },
      1: market,
    };
    expect(readInputCeiling(input, (ref) => options[ref])).toBe(options[0]);
  });

  it("falls back to the inherit reference when the input carries no spend tag", () => {
    const options: Record<number, ContextActionOption> = { 1: market };
    const ceiling = readInputCeiling(withdrawAmount, (ref) => options[ref]);
    expect(ceiling).toBe(market);
    expect(optionMaxAmount(ceiling!)).toBe("17907.668532");
  });

  it("falls through to the inherit reference when the spend option carries no max", () => {
    const input: InputReference = {
      name: "amount",
      type: "uint256",
      tags: [
        { kind: "spend", value: "0" },
        { kind: "decimal", value: "inherit", reference: 1 },
      ],
    };
    const options: Record<number, ContextActionOption> = {
      0: { value: "0xatoken", label: "aUSDC" },
      1: market,
    };
    expect(readInputCeiling(input, (ref) => options[ref])).toBe(market);
  });

  it("yields undefined when the inherit option carries no max", () => {
    expect(
      readInputCeiling(withdrawAmount, () => ({ value: "0xmarket", label: "USDC", decimals: 6 })),
    ).toBeUndefined();
    expect(readInputCeiling(withdrawAmount, () => undefined)).toBeUndefined();
  });

  it("yields undefined for an inherit tag with no reference and for untagged inputs", () => {
    const bare: InputReference = {
      name: "amount",
      type: "uint256",
      tags: [{ kind: "decimal", value: "inherit" }],
    };
    expect(readInputCeiling(bare, () => market)).toBeUndefined();
    expect(readInputCeiling({ name: "x", type: "uint256" }, () => market)).toBeUndefined();
    expect(readInputCeiling(undefined, () => market)).toBeUndefined();
  });
  // The ERC-1155 transfer shape: a whole count read at zero decimals, picked
  // within the collection and the id chosen before it, whose own options are
  // the balance held of that id.
  const editionAmount: InputReference = {
    name: "amount",
    type: "uint256",
    tags: [
      { kind: "decimal", value: "0" },
      { kind: "constraint", value: "nonzero" },
    ],
  };
  const held: ContextActionOption = {
    value: "134",
    label: "134",
    name: "All held",
    max: "134",
    decimals: 0,
  };

  it("bounds an amount by its own held option when it references no asset", () => {
    const ceiling = readInputCeiling(editionAmount, () => undefined, [held]);
    expect(ceiling).toBe(held);
    expect(optionMaxAmount(ceiling!)).toBe("134");
  });

  it("prefers a referenced asset's ceiling over the amount's own options", () => {
    const options: Record<number, ContextActionOption> = { 1: market };
    expect(readInputCeiling(withdrawAmount, (ref) => options[ref], [held])).toBe(market);
  });

  it("yields undefined when the amount's own options carry no max", () => {
    expect(
      readInputCeiling(editionAmount, () => undefined, [{ value: "5", label: "5" }]),
    ).toBeUndefined();
  });
});
