"use client";

import { useTranslations } from "next-intl";
import { type Ref, useEffect, useEffectEvent, useId, useImperativeHandle, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { canAddVertex, canClose, FENCE_RULES, type FenceProblem } from "@/domain/geometry/fence-rules";
import type { LngLat, Ring } from "@/domain/geometry/types";
import { isInTerritory } from "@/features/fence-draft/territory";

export type FenceDrawingHandle = {
  // A point from the map (a tap or Enter); it becomes a vertex only if the rules allow it
  add(point: LngLat): void;
};

type Props = {
  vertices: Ring;
  onChange(next: Ring): void;
  onClose(ring: Ring): void;
  onCancel(): void;
  // Where the reticle points, for «Sumar punto acá»
  reticlePoint(): LngLat | null;
  ref?: Ref<FenceDrawingHandle>;
};

function useProblemText() {
  const t = useTranslations("FenceDrawing");
  return (problem: FenceProblem): string => {
    switch (problem.kind) {
      case "too-few-vertices":
        return t("tooFew", { missing: problem.missing });
      case "too-many-vertices":
        return t("tooMany", { max: FENCE_RULES.maxVertices });
      case "crossing":
        return t("crossing");
      case "too-large":
        return t("tooLarge");
      case "outside":
        return t("outside");
    }
  };
}

// The drawing mode's panel. The vertices live with the caller, which also draws them on the map;
// the rules are checked here, so they only download once the mode is used
export function FenceDrawing({ vertices, onChange, onClose, onCancel, reticlePoint, ref }: Props) {
  const t = useTranslations("FenceDrawing");
  const text = useProblemText();
  const titleId = useId();
  const reasonId = useId();
  const addRef = useRef<HTMLButtonElement>(null);
  // Counted so the same rejection twice in a row is announced twice
  const [rejected, setRejected] = useState<{ problem: FenceProblem; n: number } | null>(null);
  const blocker = canClose(vertices);

  function add(point: LngLat) {
    const problem = canAddVertex(vertices, point, isInTerritory);
    if (problem) {
      setRejected((last) => ({ problem, n: (last?.n ?? 0) + 1 }));
      return;
    }
    setRejected(null);
    onChange([...vertices, point]);
  }

  useImperativeHandle(ref, () => ({ add }));

  function addHere() {
    const point = reticlePoint();
    if (point) add(point);
  }

  function undo() {
    setRejected(null);
    onChange(vertices.slice(0, -1));
  }

  // The trigger that opened the mode is gone: the next thing to do is place a point
  useEffect(() => {
    addRef.current?.focus({ preventScroll: true });
  }, []);

  const cancel = useEffectEvent(() => onCancel());
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      event.preventDefault();
      cancel();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <section aria-labelledby={titleId} className="flex min-w-0 flex-col gap-2">
      <p className="text-label text-muted">
        <span
          id={titleId}
          className="font-display font-stretch-condensed font-bold tracking-wider text-foreground uppercase"
        >
          {t("title")}
        </span>
        <span aria-hidden="true"> · </span>
        {t("hint")}
      </p>
      <p className="text-label text-muted">{t("count", { count: vertices.length, max: FENCE_RULES.maxVertices })}</p>
      <div className="flex flex-wrap gap-2">
        <Button ref={addRef} variant="secondary" onClick={addHere} className="px-4!">
          {t("addHere")}
        </Button>
        <Button variant="secondary" disabled={vertices.length === 0} onClick={undo} className="px-4!">
          {t("undo")}
        </Button>
        <Button
          disabled={blocker !== null}
          aria-describedby={blocker ? reasonId : undefined}
          onClick={() => onClose(vertices)}
          className="px-4!"
        >
          {t("close")}
        </Button>
        <Button variant="secondary" onClick={onCancel} className="px-4!">
          {t("cancel")}
        </Button>
      </div>
      {/* Why Cerrar is off, kept current as vertices come and go: hearing it change also confirms each vertex */}
      <p id={reasonId} role="status" className="min-h-5 text-label text-muted">
        {blocker ? text(blocker) : null}
      </p>
      {/* A rejected point; keyed so each rejection is inserted fresh and announced */}
      <div role="alert" className="empty:hidden">
        {rejected ? (
          <p key={rejected.n} className="text-label text-alert">
            {text(rejected.problem)}
          </p>
        ) : null}
      </div>
    </section>
  );
}
