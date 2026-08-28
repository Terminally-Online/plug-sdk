import { describe, expect, it } from "vitest";

import { ChainResponseSchema } from "./chain";

const live = {
  links: { self: "/chain" },
  data: [
    {
      chain_id: 1,
      address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
      name: "Ethereum",
      symbol: "ETH",
      decimals: 18,
      icon: "https://cdn.plug.to/blockchain/ethereum.png",
      block_time: 12000000000,
      external: {
        explorer: { name: "Etherscan", url: "https://etherscan.io" },
      },
    },
    {
      chain_id: 8453,
      address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
      name: "Base",
      symbol: "ETH",
      decimals: 18,
      icon: "https://cdn.plug.to/blockchain/base.png",
      block_time: 2000000000,
      external: {
        explorer: { name: "Basescan", url: "https://basescan.io" },
      },
      warming: true,
    },
  ],
};

describe("ChainResponseSchema", () => {
  it("parses the live shape and carries warming through", () => {
    const parsed = ChainResponseSchema.parse(live);
    const [ethereum, base] = parsed.data ?? [];
    expect(ethereum?.warming).toBeUndefined();
    expect(base?.warming).toBe(true);
  });
});
