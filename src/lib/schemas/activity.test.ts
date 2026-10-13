import { describe, expect, it } from "vitest";

import { GetActivityResponseSchema } from "./activity";

const NATIVE = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";

const gasLeg = (peer: string, int: string, role?: string) => ({
  amount: { int, float: int, value: "0" },
  ...(role === undefined ? {} : { role }),
  peer: { address: peer },
});

describe("GetActivityResponseSchema", () => {
  it("parses gas legs that name no role, as an OP-stack fee vault's do", () => {
    const response = {
      links: { self: "/address/0x1/activity" },
      data: [
        {
          kind: "execute",
          tx_hash: "0xopg1",
          block_number: 1,
          block_timestamp: 1,
          chain_id: 8453,
          title: "Execute",
          gas: { int: "-6070", float: "-0.000000000000006070" },
        },
        {
          kind: "send",
          tx_hash: "0xopg2",
          block_number: 2,
          block_timestamp: 2,
          chain_id: 8453,
          title: "Send",
          tokens: [
            {
              token: { address: NATIVE, standard: "gas" },
              net: { int: "-6070" },
              flows: [
                gasLeg(
                  "0x4200000000000000000000000000000000000011",
                  "-1000",
                  "tip",
                ),
                gasLeg("0x4200000000000000000000000000000000000019", "-5000"),
                gasLeg("0x420000000000000000000000000000000000001a", "-70"),
              ],
            },
          ],
        },
        {
          kind: "send",
          tx_hash: "0xopg3",
          block_number: 3,
          block_timestamp: 3,
          chain_id: 1,
          title: "Send",
          tokens: [
            {
              token: { address: NATIVE, standard: "gas" },
              net: { int: "-21" },
              flows: [
                gasLeg(
                  "0x0000000000000000000000000000000000000000",
                  "-20",
                  "burn",
                ),
                gasLeg(
                  "0x4838B106FCe9647Bdf1E7877BF73cE8B0BAD5f97",
                  "-1",
                  "tip",
                ),
              ],
            },
          ],
        },
      ],
    };

    const parsed = GetActivityResponseSchema.safeParse(response);

    expect(parsed.success, JSON.stringify(parsed.error?.issues)).toBe(true);
  });
});
