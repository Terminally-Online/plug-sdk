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
} from "@/src/lib/schemas/address";
import {
  ChainQueryParamsSchema,
  ChainResponseSchema,
} from "@/src/lib/schemas/chain";
import {
  ContextQueryParamsSchema,
  ContextResponseSchema,
} from "@/src/lib/schemas/context";
import {
  GetActivityQueryParamsSchema,
  GetActivityResponseSchema,
} from "@/src/lib/schemas/activity";
import {
  GetTransactionsQueryParamsSchema,
  GetTransactionsResponseSchema,
  CreateTransactionQueryParamsSchema,
  CreateTransactionResponseSchema,
} from "@/src/lib/schemas/transaction";
import {
  SeriesQueryParamsSchema,
  SeriesResponseSchema,
} from "@/src/lib/schemas/series";


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
  example?: string;
}

export interface SchemaProperty {
  name: string;
  type: string;
  required?: boolean;
  nullable?: boolean;
  description?: string;
  properties?: SchemaProperty[];
  items?: SchemaProperty;
}

export interface ApiEndpoint {
  operationId: string;
  method: HttpMethod;
  path: string;
  summary: string;
  description: string;
  tag: "address" | "transaction" | "chain";
  params: ApiParam[];
  responseSchema: SchemaProperty;
}

const unwrapSchema = (schema: ZodTypeAny): ZodTypeAny => {
  if (schema instanceof ZodOptional || schema instanceof ZodNullable) {
    return unwrapSchema(schema._def.innerType);
  }
  if (schema instanceof ZodLazy) {
    return unwrapSchema(schema._def.getter());
  }
  if (schema instanceof ZodUnion) {
    const nonNullOption = schema._def.options.find(
      (opt: ZodTypeAny) => opt._def.typeName !== "ZodNull",
    );
    if (nonNullOption) {
      return unwrapSchema(nonNullOption);
    }
  }
  return schema;
};

const isOptional = (schema: ZodTypeAny): boolean => {
  if (schema instanceof ZodOptional) return true;
  if (schema instanceof ZodNullable) return isOptional(schema._def.innerType);
  return false;
};

const isNullable = (schema: ZodTypeAny): boolean => {
  if (schema instanceof ZodNullable) return true;
  if (schema instanceof ZodOptional) return isNullable(schema._def.innerType);
  if (schema instanceof ZodUnion) {
    return schema._def.options.some(
      (opt: ZodTypeAny) => opt._def.typeName === "ZodNull",
    );
  }
  return false;
};

const getZodTypeName = (schema: ZodTypeAny): string => {
  const unwrapped = unwrapSchema(schema);
  const typeName = unwrapped._def.typeName;

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
      return getRecordType(unwrapped as z.ZodRecord<any, any>);
    case "ZodUnion":
      return getUnionType(unwrapped as z.ZodUnion<any>);
    case "ZodEnum":
      return "string";
    default:
      return typeName?.replace("Zod", "").toLowerCase() ?? "unknown";
  }
};

const getRecordType = (schema: z.ZodRecord<any, any>): string => {
  const keyType = getZodTypeName(schema._def.keyType);
  const valueType = getZodTypeName(schema._def.valueType);
  return `Record<${keyType}, ${valueType}>`;
};

const getUnionType = (schema: z.ZodUnion<any>): string => {
  const types = schema._def.options.map((opt: ZodTypeAny) =>
    getZodTypeName(opt),
  );
  const filtered = types.filter((t: string) => t !== "null");
  return filtered.length === 1 ? filtered[0] : filtered.join(" | ");
};

const getDescription = (schema: ZodTypeAny): string | undefined => {
  return schema._def.description || schema.description;
};

const getParamType = (schema: ZodTypeAny): "string" | "integer" | "boolean" => {
  const unwrapped = unwrapSchema(schema);
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
  const unwrapped = unwrapSchema(schema);
  if (unwrapped instanceof ZodEnum) {
    return unwrapped._def.values as string[];
  }
  if (unwrapped instanceof ZodBoolean) {
    return ["true", "false"];
  }
  if (unwrapped instanceof ZodArray) {
    const innerUnwrapped = unwrapSchema(unwrapped._def.type);
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
  const unwrapped = unwrapSchema(schema);

  if (!(unwrapped instanceof ZodObject)) {
    return params;
  }

  const shape = unwrapped._def.shape();

  for (const [key, value] of Object.entries(shape)) {
    const fieldSchema = value as ZodTypeAny;
    const fieldUnwrapped = unwrapSchema(fieldSchema);
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
): SchemaProperty => {
  if (depth > 10) {
    return { name, type: "object", description: "Recursive structure" };
  }

  const unwrapped = unwrapSchema(schema);
  const typeName = getZodTypeName(schema);
  const nullable = isNullable(schema);
  const optional = isOptional(schema);
  const description = getDescription(schema);

  const base: SchemaProperty = {
    name,
    type: typeName,
    ...(nullable && { nullable: true }),
    ...(!optional && !nullable && { required: true }),
    ...(description && { description }),
  };

  if (unwrapped instanceof ZodObject) {
    const shape = unwrapped._def.shape();
    base.properties = Object.entries(shape).map(([key, value]) =>
      zodToSchemaProperty(value as ZodTypeAny, key, depth + 1),
    );
  }

  if (unwrapped instanceof ZodArray) {
    base.items = zodToSchemaProperty(unwrapped._def.type, "item", depth + 1);
  }

  if (unwrapped instanceof ZodRecord) {
    const valueSchema = unwrapped._def.valueType;
    if (valueSchema instanceof ZodObject || valueSchema instanceof ZodArray) {
      base.properties = [zodToSchemaProperty(valueSchema, "value", depth + 1)];
    }
  }

  return base;
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
  tag: "address" | "transaction" | "chain";
  pathParams?: ZodTypeAny;
  queryParams?: ZodTypeAny;
  responseSchema: ZodTypeAny;
}

const ENDPOINT_DEFINITIONS: EndpointDefinition[] = [
  {
    operationId: "getAddress",
    method: "GET",
    path: "/address/{address}",
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
    path: "/address/{address}",
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
    path: "/address/{address}",
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
    path: "/address/{address}/transaction",
    summary: "Get transaction(s)",
    description:
      "Returns all transactions associated with the EVM address provided, after considering all applied filters.",
    tag: "transaction",
    pathParams: AddressParamsSchema,
    queryParams: GetTransactionsQueryParamsSchema,
    responseSchema: GetTransactionsResponseSchema,
  },
  {
    operationId: "createTransaction",
    method: "POST",
    path: "/address/{address}/transaction",
    summary: "Create transaction",
    description:
      "Constructs the transaction calldata and returns the transaction details ready for signing and submission.",
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
];

const buildEndpoint = (def: EndpointDefinition): ApiEndpoint => {
  const params: ApiParam[] = [];

  if (def.pathParams) {
    params.push(
      ...flattenParamsFromSchema(def.pathParams, "path", "", ADDRESS_EXAMPLE),
    );
  }

  params.push(ACCEPT_HEADER);

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
    responseSchema: zodToSchemaProperty(def.responseSchema),
  };
};

export const API_ENDPOINTS: ApiEndpoint[] =
  ENDPOINT_DEFINITIONS.map(buildEndpoint);

export const getEndpointsByTag = (tag: ApiEndpoint["tag"]) =>
  API_ENDPOINTS.filter((e) => e.tag === tag);
