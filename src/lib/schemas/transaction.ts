import { z } from "zod/v4";

import { createResponseSchema } from "./response";
import { AddressParams } from "./address";
import { InputTagsSchema } from "../types/sentence";

export const TransactionInputSchema = z.object({
  protocol: z.string(),
  step: z.string(),
  inputs: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])),
});
export const TransactionStepSchema = z.object({
  value: z.string(),
  selector: z.number(),
  to: z.string(),
  data: z.string(),
});

// ExecutionMode mirrors gusher's models.ExecutionMode*.
export const ExecutionModeSchema = z.enum(["manual", "scheduled"]);

// SchedulerStatus mirrors gusher's models.SchedulerStatus*.
export const SchedulerStatusSchema = z.enum([
  "armed",
  "waiting",
  "condition_ready",
  "execution_ready",
  "submitted",
  "failed",
  "canceled",
]);

// TransactionSchema tolerates the gusher row payload as-is (value as string,
// protocol-shaped inputs/steps, scheduler fields absent on manual rows).
export const TransactionSchema = z
  .object({
    id: z.string(),
    status: z.string(),
    chain_id: z.number(),
    address: z.string(),
    value: z.union([z.string(), z.number()]).optional(),
    gas_limit: z.number().nullish(),
    inputs: z.array(z.any()).nullish(),
    steps: z.any().nullish(),
    created_at: z.string(),
    updated_at: z.string(),
    tx_hash: z.string().nullish(),
    execution_mode: z.string().optional(),
    owner_address: z.string().optional(),
    plugs_hash: z.string().optional(),
    scheduler_status: z.string().optional(),
    last_error: z.string().optional(),
    verdict: z.string().optional(),
    failing_condition: z.number().optional(),
    last_simmed_block: z.number().optional(),
  })
  .passthrough();

export const GetTransactionsFilterSchema = z.object({
  id: z
    .string()
    .optional()
    .describe("Filter results to a specific transaction id."),
  chain_id: z
    .number()
    .optional()
    .describe(
      "Filter results to specific chains from the listed of supported options.",
    ),
  status: z
    .enum(["pending", "confirmed", "failed"])
    .optional()
    .describe("Filter results to specific transaction statuses."),
});
export const GetTransactionsQueryParamsSchema = z.object({
  filter: GetTransactionsFilterSchema.optional(),
});
export const GetTransactionsResponseSchema = createResponseSchema(
  z.array(TransactionSchema),
);

// CancelTransaction targets one standing scheduled intent by row id; the
// gusher DELETE handler returns the terminal row bare (no response envelope).
export const CancelTransactionInputSchema = z.object({
  id: z.string().describe("The intent row id to cancel."),
});
export const CancelTransactionResponseSchema = z
  .object({
    id: z.string(),
    status: z.string(),
    scheduler_status: z.string().optional(),
    execution_mode: z.string().optional(),
    tx_hash: z.string().nullish(),
  })
  .passthrough();

export const CreateTransactionInputStepSchema = z.object({
  protocol: z
    .string()
    .describe(
      "Specify the protocol of the action to create the transaction for.",
    ),
  step: z
    .string()
    .describe("Specify the action/step to create the transaction for."),
  inputs: z
    .record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
    .describe("The values for each input within the action sentence."),
});
export const CreateTransactionInputSchema = z.object({
  chain_id: z.number().describe("The chain to create the transaction for."),
  deadline: z
    .number()
    .optional()
    .describe(
      "A unix timestamp after which the transaction is no longer valid.",
    ),
  owner: z
    .string()
    .optional()
    .describe(
      "The account the draft executes for: a standard:wallet slot filled with \"yourself\" resolves to this address. Absent, the authenticated session's address; absent both, wallet-self slots stay on the executing account.",
    ),
  gas_limit: z
    .number()
    .optional()
    .describe("Gas limit recorded on the created transaction."),
  steps: z
    .record(z.number(), CreateTransactionInputStepSchema)
    .describe("The steps/actions to include in the transaction."),
});
export const CreateTransactionQueryParamsSchema = z.object({
  input: CreateTransactionInputSchema,
});

export const RelaySwapRegionSchema = z.object({
  token_in: z.string(),
  token_out: z.string(),
  amount_in: z.number(),
  executor_slot: z.number(),
  route_slot: z.number(),
});

export const TypedDataSchema = z.object({
  types: z.record(
    z.string(),
    z.array(z.object({ name: z.string(), type: z.string() })),
  ),
  primaryType: z.string(),
  domain: z.record(z.string(), z.any()),
  message: z.record(z.string(), z.any()),
});

