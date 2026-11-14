"use client";

import { NextIntlClientProvider } from "next-intl";
import messages from "../../../messages/es-AR.json";
import { AppError } from "./app-error";

// Brings its own translations: the root layout's are gone when global-error shows, and error.tsx
// keeps them out of every page's payload this way
export default function ErrorContent({ onRetry, ownsDocument = false }: { onRetry(): void; ownsDocument?: boolean }) {
  return (
    <NextIntlClientProvider
      locale="es-AR"
      messages={{ AppError: messages.AppError, Home: messages.Home, Button: messages.Button }}
    >
      {/* Only when the layout's metadata is gone; React hoists it to the head */}
      {ownsDocument ? <title>{messages.Metadata.title}</title> : null}
      <AppError onRetry={onRetry} />
    </NextIntlClientProvider>
  );
}
