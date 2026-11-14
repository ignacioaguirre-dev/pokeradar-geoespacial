"use client";

import { useTranslations } from "next-intl";
import { useId, type ButtonHTMLAttributes } from "react";
import { type ButtonVariant, buttonClass } from "./button-styles";

type Props = {
  variant?: ButtonVariant;
  loading?: boolean;
  disabledReason?: string;
  loadingLabel?: string;
} & ButtonHTMLAttributes<HTMLButtonElement>;

export function Button({
  variant = "primary",
  loading = false,
  disabledReason,
  loadingLabel,
  disabled,
  onClick,
  className = "",
  children,
  type = "button",
  ...rest
}: Props) {
  const t = useTranslations("Button");
  const reasonId = useId();
  const hasReason = Boolean(disabledReason);
  const inactive = hasReason || Boolean(disabled);
  const describedBy =
    [rest["aria-describedby"], hasReason ? reasonId : undefined].filter(Boolean).join(" ") ||
    undefined;
  const blocked = inactive || loading;

  const button = (
    <button
      {...rest}
      type={type}
      // Stays focusable with a reason so keyboard users can discover it
      disabled={disabled}
      aria-disabled={hasReason || loading ? true : undefined}
      aria-busy={loading ? true : undefined}
      aria-describedby={describedBy}
      onClick={(e) => {
        if (blocked) {
          e.preventDefault();
          return;
        }
        onClick?.(e);
      }}
      className={`${buttonClass(variant, inactive)} ${className}`}
    >
      {/* The spinner sits in the left padding so the label stays visible and the width does not change */}
      {loading ? (
        <span
          aria-hidden="true"
          className="absolute left-2 size-4 rounded-full border-2 border-current border-t-transparent motion-safe:animate-spin"
        />
      ) : null}
      <span>{children}</span>
    </button>
  );

  // Same tree shape in every state so the button is never remounted (focus is kept)
  return (
    <span className="inline-flex items-center gap-3">
      {button}
      {/* Persistent region: only text changes get announced */}
      <span className="sr-only" aria-live="polite">
        {loading ? (loadingLabel ?? t("loading")) : ""}
      </span>
      {hasReason ? (
        <span id={reasonId} className="text-label text-muted">
          {disabledReason}
        </span>
      ) : null}
    </span>
  );
}
