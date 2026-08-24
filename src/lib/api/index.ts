import {
  z,
  ZodTypeAny,
  ZodObject,
  ZodArray,
  ZodOptional,
  ZodNullable,
  ZodRecord,
  ZodUnion,
  ZodLazy,
  ZodEnum,
  ZodNumber,
  ZodBoolean,
} from "zod";

import {
  AddressParamsSchema,
  AddressResponseSchema,
  PositionsQueryParamsSchema,
  PositionsResponseSchema,
} from "../schemas/address";
import {
  ChainQueryParamsSchema,
  ChainResponseSchema,
} from "../schemas/chain";
import {
  ContextQueryParamsSchema,
  ContextResponseSchema,
} from "../schemas/context";
import {
  GetActivityQueryParamsSchema,
  GetActivityResponseSchema,
} from "../schemas/activity";
import {
  GetTransactionsQueryParamsSchema,
  GetTransactionsResponseSchema,
  CreateTransactionQueryParamsSchema,
  CreateTransactionResponseSchema,
  CompileTransactionQueryParamsSchema,
  CompileTransactionResponseSchema,
  CancelTransactionInputSchema,
  CancelTransactionResponseSchema,
  SubmitTransactionInputSchema,
  SubmitTransactionResponseSchema,
} from "../schemas/transaction";
import {
  SeriesQueryParamsSchema,
  SeriesResponseSchema,
} from "../schemas/series";
import {
  AuthNonceResponseSchema,
  AuthRefreshBodySchema,
  AuthSessionResponseSchema,
  AuthTokenResponseSchema,
  AuthVerifyBodySchema,
} from "../schemas/auth";
import { ColorParamsSchema, ColorResponseSchema } from "../schemas/cdn";

export type HttpMethod = "GET" | "PUT" | "POST" | "DELETE";
export type ParamLocation = "path" | "query" | "header";

export interface ApiParam {
  name: string;
  location: ParamLocation;
  type: "string" | "integer" | "boolean";
  required: boolean;
  description: string;
  default?: string;
  enum?: string[];
  array?: boolean;
  example?: string;
}

export interface SchemaProperty {
  name: string;
  type: string;
  required?: boolean;
  nullable?: boolean;
  description?: string;
  enum?: string[];
  properties?: SchemaProperty[];
  items?: SchemaProperty;
}

export type ApiTag =
  | "address"
  | "transaction"
  | "chain"
  | "auth"
  | "cdn";

export interface ApiEndpoint {
  operationId: string;
  method: HttpMethod;
  path: string;
  summary: string;
  description: string;
  tag: ApiTag;
  params: ApiParam[];
  requestSchema?: SchemaProperty;
  responseSchema: SchemaProperty;
}

// Strips presentation wrappers only. Unions are deliberately preserved: a
// union carries information (`string | self` on a recursive map) that
// collapsing to the first member silently deletes.
const unwrapSchema = (schema: ZodTypeAny): ZodTypeAny => {
  if (schema instanceof ZodOptional || schema instanceof ZodNullable) {
    return unwrapSchema(schema._def.innerType);
  }
  if (schema instanceof ZodLazy) {
    return unwrapSchema(schema._def.getter());
  }
  return schema;
};

const unionMembers = (schema: ZodUnion<any>): ZodTypeAny[] =>
  schema._def.options.filter(
    (option: ZodTypeAny) => option._def.typeName !== "ZodNull",
  );

// Unions that carry exactly one meaningful member are equivalent to that
// member, so structural expansion may descend through them. Genuine
// multi-member unions stay intact and are described by their type name.
const unwrapToConcrete = (schema: ZodTypeAny): ZodTypeAny => {
  const unwrapped = unwrapSchema(schema);
  if (!(unwrapped instanceof ZodUnion)) return unwrapped;
  const members = unionMembers(unwrapped);
  return members.length === 1 ? unwrapToConcrete(members[0]) : unwrapped;
};

const isOptional = (schema: ZodTypeAny): boolean => {
  if (schema instanceof ZodOptional) return true;
  if (schema instanceof ZodNullable) return isOptional(schema._def.innerType);
  return false;
};

