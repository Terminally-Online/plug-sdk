import { describe, expect, it } from "vitest";

import { ContextStep } from "../lib/schemas/context";
import { InputReference } from "../lib/types/sentence";
import {
  ContextInputDeclarative,
  PartSource,
  resolveDeclarativeParts,
  resolveImperativeParts,
} from "./parts";

const step = (over: Partial<ContextStep>): ContextStep => ({
  type: "action",
  name: "test",
  description: "",
  icon: "",
  sentence: { raw: "", template: "", inputs: [] },
  ...over,
});

const withInputs = (
  inputs: InputReference[],
  over: Partial<ContextStep> = {},
  template = "",
): ContextStep => {
  const base = step(over);
  return { ...base, sentence: { raw: "", template, inputs } };
};

const slots = (parts: ContextInputDeclarative[]) =>
  parts.filter((part) => part.kind === "input");

const token = (): InputReference => ({
  name: "token",
  type: "address",
  tags: [{ kind: "standard", value: "token" }],
});

const market = (requires?: number[]): InputReference => ({
  name: "market",
  type: "address",
  requires,
  tags: [{ kind: "standard", value: "market" }],
});

const wallet = (qualifier: "self" | "external"): InputReference => ({
  name: "wallet",
  type: "address",
  tags: [{ kind: "standard", value: "wallet", qualifiers: [qualifier] }],
});

const amount = (): InputReference => ({ name: "amount", type: "uint256" });

describe("resolveImperativeParts", () => {
  it("pins a launch value onto the input it names", () => {
    const action = withInputs([token(), amount()]);
    const parts = resolveImperativeParts(action, {
      pins: { "0": "0xaaa" },
    });
    expect(parts[0].value).toBe("0xaaa");
    expect(parts[0].source).toBe(PartSource.Pinned);
    expect(parts[1].value).toBeUndefined();
    expect(parts[1].source).toBeUndefined();
  });

  it("prefers the caller's commit over a pin", () => {
    const action = withInputs([token()]);
    const parts = resolveImperativeParts(action, {
      pins: { "0": "0xaaa" },
      selections: { "0": "0xbbb" },
    });
    expect(parts[0].value).toBe("0xbbb");
    expect(parts[0].source).toBe(PartSource.Selected);
  });

  it("resolves a self wallet slot from the session and never an external one", () => {
    const action = withInputs([wallet("self"), wallet("external")]);
    const parts = resolveImperativeParts(action, { address: "0xme" });
    expect(parts[0].value).toBe("0xme");
    expect(parts[0].source).toBe(PartSource.Self);
    expect(parts[1].value).toBeUndefined();
  });

  it("pins by index, never by tag: a second token slot stays open", () => {
    const action = withInputs([token(), token()]);
    const parts = resolveImperativeParts(action, {
      pins: { "1": "0xaaa" },
    });
    expect(parts[0].value).toBeUndefined();
    expect(parts[1].value).toBe("0xaaa");
    expect(parts[1].source).toBe(PartSource.Pinned);
  });

  it("never fills a lone surviving option", () => {
    const action = withInputs([token()], {
      options: { "0": [{ label: "A", value: "0xaaa" }] },
    });
    const parts = resolveImperativeParts(action, {});
    expect(parts[0].options).toHaveLength(1);
    expect(parts[0].value).toBeUndefined();
  });

  it("matches chosen canonically across checksum casing", () => {
    const action = withInputs([token()], {
      options: { "0": [{ label: "A", value: "0xaabb" }] },
    });
    const parts = resolveImperativeParts(action, {
      pins: { "0": "0xAaBb" },
    });
    expect(parts[0].chosen?.label).toBe("A");
  });

  it("resolves a dependent's subtree downward from a pinned parent", () => {
    const action = withInputs([token(), market([0])], {
      options: {
        "0": [
          { label: "A", value: "0xaaa" },
          { label: "B", value: "0xbbb" },
        ],
        "1": { "0xaaa": [{ label: "M1", value: "0xm1" }], "0xbbb": [{ label: "M2", value: "0xm2" }] },
      },
    });
    const parts = resolveImperativeParts(action, {
      pins: { "0": "0xaaa" },
    });
    expect(parts[1].options?.map((option) => option.label)).toEqual(["M1"]);
  });

  it("narrows a parent upward through a pinned dependent", () => {
    const action = withInputs([token(), market([0])], {
      options: {
        "0": [
          { label: "A", value: "0xaaa" },
          { label: "B", value: "0xbbb" },
        ],
        "1": { "0xaaa": [{ label: "M1", value: "0xm1" }], "0xbbb": [{ label: "M2", value: "0xm2" }] },
      },
    });
    const parts = resolveImperativeParts(action, {
      pins: { "1": "0xM1" },
    });
    expect(parts[0].options?.map((option) => option.label)).toEqual(["A"]);
    expect(parts[1].value).toBe("0xM1");
    expect(parts[1].source).toBe(PartSource.Pinned);
  });

  it("surfaces a meta prefill without threading it into resolution", () => {
    const action = withInputs([token(), market([0])], {
      options: {
        "0": [
          { label: "A", value: "0xaaa" },
          { label: "B", value: "0xbbb" },
        ],
        "1": { "0xaaa": [{ label: "M1", value: "0xm1" }], "0xbbb": [{ label: "M2", value: "0xm2" }] },
      },
      meta: { inputs: { "0": { value: "0xaaa" } } },
    });
    const parts = resolveImperativeParts(action, {});
    expect(parts[0].value).toBe("0xaaa");
    expect(parts[0].source).toBe(PartSource.Meta);
    // Meta never threads: the dependent's subtree stays unresolved and the
    // parent's list stays unnarrowed.
    expect(parts[1].options).toBeUndefined();
    expect(parts[0].options).toHaveLength(2);
  });

  it("returns empty for a missing action", () => {
    expect(resolveImperativeParts(undefined, {})).toEqual([]);
  });
});

