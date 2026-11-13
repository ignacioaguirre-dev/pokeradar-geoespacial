"use client";

import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { Quantity } from "@/components/ui/quantity";
import type { ColorUsage } from "@/domain/color/usage";
import { contrastOnBackground, TOKENS, usageOf, type Contrast, type Token } from "./tokens";
import { useTokenValue } from "./use-token-value";

// One list for every width: stacked blocks on phones, aligned columns from lg up
const COLUMNS =
  "lg:grid lg:grid-cols-[8rem_minmax(0,1fr)_5.5rem_6rem_9.5rem_6.5rem] lg:items-center lg:gap-x-3";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline gap-2">
      {/* Labels only show when stacked; the header row names the columns from lg up */}
      <dt className="w-24 shrink-0 text-label text-muted lg:sr-only">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function UsageLabel({ usage }: { usage: ColorUsage }) {
  const t = useTranslations("System.colors.usage");
  const kind = t(usage.kind);
  return usage.minimum === null ? kind : t("withMinimum", { usage: kind, minimum: usage.minimum });
}

function Result({ contrast }: { contrast: Contrast }) {
  const t = useTranslations("System.colors.result");
  if (contrast.kind === "measured" && contrast.meets !== null) {
    return contrast.meets ? t("pass") : t("fail");
  }
  return contrast.kind === "pending" ? " " : t("noMinimum");
}

function Row({ token }: { token: Token }) {
  const t = useTranslations("System.colors");
  const value = useTokenValue(token.name);
  const background = useTokenValue("background");
  const contrast = contrastOnBackground(token.name, value, background);
  return (
    <li className="flex items-start gap-3 border-t border-structure py-3 lg:items-center">
      <span
        aria-hidden="true"
        className={`block size-8 shrink-0 rounded-control border border-structure ${token.swatch}`}
      />
      <dl className={`flex min-w-0 flex-1 flex-col gap-1 text-body ${COLUMNS}`}>
        <Field label={t("columns.token")}>
          <code className="font-mono">{token.name}</code>
        </Field>
        <Field label={t("columns.origin")}>
          <span className="text-muted">{t(`origins.${token.name}`)}</span>
        </Field>
        <Field label={t("columns.value")}>
          {/* Fixed width so values appearing after hydration never shift the layout */}
          <code className="inline-block min-w-[8ch] font-mono tabular-nums">
            {contrast.kind === "pending" ? " " : value}
          </code>
        </Field>
        <Field label={t("columns.contrast")}>
          <span className="inline-block min-w-[9ch] whitespace-nowrap">
            {contrast.kind === "measured" ? (
              <Quantity value={contrast.ratio} decimals={2} unit=": 1" />
            ) : contrast.kind === "base" ? (
              "—"
            ) : (
              " "
            )}
          </span>
        </Field>
        <Field label={t("columns.usage")}>
          <UsageLabel usage={usageOf(token.name)} />
        </Field>
        <Field label={t("columns.result")}>
          <span className="inline-block min-w-[9ch] whitespace-nowrap">
            <Result contrast={contrast} />
          </span>
        </Field>
      </dl>
    </li>
  );
}

export function Colors() {
  const t = useTranslations("System.colors");
  return (
    <div className="flex flex-col">
      <p className="text-label text-muted">{t("intro")}</p>
      {/* Visual column names; the rows already carry them for assistive tech */}
      <div aria-hidden="true" className={`hidden pl-11 pt-4 pb-2 text-label text-muted ${COLUMNS}`}>
        <span>{t("columns.token")}</span>
        <span>{t("columns.origin")}</span>
        <span>{t("columns.value")}</span>
        <span>{t("columns.contrast")}</span>
        <span>{t("columns.usage")}</span>
        <span>{t("columns.result")}</span>
      </div>
      <ul className="mt-3 lg:mt-0">
        {TOKENS.map((token) => (
          <Row key={token.name} token={token} />
        ))}
      </ul>
    </div>
  );
}
