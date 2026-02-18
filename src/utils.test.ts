import { describe, expect, it } from "vitest";
import { transformSentence, formatActionName, getCommonPrefix } from "@/src/utils";

describe("transformSentence", () => {
  it("should transform simple name placeholder", () => {
    expect(transformSentence("Swap {0<amount>} tokens")).toBe("Swap amount tokens");
  });

  it("should strip type suffix after colon", () => {
    expect(transformSentence("Swap {0<amount:uint256>} tokens")).toBe("Swap amount tokens");
  });

  it("should handle redirect index syntax", () => {
    expect(transformSentence("Send {0=>1<recipient:address>}")).toBe("Send recipient");
  });

  it("should leave empty-name placeholders untouched", () => {
    expect(transformSentence("Value {0<>}")).toBe("Value {0<>}");
  });

  it("should leave empty-name redirect placeholders untouched", () => {
    expect(transformSentence("Value {0=>2<>}")).toBe("Value {0=>2<>}");
  });

  it("should handle multiple placeholders", () => {
    expect(transformSentence("Swap {0<amount:uint256>} of {1<token:address>}")).toBe(
      "Swap amount of token",
    );
  });

  it("should pass through strings with no placeholders", () => {
    expect(transformSentence("No placeholders here")).toBe("No placeholders here");
  });

  it("should not transform bare index placeholders without angle brackets", () => {
    expect(transformSentence("Value {0}")).toBe("Value {0}");
  });
});

describe("formatActionName", () => {
  it("should convert snake_case to Title Case", () => {
    expect(formatActionName("swap_tokens")).toBe("Swap Tokens");
  });

  it("should handle single word", () => {
    expect(formatActionName("swap")).toBe("Swap");
  });

  it("should handle empty string", () => {
    expect(formatActionName("")).toBe("");
  });

  it("should handle multiple underscores", () => {
    expect(formatActionName("get_user_balance")).toBe("Get User Balance");
  });

  it("should handle already capitalized input", () => {
    expect(formatActionName("Swap_Tokens")).toBe("Swap Tokens");
  });
});

describe("getCommonPrefix", () => {
  it("should return empty string for empty array", () => {
    expect(getCommonPrefix([])).toBe("");
  });

  it("should return the full string for single-element array", () => {
    expect(getCommonPrefix(["hello world"])).toBe("hello world");
  });

  it("should find common prefix across multiple strings", () => {
    expect(getCommonPrefix(["Swap ETH", "Swap USDC", "Swap DAI"])).toBe("Swap ");
  });

  it("should return empty string when no common prefix exists", () => {
    expect(getCommonPrefix(["abc", "xyz"])).toBe("");
  });

  it("should handle case-insensitive matching preserving first string casing", () => {
    expect(getCommonPrefix(["Hello", "hello", "HELLO"])).toBe("Hello");
  });

  it("should handle strings of different lengths", () => {
    expect(getCommonPrefix(["abc", "ab", "abcdef"])).toBe("ab");
  });

  it("should handle identical strings", () => {
    expect(getCommonPrefix(["same", "same", "same"])).toBe("same");
  });
});
