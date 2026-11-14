"use client";

import type { ReactNode } from "react";
import { Button } from "./button";
import { Mark } from "./mark";

type Props = {
  variant: "info" | "success" | "error";
  title: string;
  children?: ReactNode;
  action?: { label: string; onActivate: () => void };
  // The action on its own line, for a notice too narrow to hold it beside the text
  stacked?: boolean;
};

const BORDERS = {
  info: "border-control",
  success: "border-foreground",
  error: "border-alert",
} as const;

export function Notice({ variant, title, children, action, stacked = false }: Props) {
  const border = BORDERS[variant];
  return (
    <div
      role={variant === "error" ? "alert" : "status"}
      className={`flex items-start gap-3 rounded-panel border bg-surface p-3 text-foreground ${border} ${stacked ? "flex-wrap" : ""}`}
    >
      <Mark variant={variant} />
      <div className="flex flex-1 flex-col gap-1">
        <p className="font-semibold">{title}</p>
        {children ? <div className="text-body text-muted">{children}</div> : null}
      </div>
      {action ? (
        <div className={stacked ? "flex basis-full justify-end" : "contents"}>
          <Button variant="secondary" onClick={action.onActivate}>
            {action.label}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
