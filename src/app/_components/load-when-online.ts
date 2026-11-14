"use client";

import dynamic from "next/dynamic";
import { Component, useState, type ComponentType, type ReactNode } from "react";

// Without a network a failed chunk waits for the connection instead of failing.
// With one, a missing chunk is a real error and still throws, for LoadBoundary to catch
export function loadWhenOnline<T>(load: () => Promise<T>): Promise<T> {
  return load().catch((error: unknown) => {
    if (navigator.onLine) throw error;
    return new Promise<void>((resolve) => window.addEventListener("online", () => resolve(), { once: true })).then(
      () => loadWhenOnline(load),
    );
  });
}

function create<P>(load: () => Promise<ComponentType<P>>) {
  return dynamic(() => loadWhenOnline(load), { ssr: false, loading: () => null });
}

// A lazy component keeps its failed load forever: reload hands out a fresh one that asks for the chunk again
export function useLazyWhenOnline<P>(load: () => Promise<ComponentType<P>>): [ComponentType<P>, () => void] {
  const [Lazy, setLazy] = useState(() => create(load));
  return [Lazy, () => setLazy(() => create(load))];
}

type BoundaryProps = { children: ReactNode; fallback: ReactNode; onError?(): void };

// Keeps a chunk that fails to download from taking the page down; the parent remounts it (key) to retry
export class LoadBoundary extends Component<BoundaryProps, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch() {
    this.props.onError?.();
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
