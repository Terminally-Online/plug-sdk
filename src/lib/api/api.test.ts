import { describe, expect, it } from "vitest";
import { z } from "zod/v4";

import {
  API_ENDPOINTS,
  SELF_TYPE,
  type SchemaProperty,
  zodToSchemaProperty,
} from "./index";
import { RecursiveStringMapSchema } from "../schemas/address";

const find = (
  schema: SchemaProperty,
  name: string,
): SchemaProperty | null => {
  if (schema.name === name) return schema;
  for (const property of schema.properties ?? []) {
    const hit = find(property, name);
    if (hit) return hit;
  }
  return schema.items ? find(schema.items, name) : null;
};

describe("zodToSchemaProperty", () => {
  it("names a self-referential branch instead of expanding or discarding it", () => {
    const property = zodToSchemaProperty(RecursiveStringMapSchema, "attributes");

    expect(property.type).toBe(`Record<string, string | ${SELF_TYPE}>`);
    expect(property.properties?.[0]?.type).toBe(`string | ${SELF_TYPE}`);
  });

  it("keeps every member of a union rather than collapsing to the first", () => {
    const schema = z.object({
      value: z.union([z.string(), z.number(), z.boolean()]),
    });

    expect(find(zodToSchemaProperty(schema), "value")?.type).toBe(
      "string | integer | boolean",
    );
  });

  it("still resolves a nullable union to its one real member", () => {
    const schema = z.object({ value: z.union([z.string(), z.null()]) });
    const value = find(zodToSchemaProperty(schema), "value");

    expect(value?.type).toBe("string");
    expect(value?.nullable).toBe(true);
  });

  it("describes a record's value type even when that value is a scalar", () => {
    const schema = z.object({ tallies: z.record(z.string(), z.number()) });
    const tallies = find(zodToSchemaProperty(schema), "tallies");

    expect(tallies?.type).toBe("Record<string, integer>");
    expect(tallies?.properties?.[0]?.type).toBe("integer");
  });

  it("reports the closed set behind an enum", () => {
    const schema = z.object({ status: z.enum(["open", "closed"]) });

    expect(find(zodToSchemaProperty(schema), "status")?.enum).toEqual([
      "open",
      "closed",
    ]);
  });

  it("carries a field's description through to the documented shape", () => {
    const schema = z.object({
      rate: z.string().optional().describe("Net carry APY in percent units."),
    });

    expect(find(zodToSchemaProperty(schema), "rate")?.description).toBe(
      "Net carry APY in percent units.",
    );
  });
});

describe("API_ENDPOINTS", () => {
  it("documents a response shape for every endpoint", () => {
    for (const endpoint of API_ENDPOINTS) {
      expect(
        endpoint.responseSchema,
        `${endpoint.operationId} has no response schema`,
      ).toBeTruthy();
      expect(
        endpoint.responseSchema.properties?.length ?? 0,
        `${endpoint.operationId} has an empty response schema`,
      ).toBeGreaterThan(0);
    }
  });

  it("covers the whole surface the client can reach", () => {
    const documented = new Set(
      API_ENDPOINTS.map((endpoint) => endpoint.operationId),
    );

    for (const operationId of [
      "getAddress",
      "getPositions",
      "getContext",
      "getActivity",
      "getSeries",
      "getTransactions",
      "createTransaction",
      "compileTransaction",
      "submitTransaction",
      "cancelTransaction",
      "getChains",
      "getColor",
      "getNonce",
      "verifySignature",
      "refreshToken",
      "getSession",
    ]) {
      expect(documented.has(operationId), `${operationId} is undocumented`).toBe(
        true,
      );
    }
  });

  it("locates every path parameter that a caller has to substitute", () => {
    for (const endpoint of API_ENDPOINTS) {
      const placeholders = [...endpoint.path.matchAll(/\{([^}]+)\}/g)].map(
        (match) => match[1],
      );
      const declared = endpoint.params
        .filter((param) => param.location === "path")
        .map((param) => param.name);

      for (const placeholder of placeholders) {
        expect(
          declared,
          `${endpoint.operationId} does not declare path param ${placeholder}`,
        ).toContain(placeholder);
      }
    }
  });

  it("documents a request body wherever one is sent", () => {
    const submit = API_ENDPOINTS.find(
      (endpoint) => endpoint.operationId === "submitTransaction",
    );

    expect(submit?.requestSchema?.properties?.map((p) => p.name)).toContain(
      "signature",
    );
  });

  it("keeps the attributes map legible on the position response", () => {
    const positions = API_ENDPOINTS.find(
      (endpoint) => endpoint.operationId === "getPositions",
    )!;
    const attributes = find(positions.responseSchema, "attributes");

    expect(attributes?.type).toContain(SELF_TYPE);
    expect(attributes?.description).toContain("nested");
  });
});
