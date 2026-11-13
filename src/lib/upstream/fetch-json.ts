import type { z } from "zod";
import { UpstreamError } from "./errors";

type JsonFetcherOptions = {
  // A function so the environment is read on every call, not frozen at import time.
  baseUrl: () => string;
  timeoutMs: number;
};

export type JsonFetcher = <T>(path: string, schema: z.ZodType<T>) => Promise<T>;

// Messages carry only the path and status: the upstream body never leaves this function.
export function createJsonFetcher({ baseUrl, timeoutMs }: JsonFetcherOptions): JsonFetcher {
  return async (path, schema) => {
    let response: Response;
    try {
      // A hung upstream must not hold the request open; the abort lands in the catch below.
      response = await fetch(`${baseUrl()}${path}`, { signal: AbortSignal.timeout(timeoutMs) });
    } catch {
      throw new UpstreamError("unavailable", `${path}: network error`);
    }

    if (response.status === 404) throw new UpstreamError("not-found", `${path}: 404`);
    if (!response.ok) throw new UpstreamError("unavailable", `${path}: ${response.status}`);

    let body: unknown;
    try {
      body = await response.json();
    } catch {
      throw new UpstreamError("invalid", `${path}: body is not JSON`);
    }

    const parsed = schema.safeParse(body);
    if (!parsed.success) throw new UpstreamError("invalid", `${path}: unexpected shape`);
    return parsed.data;
  };
}
