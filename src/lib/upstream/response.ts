import type { UpstreamErrorKind } from "./errors";

const STATUS: Record<UpstreamErrorKind, number> = { "not-found": 404, unavailable: 502, invalid: 502 };

const error = (code: string, status: number) =>
  Response.json({ error: code }, { status, headers: { "Cache-Control": "no-store" } });

// Only the kind goes out: upstream bodies and messages stay on the server.
export const upstreamFailure = (kind: UpstreamErrorKind): Response => error(kind, STATUS[kind]);

export const invalidInput = (code: string): Response => error(code, 400);
