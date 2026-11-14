import type { ReactNode } from "react";

// The frame every app-level error shares: the brand stays as the page heading and the notice sits centered,
// so a failure still reads as this app and not as the browser's or the framework's
export function ErrorScreen({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-background pt-[max(0.75rem,env(safe-area-inset-top))] pr-[max(0.75rem,env(safe-area-inset-right))] pb-[max(0.75rem,env(safe-area-inset-bottom))] pl-[max(0.75rem,env(safe-area-inset-left))] text-foreground">
      <header>
        <h1 className="font-display font-stretch-condensed text-title font-bold uppercase tracking-tight md:text-headline">
          {heading}
        </h1>
      </header>
      <main className="my-auto w-full max-w-md self-center">{children}</main>
    </div>
  );
}
