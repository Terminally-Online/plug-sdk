import { describe, expect, it } from "vitest";
import {
  isAddressType,
  isConstantType,
  isModeType,
  isNumberType,
  getTypeDescription,
  getInputPlaceholder,
  walletVariant,
} from "./input";
import { InputReference } from "../lib/types/sentence";
import { InputTypeSchema, ModeTypeSchema } from "../lib/types/sentence";

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
    expect(
      isConstantType({ type: "uint256", metadata: ["uint8"] }).isConstant,
    ).toBe(false);
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
    expect(
      getTypeDescription({ type: "uint256", metadata: ["uint8", "address"] }),
    ).toBe("Type: uint256 with uint8, address");
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
    expect(getInputPlaceholder({ type: "uint256", metadata: ["uint8"] })).toBe(
      "Enter uint256 value",
    );
  });

  it("should return generic fallback for union types", () => {
    expect(getInputPlaceholder({ types: ["uint256", "address"] })).toBe(
      "Enter value",
    );
  });

  it("should prompt for a verb on mode types", () => {
    expect(getInputPlaceholder({ modes: ["is", "if", "require"] })).toBe(
      "Pick a verb",
    );
  });
});

describe("getInputPlaceholder — named slots", () => {
  it("names numeric slots with the correct article", () => {
    expect(getInputPlaceholder("uint256", "amount")).toBe("Enter an amount");
    expect(getInputPlaceholder("uint128", "deadline")).toBe("Enter a deadline");
    expect(getInputPlaceholder("int256", "offset")).toBe("Enter an offset");
  });

  it("names address slots instead of showing the 0x hint", () => {
    expect(getInputPlaceholder("address", "recipient")).toBe(
      "Enter a recipient",
    );
    expect(getInputPlaceholder("address", "owner")).toBe("Enter an owner");
  });

  it("names string and bytes slots", () => {
    expect(getInputPlaceholder("string", "message")).toBe("Enter a message");
    expect(getInputPlaceholder("bytes32", "signature")).toBe(
      "Enter a signature",
    );
  });

  it("humanizes camelCase and snake_case slot names", () => {
    expect(getInputPlaceholder("uint256", "minAmountOut")).toBe(
      "Enter a min amount out",
    );
    expect(getInputPlaceholder("address", "token_address")).toBe(
      "Enter a token address",
    );
  });

  it("keeps acronyms uppercase and picks the article from their spoken sound", () => {
    expect(getInputPlaceholder("bytes32", "ID")).toBe("Enter an ID");
    expect(getInputPlaceholder("string", "URL")).toBe("Enter a URL");
  });

  it("resolves the you-sound and silent-h exceptions", () => {
    expect(getInputPlaceholder("address", "user")).toBe("Enter a user");
    expect(getInputPlaceholder("uint256", "unit")).toBe("Enter a unit");
    expect(getInputPlaceholder("uint256", "hour")).toBe("Enter an hour");
  });

  it("phrases booleans around the slot name", () => {
    expect(getInputPlaceholder("bool", "approved")).toBe(
      "Enter approved (true or false)",
    );
  });

  it("names constant and mode slots", () => {
    expect(getInputPlaceholder({ constant: "0" }, "mode")).toBe(
      "Mode must be 0",
    );
    expect(getInputPlaceholder({ modes: ["is", "if"] }, "condition")).toBe(
      "Pick a condition",
    );
  });

  it("names compound and union slots", () => {
    expect(
      getInputPlaceholder({ type: "uint256", metadata: ["uint8"] }, "amount"),
    ).toBe("Enter an amount");
    expect(
      getInputPlaceholder({ types: ["uint256", "address"] }, "value"),
    ).toBe("Enter a value");
  });

  it("falls back to the type placeholder for blank names", () => {
    expect(getInputPlaceholder("uint256", "")).toBe("Enter a positive number");
    expect(getInputPlaceholder("uint256", "   ")).toBe(
      "Enter a positive number",
    );
    expect(getInputPlaceholder("address", undefined)).toBe("0x...");
  });
});

