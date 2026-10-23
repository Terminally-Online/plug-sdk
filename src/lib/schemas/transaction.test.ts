import { describe, expect, it } from "vitest";

import compileOwnerShort from "./fixtures/compile-owner-short.json";
import relayCreate from "./fixtures/relay-create.json";
import relaySubmitManual from "./fixtures/relay-submit-manual.json";
import relaySubmitScheduled from "./fixtures/relay-submit-scheduled.json";
import {
  CompileTransactionResponseSchema,
  CreateTransactionResponseSchema,
  SubmitManualTransactionResponseSchema,
  SubmitScheduledTransactionResponseSchema,
  SubmitTransactionInputSchema,
} from "./transaction";

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

// The fixture is gusher's CompileTransactionResponse for an owner, marshalled
// from its Go types. A lowering that will not execute still answers with the
// batch it simulated, on the simulation: the approvals and the value the
// program spends.
describe("a compile for an owner that will not execute", () => {
  it("keeps the batch its simulation ran", () => {
    const parsed = CompileTransactionResponseSchema.parse(compileOwnerShort);
    expect(parsed.data?.calls).toBeUndefined();
    expect(parsed.data?.simulation?.batch).toEqual(
      compileOwnerShort.data.simulation.batch,
    );
  });
});

// The fixture is gusher's own CreateTransactionResponse, marshalled from its Go
// types: the transaction row's fields at the top of data and the relay payload
// beside them, with the solution regions under the name gusher gives them.
describe("CreateTransactionResponseSchema", () => {
  it("keeps the relay payload exactly as gusher returns it", () => {
    const parsed = CreateTransactionResponseSchema.parse(relayCreate);
    const relay = parsed.data?.relay;

    expect(parsed.data?.plugs_hash).toBe(relayCreate.data.plugs_hash);
    expect(relay?.typed_data).toEqual(relayCreate.data.relay.typed_data);
    expect(relay?.plugs).toEqual(["0x0102", "0x03"]);
    expect(relay?.state).toEqual(["0xaa"]);
    expect(relay?.solutions).toEqual(relayCreate.data.relay.solutions);
  });

  it("reads a program with no solution regions, which gusher omits", () => {
    const { solutions: _, ...relay } = relayCreate.data.relay;
    const parsed = CreateTransactionResponseSchema.parse({
      ...relayCreate,
      data: { ...relayCreate.data, relay },
    });

    expect(parsed.data?.relay?.solutions).toBeUndefined();
  });
});

// gusher's SubmitTransactionInput: the signed program, the owner and salt that
// locate the Plug Account, and the mode that either relays it now or arms it.
describe("SubmitTransactionInputSchema", () => {
  const input = {
    chain_id: 8453,
    owner: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    plugs: ["0x0102", "0x03"],
    state: ["0xaa"],
    signature: `0x${"11".repeat(65)}`,
  };

  it("carries the mode gusher relays or arms by", () => {
    expect(SubmitTransactionInputSchema.parse({ ...input, mode: "manual" }).mode).toBe("manual");
    expect(SubmitTransactionInputSchema.parse({ ...input, mode: "scheduled" }).mode).toBe("scheduled");
  });

  it("refuses a mode gusher does not accept", () => {
    expect(SubmitTransactionInputSchema.safeParse({ ...input, mode: "now" }).success).toBe(false);
  });
});

describe("SubmitManualTransactionResponseSchema", () => {
  it("keeps the relayed transaction hash and the intent it fired", () => {
    expect(SubmitManualTransactionResponseSchema.parse(relaySubmitManual)).toEqual(relaySubmitManual);
  });
});

describe("SubmitScheduledTransactionResponseSchema", () => {
  it("reads the armed intent row gusher returns bare", () => {
    const parsed = SubmitScheduledTransactionResponseSchema.parse(relaySubmitScheduled);
    expect(parsed.id).toBe(relaySubmitScheduled.id);
    expect(parsed.plugs_hash).toBe(relaySubmitScheduled.plugs_hash);
  });
});
