"use client";

import { useCallback, useEffect, useState } from "react";
import { TYPE_NAMES, type CreatureDetail } from "@/features/catalog/types";

export type CreatureError = "not-found" | "unavailable";

export type CreatureState = {
  state: "idle" | "loading" | "error" | "ready";
  data?: CreatureDetail;
  error?: CreatureError;
  retry(): void;
};

// Per session: a creature's detail does not change while the page is open
const cache = new Map<number, CreatureDetail>();

const STAT_KEYS = ["hp", "attack", "defense", "specialAttack", "specialDefense", "speed"] as const;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;
const isNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const isStringOrNull = (value: unknown) => value === null || typeof value === "string";

// Hand-written so zod stays out of the client bundle; checks only what the panel reads
function isCreatureDetail(value: unknown): value is CreatureDetail {
  if (!isRecord(value) || !isRecord(value.stats) || !isRecord(value.sprite)) return false;
  const { stats, sprite } = value;
  return (
    isNumber(value.id) &&
    typeof value.name === "string" &&
    Array.isArray(value.types) &&
    value.types.length > 0 &&
    value.types.every((t) => (TYPE_NAMES as readonly unknown[]).includes(t)) &&
    STAT_KEYS.every((key) => isNumber(stats[key])) &&
    isNumber(value.heightM) &&
    isNumber(value.weightKg) &&
    typeof sprite.still === "string" &&
    isStringOrNull(sprite.animated) &&
    isStringOrNull(value.cry) &&
    isStringOrNull(value.flavor)
  );
}

type Result = { data?: CreatureDetail; error?: CreatureError };
type Settled = Result & { key: string };

// Prefetches in flight: opening the creature meanwhile waits for them instead of asking twice
const inflight = new Map<number, Promise<Result>>();

// Never rejects: every failure is a result, and a good answer lands in the cache
async function request(id: number, signal?: AbortSignal): Promise<Result> {
  try {
    const response = await fetch(`/api/creatures/${id}`, { signal });
    if (response.status === 404) return { error: "not-found" };
    if (!response.ok) return { error: "unavailable" };
    const body: unknown = await response.json();
    // Another creature's detail under this id is as wrong as a broken shape
    if (!isCreatureDetail(body) || body.id !== id) return { error: "unavailable" };
    cache.set(id, body);
    return { data: body };
  } catch {
    return { error: "unavailable" };
  }
}

// On intent (hover, focus) before the tap. Not abortable: the answer is worth keeping either way
export function prefetchCreature(id: number): void {
  if (cache.has(id) || inflight.has(id)) return;
  const pending = request(id).finally(() => inflight.delete(id));
  inflight.set(id, pending);
}

export function useCreature(id: number | null): CreatureState {
  const [attempt, setAttempt] = useState(0);
  const [settled, setSettled] = useState<Settled | null>(null);
  const [settledFor, setSettledFor] = useState(id);
  // A new id forgets the last result: reopening a creature that failed must ask again, not show the old error.
  // Adjusted while rendering so the stale result never reaches the screen
  if (settledFor !== id) {
    setSettledFor(id);
    setSettled(null);
  }
  const key = `${id}:${attempt}`;
  const cached = id === null ? undefined : cache.get(id);

  useEffect(() => {
    if (id === null || cache.has(id)) return;
    const controller = new AbortController();
    (inflight.get(id) ?? request(id, controller.signal)).then((result) => {
      if (!controller.signal.aborted) setSettled({ key, ...result });
    });
    return () => controller.abort();
  }, [id, key]);

  const retry = useCallback(() => setAttempt((a) => a + 1), []);

  if (id === null) return { state: "idle", retry };
  if (cached) return { state: "ready", data: cached, retry };
  // A result from another id or an earlier attempt is stale: show loading until this one settles
  if (settled?.key !== key) return { state: "loading", retry };
  if (settled.error) return { state: "error", error: settled.error, retry };
  return { state: "ready", data: settled.data, retry };
}
