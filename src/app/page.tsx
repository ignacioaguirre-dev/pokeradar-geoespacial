import { getTranslations } from "next-intl/server";

export default async function Home() {
  const t = await getTranslations("Home");
  return (
    <main className="flex flex-1 items-center justify-center">
      <h1 className="font-display font-stretch-condensed text-cabecera font-bold uppercase tracking-tight">
        {t("heading")}
      </h1>
    </main>
  );
}