const isNullable = (schema: ZodTypeAny): boolean => {
  if (schema instanceof ZodNullable) return true;
  if (schema instanceof ZodOptional) return isNullable(schema._def.innerType);
  if (schema instanceof ZodLazy) return isNullable(schema._def.getter());
  if (schema instanceof ZodUnion) {
    return schema._def.options.some(
      (opt: ZodTypeAny) => opt._def.typeName === "ZodNull",
    );
  }
  return false;
};

// SELF_TYPE names the point where a schema refers back to itself. A recursive
// map has no finite expansion, and rendering one branch of it as the whole
// truth is what makes callers believe nested data does not exist.
export const SELF_TYPE = "self";

// lazyDepth counts z.lazy boundaries already crossed on this path. Crossing a
// second one means the schema is cyclic, and the cycle is named rather than
// expanded.
const getZodTypeName = (schema: ZodTypeAny, lazyDepth: number = 0): string => {
  if (schema instanceof ZodOptional || schema instanceof ZodNullable) {
    return getZodTypeName(schema._def.innerType, lazyDepth);
  }
  if (schema instanceof ZodLazy) {
    if (lazyDepth >= 1) return SELF_TYPE;
    return getZodTypeName(schema._def.getter(), lazyDepth + 1);
  }

  const typeName = schema._def.typeName;

  switch (typeName) {
    case "ZodString":
      return "string";
    case "ZodNumber":
      return "integer";
    case "ZodBoolean":
      return "boolean";
    case "ZodArray":
      return "array";
    case "ZodObject":
      return "object";
    case "ZodRecord":
      return getRecordType(schema as z.ZodRecord<any, any>, lazyDepth);
    case "ZodUnion":
      return getUnionType(schema as z.ZodUnion<any>, lazyDepth);
    case "ZodEnum":
      return "string";
    default:
      return typeName?.replace("Zod", "").toLowerCase() ?? "unknown";
  }
};

const getRecordType = (
  schema: z.ZodRecord<any, any>,
  lazyDepth: number = 0,
): string => {
  const keyType = getZodTypeName(schema._def.keyType, lazyDepth);
  const valueType = getZodTypeName(schema._def.valueType, lazyDepth);
  return `Record<${keyType}, ${valueType}>`;
};

const getUnionType = (
  schema: z.ZodUnion<any>,
  lazyDepth: number = 0,
): string => {
  const types = unionMembers(schema).map((option: ZodTypeAny) =>
    getZodTypeName(option, lazyDepth),
  );
  const unique = types.filter(
    (type: string, index: number) => types.indexOf(type) === index,
  );
  return unique.length === 1 ? unique[0] : unique.join(" | ");
};

const getDescription = (schema: ZodTypeAny): string | undefined => {
  return schema._def.description || schema.description;
};

const getParamType = (schema: ZodTypeAny): "string" | "integer" | "boolean" => {
  const unwrapped = unwrapToConcrete(schema);
  if (unwrapped instanceof ZodNumber) return "integer";
  if (unwrapped instanceof ZodBoolean) return "boolean";
  if (unwrapped instanceof ZodArray) {
    const innerType = unwrapped._def.type;
    if (innerType instanceof ZodNumber) return "integer";
    if (innerType instanceof ZodBoolean) return "boolean";
  }
  return "string";
};

const getEnumValues = (schema: ZodTypeAny): string[] | undefined => {
  const unwrapped = unwrapToConcrete(schema);
  if (unwrapped instanceof ZodEnum) {
    return unwrapped._def.values as string[];
  }
  if (unwrapped instanceof ZodBoolean) {
    return ["true", "false"];
  }
  if (unwrapped instanceof ZodArray) {
    const innerUnwrapped = unwrapToConcrete(unwrapped._def.type);
    if (innerUnwrapped instanceof ZodEnum) {
      return innerUnwrapped._def.values as string[];
    }
  }
  return undefined;
};