export const RelayPayloadSchema = z.object({
  typed_data: TypedDataSchema,
  plugs: z.array(z.string()),
  state: z.array(z.string()),
  manifest: z.array(RelaySwapRegionSchema),
});

export const CreateTransactionDataSchema = TransactionSchema.extend({
  outputs: z.array(z.any()).nullish(),
  relay: RelayPayloadSchema.nullish(),
});
export const CreateTransactionResponseSchema = createResponseSchema(
  CreateTransactionDataSchema,
);

export const SubmitTransactionInputSchema = z.object({
  chain_id: z.number(),
  owner: z.string(),
  salt: z.string().optional(),
  plugs: z.array(z.string()),
  state: z.array(z.string()),
  signature: z.string(),
  manifest: z.array(RelaySwapRegionSchema),
});
export const SubmitTransactionResponseSchema = z.object({
  transaction_hash: z.string(),
});

export type TransactionInput = z.infer<typeof TransactionInputSchema>;
export type TransactionStep = z.infer<typeof TransactionStepSchema>;
export type Transaction = z.infer<typeof TransactionSchema>;
export type ExecutionMode = z.infer<typeof ExecutionModeSchema>;
export type SchedulerStatus = z.infer<typeof SchedulerStatusSchema>;
export type GetTransactionsQueryParams = AddressParams &
  z.infer<typeof GetTransactionsQueryParamsSchema>;
export type GetTransactionsResponse = z.infer<
  typeof GetTransactionsResponseSchema
>;

export type CancelTransactionInput = z.infer<
  typeof CancelTransactionInputSchema
>;
export type CancelTransactionParams = AddressParams & CancelTransactionInput;
export type CancelTransactionResponse = z.infer<
  typeof CancelTransactionResponseSchema
>;

export type CreateTransactionQueryParams = AddressParams &
  z.infer<typeof CreateTransactionQueryParamsSchema>;
export type CreateTransactionResponse = z.infer<
  typeof CreateTransactionResponseSchema
>;

export const CoilOptionSchema = z.object({
  name: z.string(),
  type: z.string(),
  ref: z.string(),
});

export const CompileTransactionStepSchema = z.object({
  protocol: z
    .string()
    .describe("Specify the protocol of the action to compile."),
  step: z.string().describe("Specify the action/step to compile."),
  inputs: z
    .record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
    .optional()
    .describe("The values for each input within the action sentence."),
});
export const CompileTransactionInputSchema = z.object({
  chain_id: z.number().describe("The chain to compile the transaction for."),
  owner: z
    .string()
    .optional()
    .describe(
      "The simulation subject: drafts compile and simulate at this address's counterfactual socket, so user-specific reads observe its real chain state. Absent, drafts simulate on the synthetic account.",
    ),
  steps: z
    .record(z.number(), CompileTransactionStepSchema)
    .describe("The steps/actions to compile."),
  overrides: z
    .record(z.string(), z.string())
    .optional()
    .describe(
      "Debugger hypotheses: step.path keys naming read outputs, 0x-hex raw slot values. The program re-executes with each read pinned to its stated value; a draft carrying overrides projects fully and is never signable.",
    ),
  signature: z
    .string()
    .optional()
    .describe(
      "The owner's EIP-712 signature over the lowered program. Present on the second lowering pass: with it the response carries the complete wallet_sendCalls batch including the factory createAndExecute call, simulated as the exact batch that will execute. Without it the response carries the typed data to sign.",
    ),
  deadline: z
    .number()
    .optional()
    .describe(
      "Unix seconds for the program deadline. The deadline is part of the signed typed data, so a signed re-simulation must echo the value that was signed; a different deadline is a different program. Absent or zero, the server stamps its default TTL.",
    ),
});
export const CompileTransactionQueryParamsSchema = z.object({
  input: CompileTransactionInputSchema,
});

export const SimulationSlotSchema = z.object({
  name: z.string(),
  type: z.any(),
  slot: z.number(),
  path: z.string(),
  tags: InputTagsSchema.nullish(),
  value: z.string().nullish(),
});
export const SimulationOutputSchema = z.object({
  action_index: z.number(),
  action: z.string(),
  assumed: z.boolean().nullish(),
  slots: z.array(SimulationSlotSchema),
});
export const SimulationExclusionSchema = z.object({
  step: z.number(),
  cause: z.string(),
});

export const SimulationSchema = z.object({
  verdict: z.string().nullish(),
  reason: z.string().nullish(),
  failing_step: z.number().nullish(),
  gas_used: z.number().nullish(),
  block_number: z.number().nullish(),
  outputs: z.array(SimulationOutputSchema).nullish(),
  exclusions: z.array(SimulationExclusionSchema).nullish(),
});

