"use client";

import { type ComponentType, useEffect, useState } from "react";

type Props = { onRetry(): void; ownsDocument?: boolean };
type Content = ComponentType<Props>;

// Kept across mounts so a retry that fails again renders the content at once instead of flashing the fallback
let loaded: Content | null = null;

// Next ships error.tsx and global-error.tsx with the initial JS; the content (and the catalog it needs)
// only downloads when something fails. A plain import() instead of next/dynamic, whose loader would also
// land in the initial JS
export function LazyError({ reload = () => window.location.reload(), ...props }: Props & { reload?(): void }) {
  const [Content, setContent] = useState<Content | null>(() => loaded);
  useEffect(() => {
    if (loaded) return;
    let active = true;
    import("./error-content")
      .then((module) => {
        loaded = module.default;
        if (active) setContent(() => module.default);
      })
      // Offline or a newer deploy: the chunk is gone, the static fallback stays
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);
  return Content ? <Content {...props} /> : <StaticFallback reload={reload} />;
}

// Hardcoded Spanish on purpose: when the chunk can't download, neither can the message catalog.
// Short classes instead of buttonClass: both boundaries ship this in the initial JS, each with its own copy.
// The browser's default focus ring stays
const ACTION = "inline-flex min-h-11 items-center rounded-control border border-control px-4 font-semibold";

function StaticFallback({ reload }: { reload(): void }) {
  return (
    <div role="alert" className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-3 p-3">
      <p>Algo salió mal. Volvé al mapa o recargá la página.</p>
      <div className="flex flex-wrap gap-3">
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- a full load is the way out of a crashed page */}
        <a href="/" className={ACTION}>
          Volver al mapa
        </a>
        <button type="button" onClick={reload} className={ACTION}>
          Recargar la página
        </button>
      </div>
    </div>
  );
}
