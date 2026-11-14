"use client";

import type { ReactNode } from "react";
import { Button } from "./button";
import { NoticeFrame, type NoticeVariant } from "./notice-frame";

type Props = {
  variant: NoticeVariant;
  title: string;
  children?: ReactNode;
  action?: { label: string; onActivate: () => void };
};

export function Notice({ variant, title, children, action }: Props) {
  return (
    <NoticeFrame
      variant={variant}
      title={title}
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
