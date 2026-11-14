import type { ReactNode } from "react";
import { Mark } from "./mark";

export type NoticeVariant = "info" | "success" | "error";

type Props = {
  variant: NoticeVariant;
  title: string;
  children?: ReactNode;
  trailing?: ReactNode;
  // The trailing action on its own line, for a notice too narrow to hold it beside the text
  stacked?: boolean;
  // False inside a live region that already exists: a role on a node inserted later may go unannounced
  live?: boolean;
};

const BORDERS = {
  info: "border-control",
  success: "border-foreground",
  error: "border-alert",
} as const;

// No "use client": a server page (the root 404) can show a notice without shipping Notice and Button
// again in a chunk of its own
export function NoticeFrame({ variant, title, children, trailing, stacked = false, live = true }: Props) {
  return (
    <div
      role={live ? (variant === "error" ? "alert" : "status") : undefined}
      className={`flex items-start gap-3 rounded-panel border bg-surface p-3 text-foreground ${BORDERS[variant]} ${stacked ? "flex-wrap" : ""}`}
    >
      <Mark variant={variant} />
      <div className="flex flex-1 flex-col gap-1">
        <p className="font-semibold">{title}</p>
        {children ? <div className="text-body text-muted">{children}</div> : null}
      </div>
      {trailing ? <div className={stacked ? "flex basis-full justify-end" : "contents"}>{trailing}</div> : null}
    </div>
  );
}