describe("isModeType", () => {
  it("identifies mode types and returns the declared modes", () => {
    const result = isModeType({ modes: ["is", "if", "if_not"] });
    expect(result.isMode).toBe(true);
    expect(result.modes).toEqual(["is", "if", "if_not"]);
  });

  it("rejects EVM, constant, compound, and conditional types", () => {
    expect(isModeType("uint256").isMode).toBe(false);
    expect(isModeType({ constant: "42" }).isMode).toBe(false);
    expect(isModeType({ type: "uint256", metadata: ["uint8"] }).isMode).toBe(
      false,
    );
    expect(
      isModeType({
        left: { literal: "1" },
        operator: "==",
        right: { reference: 0 },
        trueType: "uint256",
        falseType: "null",
      }).isMode,
    ).toBe(false);
  });

  it("rejects undefined", () => {
    expect(isModeType(undefined).isMode).toBe(false);
  });
});

describe("ModeTypeSchema", () => {
  it("accepts the canonical 7-verb predicate shape gusher emits", () => {
    const parsed = ModeTypeSchema.parse({
      modes: ["is", "if", "if_not", "else_if", "for", "until", "require"],
    });
    expect(parsed.modes.length).toBe(7);
  });

  it("accepts a declared subset", () => {
    expect(ModeTypeSchema.parse({ modes: ["is"] }).modes).toEqual(["is"]);
  });

  it("rejects empty mode lists — every mode-typed slot must declare at least one verb", () => {
    expect(() => ModeTypeSchema.parse({ modes: [] })).toThrow();
  });

  it("rejects unknown verbs so SDK drift surfaces loudly", () => {
    expect(() => ModeTypeSchema.parse({ modes: ["switch"] })).toThrow();
  });
});

describe("InputTypeSchema", () => {
  it("accepts ModeType at the top level of an input slot", () => {
    const parsed = InputTypeSchema.parse({ modes: ["is", "if", "require"] });
    expect(parsed).toEqual({ modes: ["is", "if", "require"] });
  });

  it("still accepts the existing type shapes", () => {
    expect(InputTypeSchema.parse("uint256")).toBe("uint256");
    expect(InputTypeSchema.parse({ constant: "42" })).toEqual({
      constant: "42",
    });
    expect(
      InputTypeSchema.parse({ type: "uint256", metadata: ["uint8"] }),
    ).toEqual({
      type: "uint256",
      metadata: ["uint8"],
    });
  });
});

describe("getTypeDescription — mode type", () => {
  it("describes mode types with the declared verbs", () => {
    expect(getTypeDescription({ modes: ["is", "if", "require"] })).toBe(
      "Verb (is | if | require)",
    );
  });
});

describe("isNumberType", () => {
  it("is true for integer EVM types", () => {
    expect(isNumberType("uint256")).toBe(true);
    expect(isNumberType("int128")).toBe(true);
    expect(isNumberType("uint8")).toBe(true);
  });

  it("is false for non-numeric types and undefined", () => {
    expect(isNumberType("address")).toBe(false);
    expect(isNumberType("string")).toBe(false);
    expect(isNumberType("bool")).toBe(false);
    expect(isNumberType({ constant: "1" })).toBe(false);
    expect(isNumberType(undefined)).toBe(false);
  });
});

describe("walletVariant", () => {
  const withTags = (tags: InputReference["tags"]): InputReference => ({
    type: "address",
    tags,
  });

  it("returns self only when the wallet tag is qualified self", () => {
    expect(
      walletVariant(
        withTags([{ kind: "standard", value: "wallet", qualifiers: ["self"] }]),
      ),
    ).toBe("self");
  });

  it("returns external for an explicit external qualifier", () => {
    expect(
      walletVariant(
        withTags([
          { kind: "standard", value: "wallet", qualifiers: ["external"] },
        ]),
      ),
    ).toBe("external");
  });

  it("defaults a bare wallet tag to external", () => {
    expect(
      walletVariant(withTags([{ kind: "standard", value: "wallet" }])),
    ).toBe("external");
  });

  it("returns undefined for non-wallet inputs", () => {
    expect(
      walletVariant(withTags([{ kind: "standard", value: "token" }])),
    ).toBeUndefined();
    expect(walletVariant(withTags([]))).toBeUndefined();
    expect(walletVariant(undefined)).toBeUndefined();
  });
});

describe("isAddressType", () => {
  it("is true only for the address type", () => {
    expect(isAddressType("address")).toBe(true);
  });

  it("is false for non-address types and undefined", () => {
    expect(isAddressType("uint256")).toBe(false);
    expect(isAddressType("string")).toBe(false);
    expect(isAddressType("bool")).toBe(false);
    expect(isAddressType({ constant: "0x0" })).toBe(false);
    expect(isAddressType(undefined)).toBe(false);
  });
});
