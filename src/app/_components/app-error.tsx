"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { BackToMapLink } from "./back-to-map-link";
import { ErrorScreen } from "./error-screen";

// What error.tsx and global-error.tsx show instead of Next's generic English page
export function AppError({ onRetry }: { onRetry(): void }) {
  const t = useTranslations("AppError");
  const tHome = useTranslations("Home");
  return (
    <ErrorScreen heading={tHome("heading")}>
      <Notice variant="error" title={t("title")}>
        <p>{t("body")}</p>
        <div className="mt-3 flex flex-wrap gap-3">
          <Button onClick={onRetry}>{t("retry")}</Button>
          <BackToMapLink label={t("backToMap")} />
        </div>
      </Notice>
    </ErrorScreen>
  );
}
