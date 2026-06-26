import { describe, expect, it } from "vitest";
import { readInputSentinels, sentinelAmount } from "./sentinel";
import { InputReference, Sentinel } from "../types/sentence";
import { ContextActionOption } from "./option";

// An amount input that offers a "max" sentinel sourced from the token option chosen
// for the upstream token input at index 0.
const amountInput: InputReference = {
  name: "amount",
  type: "uint256",
  tags: [{ kind: "sentinel", value: Sentinel.Max, reference: 0 }],
};

describe("sentinelAmount", () => {
  it("scales the base-units max by decimals and trims zeros", () => {
    expect(sentinelAmount({ value: "0xtoken", max: "1500000", decimals: 6 })).toBe("1.5");
    expect(
      sentinelAmount({ value: "0xtoken", max: "1000000000000000000", decimals: 18 }),
    ).toBe("1");
  });

  it("treats a max with no decimals as already display-ready", () => {
    expect(sentinelAmount({ value: "0xtoken", max: "42" })).toBe("42");
  });

  it("yields undefined when the option carries no max", () => {
    expect(sentinelAmount({ value: "0xtoken", label: "USDC" })).toBeUndefined();
  });
});

describe("readInputSentinels", () => {
  it("returns the referenced token option when it carries a max", () => {
    const token: ContextActionOption = {
      value: "0xtoken",
      label: "USDC",
      max: "1500000",
      decimals: 6,
    };
    const result = readInputSentinels(amountInput, () => token);
    expect(result).toEqual([token]);
    expect(sentinelAmount(result[0])).toBe("1.5");
  });

  it("returns one option per sentinel-kind tag the input declares", () => {
    const input: InputReference = {
      name: "amount",
      type: "uint256",
      tags: [
        { kind: "sentinel", value: "max", reference: 0 },
        { kind: "sentinel", value: "max", reference: 1 },
      ],
    };
    const options: Record<number, ContextActionOption> = {
      0: { value: "0xa", label: "A", max: "1000000", decimals: 6 },
      1: { value: "0xb", label: "B", max: "500000", decimals: 6 },
    };
    expect(readInputSentinels(input, (ref) => options[ref])).toEqual([
      options[0],
      options[1],
    ]);
  });

  it("skips a sentinel whose referenced option is unresolved", () => {
    expect(readInputSentinels(amountInput, () => undefined)).toEqual([]);
  });

  it("skips a referenced option that carries no max", () => {
    expect(
      readInputSentinels(amountInput, () => ({ value: "0xtoken", label: "USDC" })),
    ).toEqual([]);
  });

  it("ignores non-sentinel tags and inputs without tags", () => {
    const tokenInput: InputReference = {
      name: "token",
      type: "address",
      tags: [{ kind: "standard", value: "token" }],
    };
    expect(
      readInputSentinels(tokenInput, () => ({ value: "0xt", max: "1", decimals: 6 })),
    ).toEqual([]);
    expect(
      readInputSentinels({ name: "x", type: "uint256" }, () => undefined),
    ).toEqual([]);
    expect(readInputSentinels(undefined, () => undefined)).toEqual([]);
  });
});
