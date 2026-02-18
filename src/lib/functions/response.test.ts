import { describe, expect, it } from "vitest";
import { isErrorResponse, isApiResponse } from "@/src/lib/functions/response";

describe("isErrorResponse", () => {
  it("should return true for valid error response", () => {
    expect(isErrorResponse({ error: "something went wrong" })).toBe(true);
  });

  it("should return true for empty string error", () => {
    expect(isErrorResponse({ error: "" })).toBe(true);
  });

  it("should return false for null", () => {
    expect(isErrorResponse(null)).toBe(false);
  });

  it("should return false for undefined", () => {
    expect(isErrorResponse(undefined)).toBe(false);
  });

  it("should return false for non-string error property", () => {
    expect(isErrorResponse({ error: 42 })).toBe(false);
    expect(isErrorResponse({ error: null })).toBe(false);
    expect(isErrorResponse({ error: true })).toBe(false);
  });

  it("should return false for objects without error property", () => {
    expect(isErrorResponse({ data: "ok" })).toBe(false);
    expect(isErrorResponse({})).toBe(false);
  });

  it("should return false for primitives", () => {
    expect(isErrorResponse("string")).toBe(false);
    expect(isErrorResponse(42)).toBe(false);
    expect(isErrorResponse(true)).toBe(false);
  });

  it("should return false for arrays", () => {
    expect(isErrorResponse(["error"])).toBe(false);
  });

  it("should return true even when other properties are present", () => {
    expect(isErrorResponse({ error: "msg", data: {}, status: 500 })).toBe(true);
  });
});

describe("isApiResponse", () => {
  it("should return true for objects with data property", () => {
    expect(isApiResponse({ data: { items: [] } })).toBe(true);
  });

  it("should return true when data is null", () => {
    expect(isApiResponse({ data: null })).toBe(true);
  });

  it("should return true when data is undefined but key exists", () => {
    expect(isApiResponse({ data: undefined })).toBe(true);
  });

  it("should return false for null", () => {
    expect(isApiResponse(null)).toBe(false);
  });

  it("should return false for objects without data property", () => {
    expect(isApiResponse({ error: "msg" })).toBe(false);
    expect(isApiResponse({})).toBe(false);
  });

  it("should return false for primitives", () => {
    expect(isApiResponse("string")).toBe(false);
    expect(isApiResponse(42)).toBe(false);
  });

  it("should return false for arrays", () => {
    expect(isApiResponse([1, 2, 3])).toBe(false);
  });
});
