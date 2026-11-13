import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { EnergyBar } from "@/components/ui/energy-bar";
import { Button } from "@/components/ui/button";
import { Quantity } from "@/components/ui/quantity";
import { Tag } from "@/components/ui/tag";
import { Colors } from "./_components/colors";
import { Notices } from "./_components/notices";
import { DURATIONS, TYPE_SCALE } from "./_components/tokens";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("System");
  return {
    title: t("metaTitle"),
    robots: { index: false, follow: false },
  };
}

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-4 border-t border-structure pt-6">
      <h2
        id={id}
        className="font-display font-stretch-condensed text-title font-bold uppercase tracking-tight"
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-label text-muted">{title}</h3>
      <div className="flex flex-wrap items-center gap-4">{children}</div>
    </div>
  );
}

export default async function SystemPage() {
  const t = await getTranslations("System");
  const messages = await getMessages();
  return (
    // Only this page's client pieces need the System namespace in the browser
    <NextIntlClientProvider messages={{ Button: messages.Button, System: messages.System }}>
      <main className="mx-auto flex w-full max-w-4xl flex-col gap-10 px-4 py-10">
        <header className="flex flex-col gap-2">
          <h1 className="font-display font-stretch-condensed text-headline font-bold uppercase tracking-tight">
            {t("heading")}
          </h1>
          <p className="text-muted">{t("intro")}</p>
        </header>

        <Section id="system-colors" title={t("sections.colors")}>
          <Colors />
        </Section>

        <Section id="system-typography" title={t("sections.typography")}>
          <dl className="flex flex-col gap-3">
            {TYPE_SCALE.map((step) => (
              <div key={step.name} className="flex flex-col gap-1">
                <dt className="text-label text-muted">
                  <code className="font-mono">{step.name}</code> · {t(`typography.sizes.${step.name}`)} ·{" "}
                  {step.family ?? t("typography.condensed")}
                </dt>
                <dd className={step.className}>{t("typography.sample")}</dd>
              </div>
            ))}
          </dl>
          <p className="text-body">
            {t("typography.figures")} <Quantity value={1234567.89} decimals={2} />
          </p>
        </Section>

        <Section id="system-motion" title={t("sections.motion")}>
          <dl className="flex flex-col gap-2">
            {DURATIONS.map((d) => (
              <div key={d.name} className="flex gap-4">
                <dt className="w-48 text-label text-muted">
                  <code className="font-mono">{d.name}</code>
                </dt>
                <dd>
                  <Quantity value={d.ms} unit="ms" />
                </dd>
              </div>
            ))}
          </dl>
          <p className="text-muted">{t("motion.reduced")}</p>
        </Section>

        <Section id="system-button" title={t("sections.button")}>
          <Group title={t("button.primary")}>
            <Button>{t("button.save")}</Button>
            <Button disabledReason={t("button.missingVertices")}>{t("button.createFence")}</Button>
            <Button loading>{t("button.searching")}</Button>
          </Group>
          <Group title={t("button.secondary")}>
            <Button variant="secondary">{t("button.cancel")}</Button>
            <Button variant="secondary" disabledReason={t("button.pickZoneFirst")}>
              {t("button.export")}
            </Button>
            <Button variant="secondary" loading>
              {t("button.loading")}
            </Button>
          </Group>
        </Section>

        <Section id="system-tag" title={t("sections.tag")}>
          <div className="flex flex-wrap gap-6">
            <Tag variant="habitat">{t("tag.forest")}</Tag>
            <Tag variant="condition">{t("tag.rain")}</Tag>
            <Tag variant="neutral">{t("tag.noData")}</Tag>
          </div>
        </Section>

        <Section id="system-energy-bar" title={t("sections.energyBar")}>
          <div className="flex max-w-sm flex-col gap-4">
            <EnergyBar label={t("energyBar.low")} value={25} max={255} />
            <EnergyBar label={t("energyBar.medium")} value={128} max={255} />
            <EnergyBar label={t("energyBar.max")} value={255} max={255} />
          </div>
        </Section>

        <Section id="system-quantity" title={t("sections.quantity")}>
          <div className="flex flex-wrap gap-6 text-subtitle">
            <Quantity value={84} />
            <Quantity value={1234.5} decimals={1} />
            <Quantity value={1234.5} decimals={1} unit="km²" />
          </div>
        </Section>

        <Section id="system-notice" title={t("sections.notice")}>
          <Notices />
        </Section>
      </main>
    </NextIntlClientProvider>
  );
}
