import { describe, expect, it } from "vitest";
import { optionMaxAmount, readInputSpends } from "./spend";
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
