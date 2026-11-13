export type UpstreamErrorKind = "not-found" | "unavailable" | "invalid";

export class UpstreamError extends Error {
  readonly kind: UpstreamErrorKind;

  constructor(kind: UpstreamErrorKind, message: string = kind) {
    super(message);
    this.name = "UpstreamError";
    this.kind = kind;
  }
}
