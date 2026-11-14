"use client";

import { LazyError } from "./_components/lazy-error";
import "./globals.css";

// Replaces the root layout when the layout itself fails, so it brings its own document and styles
export default function GlobalError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <html lang="es-AR" className="h-full antialiased">
      <body className="min-h-full bg-background font-sans text-foreground">
        <LazyError onRetry={retry} ownsDocument />
      </body>
    </html>
  );
}
