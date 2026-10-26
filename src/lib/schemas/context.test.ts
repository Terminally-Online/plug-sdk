import { describe, expect, it } from "vitest";

import { ContextProtocolSchema } from "./context";

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
