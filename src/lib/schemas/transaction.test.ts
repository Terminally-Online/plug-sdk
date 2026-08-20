import { describe, expect, it } from "vitest";

import { CompileTransactionResponseSchema } from "./transaction";

// The signed second lowering pass answers with the wallet_sendCalls batch and
// the signing surface — the two fields an execute path reads. Validation must
// carry them through, not strip them as unknown keys.
describe("CompileTransactionResponseSchema", () => {
  it("keeps calls, program and parameters", () => {
    const typed_data = {
      types: { Plug: [{ name: "socket", type: "address" }] },
      primaryType: "Plug",
      domain: { name: "Plug", chainId: 8453 },
      message: { socket: "0xabc" },
    };
    const parsed = CompileTransactionResponseSchema.parse({
      data: {
        options: [],
        outputs: [],
        parameters: [{ step: 0, name: "Amount", type: "uint256" }],
        simulation: { verdict: "executable" },
        calls: [{ to: "0x1", value: "0x0", data: "0x" }],
        program: { socket: "0x2", salt: "0x3", deadline: 1, typed_data },
      },
    });
    expect(parsed.data?.calls).toEqual([{ to: "0x1", value: "0x0", data: "0x" }]);
    expect(parsed.data?.program?.deadline).toBe(1);
    expect(parsed.data?.program?.typed_data).toEqual(typed_data);
    expect(parsed.data?.parameters).toEqual([
      { step: 0, name: "Amount", type: "uint256" },
    ]);
  });

  it("tolerates the unsigned shape (no calls, no program)", () => {
    const parsed = CompileTransactionResponseSchema.parse({
      data: { options: [], outputs: [], parameters: [], simulation: null },
    });
    expect(parsed.data?.calls).toBeUndefined();
    expect(parsed.data?.program).toBeUndefined();
  });
});
