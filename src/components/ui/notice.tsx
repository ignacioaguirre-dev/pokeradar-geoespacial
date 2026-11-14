"use client";

import type { ReactNode } from "react";
import { Button } from "./button";
import { Mark } from "./mark";

type Props = {
  variant: "info" | "success" | "error";
  title: string;
  children?: ReactNode;
  action?: { label: string; onActivate: () => void };
};

const BORDERS = {
  info: "border-control",
  success: "border-foreground",
  error: "border-alert",
} as const;

export function Notice({ variant, title, children, action }: Props) {
  const border = BORDERS[variant];
  return (
    <div
      role={variant === "error" ? "alert" : "status"}
      className={`flex items-start gap-3 rounded-panel border bg-surface p-3 text-foreground ${border}`}
    >
      <Mark variant={variant} />
      <div className="flex flex-1 flex-col gap-1">
        <p className="font-semibold">{title}</p>
        {children ? <div className="text-body text-muted">{children}</div> : null}
      </div>
      {action ? (
        <Button variant="secondary" onClick={action.onActivate}>
          {action.label}
        </Button>
      ) : null}
    </div>
  );
}
