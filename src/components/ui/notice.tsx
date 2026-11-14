"use client";

import type { ReactNode } from "react";
import { Button } from "./button";
import { NoticeFrame, type NoticeVariant } from "./notice-frame";

type Props = {
  variant: NoticeVariant;
  title: string;
  children?: ReactNode;
  action?: { label: string; onActivate: () => void };
  stacked?: boolean;
  live?: boolean;
};

export function Notice({ variant, title, children, action, stacked, live }: Props) {
  return (
    <NoticeFrame
      variant={variant}
      title={title}
      stacked={stacked}
      live={live}
      trailing={
        action ? (
          <Button variant="secondary" onClick={action.onActivate}>
            {action.label}
          </Button>
        ) : null
      }
    >
      {children}
    </NoticeFrame>
  );
}
