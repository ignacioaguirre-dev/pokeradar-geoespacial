"use client";

import { LazyError } from "./_components/lazy-error";

// Catches what breaks inside the page; the root layout (fonts, styles) is still there.
// retry() re-fetches the segment, which reset() would not
export default function Error({ retry }: { error: unknown; retry: () => void }) {
  return <LazyError onRetry={retry} />;
}
