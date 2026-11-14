"use client";

import { AnimatePresence, domAnimation, LazyMotion } from "motion/react";
import * as m from "motion/react-m";
import { type KeyboardEvent, type ReactNode, useEffect, useEffectEvent, useId, useRef } from "react";
import { useDurationToken } from "@/hooks/use-duration-token";
import { CURVE_OUT } from "./motion-tokens";

type Props = {
  open: boolean;
  title: string;
  // The visible way out (a Button calling onClose), passed in so this lazy chunk shares no module with the page's
  close: ReactNode;
  onClose(): void;
  // Where focus goes back on close; a tap does not focus a button in every browser, so the opener is not guessed
  returnFocus(): HTMLElement | null;
  children: ReactNode;
};

const FOCUSABLE = "button:not([disabled]), a[href], input:not([disabled]), [tabindex]:not([tabindex='-1'])";

// A modal sheet rising from the bottom edge, for phones: the dimmed map behind it closes it on a tap.
// Focus moves in on open, stays inside while open and goes back to whatever opened it
export function Sheet({ open, title, close, onClose, returnFocus, children }: Props) {
  const durationMs = useDurationToken("--duration-medium");
  const panelRef = useRef<HTMLElement>(null);
  const headingId = useId();

  const enter = useEffectEvent(() => panelRef.current?.focus({ preventScroll: true }));

  const leave = useEffectEvent(() => {
    const active = document.activeElement;
    // Something else (the creature detail) may have taken the focus on purpose; only a lost one goes back
    const lost = active === null || active === document.body || panelRef.current?.contains(active);
    if (lost) returnFocus()?.focus({ preventScroll: true });
  });

  useEffect(() => {
    if (!open) return;
    enter();
    return () => leave();
  }, [open]);

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = [...event.currentTarget.querySelectorAll<HTMLElement>(FOCUSABLE)];
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;
    if (event.shiftKey && (active === first || active === event.currentTarget)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }

  // With reduced motion the token is 0: no travel, the sheet just appears
  const seconds = durationMs / 1000;
  const offset = durationMs === 0 ? 0 : "100%";

  return (
    // domAnimation with m.* instead of the full motion bundle: only opacity and y move
    <LazyMotion features={domAnimation} strict>
      <AnimatePresence>
        {open ? (
          <m.div
            key="backdrop"
            aria-hidden="true"
            onClick={onClose}
            className="pointer-events-auto fixed inset-0 z-30 bg-background/60"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: seconds, ease: CURVE_OUT }}
          />
        ) : null}
        {open ? (
          <m.section
            key="sheet"
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={headingId}
            tabIndex={-1}
            onKeyDown={handleKeyDown}
            className="pointer-events-auto fixed inset-x-0 bottom-0 z-30 flex max-h-[80dvh] flex-col gap-3 overflow-y-auto overscroll-contain rounded-t-panel border-t border-structure bg-surface px-4 pt-2 pb-[max(1rem,env(safe-area-inset-bottom))] text-body text-foreground outline-none"
            initial={{ y: offset }}
            animate={{ y: 0 }}
            exit={{ y: offset }}
            transition={{ duration: seconds, ease: CURVE_OUT }}
          >
            {/* The handle says it is a sheet; closing is the button, the backdrop or Escape */}
            <span aria-hidden="true" className="mx-auto h-1 w-10 shrink-0 rounded-control bg-control" />
            <h2 id={headingId} className="font-semibold">
              {title}
            </h2>
            {children}
            <div className="flex justify-end">{close}</div>
          </m.section>
        ) : null}
      </AnimatePresence>
    </LazyMotion>
  );
}
