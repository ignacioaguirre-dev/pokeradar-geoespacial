import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { NoticeFrame } from "@/components/ui/notice-frame";
import { BackToMapLink } from "./_components/back-to-map-link";
import { ErrorScreen } from "./_components/error-screen";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("NotFound");
  // No robots entry: Next already adds noindex to every not-found response, and a second tag would duplicate it
  return { title: t("metaTitle") };
}

// Next's own 404 is in English and has no way back
export default function NotFound() {
  const t = useTranslations("NotFound");
  const tHome = useTranslations("Home");
  return (
    <ErrorScreen heading={tHome("heading")}>
      <NoticeFrame variant="error" title={t("title")}>
        <p>{t("body")}</p>
        <div className="mt-3">
          <BackToMapLink label={t("backToMap")} />
        </div>
      </NoticeFrame>
    </ErrorScreen>
  );
}