export const IRInstructionSchema = z.object({
  index: z.number(),
  kind: z.string(),
  label: z.string().nullish(),
  dead: z.boolean().nullish(),
  reads: z.array(z.number()).nullish(),
  writes: z.array(z.number()).nullish(),
});

export const IntentNodeSchema = z.object({
  step: z.number(),
  protocol: z.string(),
  action: z.string(),
  outputs: z.array(z.any()).nullish(),
  ir: z.array(IRInstructionSchema).nullish(),
});

export const IntentEdgeSchema = z.object({
  kind: z.enum(["output", "input", "state"]),
  source: z.number(),
  source_slot: z.number(),
  source_name: z.string().nullish(),
  source_tags: z.any().nullish(),
  fields: z.array(z.number()).nullish(),
  target: z.number(),
  target_input: z.string(),
  ref: z.string(),
});

export const IntentGraphSchema = z.object({
  nodes: z.array(IntentNodeSchema),
  edges: z.array(IntentEdgeSchema),
});

// One call of the wallet_sendCalls batch a signed compile returns — the exact
// batch the simulation executed, ready to send as-is.
export const LoweredCallSchema = z.object({
  to: z.string(),
  value: z.string(),
  data: z.string(),
});

// The signing surface of a compiled draft: the counterfactual account the
// program executes on, the salt that derives it, the deadline the signature
// commits to (pass it back as `deadline` when re-compiling with the
// signature), and the EIP-712 payload for eth_signTypedData_v4.
export const LoweredProgramSchema = z.object({
  socket: z.string(),
  salt: z.string(),
  deadline: z.number(),
  typed_data: TypedDataSchema,
});

// An input the compiled draft leaves unbound for the caller to supply at
// execution: the declaring step, the name, and the Solidity type.
export const CompileParameterSchema = z.object({
  step: z.number(),
  name: z.string(),
  type: z.string(),
});

export const CompileTransactionDataSchema = z.object({
  options: z.array(z.record(z.string(), z.array(CoilOptionSchema))).nullish(),
  outputs: z.array(z.any()).nullish(),
  parameters: z
    .array(CompileParameterSchema)
    .nullish()
    .describe("Inputs the draft leaves unbound for execution time."),
  graph: IntentGraphSchema.nullish(),
  simulation: SimulationSchema.nullish(),
  calls: z
    .array(LoweredCallSchema)
    .nullish()
    .describe(
      "The executable wallet_sendCalls batch. Present only when the request carried the owner's signature and the simulation verdict is executable.",
    ),
  program: LoweredProgramSchema.nullish().describe(
    "The typed data to sign and the account it executes on. Present when the draft is complete and an owner was given; absent once a signature is supplied.",
  ),
});
export const CompileTransactionResponseSchema = createResponseSchema(
  CompileTransactionDataSchema,
);

export type RelaySwapRegion = z.infer<typeof RelaySwapRegionSchema>;
export type TypedData = z.infer<typeof TypedDataSchema>;
export type RelayPayload = z.infer<typeof RelayPayloadSchema>;
export type SubmitTransactionInput = z.infer<
  typeof SubmitTransactionInputSchema
>;
export type SubmitTransactionParams = AddressParams & SubmitTransactionInput;
export type SubmitTransactionResponse = z.infer<
  typeof SubmitTransactionResponseSchema
>;

export type CoilOption = z.infer<typeof CoilOptionSchema>;
export type CompileTransactionQueryParams = z.infer<
  typeof CompileTransactionQueryParamsSchema
>;
export type CompileTransactionResponse = z.infer<
  typeof CompileTransactionResponseSchema
>;

export type CompileParameter = z.infer<typeof CompileParameterSchema>;
export type LoweredCall = z.infer<typeof LoweredCallSchema>;
export type LoweredProgram = z.infer<typeof LoweredProgramSchema>;
export type IRInstruction = z.infer<typeof IRInstructionSchema>;
export type IntentNode = z.infer<typeof IntentNodeSchema>;
export type IntentEdge = z.infer<typeof IntentEdgeSchema>;
export type IntentGraph = z.infer<typeof IntentGraphSchema>;
export type SimulationSlot = z.infer<typeof SimulationSlotSchema>;
export type SimulationOutput = z.infer<typeof SimulationOutputSchema>;
export type SimulationExclusion = z.infer<typeof SimulationExclusionSchema>;
export type Simulation = z.infer<typeof SimulationSchema>;
export type CompileTransactionData = z.infer<
  typeof CompileTransactionDataSchema
>;