describe("cascadeFills", () => {
  it("fills a lone survivor as source only, with its chosen matched", () => {
    const action = withInputs([token()], {
      options: { "0": [{ label: "A", value: "0xaaa" }] },
    });
    const parts = resolveImperativeParts(action, { cascadeFills: true });
    expect(parts[0].value).toBe("0xaaa");
    expect(parts[0].source).toBe(PartSource.Only);
    expect(parts[0].chosen?.label).toBe("A");
  });

  it("cascades forward: a fill resolves the dependent's subtree, which fills too", () => {
    const action = withInputs([token(), market([0])], {
      options: {
        "0": [{ label: "A", value: "0xaaa" }],
        "1": { "0xaaa": [{ label: "M1", value: "0xm1" }] },
      },
    });
    const parts = resolveImperativeParts(action, { cascadeFills: true });
    expect(parts[0].source).toBe(PartSource.Only);
    expect(parts[1].value).toBe("0xm1");
    expect(parts[1].source).toBe(PartSource.Only);
  });

  it("fills a parent narrowed to one by a pinned dependent", () => {
    const action = withInputs([token(), market([0])], {
      options: {
        "0": [
          { label: "A", value: "0xaaa" },
          { label: "B", value: "0xbbb" },
        ],
        "1": { "0xaaa": [{ label: "M1", value: "0xm1" }], "0xbbb": [{ label: "M2", value: "0xm2" }] },
      },
    });
    const parts = resolveImperativeParts(action, {
      pins: { "1": "0xm1" },
      cascadeFills: true,
    });
    expect(parts[0].value).toBe("0xaaa");
    expect(parts[0].source).toBe(PartSource.Only);
  });

  it("never fills an input the caller is searching, even narrowed to one", () => {
    const action = withInputs([token(), market([0])], {
      options: {
        "0": [{ label: "A", value: "0xaaa" }],
        "1": { "0xaaa": [{ label: "Prime", value: "0xm2" }] },
      },
    });
    const parts = resolveImperativeParts(action, {
      cascadeFills: true,
      searched: ["1"],
    });
    expect(parts[0].source).toBe(PartSource.Only);
    expect(parts[1].value).toBeUndefined();
    expect(parts[1].options).toHaveLength(1);
  });

  it("never fills a wallet slot, even with a single suggestion", () => {
    const action = withInputs([wallet("external")], {
      options: { "0": [{ label: "Yourself", value: "0xme" }] },
    });
    const parts = resolveImperativeParts(action, { cascadeFills: true });
    expect(parts[0].value).toBeUndefined();
  });
});

