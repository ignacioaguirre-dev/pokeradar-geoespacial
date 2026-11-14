"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Notice } from "@/components/ui/notice";

export function Notices() {
  const t = useTranslations("System.notice");
  const [attempts, setAttempts] = useState(0);
  return (
    <div className="flex flex-col gap-3">
      <Notice variant="info" title={t("infoTitle")}>
        {t("infoBody")}
      </Notice>
      <Notice variant="success" title={t("successTitle")} />
      <Notice
        variant="error"
        title={t("errorTitle")}
        action={{ label: t("retry"), onActivate: () => setAttempts((n) => n + 1) }}
      >
        {t("errorBody", { attempts })}
      </Notice>
    </div>
  );
}
