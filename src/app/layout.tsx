import type { Metadata, Viewport } from "next";
import { Archivo, Chivo, Chivo_Mono } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import { ConnectionStatus } from "@/components/connection-status/connection-status";
import "./globals.css";

// Width axis gives the condensed display cut without a second family
const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  axes: ["wdth"],
  display: "swap",
  preload: true,
});

const chivo = Chivo({
  variable: "--font-chivo",
  subsets: ["latin"],
  display: "swap",
  preload: false,
});

const chivoMono = Chivo_Mono({
  variable: "--font-chivo-mono",
  subsets: ["latin"],
  display: "swap",
  preload: false,
});

// Lets the map reach under the notch; safe-area insets keep the UI clear of it
export const viewport: Viewport = { viewportFit: "cover" };

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Metadata");
  return { title: t("title") };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const locale = await getLocale();
  const messages = await getMessages();
  return (
    <html
      lang={locale}
      className={`${archivo.variable} ${chivo.variable} ${chivoMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground font-sans">
        {/* Only namespaces read by shared client primitives ship to the browser; pages add their own */}
        <NextIntlClientProvider messages={{ Button: messages.Button, Connection: messages.Connection }}>
          {children}
          {/* Once for every page, outside the pages' own providers, so it reads the layout's messages */}
          <ConnectionStatus />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