describe("resolveDeclarativeParts", () => {
  const OPTIONS = {
    "0": [
      { label: "A", value: "0xaaa" },
      { label: "B", value: "0xbbb" },
    ],
    "1": { "0xaaa": [{ label: "M1", value: "0xm1" }], "0xbbb": [{ label: "M2", value: "0xm2" }] },
  };

  it("renders a slot-less sentence as its text", () => {
    const action = withInputs([], {}, "End block");
    const parts = resolveDeclarativeParts(action, { values: [] });
    expect(parts.map((part) => part.kind)).toEqual(["text"]);
    expect(parts).toHaveLength(1);
  });

  it("interleaves text and input slots carrying resolution facts", () => {
    const action = withInputs(
      [token(), market([0])],
      { options: OPTIONS },
      "Deposit {0} into {1}",
    );
    const parts = resolveDeclarativeParts(action, {
      values: [{ value: "0xaaa" }],
    });
    expect(parts.map((part) => part.kind)).toEqual(["text", "input", "text", "input"]);
    const [tokenSlot, marketSlot] = slots(parts);
    expect(tokenSlot.value).toBe("0xaaa");
    expect(tokenSlot.source).toBe(PartSource.Selected);
    expect(tokenSlot.chosen?.label).toBe("A");
    // The stored parent resolves the dependent's subtree downward.
    expect(marketSlot.options?.map((option) => option.label)).toEqual(["M1"]);
  });

  it("dereferences a tag ref for chosen while preserving the raw value", () => {
    const action = withInputs([token()], { options: OPTIONS }, "{0}");
    const parts = resolveDeclarativeParts(action, {
      values: [{ value: "<~{0.1}" }],
      actions: [{ values: [undefined, { value: "0xaaa" }] }],
    });
    const [slot] = slots(parts);
    expect(slot.value).toBe("<~{0.1}");
    expect(slot.chosen?.label).toBe("A");
  });

  it("carries a raw coil ref with no chosen", () => {
    const action = withInputs([token()], { options: OPTIONS }, "{0}");
    const parts = resolveDeclarativeParts(action, {
      values: [{ value: "<-{0.amount}" }],
    });
    const [slot] = slots(parts);
    expect(slot.value).toBe("<-{0.amount}");
    expect(slot.chosen).toBeUndefined();
  });

  it("projects a mode slot with no options and no crash", () => {
    const action = withInputs(
      [{ name: "verb", type: { modes: ["is", "if"] } }],
      {},
      "{0} true",
    );
    const parts = resolveDeclarativeParts(action, {});
    const [slot] = slots(parts);
    expect(slot.options).toBeUndefined();
    expect(slot.value).toBeUndefined();
  });

  it("drops a token targeting an undeclared input", () => {
    const action = withInputs([token()], {}, "Use {5}");
    const parts = resolveDeclarativeParts(action, {});
    expect(parts).toEqual([{ kind: "text", text: "Use " }]);
  });

  it("cascades fills through the shared pass", () => {
    const action = withInputs(
      [token(), market([0])],
      {
        options: {
          "0": [{ label: "A", value: "0xaaa" }],
          "1": { "0xaaa": [{ label: "M1", value: "0xm1" }] },
        },
      },
      "{0} into {1}",
    );
    const parts = resolveDeclarativeParts(action, { cascadeFills: true });
    const [tokenSlot, marketSlot] = slots(parts);
    expect(tokenSlot.source).toBe(PartSource.Only);
    expect(marketSlot.value).toBe("0xm1");
    expect(marketSlot.source).toBe(PartSource.Only);
  });
});