const flattenParamsFromSchema = (
  schema: ZodTypeAny,
  location: ParamLocation,
  prefix: string = "",
  example?: string,
): ApiParam[] => {
  const params: ApiParam[] = [];
  const unwrapped = unwrapToConcrete(schema);

  if (!(unwrapped instanceof ZodObject)) {
    return params;
  }

  const shape = unwrapped._def.shape();

  for (const [key, value] of Object.entries(shape)) {
    const fieldSchema = value as ZodTypeAny;
    const fieldUnwrapped = unwrapToConcrete(fieldSchema);
    const paramName = prefix ? `${prefix}[${key}]` : key;
    const description = getDescription(fieldSchema) || "";
    const required = !isOptional(fieldSchema);

    if (fieldUnwrapped instanceof ZodObject) {
      params.push(...flattenParamsFromSchema(fieldSchema, location, paramName));
    } else {
      const param: ApiParam = {
        name: paramName,
        location,
        type: getParamType(fieldSchema),
        required,
        description,
      };

      const enumValues = getEnumValues(fieldSchema);
      if (enumValues) {
        param.enum = enumValues;
      }

      if (fieldUnwrapped instanceof ZodArray) {
        param.array = true;
      }

      if (example && key === "address") {
        param.example = example;
      }

      params.push(param);
    }
  }

  return params;
};

export const zodToSchemaProperty = (
  schema: ZodTypeAny,
  name: string = "response",
  depth: number = 0,
  lazyDepth: number = 0,
): SchemaProperty => {
  if (depth > 10) {
    return { name, type: SELF_TYPE, description: "Recursive structure" };
  }

  const nullable = isNullable(schema);
  const optional = isOptional(schema);
  const description = getDescription(schema);
  const enumValues = getResponseEnumValues(schema);

  const base: SchemaProperty = {
    name,
    type: getZodTypeName(schema, lazyDepth),
    ...(nullable && { nullable: true }),
    ...(!optional && !nullable && { required: true }),
    ...(description && { description }),
    ...(enumValues && { enum: enumValues }),
  };

  if (base.type === SELF_TYPE) return base;

  const crossesLazy = crossesLazyBoundary(schema);
  const nextLazyDepth = crossesLazy ? lazyDepth + 1 : lazyDepth;
  const unwrapped = unwrapToConcrete(schema);

  if (unwrapped instanceof ZodObject) {
    const shape = unwrapped._def.shape();
    base.properties = Object.entries(shape).map(([key, value]) =>
      zodToSchemaProperty(value as ZodTypeAny, key, depth + 1, nextLazyDepth),
    );
  }

  if (unwrapped instanceof ZodArray) {
    base.items = zodToSchemaProperty(
      unwrapped._def.type,
      "item",
      depth + 1,
      nextLazyDepth,
    );
  }

  // Every record describes its value type, not only the ones whose values
  // happen to be objects or arrays. A record left undescribed reads as a flat
  // string map even when it nests arbitrarily deep.
  if (unwrapped instanceof ZodRecord) {
    base.properties = [
      zodToSchemaProperty(
        unwrapped._def.valueType,
        "value",
        depth + 1,
        nextLazyDepth,
      ),
    ];
  }

  return base;
};

// Query params advertise booleans as a true/false enum so callers know what to
// put in the URL. A response field gains nothing from that, so only genuine
// closed sets are reported here.
const getResponseEnumValues = (schema: ZodTypeAny): string[] | undefined => {
  const unwrapped = unwrapToConcrete(schema);
  if (unwrapped instanceof ZodEnum) return unwrapped._def.values as string[];
  if (unwrapped instanceof ZodArray) {
    const inner = unwrapToConcrete(unwrapped._def.type);
    if (inner instanceof ZodEnum) return inner._def.values as string[];
  }
  return undefined;
};

const crossesLazyBoundary = (schema: ZodTypeAny): boolean => {
  if (schema instanceof ZodLazy) return true;
  if (schema instanceof ZodOptional || schema instanceof ZodNullable) {
    return crossesLazyBoundary(schema._def.innerType);
  }
  return false;
};

const ACCEPT_HEADER: ApiParam = {
  name: "Accept",
  location: "header",
  type: "string",
  required: true,
  description:
    "For a typical single-time JSON response, set this to application/json. To receive realtime updates through a stream, set this to text/event-stream.",
  default: "application/json",
  enum: ["application/json", "text/event-stream"],
};

const ADDRESS_EXAMPLE = "0x62180042606624f02d8a130da8a3171e9b33894d";

interface EndpointDefinition {
  operationId: string;
  method: HttpMethod;
  path: string;
  summary: string;
  description: string;
  tag: ApiTag;
  pathParams?: ZodTypeAny;
  queryParams?: ZodTypeAny;
  bodySchema?: ZodTypeAny;
  responseSchema: ZodTypeAny;
  streaming?: boolean;
}

