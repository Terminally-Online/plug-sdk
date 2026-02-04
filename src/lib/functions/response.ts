import { ResponseError } from "@/src/lib/schemas/response";

export const isErrorResponse = (data: unknown): data is ResponseError => {
  return (
    data !== null &&
    typeof data === "object" &&
    "error" in data &&
    typeof (data as ResponseError).error === "string"
  );
};

export const isApiResponse = <T>(
  result: T,
): result is T & { data: unknown } => {
  return result !== null && typeof result === "object" && "data" in result;
};
