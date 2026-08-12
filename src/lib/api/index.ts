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
    "For a typical single-time JSON response, set this to `application/json`. To receive realtime updates through a stream, set this to `text/event-stream`.",
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
      "Returns all address level metadata for the provided EVM address including signal-level graph flags.",
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
      "Returns all indexed fungible, non-fungible, and non-tokenized positions for the provided address.",
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
      "Returns all the options needed for each action input to build a valid transaction such as tokens, pools, and chains.",
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
      "Returns paginated on-chain transaction activity for the provided address, sorted by block number descending.",
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
      "Returns all saved Plug transactions associated with the EVM address provided, after considering all applied filters. Use this to list and review existing transaction records, not to compile new calldata.",
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
      "Constructs and compiles transaction calldata from structured inputs, returning details ready for signing and submission. This is the build step — use GET /transaction to list existing records.",
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
      "Returns time-series data for the provided address including price OHLC, balance history, and portfolio value over time.",
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
      "Compiles a draft action sequence into coil options, output manifests, and simulated slot values without persisting anything. This is the preview step the composer runs on every edit — it is not bound to a wallet and it never submits.",
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
      "Broadcasts a signed intent bundle. The signature must be produced by the owning wallet, so this is the one surface that cannot act on an arbitrary address.",
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
      "Cancels a scheduled or pending intent row owned by the address.",
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
      "Returns all data for a specific blockchain network including its configuration and metadata.",
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
      "Returns the dominant color and a readable text color for a CDN-hosted image, used to theme surfaces around remote assets.",
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
      "Issues a one-time nonce to embed in a SIWE message. Step one of three in wallet authentication.",
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
      "Exchanges a signed SIWE message for an access and refresh token pair. Step two of three in wallet authentication.",
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
      "Rotates an expiring access token using its refresh token. Step three of three in wallet authentication.",
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
      "Resolves the address that the presented access token authenticates.",
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