const ENDPOINT_DEFINITIONS: EndpointDefinition[] = [
  {
    operationId: "getAddress",
    method: "GET",
    path: "/address/{address}/",
    summary: "Get address",
    description:
      "Returns everything Plug knows about an address at the identity level: its metadata and the signal flags the indexing graph has raised on it.\n\nThe response is the address as the indexer sees it, not as a wallet does. Graph signals classify what the address is (a contract, a token, a router, a known entity) and how it behaves, derived from indexed history rather than a registry someone maintains by hand. Requesting an address that has never been seen queues it for indexing immediately, so a cold address warms up by being asked about.\n\nReach for it as the first call in any flow that starts from a raw address: resolving what something is before deciding which of the other surfaces to read next.",
    tag: "address",
    pathParams: AddressParamsSchema,
    responseSchema: AddressResponseSchema,
  },
  {
    operationId: "getPositions",
    method: "PUT",
    path: "/address/{address}/",
    summary: "Get position(s)",
    description:
      "Returns every position an address holds across every protocol Plug indexes: fungible balances, non-fungible holdings, and the non-tokenized positions that never show up in a wallet.\n\nA lending market deposit, an LP range, a staked balance, a vault share: most of what an address is worth has no token in the wallet to prove it. The indexer derives these positions from onchain events and keeps every number a protocol tracks about them, yields, rates, health, value, in the attributes of each entry.\n\nReach for it to render a portfolio, to find the balance a strategy is about to act on, or to answer what is this address actually holding without connecting a wallet or touching a key.",
    tag: "address",
    pathParams: AddressParamsSchema,
    queryParams: PositionsQueryParamsSchema,
    responseSchema: PositionsResponseSchema,
  },
  {
    operationId: "getContext",
    method: "POST",
    path: "/address/{address}/",
    summary: "Get context",
    description:
      "Returns the options every input of an action accepts for this address: the tokens it holds, the pools that exist, the chains it can act on, resolved against the live catalog.\n\nThis is the surface the composer runs on. Send the action sequence being drafted and the response carries a valid option set for each unfilled input, plus request-scoped context such as a swap quote or a live maximum projected over what has been filled so far. The options are already filtered to what would actually compile.\n\nReach for it while building a transaction, once per edit, so the person or agent doing the composing only ever sees choices that work.",
    tag: "transaction",
    pathParams: AddressParamsSchema,
    queryParams: ContextQueryParamsSchema,
    responseSchema: ContextResponseSchema,
  },
  {
    operationId: "getActivity",
    method: "GET",
    path: "/address/{address}/activity",
    summary: "Get activity",
    description:
      "Returns the onchain transaction history of an address, paginated and sorted by block number descending.\n\nEach entry is a settled transaction with what it moved: the flows, approvals, and counterparties involved, normalized across every chain Plug indexes rather than raw logs left for the caller to decode.\n\nReach for it to render an activity feed, to reconcile what a strategy actually did against what it was meant to do, or to walk an address's history without running an archive node.",
    tag: "address",
    pathParams: AddressParamsSchema,
    queryParams: GetActivityQueryParamsSchema,
    responseSchema: GetActivityResponseSchema,
  },
  {
    operationId: "getTransactions",
    method: "GET",
    path: "/address/{address}/transaction/",
    summary: "Get transaction(s)",
    description:
      "Returns the transactions Plug has saved for an address: every intent created through the platform, with its status, schedule, and execution record, narrowed by whatever filters are applied.\n\nThese are Plug's own records, not chain history. A row exists from the moment a transaction is created, tracks its life through scheduling, simulation, submission, and settlement, and keeps the verdict when something fails. Listing is all this surface does.\n\nReach for it to show a user their pending and past transactions or to poll the state of an intent that was submitted earlier. Compiling new calldata belongs to the create step, not here.",
    tag: "transaction",
    pathParams: AddressParamsSchema,
    queryParams: GetTransactionsQueryParamsSchema,
    responseSchema: GetTransactionsResponseSchema,
  },
  {
    operationId: "createTransaction",
    method: "POST",
    path: "/address/{address}/transaction/",
    summary: "Create transaction",
    description:
      "Constructs and compiles transaction calldata from structured inputs, returning a record ready for signing and submission.\n\nHand it the steps of the transaction as action references with filled inputs and it resolves them through the catalog, compiles the calldata, and persists a transaction row that tracks the intent from here to settlement. The response carries everything a wallet needs to sign.\n\nThis is the build step. Listing existing records is the GET on the same path, and the pure preview that persists nothing is the compile surface.",
    tag: "transaction",
    pathParams: AddressParamsSchema,
    queryParams: CreateTransactionQueryParamsSchema,
    responseSchema: CreateTransactionResponseSchema,
  },
  {
    operationId: "getSeries",
    method: "GET",
    path: "/address/{address}/history",
    summary: "Get series",
    description:
      "Returns time series for an address: price candles, balance history, and portfolio value over time, bucketed for charting.\n\nWhich groups a bucket carries follows what was asked for, so the same surface serves a price chart, a balance sparkline, or a full portfolio curve. Values arrive in the units the display layer expects, with the bucketing already done server side.\n\nReach for it any time a number needs to become a line: charting a holding, showing portfolio drift, or feeding a strategy the recent history of what it manages.",
    tag: "address",
    pathParams: AddressParamsSchema,
    queryParams: SeriesQueryParamsSchema,
    responseSchema: SeriesResponseSchema,
  },
  {
    operationId: "compileTransaction",
    method: "PUT",
    path: "/transaction/",
    summary: "Compile transaction",
    description:
      "Compiles a draft action sequence into coil options, output manifests, and simulated slot values without persisting anything.\n\nThis is the preview step the composer runs on every edit. It is not bound to a wallet, it never submits, and nothing it computes outlives the response: it exists so a draft can be checked against the compiler that will eventually execute it, every keystroke, for free.\n\nReach for it to validate a sequence as it is being written, to learn what each step will output before anything is signed, or to build composer-grade tooling of your own on the same contract the app uses.",
    tag: "transaction",
    queryParams: CompileTransactionQueryParamsSchema,
    responseSchema: CompileTransactionResponseSchema,
  },
  {
    operationId: "submitTransaction",
    method: "PUT",
    path: "/address/{address}/transaction/",
    summary: "Submit transaction",
    description:
      "Broadcasts a signed intent bundle.\n\nThe signature must come from the owning wallet, which makes this the one surface in the API that cannot act on an arbitrary address. Everything before it, reading, composing, compiling, is open; the moment value can move, the wallet is the gate. The submitted program carries its own conditions, so execution happens when they are met, not necessarily when this call returns.\n\nReach for it as the final step of the flow the create and compile surfaces set up: sign what they produced, hand it over, and track the record through the transactions list.",
    tag: "transaction",
    pathParams: AddressParamsSchema,
    bodySchema: SubmitTransactionInputSchema,
    streaming: false,
    responseSchema: SubmitTransactionResponseSchema,
  },
  {
    operationId: "cancelTransaction",
    method: "DELETE",
    path: "/address/{address}/transaction/",
    summary: "Cancel transaction",
    description:
      "Cancels a scheduled or pending intent owned by the address.\n\nAn armed intent is a standing order: it will fire whenever its conditions are met, whether or not anyone is watching. Cancelation is how a standing order dies before it fires. Rows that have already settled are history and stay untouched.\n\nReach for it when a strategy is retired, a schedule is no longer wanted, or a pending transaction was a mistake, and confirm the row's status through the transactions list afterward.",
    tag: "transaction",
    pathParams: AddressParamsSchema,
    queryParams: CancelTransactionInputSchema,
    streaming: false,
    responseSchema: CancelTransactionResponseSchema,
  },
  {
    operationId: "getChains",
    method: "GET",
    path: "/chain",
    summary: "Get chain(s)",
    description:
      "Returns the configuration and metadata of every blockchain network Plug indexes and executes on.\n\nEach entry carries what a caller needs to speak to a chain through Plug: its id, its identity, and the platform-level configuration that decides how it is indexed and executed against. The list is the authority on where Plug operates; anything not in it is not supported yet.\n\nReach for it to populate a chain picker, to validate a chain id before composing against it, or to discover what is supported without hardcoding a list that will rot.",
    tag: "chain",
    queryParams: ChainQueryParamsSchema,
    responseSchema: ChainResponseSchema,
  },
  {
    operationId: "getColor",
    method: "GET",
    path: "/cdn/{encoded_url}/color",
    summary: "Get color",
    description:
      "Returns the dominant color of a hosted image along with a text color that stays readable on top of it.\n\nThe pair is computed once and served from the CDN, so surfaces themed around remote assets, token icons, protocol logos, NFT media, get their palette in one cheap call instead of shipping color extraction to the client.\n\nReach for it whenever UI wraps an image it has never seen: card backgrounds, hover washes, any place the design should take its color from the asset instead of a default.",
    tag: "cdn",
    pathParams: ColorParamsSchema,
    responseSchema: ColorResponseSchema,
  },
  {
    operationId: "getNonce",
    method: "GET",
    path: "/auth/nonce",
    summary: "Get nonce",
    description:
      "Issues a one-time nonce to embed in a Sign-In with Ethereum message.\n\nThe nonce binds the message the wallet is about to sign to this single authentication attempt, which is what makes a replayed signature worthless. It is step one of three: nonce, verify, refresh.\n\nReach for it at the start of wallet authentication, put the value in the SIWE message, and send the signed result to the verify surface.",
    tag: "auth",
    streaming: false,
    responseSchema: AuthNonceResponseSchema,
  },
  {
    operationId: "verifySignature",
    method: "POST",
    path: "/auth/verify",
    summary: "Verify signature",
    description:
      "Exchanges a signed Sign-In with Ethereum message for an access and refresh token pair.\n\nThe server checks the signature against the message, confirms the nonce is the one it issued, and mints the pair: a short-lived access token that authenticates requests and a refresh token that rotates it. Step two of three in wallet authentication.\n\nReach for it with the output of the wallet's signing prompt, then hold both tokens; the session lives exactly as long as the refresh rotation continues.",
    tag: "auth",
    bodySchema: AuthVerifyBodySchema,
    streaming: false,
    responseSchema: AuthTokenResponseSchema,
  },
  {
    operationId: "refreshToken",
    method: "POST",
    path: "/auth/refresh",
    summary: "Refresh token",
    description:
      "Rotates an expiring access token using its refresh token.\n\nAccess tokens are deliberately short-lived; the refresh token is what turns a signature made once into a session that lasts. Each rotation returns a fresh pair, so the caller always holds current credentials without asking the wallet to sign again. Step three of three in wallet authentication.\n\nReach for it just before the access token expires, or on the first rejected request, and replace both stored tokens with what comes back.",
    tag: "auth",
    bodySchema: AuthRefreshBodySchema,
    streaming: false,
    responseSchema: AuthTokenResponseSchema,
  },
  {
    operationId: "getSession",
    method: "GET",
    path: "/auth/session",
    summary: "Get session",
    description:
      "Resolves the address that the presented access token authenticates.\n\nIt is the whoami of the API: given nothing but the bearer token, it answers which wallet this session belongs to, which is exactly what a server-side consumer needs to trust a request without re-verifying a signature.\n\nReach for it to restore a session on load, to guard a route, or to confirm a token still lives before doing something that needs it.",
    tag: "auth",
    streaming: false,
    responseSchema: AuthSessionResponseSchema,
  },
];

const buildEndpoint = (def: EndpointDefinition): ApiEndpoint => {
  const params: ApiParam[] = [];

  if (def.pathParams) {
    params.push(
      ...flattenParamsFromSchema(def.pathParams, "path", "", ADDRESS_EXAMPLE),
    );
  }

  if (def.streaming !== false) {
    params.push(ACCEPT_HEADER);
  }

  if (def.queryParams) {
    params.push(...flattenParamsFromSchema(def.queryParams, "query"));
  }

  return {
    operationId: def.operationId,
    method: def.method,
    path: def.path,
    summary: def.summary,
    description: def.description,
    tag: def.tag,
    params,
    ...(def.bodySchema && {
      requestSchema: zodToSchemaProperty(def.bodySchema, "body"),
    }),
    responseSchema: zodToSchemaProperty(def.responseSchema),
  };
};

export const API_ENDPOINTS: ApiEndpoint[] =
  ENDPOINT_DEFINITIONS.map(buildEndpoint);

export const getEndpointsByTag = (tag: ApiEndpoint["tag"]) =>
  API_ENDPOINTS.filter((e) => e.tag === tag);
