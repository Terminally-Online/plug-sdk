import { describe, expect, it } from "vitest";

import { ContextProtocolSchema, ContextStepSchema } from "./context";

const protocol = {
  name: "Arcadia",
  symbol: "ARCADIA",
  icon: "https://cdn.plug.to/protocols/arcadia.png",
  tags: [],
  chains: [],
};

describe("ContextProtocolSchema", () => {
  it("keeps the colour a protocol is served with", () => {
    const parsed = ContextProtocolSchema.parse({ ...protocol, color: "#2F6BFF" });
    expect(parsed.color).toBe("#2F6BFF");
  });

  it("reads a protocol served without a colour", () => {
    const parsed = ContextProtocolSchema.parse(protocol);
    expect(parsed.color).toBeUndefined();
  });
});

describe("ContextStepSchema", () => {
  const step = {
    type: "action",
    sentence: { raw: "Supply {0}", template: "Supply {0}", inputs: [] },
    name: "Supply",
    description: "Supplies an asset.",
    icon: "https://cdn.plug.to/actions/aave/supply.png",
    chains: [1],
  };

  it("keeps the colour an action's mark is served with", () => {
    const parsed = ContextStepSchema.parse({ ...step, color: "#9896FF" });
    expect(parsed.color).toBe("#9896FF");
  });
});

describe("ContextStepSchema refusals", () => {
  const step = {
    type: "action",
    sentence: { raw: "Supply {0}", template: "Supply {0}", inputs: [] },
    name: "Supply",
    description: "Supplies an asset.",
    icon: "https://cdn.plug.to/actions/aave/supply.png",
    chains: [8453],
  };

  it("keeps why an input's options came back empty", () => {
    const refusals = {
      "2": "USDC on Aave Base is frozen, and its pool refuses every supply into a frozen reserve (ReserveFrozen)",
    };
    const parsed = ContextStepSchema.parse({ ...step, options: { 2: [] }, refusals });
    expect(parsed.refusals).toEqual(refusals);
  });
});
