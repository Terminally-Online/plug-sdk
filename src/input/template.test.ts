import { describe, expect, it } from "vitest";

import { parseTemplate, referencedIndices } from "./template";

describe("parseTemplate", () => {
  it("interleaves text runs and input slots", () => {
    expect(parseTemplate("Deposit {0} {1} into {2}")).toEqual([
      { kind: "text", text: "Deposit " },
      { kind: "input", index: 0 },
      { kind: "text", text: " " },
      { kind: "input", index: 1 },
      { kind: "text", text: " into " },
      { kind: "input", index: 2 },
    ]);
  });

  it("parses a coil-marked token to its index", () => {
    expect(parseTemplate("{~3}")).toEqual([{ kind: "input", index: 3 }]);
  });

  it("targets the redirect of a {N=>M} token", () => {
    expect(parseTemplate("{1=>2}")).toEqual([{ kind: "input", index: 2 }]);
    expect(parseTemplate("{~1=>2}")).toEqual([{ kind: "input", index: 2 }]);
  });

  it("keeps an unknown brace group as text", () => {
    expect(parseTemplate("Take {amount} out")).toEqual([
      { kind: "text", text: "Take " },
      { kind: "text", text: "{amount}" },
      { kind: "text", text: " out" },
    ]);
  });

  it("handles adjacent, leading, and trailing tokens without empty segments", () => {
    expect(parseTemplate("{0}{1}")).toEqual([
      { kind: "input", index: 0 },
      { kind: "input", index: 1 },
    ]);
    expect(parseTemplate("{0} end")).toEqual([
      { kind: "input", index: 0 },
      { kind: "text", text: " end" },
    ]);
  });

  it("returns no segments for an empty template", () => {
    expect(parseTemplate("")).toEqual([]);
  });
});

describe("referencedIndices", () => {
  it("collects the inline-placed input indices", () => {
    const segments = parseTemplate("Use {0} where {1=>4} is {~2}");
    expect(referencedIndices(segments)).toEqual(new Set([0, 4, 2]));
  });
});
