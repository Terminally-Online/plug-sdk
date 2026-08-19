import { describe, expect, it } from "vitest";

import { buildSiweMessage } from "./siwe";

const BASE = {
  address: "0x1111111111111111111111111111111111111111",
  domain: "poof.plug.to",
  uri: "https://poof.plug.to",
  nonce: "abc123",
  chainId: 1,
  issuedAt: new Date("2026-08-19T12:00:00.000Z"),
};

describe("buildSiweMessage", () => {
  it("emits the EIP-4361 preamble without a statement", () => {
    expect(buildSiweMessage(BASE)).toBe(
      [
        "poof.plug.to wants you to sign in with your Ethereum account:",
        "0x1111111111111111111111111111111111111111",
        "",
        "",
        "URI: https://poof.plug.to",
        "Version: 1",
        "Chain ID: 1",
        "Nonce: abc123",
        "Issued At: 2026-08-19T12:00:00Z",
      ].join("\n"),
    );
  });

  it("surrounds a statement with blank lines", () => {
    const message = buildSiweMessage({ ...BASE, statement: "Access poof." });

    expect(message).toContain("\n\nAccess poof.\n\nURI:");
  });

  it("carries the chain it was asked for", () => {
    expect(buildSiweMessage({ ...BASE, chainId: 8453 })).toContain(
      "Chain ID: 8453",
    );
  });

  it("appends optional fields in spec order", () => {
    const message = buildSiweMessage({
      ...BASE,
      expirationTime: new Date("2026-08-19T13:00:00.000Z"),
      notBefore: new Date("2026-08-19T11:00:00.000Z"),
      requestId: "req-1",
      resources: ["https://plug.to/a", "https://plug.to/b"],
    });

    expect(message.split("\n").slice(-7)).toEqual([
      "Issued At: 2026-08-19T12:00:00Z",
      "Expiration Time: 2026-08-19T13:00:00Z",
      "Not Before: 2026-08-19T11:00:00Z",
      "Request ID: req-1",
      "Resources:",
      "- https://plug.to/a",
      "- https://plug.to/b",
    ]);
  });

  it("omits optional fields that were not supplied", () => {
    const message = buildSiweMessage(BASE);

    expect(message).not.toContain("Expiration Time:");
    expect(message).not.toContain("Not Before:");
    expect(message).not.toContain("Request ID:");
    expect(message).not.toContain("Resources:");
  });
});
