import { describe, expect, it } from "vitest";
import { readInputSentinels, sentinelAmount } from "./sentinel";
import { InputReference, Sentinel } from "../types/sentence";
import { ContextActionOption } from "./option";

// An amount input that offers a "max" sentinel sourced from the option chosen for
// the upstream token input at index 0.
const amountInput: InputReference = {
  name: "amount",
  type: "uint256",
  tags: [{ kind: "sentinel", value: Sentinel.Max, reference: 0 }],
};

const optionWithSentinel = (
  sentinel: ContextActionOption | undefined,
): ContextActionOption => ({ value: "0xtoken", label: "USDC", sentinel });

describe("sentinelAmount", () => {
  it("scales the base-units value by the paired decimals and trims zeros", () => {
    expect(
      sentinelAmount({ label: "max", value: "1500000", info: { value: "6" } }),
    ).toBe("1.5");
    expect(
      sentinelAmount({
        label: "max",
        value: "1000000000000000000",
        info: { value: "18" },
      }),
    ).toBe("1");
  });

  it("treats a sentinel with no decimals scalar as already display-ready", () => {
    expect(sentinelAmount({ label: "max", value: "42" })).toBe("42");
  });

  it("yields undefined when there is no value to fill", () => {
    expect(sentinelAmount({ label: "max" })).toBeUndefined();
  });
});

describe("readInputSentinels", () => {
  it("returns the sentinel option hanging off the referenced chosen option", () => {
    const sentinel: ContextActionOption = {
      label: "max",
      value: "1500000",
      info: { value: "6" },
    };
    const result = readInputSentinels(amountInput, () =>
      optionWithSentinel(sentinel),
    );
    expect(result).toEqual([sentinel]);
    expect(sentinelAmount(result[0])).toBe("1.5");
  });

  it("resolves a kind other than max — nothing is special-cased", () => {
    const input: InputReference = {
      name: "amount",
      type: "uint256",
      tags: [{ kind: "sentinel", value: "half", reference: 0 }],
    };
    const sentinel: ContextActionOption = { label: "half", value: "500000" };
    expect(
      readInputSentinels(input, () => optionWithSentinel(sentinel)),
    ).toEqual([sentinel]);
  });

  it("returns one option per sentinel-kind tag the input declares", () => {
    const input: InputReference = {
      name: "amount",
      type: "uint256",
      tags: [
        { kind: "sentinel", value: "max", reference: 0 },
        { kind: "sentinel", value: "half", reference: 1 },
      ],
    };
    const sentinels: Record<number, ContextActionOption> = {
      0: { label: "max", value: "1000000", info: { value: "6" } },
      1: { label: "half", value: "500000", info: { value: "6" } },
    };
    const options: Record<number, ContextActionOption> = {
      0: optionWithSentinel(sentinels[0]),
      1: optionWithSentinel(sentinels[1]),
    };
    expect(readInputSentinels(input, (ref) => options[ref])).toEqual([
      sentinels[0],
      sentinels[1],
    ]);
  });

  it("skips a sentinel whose referenced option is unresolved", () => {
    expect(readInputSentinels(amountInput, () => undefined)).toEqual([]);
  });

  it("skips a referenced option that carries no sentinel", () => {
    expect(
      readInputSentinels(amountInput, () => optionWithSentinel(undefined)),
    ).toEqual([]);
  });

  it("skips a sentinel with no value to fill", () => {
    expect(
      readInputSentinels(amountInput, () =>
        optionWithSentinel({ label: "max" }),
      ),
    ).toEqual([]);
  });

  it("ignores non-sentinel tags and inputs without tags", () => {
    const tokenInput: InputReference = {
      name: "token",
      type: "address",
      tags: [{ kind: "standard", value: "token" }],
    };
    expect(
      readInputSentinels(tokenInput, () => optionWithSentinel(undefined)),
    ).toEqual([]);
    expect(
      readInputSentinels({ name: "x", type: "uint256" }, () => undefined),
    ).toEqual([]);
    expect(readInputSentinels(undefined, () => undefined)).toEqual([]);
  });
});
