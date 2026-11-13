import { cacheLife } from "next/cache";
import { UpstreamError, type UpstreamErrorKind } from "./errors";

// Anything thrown inside "use cache" reaches the caller as a plain Error, losing UpstreamError
// and its kind. Cached scopes return failures as values instead.
export type Loaded<T> = { ok: true; data: T } | { ok: false; kind: UpstreamErrorKind };

// Only upstream failures become values; any other error is a bug and must surface.
export async function settle<T>(load: () => Promise<T>): Promise<Loaded<T>> {
  try {
    return { ok: true, data: await load() };
  } catch (error) {
    if (error instanceof UpstreamError) return { ok: false, kind: error.kind };
    throw error;
  }
}

// Call from inside the "use cache" function. Failures are kept briefly so upstream can recover.
// Trade-off: if upstream fails right when good data is revalidated, the failure replaces it for up
// to a minute (cacheLife "seconds").
export function cacheFor(loaded: Loaded<unknown>, profile: "minutes" | "hours" | "days" | "weeks"): void {
  if (!loaded.ok) {
    cacheLife("seconds");
    return;
  }
  // cacheLife is overloaded per profile literal, so a union needs one call per member.
  switch (profile) {
    case "minutes":
      return cacheLife("minutes");
    case "hours":
      return cacheLife("hours");
    case "days":
      return cacheLife("days");
    case "weeks":
      return cacheLife("weeks");
  }
}
