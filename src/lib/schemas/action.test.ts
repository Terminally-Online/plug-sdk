import { describe, expect, it } from "vitest";

import { ActionSchema } from "./action";

describe("ActionSchema", () => {
  it("keeps the action's own name beside the verb", () => {
    const parsed = ActionSchema.parse({
      protocol: "uniswap",
      action: "mint",
      name: "Mint position",
      capability: { value: "lp_addable", label: "Add Liquidity", description: "" },
      pins: { "1": "0x40d16fc0246ad3160ccc09b8d0d3a2cd28ae6c2f" },
    });
    expect(parsed.name).toBe("Mint position");
    expect(parsed.capability?.label).toBe("Add Liquidity");
  });

  it("still parses a reference that carries no name", () => {
    expect(ActionSchema.parse({ protocol: "plug", action: "swap" }).name).toBeUndefined();
  });
});
