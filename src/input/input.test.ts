import { describe, expect, it } from "vitest";
import { isConstantType, getTypeDescription, getInputPlaceholder } from "./input";

describe("isConstantType", () => {
  it("should identify constant types", () => {
    const result = isConstantType({ constant: "1" });
    expect(result.isConstant).toBe(true);
    expect(result.value).toBe("1");
  });

  it("should reject string types", () => {
    expect(isConstantType("uint256").isConstant).toBe(false);
  });

  it("should reject undefined", () => {
    expect(isConstantType(undefined).isConstant).toBe(false);
  });

  it("should reject compound types", () => {
    expect(isConstantType({ type: "uint256", metadata: ["uint8"] }).isConstant).toBe(false);
  });

  it("should reject conditional types", () => {
    expect(
      isConstantType({
        left: { literal: "1" },
        operator: "==",
        right: { reference: 0 },
        trueType: "uint256",
        falseType: "null",
      }).isConstant,
    ).toBe(false);
  });
});

describe("getTypeDescription", () => {
  it("should return empty string for undefined", () => {
    expect(getTypeDescription(undefined)).toBe("");
  });

  it("should describe string EVM types", () => {
    expect(getTypeDescription("uint256")).toBe("Type: uint256");
    expect(getTypeDescription("address")).toBe("Type: address");
    expect(getTypeDescription("bool")).toBe("Type: bool");
  });

  it("should describe constant types", () => {
    expect(getTypeDescription({ constant: "42" })).toBe('Must be: "42"');
  });

  it("should describe compound types with metadata", () => {
    expect(getTypeDescription({ type: "uint256", metadata: ["uint8", "address"] })).toBe(
      "Type: uint256 with uint8, address",
    );
  });

  it("should describe conditional types", () => {
    expect(
      getTypeDescription({
        left: { literal: "1" },
        operator: "==",
        right: { reference: 0 },
        trueType: "uint256",
        falseType: "null",
      }),
    ).toBe("Conditional type");
  });

  it("should return empty string for union types", () => {
    expect(getTypeDescription({ types: ["uint256", "address"] })).toBe("");
  });
});

describe("getInputPlaceholder", () => {
  it("should return empty string for undefined", () => {
    expect(getInputPlaceholder(undefined)).toBe("");
  });

  it("should return specific placeholders for known EVM types", () => {
    expect(getInputPlaceholder("uint256")).toBe("Enter a positive number");
    expect(getInputPlaceholder("address")).toBe("0x...");
    expect(getInputPlaceholder("bool")).toBe("true or false");
    expect(getInputPlaceholder("string")).toBe("Enter text");
  });

  it("should return generic placeholder for unknown string types", () => {
    expect(getInputPlaceholder("bytes32")).toBe("Enter bytes32");
    expect(getInputPlaceholder("int128")).toBe("Enter int128");
  });

  it("should return placeholder for constant types", () => {
    expect(getInputPlaceholder({ constant: "42" })).toBe("Must be: 42");
  });

  it("should return placeholder for compound types", () => {
    expect(getInputPlaceholder({ type: "uint256", metadata: ["uint8"] })).toBe("Enter uint256 value");
  });

  it("should return generic fallback for union types", () => {
    expect(getInputPlaceholder({ types: ["uint256", "address"] })).toBe("Enter value");
  });
});
